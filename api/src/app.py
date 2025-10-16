import os
import json
import uuid
import hashlib
import time
from flask import Flask, jsonify, request
from .parsing.normalization import normalize_tokens
from .parsing.alias_loader import load_aliases, AliasIndex
from .parsing.parser import LangExtractParser
from .parsing.prompts import EXTRACTION_PROMPTS
from .config.feature_flags import FLAGS
from .metrics import inc, snapshot as metrics_snapshot


ALIAS_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'aliases.json')
_ALIASES: AliasIndex | None = None
_ALIASES_ETAG: str | None = None

# Lazy-initialized LangExtract parser
_PARSER: LangExtractParser | None = None


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
      _PARSER = LangExtractParser()

    result = _PARSER.parse(text, entity)
    return jsonify({'traceId': str(uuid.uuid4()), 'text': text, 'entity': entity, 'result': result})

  @app.get('/api/metrics')
  def metrics():
    return jsonify(metrics_snapshot())
  return app


app = create_app()
