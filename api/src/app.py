import os
import json
import uuid
import hashlib
import time
import psycopg2
import psycopg2.extras
from flask import Flask, jsonify, request
from .parsing.normalization import normalize_tokens
from .parsing.alias_loader import load_aliases, AliasIndex
from typing import Any
try:
  from .parsing.prompts import EXTRACTION_PROMPTS  # type: ignore
except Exception:
  # Fallback for tests that don't need parse endpoint
  EXTRACTION_PROMPTS = {}
from .config.feature_flags import FLAGS
from .metrics import inc, snapshot as metrics_snapshot


ALIAS_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'aliases.json')
_ALIASES: AliasIndex | None = None
_ALIASES_ETAG: str | None = None

# Lazy-initialized LangExtract parser
_PARSER: Any | None = None


def _update_etag():
  global _ALIASES_ETAG
  try:
    with open(ALIAS_PATH, 'rb') as f:
      data = f.read()
    _ALIASES_ETAG = hashlib.md5(data).hexdigest()
  except Exception:
    _ALIASES_ETAG = None


def _ensure_aliases():
  global _ALIASES
  if _ALIASES is None and os.getenv('FLAG_ALIAS_LOADER', 'on') != 'off':
    try:
      _ALIASES = load_aliases(ALIAS_PATH)
      _update_etag()
    except Exception:
      _ALIASES = None


def create_app() -> Flask:
  app = Flask(__name__)

  @app.get('/api/health')
  def health():
    return jsonify({
      'status': 'ok',
      'traceId': str(uuid.uuid4()),
      'flags': {
        'FLAG_ALIAS_LOADER': os.getenv('FLAG_ALIAS_LOADER', 'on'),
        'FLAG_PARSE_ENGINE': os.getenv('FLAG_PARSE_ENGINE', 'on'),
        'FLAG_DATA_VALIDATION': os.getenv('FLAG_DATA_VALIDATION', 'off'),  # Data validation (Pandera/GE) feature flag
        'ENABLE_VISION': FLAGS.ENABLE_VISION,
        'ENABLE_VIDEO': FLAGS.ENABLE_VIDEO,
        'ENABLE_EMBEDDINGS': FLAGS.ENABLE_EMBEDDINGS,
      },
    })

  @app.post('/api/normalize')
  def normalize():
    payload = request.get_json(silent=True) or {}
    text = (payload.get('text') or '').strip()
    tokens = payload.get('tokens') or []
    result = normalize_tokens(text=text, tokens=tokens)
    _ensure_aliases()
    # Build alias matches with lineage
    alias_hits = []
    inc('normalize_calls_total')
    if _ALIASES is not None:
      for original, variants in result.items():
        for v in variants:
          hit = _ALIASES.lookup(v)
          if hit:
            domain, canonical, payload = hit
            alias_hits.append({
              'original': original,
              'variant': v,
              'domain': domain,
              'canonical': canonical,
              'confidence': payload.get('confidence', 1.0),
              'source': payload.get('source', 'manual'),
            })
    if alias_hits:
      inc('alias_hits_total', by=len(alias_hits))
    else:
      inc('alias_misses_total')
    return jsonify({
      'traceId': str(uuid.uuid4()),
      'input': {'text': text, 'tokens': tokens},
      'normalized': result,
      'aliasesVersion': getattr(_ALIASES, 'version', None),
      'aliases': alias_hits,
    })

  @app.get('/api/aliases')
  def get_aliases():
    _ensure_aliases()
    if _ALIASES is None:
      resp = jsonify({'version': None, 'aliases': {}})
    else:
      resp = jsonify({'version': _ALIASES.version, 'tags': _ALIASES.tags, 'locations': _ALIASES.locations})
    if _ALIASES_ETAG:
      resp.headers['ETag'] = _ALIASES_ETAG
    return resp

  @app.post('/api/aliases/reload')
  def reload_aliases():
    if os.getenv('FLAG_ALIAS_LOADER', 'on') == 'off':
      return jsonify({'reloaded': False, 'disabled': True}), 400
    try:
      global _ALIASES
      _ALIASES = load_aliases(ALIAS_PATH)
      _update_etag()
      return jsonify({'reloaded': True, 'version': _ALIASES.version, 'updatedAt': int(time.time()), 'traceId': str(uuid.uuid4())})
    except Exception as e:
      return jsonify({'reloaded': False, 'error': str(e)}), 500

  @app.post('/api/normalize/batch')
  def normalize_batch():
    payload = request.get_json(silent=True) or {}
    items = payload.get('items') or []
    out = []
    for it in items:
      text = (it.get('text') or '').strip()
      tokens = it.get('tokens') or []
      normalized = normalize_tokens(text=text, tokens=tokens)
      inc('normalize_calls_total')
      out.append({'traceId': str(uuid.uuid4()), 'input': {'text': text, 'tokens': tokens}, 'normalized': normalized})
    return jsonify({'items': out})

  @app.post('/api/parse')
  def parse_endpoint():
    if os.getenv('FLAG_PARSE_ENGINE', 'on') == 'off':
      return jsonify({'disabled': True, 'flag': 'FLAG_PARSE_ENGINE', 'traceId': str(uuid.uuid4())}), 503

    payload = request.get_json(silent=True) or {}
    text = (payload.get('text') or '').strip()
    entity = (payload.get('entity') or '').strip()

    if not text:
      return jsonify({'error': 'text is required', 'fields': ['text'], 'traceId': str(uuid.uuid4())}), 400

    if entity not in EXTRACTION_PROMPTS:
      return jsonify({'error': 'invalid entity', 'allowedEntities': list(EXTRACTION_PROMPTS.keys()), 'traceId': str(uuid.uuid4())}), 400

    global _PARSER
    if _PARSER is None:
      # Lazy import to avoid heavy deps during unrelated tests
      from .parsing.parser import LangExtractParser  # type: ignore
      _PARSER = LangExtractParser()

    result = _PARSER.parse(text, entity)
    return jsonify({'traceId': str(uuid.uuid4()), 'text': text, 'entity': entity, 'result': result})

  @app.get('/api/metrics')
  def metrics():
    return jsonify(metrics_snapshot())

  # --- Tags APIs ---
  def _db():
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
      raise RuntimeError('DATABASE_URL not configured')
    return psycopg2.connect(database_url)

  def _slugify(label: str) -> str:
    s = label.strip()
    s = s.replace(' ', '-').replace('/', '-').replace('\n', '-')
    return hashlib.md5(s.encode('utf-8')).hexdigest()[:10] + '-' + s

  @app.get('/api/tags')
  def list_tags():
    q = (request.args.get('query') or '').strip()
    try:
      conn = _db()
      cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
      if q:
        cur.execute("""
          SELECT id, slug, label_hi, label_en, status
          FROM tags
          WHERE label_hi ILIKE %s OR label_en ILIKE %s
          ORDER BY label_hi ASC
          LIMIT 100
        """, (f'%{q}%', f'%{q}%'))
      else:
        cur.execute("""
          SELECT id, slug, label_hi, label_en, status
          FROM tags
          WHERE status IN ('active','proposed')
          ORDER BY label_hi ASC
          LIMIT 200
        """)
      rows = cur.fetchall()
      cur.close(); conn.close()
      return jsonify({'success': True, 'tags': rows})
    except Exception as e:
      return jsonify({'success': False, 'error': str(e)}), 500

  @app.post('/api/tags')
  def create_tag():
    data = request.get_json(silent=True) or {}
    label_hi = (data.get('label_hi') or '').strip()
    label_en = (data.get('label_en') or '').strip() or None
    status = (data.get('status') or 'proposed').strip()
    if not label_hi:
      return jsonify({'success': False, 'error': 'label_hi required'}), 400
    try:
      conn = _db(); cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
      # Check existing
      cur.execute("SELECT id, slug FROM tags WHERE label_hi = %s", (label_hi,))
      row = cur.fetchone()
      if row:
        tag_id = row['id']
      else:
        cur.execute(
          "INSERT INTO tags (slug, label_hi, label_en, status) VALUES (%s,%s,%s,%s) RETURNING id, slug",
          (_slugify(label_hi), label_hi, label_en, status)
        )
        row = cur.fetchone(); tag_id = row['id']
      conn.commit(); cur.close(); conn.close()
      return jsonify({'success': True, 'id': tag_id})
    except Exception as e:
      return jsonify({'success': False, 'error': str(e)}), 500

  @app.post('/api/tweets/<tweet_id>/tags')
  def attach_tags(tweet_id: str):
    data = request.get_json(silent=True) or {}
    tag_ids = data.get('tag_ids') or []
    labels = data.get('labels') or []
    source = (data.get('source') or 'human')
    try:
      conn = _db(); cur = conn.cursor()
      # Create any labels that do not exist
      for label in labels:
        cur.execute("SELECT id FROM tags WHERE label_hi = %s", (label,))
        row = cur.fetchone()
        if row is None:
          cur.execute("INSERT INTO tags (slug, label_hi, status) VALUES (%s,%s,'proposed') RETURNING id",
                      (_slugify(label), label))
          tag_id = cur.fetchone()[0]
          tag_ids.append(tag_id)
        else:
          tag_ids.append(row[0])
      # Upsert into tweet_tags
      for tid in set(tag_ids):
        cur.execute(
          """
          INSERT INTO tweet_tags (tweet_id, tag_id, source)
          VALUES (%s,%s,%s)
          ON CONFLICT (tweet_id, tag_id) DO UPDATE SET source = EXCLUDED.source
          """,
          (str(tweet_id), int(tid), source)
        )
      conn.commit(); cur.close(); conn.close()
      return jsonify({'success': True})
    except Exception as e:
      return jsonify({'success': False, 'error': str(e)}), 500

  @app.get('/api/tweets/<tweet_id>/tags')
  def get_tweet_tags(tweet_id: str):
    """Return attached tags and parser-suggested topics for a tweet."""
    try:
      conn = _db()
      cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
      # Get tweet text and attached tags
      cur.execute(
        """
        SELECT rt.text AS tweet_text
        FROM raw_tweets rt
        LEFT JOIN tweet_tags tt ON tt.tweet_id = rt.tweet_id
        WHERE rt.tweet_id = %s
        LIMIT 1
        """,
        (str(tweet_id),)
      )
      row = cur.fetchone()
      tweet_text = (row or {}).get('tweet_text', '')

      # Load tag vocabulary and aliases
      cur2 = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
      cur2.execute(
        """
        SELECT t.label_hi, a.alias
        FROM tags t
        LEFT JOIN tag_aliases a ON a.tag_id = t.id
        WHERE t.status IN ('active','proposed')
        """
      )
      rows = cur2.fetchall()
      cur2.close()

      labels: dict[str, list[str]] = {}
      for r in rows:
        lab = r.get('label_hi')
        alias = r.get('alias')
        labels.setdefault(lab, [])
        if alias:
          labels[lab].append(alias)

      # Use EnhancedParser topic extraction on-the-fly
      from .parsing.enhanced_parser import EnhancedParser  # local import to avoid heavy deps elsewhere
      p = EnhancedParser()
      p.set_topics(list(labels.keys()), labels)
      suggested = p._extract_topics(tweet_text)

      cur.close(); conn.close()
      return jsonify({'success': True, 'attached': [], 'suggested': suggested})
    except Exception as e:
      return jsonify({'success': False, 'error': str(e)}), 500

  @app.get('/api/parsed-events')
  def get_parsed_events():
    """
    Get parsed events for human review.
    
    Query params:
    - status: pending/approved/rejected/edited (default: all)
    - needs_review: true/false (default: all)
    - limit: number of results (default: 50)
    """
    try:
      # Get query parameters
      status = request.args.get('status')
      needs_review = request.args.get('needs_review')
      limit = int(request.args.get('limit', 50))
      
      # Connect to database
      database_url = os.getenv('DATABASE_URL')
      if not database_url:
        return jsonify({'error': 'DATABASE_URL not configured'}), 500
      
      conn = psycopg2.connect(database_url)
      cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
      
      # Build query
      query = """
        SELECT 
          pe.id,
          pe.tweet_id,
          rt.text as tweet_text,
          rt.created_at as tweet_created_at,
          pe.event_type,
          pe.event_type_confidence,
          pe.event_date,
          pe.date_confidence,
          pe.locations,
          pe.people_mentioned,
          pe.organizations,
          pe.schemes_mentioned,
          pe.overall_confidence,
          pe.needs_review,
          pe.review_status,
          pe.reviewed_at,
          pe.reviewed_by,
          pe.parsed_at,
          pe.parsed_by
        FROM parsed_events pe
        JOIN raw_tweets rt ON pe.tweet_id = rt.tweet_id
        WHERE 1=1
      """
      params = []
      
      if status:
        query += " AND pe.review_status = %s"
        params.append(status)
      
      if needs_review == 'true':
        query += " AND pe.needs_review = true"
      elif needs_review == 'false':
        query += " AND pe.needs_review = false"
      
      query += " ORDER BY rt.created_at DESC LIMIT %s"
      params.append(limit)
      
      cur.execute(query, params)
      events = cur.fetchall()
      
      cur.close()
      conn.close()
      
      return jsonify({
        'success': True,
        'count': len(events),
        'events': events
      })
      
    except Exception as e:
      return jsonify({'error': str(e)}), 500

  @app.put('/api/parsed-events/<int:event_id>')
  def update_parsed_event(event_id):
    """
    Update a parsed event (for human review corrections).
    
    Body: JSON with fields to update
    """
    try:
      data = request.get_json()
      
      # Connect to database
      database_url = os.getenv('DATABASE_URL')
      if not database_url:
        return jsonify({'error': 'DATABASE_URL not configured'}), 500
      
      conn = psycopg2.connect(database_url)
      cur = conn.cursor()
      
      # Build update query
      update_fields = []
      params = []
      
      if 'event_type' in data:
        update_fields.append('event_type = %s')
        params.append(data['event_type'])
      
      if 'event_date' in data:
        update_fields.append('event_date = %s')
        params.append(data['event_date'])
      
      if 'locations' in data:
        update_fields.append('locations = %s')
        params.append(psycopg2.extras.Json(data['locations']))
      
      if 'people_mentioned' in data:
        update_fields.append('people_mentioned = %s')
        params.append(data['people_mentioned'])
      
      if 'organizations' in data:
        update_fields.append('organizations = %s')
        params.append(data['organizations'])
      
      if 'schemes_mentioned' in data:
        update_fields.append('schemes_mentioned = %s')
        params.append(data['schemes_mentioned'])
      
      if not update_fields:
        return jsonify({'error': 'No fields to update'}), 400
      
      # Add review metadata
      update_fields.append('review_status = %s')
      params.append('edited')
      
      update_fields.append('reviewed_at = NOW()')
      
      if 'reviewed_by' in data:
        update_fields.append('reviewed_by = %s')
        params.append(data['reviewed_by'])
      
      params.append(event_id)
      
      query = f"""
        UPDATE parsed_events
        SET {', '.join(update_fields)}
        WHERE id = %s
      """
      
      cur.execute(query, params)
      conn.commit()
      
      cur.close()
      conn.close()
      
      return jsonify({'success': True, 'message': 'Event updated'})
      
    except Exception as e:
      return jsonify({'error': str(e)}), 500

  @app.post('/api/parsed-events/<int:event_id>/approve')
  def approve_parsed_event(event_id):
    """Approve a parsed event."""
    try:
      data = request.get_json() or {}
      reviewed_by = data.get('reviewed_by', 'user')
      
      database_url = os.getenv('DATABASE_URL')
      if not database_url:
        return jsonify({'error': 'DATABASE_URL not configured'}), 500
      
      conn = psycopg2.connect(database_url)
      cur = conn.cursor()
      
      cur.execute("""
        UPDATE parsed_events
        SET review_status = 'approved',
            reviewed_at = NOW(),
            reviewed_by = %s
        WHERE id = %s
      """, (reviewed_by, event_id))
      
      conn.commit()
      cur.close()
      conn.close()
      
      return jsonify({'success': True, 'message': 'Event approved'})
      
    except Exception as e:
      return jsonify({'error': str(e)}), 500

  @app.post('/api/parsed-events/<int:event_id>/reject')
  def reject_parsed_event(event_id):
    """Reject a parsed event."""
    try:
      data = request.get_json() or {}
      reviewed_by = data.get('reviewed_by', 'user')
      
      database_url = os.getenv('DATABASE_URL')
      if not database_url:
        return jsonify({'error': 'DATABASE_URL not configured'}), 500
      
      conn = psycopg2.connect(database_url)
      cur = conn.cursor()
      
      cur.execute("""
        UPDATE parsed_events
        SET review_status = 'rejected',
            reviewed_at = NOW(),
            reviewed_by = %s
        WHERE id = %s
      """, (reviewed_by, event_id))
      
      conn.commit()
      cur.close()
      conn.close()
      
      return jsonify({'success': True, 'message': 'Event rejected'})
      
    except Exception as e:
      return jsonify({'error': str(e)}), 500

  return app


app = create_app()
