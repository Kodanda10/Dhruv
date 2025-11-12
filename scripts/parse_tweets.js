#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Project Dhruv — Robust Tweet Parser CLI
 *
 * Features:
 * - Env sanity checks (API_BASE, optional OLLAMA_BASE_URL, GEMINI_API_KEY)
 * - --help, --dry, --batch, --start, --timeout, --retries, --reparse
 * - Preflight /api/health server check
 * - Fetch unparsed tweets in batches
 * - 3-layer parsing (Gemini/Ollama/FAISS) with consensus & JSON verification
 * - Partial-parse tolerance (configurable) vs fail-stop
 * - Deterministic backups to data/backups/parse_runs/<ts>/
 * - Clear exit codes and concise run summary
 */

import 'dotenv/config';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// ---------- CLI ARG PARSER (minimal, no deps) ----------
const args = process.argv.slice(2);
const getFlag = (name, def = false) =>
  args.some(a => a === `--${name}`) ? true :
  args.some(a => a === `--no-${name}`) ? false : def;

const getOpt = (name, def = undefined) => {
  const hit = args.find(a => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=').trim() : def;
};

const HELP = getFlag('help', false);
const DRY = getFlag('dry', false);
const BATCH = parseInt(getOpt('batch', '25'), 10);
const START = parseInt(getOpt('start', '0'), 10);
const TIMEOUT_MS = parseInt(getOpt('timeout', '15000'), 10);
const RETRIES = parseInt(getOpt('retries', '1'), 10);
const REPARSE = getFlag('reparse', false); // allow retry/parsing even if already parsed
const FAIL_STOP = getFlag('strict', true); // default: strict/fail-stop ON
const CONSENSUS = getFlag('consensus', true);
const REQUIRE_ALL = getFlag('require-all', true); // require all 3 layers by default
const PARTIAL_TOLERANCE = getFlag('partial-ok', false); // allow partial success to continue
const SAVE_INTERMEDIATE = getFlag('save-intermediate', true);

// ---------- PATHS & ENV ----------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_BASE = process.env.API_BASE;
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const FAISS_STORE = process.env.FAISS_STORE || path.join(process.cwd(), 'data', 'geography_embeddings_faiss.pkl');

const BACKUP_ROOT = path.join(process.cwd(), 'data', 'backups', 'parse_runs');
const RUN_TS = new Date().toISOString().replace(/[:.]/g, '-');
const RUN_DIR = path.join(BACKUP_ROOT, RUN_TS);

// ---------- HELP ----------
if (HELP) {
  console.log(`
Usage:
  node scripts/parse_tweets.js [--batch=N] [--start=N] [--dry]
                               [--timeout=ms] [--retries=N]
                               [--reparse] [--strict|--no-strict]
                               [--consensus|--no-consensus]
                               [--require-all|--no-require-all]
                               [--partial-ok] [--save-intermediate|--no-save-intermediate]
                               [--help]

Flags & Options:
  --help                  Show this help and exit.
  --dry                   Do not persist writes; print what would happen.
  --batch=N               Batch size (default 25).
  --start=N               Start offset (default 0).
  --timeout=ms            Per-request timeout (default 15000).
  --retries=N             Retries for transient failures (default 1).
  --reparse               Force re-parse even if marked parsed.
  --strict / --no-strict  Fail-stop on any record error (default: --strict).
  --consensus             Enforce 3-layer consensus (default: on).
  --require-all           Require all 3 layers present (default: on).
  --partial-ok            Tolerate partial layer success and continue.
  --save-intermediate     Write intermediate JSONL to backups (default: on).

Environment:
  API_BASE                (required) e.g. http://127.0.0.1:3001
  OLLAMA_BASE_URL         (optional) default http://127.0.0.1:11434
  GEMINI_API_KEY          (optional) enables Gemini parser
  FAISS_STORE             (optional) path to FAISS pkl (for existence check)

Examples:
  API_BASE=http://127.0.0.1:3001 node scripts/parse_tweets.js --batch=50 --start=0
  node scripts/parse_tweets.js --dry --batch=5 --start=0 --no-strict --partial-ok
`);
  process.exit(0);
}

// ---------- SMALL UTILS ----------
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function withTimeout(promise, ms, label = 'request') {
  let to;
  const timer = new Promise((_, rej) => (to = setTimeout(() => rej(new Error(`Timeout after ${ms}ms: ${label}`)), ms)));
  try {
    return await Promise.race([promise, timer]);
  } finally {
    clearTimeout(to);
  }
}

// Safe JSON shape check
function isValidParsed(obj) {
  if (!obj || typeof obj !== 'object') return false;
  // Minimal required shape for our pipeline:
  const keys = ['event_type', 'locations', 'schemes_mentioned'];
  return keys.every(k => k in obj) &&
    (typeof obj.event_type === 'string' || obj.event_type === null || obj.event_type === undefined) &&
    (Array.isArray(obj.locations) || obj.locations == null) &&
    (Array.isArray(obj.schemes_mentioned) || obj.schemes_mentioned == null);
}

function majorityVote(values = []) {
  const counts = new Map();
  for (const v of values) counts.set(v, (counts.get(v) || 0) + 1);
  let best = null, bestN = 0;
  for (const [k, n] of counts.entries()) if (n > bestN) { best = k; bestN = n; }
  return { value: best, count: bestN, total: values.length };
}

function arrayIntersect(a = [], b = []) {
  const setB = new Set(b);
  return [...new Set(a.filter(x => setB.has(x)))];
}

// ---------- STARTUP SANITY ----------
async function ensureDirs() {
  await fsp.mkdir(BACKUP_ROOT, { recursive: true });
  await fsp.mkdir(RUN_DIR, { recursive: true });
}

function banner() {
  console.log(`\n🚀 Parse Run — ${RUN_TS}
  API_BASE          : ${API_BASE || '(unset)'}
  OLLAMA_BASE_URL   : ${OLLAMA_BASE_URL}
  GEMINI_API_KEY    : ${GEMINI_API_KEY ? 'present' : 'absent'}
  FAISS_STORE       : ${FAISS_STORE}
  dry-run           : ${DRY}
  batch/start       : ${BATCH}/${START}
  strict(fail-stop) : ${FAIL_STOP}
  consensus         : ${CONSENSUS} (require_all=${REQUIRE_ALL})
  partial-ok        : ${PARTIAL_TOLERANCE}
  retries           : ${RETRIES}
  timeout(ms)       : ${TIMEOUT_MS}\n`);
}

function hardRequireEnv() {
  if (!API_BASE) {
    console.error('❌ API_BASE is not set. Example: API_BASE=http://127.0.0.1:3001');
    process.exit(2);
  }
}

async function healthCheck() {
  const url = `${API_BASE}/api/health`;
  try {
    const res = await withTimeout(fetch(url), TIMEOUT_MS, '/api/health');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json().catch(() => ({}));
    console.log(`✅ Server health OK via /api/health`);
    return true;
  } catch (e) {
    console.error(`❌ Server health check failed: ${e.message}`);
    if (FAIL_STOP) process.exit(3);
    return false;
  }
}

async function existenceChecks() {
  // Backup root must be writable
  try {
    await ensureDirs();
    await fsp.access(RUN_DIR, fs.constants.W_OK);
    console.log(`✅ Backup directory ready: ${RUN_DIR}`);
  } catch (e) {
    console.error(`❌ Backup directory not writable: ${RUN_DIR} (${e.message})`);
    if (FAIL_STOP) process.exit(4);
  }

  // FAISS file existence (best-effort)
  try {
    await fsp.access(FAISS_STORE, fs.constants.R_OK);
    console.log(`✅ FAISS store present: ${FAISS_STORE}`);
  } catch {
    console.warn(`⚠️  FAISS store not found at ${FAISS_STORE} (continuing)`);
    if (REQUIRE_ALL && CONSENSUS) {
      console.warn('   Because --require-all is ON, FAISS absence may cause consensus failure.');
    }
  }
}

// ---------- FETCH HELPERS ----------
async function getBatch(start, limit) {
  const url = `${API_BASE}/api/tweets/unparsed?start=${start}&limit=${limit}${REPARSE ? '&reparse=1' : ''}`;
  const res = await withTimeout(fetch(url), TIMEOUT_MS, 'getBatch');
  if (!res.ok) throw new Error(`Failed to fetch batch: HTTP ${res.status}`);
  return res.json();
}

async function postParsed(tweetId, payload) {
  if (DRY) return { ok: true, dry: true };
  const url = `${API_BASE}/api/tweets/parsed/${encodeURIComponent(tweetId)}`;
  const res = await withTimeout(fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }), TIMEOUT_MS, 'postParsed');
  if (!res.ok) throw new Error(`Failed to store parsed: HTTP ${res.status}`);
  return res.json();
}

// --- Parsers (3 layers) ---
async function parseWithGemini(text) {
  if (!GEMINI_API_KEY) throw new Error('Gemini key missing');
  // Your backend might expose a proxy endpoint. Prefer that if available:
  const url = `${API_BASE}/api/parse/gemini`;
  const res = await withTimeout(fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  }), TIMEOUT_MS, 'parse:gemini');
  if (!res.ok) throw new Error(`Gemini parse HTTP ${res.status}`);
  const obj = await res.json();
  if (!isValidParsed(obj)) throw new Error('Gemini returned invalid JSON shape');
  return { layer: 'gemini', parsed: obj };
}

async function parseWithOllama(text) {
  // Prefer your backend proxy first if exists:
  const url = `${API_BASE}/api/parse/ollama`;
  const res = await withTimeout(fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  }), TIMEOUT_MS, 'parse:ollama');
  if (!res.ok) throw new Error(`Ollama parse HTTP ${res.status}`);
  const obj = await res.json();
  if (!isValidParsed(obj)) throw new Error('Ollama returned invalid JSON shape');
  return { layer: 'ollama', parsed: obj };
}

async function parseWithFaiss(text) {
  // FAISS-driven heuristics via backend endpoint
  const url = `${API_BASE}/api/parse/faiss`;
  const res = await withTimeout(fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  }), TIMEOUT_MS, 'parse:faiss');
  if (!res.ok) throw new Error(`FAISS parse HTTP ${res.status}`);
  const obj = await res.json();
  if (!isValidParsed(obj)) throw new Error('FAISS returned invalid JSON shape');
  return { layer: 'faiss', parsed: obj };
}

// ---------- CONSENSUS ----------
function buildConsensus(results, tweetText) {
  const layers = results.map(r => r.layer);
  const valid = results.map(r => r.parsed);

  // event_type: majority vote over non-empty strings
  const types = valid.map(v => (v.event_type || '').trim()).filter(Boolean);
  const votedType = types.length ? majorityVote(types) : { value: null, count: 0, total: 0 };

  // locations: set-intersection across all present arrays, fallback to majority presence
  const locArrays = valid.map(v => Array.isArray(v.locations) ? v.locations.map(x => String(x).trim()) : []);
  let agreedLocs = locArrays.length ? locArrays.reduce((acc, arr) => acc == null ? arr : arrayIntersect(acc, arr), null) : [];
  if (!agreedLocs || agreedLocs.length === 0) {
    // fallback: items appearing in >=2 layers
    const count = new Map();
    for (const arr of locArrays) for (const it of arr) count.set(it, (count.get(it) || 0) + 1);
    agreedLocs = [...count.entries()].filter(([_, n]) => n >= 2).map(([k]) => k);
  }

  // schemes_mentioned: same as locations
  const schArrays = valid.map(v => Array.isArray(v.schemes_mentioned) ? v.schemes_mentioned.map(x => String(x).trim()) : []);
  let agreedSchemes = schArrays.length ? schArrays.reduce((acc, arr) => acc == null ? arr : arrayIntersect(acc, arr), null) : [];
  if (!agreedSchemes || agreedSchemes.length === 0) {
    const count = new Map();
    for (const arr of schArrays) for (const it of arr) count.set(it, (count.get(it) || 0) + 1);
    agreedSchemes = [...count.entries()].filter(([_, n]) => n >= 2).map(([k]) => k);
  }

  const layerCount = layers.length;
  const requireAll = REQUIRE_ALL;
  const hasAll = layerCount === 3;

  // Decide acceptability
  const hasTypeConsensus = votedType.count >= 2 || (layerCount === 1 && votedType.count === 1);
  const hasAtLeastOneSignal = hasTypeConsensus || (agreedLocs.length > 0) || (agreedSchemes.length > 0);

  const consensusOk = CONSENSUS
    ? (requireAll ? (hasAll && hasAtLeastOneSignal) : hasAtLeastOneSignal)
    : true;

  const merged = {
    event_type: votedType.value || valid.find(v => v.event_type)?.event_type || null,
    locations: agreedLocs,
    schemes_mentioned: agreedSchemes,
    overall_confidence: Math.min(1, 0.5 + (votedType.count / Math.max(1, votedType.total)) * 0.5),
    needs_review: !consensusOk,
    review_status: consensusOk ? 'approved' : 'pending',
    reasoning: `layers=${layers.join(',')}; typeVote=${JSON.stringify(votedType)}`
  };

  // Final JSON verification
  const jsonValid = isValidParsed(merged);
  return { consensusOk: consensusOk && jsonValid, merged, layers, votedType, jsonValid };
}

// ---------- BACKUP WRITERS ----------
async function writeJSONL(file, obj) {
  const line = JSON.stringify(obj) + '\n';
  await fsp.appendFile(file, line, 'utf8');
}

async function backupOne(kind, obj) {
  const file = path.join(RUN_DIR, `${kind}.jsonl`);
  await writeJSONL(file, obj);
}

// ---------- MAIN RUN ----------
async function run() {
  banner();
  hardRequireEnv();
  await existenceChecks();
  await healthCheck();

  const manifest = {
    startedAt: new Date().toISOString(),
    params: { DRY, BATCH, START, TIMEOUT_MS, RETRIES, REPARSE, FAIL_STOP, CONSENSUS, REQUIRE_ALL, PARTIAL_TOLERANCE, SAVE_INTERMEDIATE },
    env: { API_BASE, OLLAMA_BASE_URL, GEMINI_API_KEY: GEMINI_API_KEY ? 'present' : 'absent', FAISS_STORE }
  };
  await backupOne('manifest', manifest);

  let offset = START;
  let totalFetched = 0;
  let totalParsed = 0;
  let totalErrors = 0;
  let hardFailed = false;

  while (true) {
    let batch;
    try {
      batch = await getBatch(offset, BATCH);
      if (!Array.isArray(batch) || batch.length === 0) {
        console.log('✅ No more unparsed tweets.');
        break;
      }
    } catch (e) {
      console.error(`❌ fetch batch failed at offset=${offset}: ${e.message}`);
      await backupOne('errors', { at: 'getBatch', offset, error: e.message });
      if (FAIL_STOP) { hardFailed = true; break; }
      if (RETRIES > 0) { await sleep(500); continue; }
      break;
    }

    totalFetched += batch.length;

    for (const t of batch) {
      const tweetId = t.tweet_id || t.id || 'unknown';
      const tweetText = String(t.text || '').trim();

      if (!tweetText) {
        const msg = `Empty tweet text for ${tweetId}`;
        console.warn(`⚠️  ${msg}`);
        totalErrors++;
        await backupOne('errors', { tweetId, error: msg });
        if (FAIL_STOP) { hardFailed = true; break; }
        continue;
      }

      if (SAVE_INTERMEDIATE) await backupOne('input', { tweetId, tweetText, raw: t });

      // --- Try 3-layer parse with retries ---
      let results = [];
      let attempt = 0;

      const tryLayer = async (fn, label) => {
        try {
          return await fn(tweetText);
        } catch (e) {
          await backupOne('layer_errors', { tweetId, layer: label, error: e.message });
          throw e;
        }
      };

      while (attempt <= RETRIES) {
        results = [];
        try {
          if (CONSENSUS) {
            // Collect available layers; missing layers will throw unless REQUIRE_ALL=false
            const promises = [];
            // Gemini
            if (GEMINI_API_KEY) promises.push(tryLayer(parseWithGemini, 'gemini'));
            else if (REQUIRE_ALL) throw new Error('Gemini layer unavailable (no key)');
            // Ollama (proxied via backend)
            promises.push(tryLayer(parseWithOllama, 'ollama'));
            // FAISS (proxied via backend)
            promises.push(tryLayer(parseWithFaiss, 'faiss'));

            const settled = await Promise.allSettled(promises);
            for (const s of settled) if (s.status === 'fulfilled') results.push(s.value);

            if (results.length === 0) throw new Error('All layers failed');

            if (REQUIRE_ALL && results.length < 3) {
              throw new Error(`Expected 3 layers, got ${results.length}`);
            }
          } else {
            // Single-layer fallback (Ollama)
            const one = await parseWithOllama(tweetText);
            results = [one];
          }

          // Got some results; break retry loop
          break;
        } catch (e) {
          attempt++;
          if (attempt > RETRIES) {
            totalErrors++;
            await backupOne('errors', { tweetId, error: `parsers failed after ${RETRIES} retries: ${e.message}` });
            console.error(`❌ ${tweetId}: parsing failed — ${e.message}`);
            if (FAIL_STOP) { hardFailed = true; }
            break;
          } else {
            console.warn(`↻ ${tweetId}: retry ${attempt}/${RETRIES} — ${e.message}`);
            await sleep(400);
          }
        }
      }
      if (hardFailed) break;
      if (!results || results.length === 0) continue;

      // --- Consensus & JSON verification ---
      const { consensusOk, merged, layers, votedType, jsonValid } = buildConsensus(results, tweetText);

      if (SAVE_INTERMEDIATE) {
        await backupOne('layers', { tweetId, layers, results });
        await backupOne('consensus', { tweetId, merged, consensusOk, jsonValid, votedType });
      }

      if (!jsonValid) {
        totalErrors++;
        console.error(`❌ ${tweetId}: merged JSON invalid`);
        await backupOne('errors', { tweetId, error: 'Merged JSON invalid' });
        if (FAIL_STOP) { hardFailed = true; break; }
        if (!PARTIAL_TOLERANCE) continue;
      }

      if (CONSENSUS && !consensusOk) {
        const msg = `Consensus not satisfied (require_all=${REQUIRE_ALL})`;
        console.warn(`⚠️  ${tweetId}: ${msg}`);
        await backupOne('warnings', { tweetId, warning: msg, merged });
        if (FAIL_STOP) { hardFailed = true; break; }
        if (!PARTIAL_TOLERANCE) continue;
      }

      // --- Store result ---
      try {
        const payload = {
          ...merged,
          tweet_id: tweetId,
          needs_review: merged.needs_review,
          review_status: merged.review_status,
        };
        if (DRY) {
          console.log(`DRY STORE ${tweetId}:`, JSON.stringify(payload));
        } else {
          await postParsed(tweetId, payload);
        }
        totalParsed++;
      } catch (e) {
        totalErrors++;
        console.error(`❌ ${tweetId}: store failed — ${e.message}`);
        await backupOne('errors', { tweetId, error: `store failed: ${e.message}` });
        if (FAIL_STOP) { hardFailed = true; break; }
      }
    }

    if (hardFailed) break;

    offset += batch.length;
    if (batch.length < BATCH) {
      console.log('✅ Final batch consumed.');
      break;
    }
  }

  const summary = {
    finishedAt: new Date().toISOString(),
    totalFetched, totalParsed, totalErrors,
    runDir: RUN_DIR,
    strict: FAIL_STOP, consensus: CONSENSUS, requireAll: REQUIRE_ALL
  };
  await backupOne('summary', summary);

  console.log(`\n— Run Summary —
fetched: ${totalFetched}
parsed : ${totalParsed}
errors : ${totalErrors}
backups: ${RUN_DIR}
strict : ${FAIL_STOP}
consensus(require_all=${REQUIRE_ALL}): ${CONSENSUS}
`);

  if (totalErrors > 0 && FAIL_STOP) process.exit(1);
  process.exit(0);
}

// Kickoff
run().catch(async (e) => {
  console.error(`💥 Fatal: ${e.message}`);
  try {
    await ensureDirs();
    await backupOne('fatal', { error: e.message, stack: e.stack });
  } catch {}
  process.exit(1);
});