// backend/app.js
// Minimal, production-friendly stubs for Project Dhruv parse pipeline.
// Exposes: /api/health, /api/tweets/*, /api/parse/*
// Node ≥18 (built-in fetch). Use dotenv for local envs.

import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// ---------- Config ----------
const PORT = parseInt(process.env.PORT || '3001', 10);
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const INPUT_JSON = process.env.UNPARSED_SEED || path.join(DATA_DIR, 'input', 'unparsed.json'); // optional
const FAISS_STORE = process.env.FAISS_STORE || path.join(DATA_DIR, 'geography_embeddings_faiss.pkl');

// ---------- App ----------
const app = express();
app.use(express.json({ limit: '1mb' }));

// ---------- In-memory stores ----------
/**
 * tweetsStore: { id -> { tweet_id, text, ... } }
 * parsedStore: { id -> parsedPayload }
 */
const tweetsStore = new Map();
const parsedStore = new Map();

// Optional seed loader (best-effort)
(function seedUnparsed() {
  try {
    if (fs.existsSync(INPUT_JSON)) {
      const raw = fs.readFileSync(INPUT_JSON, 'utf8');
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        for (const t of arr) {
          const id = String(t.tweet_id || t.id || crypto.randomUUID());
          const text = String(t.text || '').trim();
          if (!text) continue;
          tweetsStore.set(id, { tweet_id: id, text, ...t });
        }
        console.log(`✅ Seeded ${tweetsStore.size} tweets from ${INPUT_JSON}`);
      }
    } else {
      // Create a tiny default set if no file exists
      const seed = [
        { tweet_id: 'T-1', text: 'आज रायपुर में विकास कार्यों की समीक्षा बैठक। PM-Kisan और आयुष्मान का लाभ चर्चा।' },
        { tweet_id: 'T-2', text: 'दुर्ग में लोकर्पण कार्यक्रम, योजनाएँ: उज्ज्वला, PM-Kisan.' },
        { tweet_id: 'T-3', text: 'रायगढ़ दौरा: जनसम्पर्क एवं बैठक; योजनाएँ — मुख्यमंत्रि युवा।' }
      ];
      for (const t of seed) tweetsStore.set(t.tweet_id, t);
      console.log(`ℹ️  Using built-in seed (${tweetsStore.size} tweets). Provide ${INPUT_JSON} to override.`);
    }
  } catch (e) {
    console.warn(`⚠️  Seed load failed (${e.message}). Starting with empty store.`);
  }
})();

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
app.get('/api/health', (_req, res) => {
  ok(res, {
    ok: true,
    service: 'dhruv-parse-stub',
    time: new Date().toISOString(),
    env: {
      GEMINI_API_KEY: GEMINI_API_KEY ? 'present' : 'absent',
      OLLAMA_BASE_URL,
      DATA_DIR,
      FAISS_STORE_EXISTS: fs.existsSync(FAISS_STORE)
    },
    counts: {
      totalTweets: tweetsStore.size,
      parsed: parsedStore.size,
      unparsed: [...tweetsStore.keys()].filter(id => !parsedStore.has(id)).length
    }
  });
});

// Unparsed fetch (supports ?start=&limit=&reparse=1)
app.get('/api/tweets/unparsed', (req, res) => {
  const start = parseInt(String(req.query.start ?? '0'), 10) || 0;
  const limit = parseInt(String(req.query.limit ?? '25'), 10) || 25;
  const reparse = String(req.query.reparse ?? '0') === '1';

  const all = [...tweetsStore.values()];
  const list = reparse
    ? all
    : all.filter(t => !parsedStore.has(String(t.tweet_id)));

  const slice = list.slice(start, start + limit);
  ok(res, slice);
});

// Store parsed result
app.post('/api/tweets/parsed/:id', (req, res) => {
  const id = String(req.params.id);
  const payload = req.body || {};
  if (!isValidParsed(payload)) {
    return bad(res, 400, 'Invalid parsed JSON shape');
  }
  parsedStore.set(id, { ...payload, stored_at: new Date().toISOString() });
  ok(res, { ok: true, id });
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