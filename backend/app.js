// backend/app.js
// Minimal, production-friendly stubs for Project Dhruv parse pipeline.
// Exposes: /api/health, /api/tweets/*, /api/parse/*
// Node ≥18 (built-in fetch). Use dotenv for local envs.

import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import pkg from 'pg';
const { Pool } = pkg;

// ---------- Config ----------
const PORT = parseInt(process.env.PORT || '3001', 10);
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const INPUT_JSON = process.env.UNPARSED_SEED || path.join(DATA_DIR, 'input', 'unparsed.json'); // optional
const FAISS_STORE = process.env.FAISS_STORE || path.join(DATA_DIR, 'geography_embeddings_faiss.pkl');
const DATABASE_URL = process.env.DATABASE_URL;

// ---------- Database Connection ----------
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Test database connection
pool.on('connect', () => console.log('✅ Connected to PostgreSQL database'));
pool.on('error', (err) => console.error('❌ Database connection error:', err));

// ---------- App ----------
const app = express();
app.use(express.json({ limit: '1mb' }));

// ---------- Helpers ----------
const ok = (res, data) => res.status(200).json(data);
const bad = (res, code, msg) => res.status(code).json({ error: msg });

function isValidParsed(obj) {
  if (!obj || typeof obj !== 'object') return false;
  const hasKeys = ['event_type', 'locations', 'schemes_mentioned'].every(k => k in obj);
  if (!hasKeys) return false;
  const typeOk = typeof obj.event_type === 'string' || obj.event_type == null;
  const locOk = Array.isArray(obj.locations) || obj.locations == null;
  const schOk = Array.isArray(obj.schemes_mentioned) || obj.schemes_mentioned == null;
  return typeOk && locOk && schOk;
}

function uniqNorm(arr = []) {
  return [...new Set((arr || []).map(x => String(x).trim()).filter(Boolean))];
}

// Simple Hindi/English heuristic extraction for local fallback
function heuristicParse(text = '') {
  const lower = text.toLowerCase();
  // event_type guess
  let event_type = null;
  if (/[क|क़]?बैठक|meeting/i.test(text)) event_type = 'बैठक';
  else if (/लोकर्पण|उद्घाटन|inauguration|lokarpan/i.test(text)) event_type = 'लोकर्पण';
  else if (/दौरा|tour|जनसम्पर्क|rally/i.test(text)) event_type = 'दौरा';
  // locations guess
  const locs = [];
  ['रायपुर','बिलासपुर','दुर्ग','रायगढ़','कोरबा','भिलाई','जांजगीर','महासमुंद','अंबिकापुर','धमतरी']
    .forEach(city => { if (text.includes(city)) locs.push(city); });
  // schemes guess
  const schemes = [];
  const schemeDict = [
    'PM-Kisan','PM Kisan','पीएम किसान','आयुष्मान','Ayushman','Ujjwala','उज्ज्वला',
    'मुख्यमंत्रि युवा','Mukhyamantri Yuva','PM Awas','प्रधानमन्त्री आवास'
  ];
  schemeDict.forEach(s => { if (text.includes(s) || lower.includes(s.toLowerCase())) schemes.push(s); });

  return {
    event_type,
    locations: uniqNorm(locs),
    schemes_mentioned: uniqNorm(schemes),
    overall_confidence: 0.6,
    needs_review: false,
    review_status: 'auto_accepted',
    reasoning: 'heuristic_fallback'
  };
}

// Attempt real Ollama JSON; fallback to heuristic
async function parseViaOllama(text) {
  try {
    const prompt = `
Parse the tweet text and return ONLY valid compact JSON:\n
{"event_type":string|null,"locations":string[],"schemes_mentioned":string[]}
Text: """${text}"""`;
    const res = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gemma2:2b', prompt, stream: false })
    });
    if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
    const data = await res.json();
    const raw = (data && (data.response || data.output || data.message || '')).trim();
    const jsonStr = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(jsonStr);
    if (!isValidParsed(parsed)) throw new Error('invalid shape from Ollama');
    return {
      ...parsed,
      overall_confidence: parsed.overall_confidence ?? 0.7,
      needs_review: false,
      review_status: 'auto_accepted',
      reasoning: 'ollama_direct'
    };
  } catch {
    return heuristicParse(text);
  }
}

// Attempt real Gemini via Google API? We avoid direct SDK to keep this stub self-contained.
// If GEMINI_API_KEY present and you have a proxy/middleware, plug it here.
// For now: deterministic heuristic + tiny variant so consensus has diversity.
async function parseViaGemini(text) {
  // Simple deterministic variant: prefer "बैठक" if both meeting & दौरा present.
  const h = heuristicParse(text);
  if (h.event_type === 'दौरा' && /बैठक|meeting/i.test(text)) h.event_type = 'बैठक';
  h.reasoning = 'gemini_stub_heuristic';
  h.overall_confidence = 0.72;
  return h;
}

// FAISS "semantic" stub: emphasize locations; prefer Lokarpan if present.
async function parseViaFaiss(text) {
  const h = heuristicParse(text);
  if (/लोकर्पण|उद्घाटन|inauguration/i.test(text)) h.event_type = 'लोकर्पण';
  h.reasoning = fs.existsSync(FAISS_STORE) ? 'faiss_semantic_stub' : 'faiss_missing_store_stub';
  h.overall_confidence = fs.existsSync(FAISS_STORE) ? 0.75 : 0.65;
  return h;
}

// ---------- Routes ----------

// Health
app.get('/api/health', async (_req, res) => {
  try {
    // Get database stats
    const rawTweetsResult = await pool.query('SELECT COUNT(*) as count FROM raw_tweets');
    const parsedEventsResult = await pool.query('SELECT COUNT(*) as count FROM parsed_events');
    const unparsedResult = await pool.query(`
      SELECT COUNT(*) as count FROM raw_tweets rt
      LEFT JOIN parsed_events pe ON rt.tweet_id = pe.tweet_id
      WHERE pe.tweet_id IS NULL
    `);

    const totalTweets = parseInt(rawTweetsResult.rows[0].count, 10);
    const parsed = parseInt(parsedEventsResult.rows[0].count, 10);
    const unparsed = parseInt(unparsedResult.rows[0].count, 10);

    ok(res, {
      ok: true,
      service: 'dhruv-parse-backend',
      time: new Date().toISOString(),
      database: {
        connected: true,
        totalTweets,
        parsed,
        unparsed
      },
      env: {
        GEMINI_API_KEY: GEMINI_API_KEY ? 'present' : 'absent',
        OLLAMA_BASE_URL,
        DATA_DIR,
        FAISS_STORE_EXISTS: fs.existsSync(FAISS_STORE)
      }
    });
  } catch (error) {
    console.error('❌ Health check database error:', error);
    bad(res, 500, `Database health check failed: ${error.message}`);
  }
});

// Unparsed fetch (supports ?start=&limit=&reparse=1)
app.get('/api/tweets/unparsed', async (req, res) => {
  const start = parseInt(String(req.query.start ?? '0'), 10) || 0;
  const limit = parseInt(String(req.query.limit ?? '25'), 10) || 25;
  const reparse = String(req.query.reparse ?? '0') === '1';

  try {
    let query;
    let params;

    if (reparse) {
      // Return all raw tweets for reparse
      query = `
        SELECT tweet_id, text, author_handle, created_at
        FROM raw_tweets
        ORDER BY created_at DESC
        LIMIT $1 OFFSET $2
      `;
      params = [limit, start];
    } else {
      // Return only unparsed tweets (no entry in parsed_events)
      query = `
        SELECT rt.tweet_id, rt.text, rt.author_handle, rt.created_at
        FROM raw_tweets rt
        LEFT JOIN parsed_events pe ON rt.tweet_id = pe.tweet_id
        WHERE pe.tweet_id IS NULL
        ORDER BY rt.created_at DESC
        LIMIT $1 OFFSET $2
      `;
      params = [limit, start];
    }

    const result = await pool.query(query, params);
    const tweets = result.rows.map(row => ({
      tweet_id: row.tweet_id,
      text: row.text,
      author_handle: row.author_handle,
      created_at: row.created_at
    }));

    console.log(`📋 Fetched ${tweets.length} ${reparse ? 'tweets for reparse' : 'unparsed tweets'} (offset: ${start}, limit: ${limit})`);
    ok(res, tweets);
  } catch (error) {
    console.error('❌ Database error fetching unparsed tweets:', error);
    bad(res, 500, `Database error: ${error.message}`);
  }
});

// Store parsed result
app.post('/api/tweets/parsed/:id', async (req, res) => {
  const tweetId = String(req.params.id);
  const payload = req.body || {};

  if (!isValidParsed(payload)) {
    return bad(res, 400, 'Invalid parsed JSON shape');
  }

  try {
    // Check if raw tweet exists
    const rawTweetCheck = await pool.query(
      'SELECT tweet_id FROM raw_tweets WHERE tweet_id = $1',
      [tweetId]
    );

    if (rawTweetCheck.rows.length === 0) {
      return bad(res, 404, `Raw tweet with ID ${tweetId} not found`);
    }

    // Insert parsed event
    const query = `
      INSERT INTO parsed_events (
        tweet_id, event_type, event_type_confidence, event_date, date_confidence,
        locations, people_mentioned, organizations, schemes_mentioned,
        overall_confidence, needs_review, review_status, parsed_by,
        consensus_data, consensus_summary, batch_id
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
      )
      ON CONFLICT (tweet_id) DO UPDATE SET
        event_type = EXCLUDED.event_type,
        event_type_confidence = EXCLUDED.event_type_confidence,
        event_date = EXCLUDED.event_date,
        date_confidence = EXCLUDED.date_confidence,
        locations = EXCLUDED.locations,
        people_mentioned = EXCLUDED.people_mentioned,
        organizations = EXCLUDED.organizations,
        schemes_mentioned = EXCLUDED.schemes_mentioned,
        overall_confidence = EXCLUDED.overall_confidence,
        needs_review = EXCLUDED.needs_review,
        review_status = EXCLUDED.review_status,
        parsed_at = now(),
        parsed_by = EXCLUDED.parsed_by,
        consensus_data = EXCLUDED.consensus_data,
        consensus_summary = EXCLUDED.consensus_summary,
        batch_id = EXCLUDED.batch_id
      RETURNING id
    `;

    const values = [
      tweetId,
      payload.event_type,
      payload.event_type_confidence || null,
      payload.event_date || null,
      payload.date_confidence || null,
      JSON.stringify(payload.locations || []),
      payload.people_mentioned || [],
      payload.organizations || [],
      payload.schemes_mentioned || [],
      payload.overall_confidence || 0.5,
      payload.needs_review || false,
      payload.review_status || 'pending',
      payload.parsed_by || 'backend-api',
      JSON.stringify(payload.consensus_data || {}),
      JSON.stringify(payload.consensus_summary || {}),
      payload.batch_id || null
    ];

    const result = await pool.query(query, values);
    console.log(`✅ Stored parsed event for tweet ${tweetId} (ID: ${result.rows[0].id})`);

    ok(res, { ok: true, id: result.rows[0].id, tweet_id: tweetId });
  } catch (error) {
    console.error('❌ Database error storing parsed event:', error);
    bad(res, 500, `Database error: ${error.message}`);
  }
});

// Parse endpoints
app.post('/api/parse/gemini', async (req, res) => {
  const text = String(req.body?.text || '').trim();
  if (!text) return bad(res, 400, 'Missing text');
  try {
    const parsed = await parseViaGemini(text);
    if (!isValidParsed(parsed)) throw new Error('invalid shape');
    ok(res, parsed);
  } catch (e) {
    bad(res, 500, `gemini_parse_failed: ${e.message}`);
  }
});

app.post('/api/parse/ollama', async (req, res) => {
  const text = String(req.body?.text || '').trim();
  if (!text) return bad(res, 400, 'Missing text');
  try {
    const parsed = await parseViaOllama(text);
    if (!isValidParsed(parsed)) throw new Error('invalid shape');
    ok(res, parsed);
  } catch (e) {
    bad(res, 500, `ollama_parse_failed: ${e.message}`);
  }
});

app.post('/api/parse/faiss', async (req, res) => {
  const text = String(req.body?.text || '').trim();
  if (!text) return bad(res, 400, 'Missing text');
  try {
    const parsed = await parseViaFaiss(text);
    if (!isValidParsed(parsed)) throw new Error('invalid shape');
    ok(res, parsed);
  } catch (e) {
    bad(res, 500, `faiss_parse_failed: ${e.message}`);
  }
});

// ---------- Start ----------
app.listen(PORT, () => {
  console.log(`✅ Stub server listening on http://127.0.0.1:${PORT}`);
});