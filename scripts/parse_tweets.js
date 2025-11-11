#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const { setTimeout: sleep } = require("timers/promises");
const crypto = require("crypto");

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k,v] = a.replace(/^--/,'').split('=');
  return [k, v ?? true];
}));

const API_BASE = process.env.API_BASE;
const DRY = String(args.dry || 'false') === 'true';
const START = parseInt(args.start ?? 0, 10);
const BATCH = parseInt(args.batch ?? 250, 10);
const PARSER_VERSION = process.env.PARSER_VERSION || "v3-consensus-001";
const EVENT_HIGH = Number(process.env.EVENT_HIGH || 0.88);
const EVENT_LOW  = Number(process.env.EVENT_LOW  || 0.60);

const CKPT_DIR = ".workflow/checkpoints";
const REPORT_DIR = ".workflow/reports";
const BACKUP_DIR = "data/backups";
fs.mkdirSync(CKPT_DIR, { recursive: true });
fs.mkdirSync(REPORT_DIR, { recursive: true });
fs.mkdirSync(BACKUP_DIR, { recursive: true });

function idKey(tweet) {
  return `${tweet.tweet_id}:${PARSER_VERSION}`;
}

function hash(obj) {
  return crypto.createHash("sha1").update(JSON.stringify(obj)).digest("hex");
}

async function getBatch(start, limit) {
  const url = `${API_BASE}/api/tweets/unparsed?start=${start}&limit=${limit}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`fetch batch failed ${r.status}`);
  return r.json();
}

// --- Layer 1: Rules/Regex (fast, deterministic)
function rulesLayer(text) {
  const t = text.normalize("NFC");
  const suggest = { event: [], location: [], people: [], schemes: [], tags: [] };

  // Event type patterns
  if (/(जनसभा|जन संबोधन|सार्वजनिक सभा)/.test(t)) suggest.event.push({key:"public_meeting", score:0.92, ev:["जनसभा"]});
  if (/(शुभकामनाएं|बधाई|जन्मदिन)/.test(t)) suggest.event.push({key:"greetings", score:0.78, ev:["शुभकामनाएं"]});
  if (/(शोक|निधन|दु:ख)/.test(t)) suggest.event.push({key:"condolence", score:0.85, ev:["शोक"]});
  if (/(उद्घाटन|लोकार्पण)/.test(t)) suggest.event.push({key:"inauguration", score:0.90, ev:["उद्घाटन"]});
  if (/(निरीक्षण|दौरा)/.test(t)) suggest.event.push({key:"inspection", score:0.88, ev:["निरीक्षण"]});
  if (/(योजना|घोषणा)/.test(t)) suggest.event.push({key:"scheme_announcement", score:0.82, ev:["योजना"]});
  if (/(वितरण|बंटवारा)/.test(t)) suggest.event.push({key:"relief_distribution", score:0.85, ev:["वितरण"]});

  // Location patterns (seed for FAISS)
  const locMatches = t.match(/(रायगढ़|पुसौर|बरमपुर|बिलासपुर|रायपुर|छत्तीसगढ़|दुर्ग|अंतागढ़)/g);
  if (locMatches) {
    locMatches.forEach(loc => {
      suggest.location.push({name: loc, score:0.70, ev:[loc]});
    });
  }

  // People patterns
  const peopleMatches = t.match(/(श्री\s+[^\s,।]+(?:\s+[^\s,।]+){0,2})\s*जी?/g);
  if (peopleMatches) {
    peopleMatches.forEach(person => {
      const clean = person.replace(/^श्री\s+|\s*जी?$/g, '').trim();
      if (clean) suggest.people.push({name: clean, score:0.75, ev:[person]});
    });
  }

  // Scheme patterns
  if (/(प्रधानमंत्री आवास|मनरेगा|आयुष्मान भारत|किसान सम्मान)/.test(t)) {
    const schemeMatch = t.match(/(प्रधानमंत्री आवास|मनरेगा|आयुष्मान भारत|किसान सम्मान)/);
    if (schemeMatch) suggest.schemes.push({name: schemeMatch[0], score:0.80, ev:[schemeMatch[0]]});
  }

  return suggest;
}

// --- Layer 2: Gemini (LLM)
async function geminiLayer(text) {
  const r = await fetch(`${API_BASE}/api/llm/gemini/parse`, {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ text, focus:["event","location","people","schemes","tags"] })
  });
  if (!r.ok) throw new Error(`gemini fail ${r.status}`);
  return r.json();
}

// --- Layer 3: Ollama (LLM local)
async function ollamaLayer(text) {
  const r = await fetch(`${API_BASE}/api/llm/ollama/parse`, {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ text, focus:["event","location","people","schemes","tags"] })
  });
  if (!r.ok) throw new Error(`ollama fail ${r.status}`);
  return r.json();
}

// Merge & consensus: require 2-of-3 agreement per FIELD
function consensus(field, r1, r2, r3) {
  const pool = [ ...(r1[field]||[]), ...(r2[field]||[]), ...(r3[field]||[]) ];
  const map = new Map();

  for (const item of pool) {
    const k = (item.key || item.name || "").toLowerCase().trim();
    if (!k) continue;
    const cur = map.get(k) || { key:item.key, name:item.name, votes:0, scoreSum:0, ev:[] };
    cur.votes += 1;
    cur.scoreSum += Number(item.score || 0.7);
    cur.ev.push(...(item.ev||[]));
    map.set(k, cur);
  }

  const merged = [...map.values()]
    .map(x => ({ ...x, score: x.scoreSum / x.votes }))
    .sort((a,b)=>b.score-a.score);

  const agreed = merged.filter(x => x.votes >= 2); // 2-of-3
  return { merged, agreed };
}

function readyForAutoAccept(eventTopScore) {
  return eventTopScore >= EVENT_HIGH;
}

// Persist with atomic finalize (server handles transaction+emit)
async function finalize(tweet_id, payload) {
  if (DRY) return { dry:true };
  
  // Transform payload to match API expectations
  const action = payload.policy.auto_accept ? "APPROVE" : "SKIP";
  const apiPayload = {
    action: action,
    parser_version: payload.parser_version,
    decisions: payload.decisions,
    evidence: payload.evidence,
    policy: payload.policy,
    consensus_meta: payload.consensus_meta,
    notes: `Auto-finalized: ${action.toLowerCase()} | Event score: ${payload.consensus_meta.votes.event} | Location score: ${payload.consensus_meta.votes.location}`
  };
  
  const r = await fetch(`${API_BASE}/api/review/${tweet_id}/finalize`, {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify(apiPayload)
  });
  if (!r.ok) throw new Error(`finalize fail ${r.status}`);
  return r.json();
}

async function run() {
  const batch = await getBatch(START, BATCH);
  const report = {
    started: new Date().toISOString(),
    count: batch.length,
    ok:0,
    needs_review:0,
    retried:0,
    errors:0,
    ids:[],
    parser_version: PARSER_VERSION
  };

  const processedData = [];

  for (const tw of batch) {
    const key = idKey(tw);
    try {
      // retry loop (max 3 attempts total)
      let attempt = 0, done = false, lastErr = null, result = null;
      while (attempt < 3 && !done) {
        attempt++;
        try {
          const r1 = rulesLayer(tw.text);
          const r2 = await geminiLayer(tw.text);
          const r3 = await ollamaLayer(tw.text);

          const cEvent = consensus("event", r1, r2, r3);
          const cLoc   = consensus("location", r1, r2, r3);
          const cPeople= consensus("people", r1, r2, r3);
          const cSchemes=consensus("schemes", r1, r2, r3);
          const cTags  = consensus("tags", r1, r2, r3);

          const topEventScore = (cEvent.agreed[0]?.score ?? 0);
          const payload = {
            parser_version: PARSER_VERSION,
            tweet_id: tw.tweet_id,
            decisions: {
              event: cEvent.agreed,
              location: cLoc.agreed,
              people: cPeople.agreed,
              schemes: cSchemes.agreed,
              tags: cTags.agreed
            },
            evidence: {
              event: cEvent.agreed[0]?.ev || [],
              location: cLoc.agreed[0]?.ev || []
            },
            policy: {
              auto_accept: readyForAutoAccept(topEventScore),
              thresholds: { high: EVENT_HIGH, low: EVENT_LOW }
            },
            consensus_meta: {
              votes: {
                event: cEvent.agreed[0]?.votes || 0,
                location: cLoc.agreed[0]?.votes || 0
              }
            },
            idempotency_key: key
          };

          // If any FIELD lacks 2-of-3 agreement, mark needs_review (no analytics)
          const needsReview =
            (!cEvent.agreed.length) ||
            (!cLoc.agreed.length);

          if (needsReview) {
            payload.policy.auto_accept = false;
          }

          result = await finalize(tw.tweet_id, payload);
          done = true;

          if (payload.policy.auto_accept) {
            report.ok += 1;
          } else {
            report.needs_review += 1;
          }

          report.ids.push({
            id: tw.tweet_id,
            ok: payload.policy.auto_accept,
            attempt,
            event_score: topEventScore,
            consensus: {
              event_votes: cEvent.agreed[0]?.votes || 0,
              location_votes: cLoc.agreed[0]?.votes || 0
            }
          });

          // Store processed data for backup
          processedData.push({
            tweet_id: tw.tweet_id,
            original_text: tw.text,
            original_metadata: {
              created_at: tw.created_at,
              author_handle: tw.author_handle,
              retweet_count: tw.retweet_count,
              reply_count: tw.reply_count,
              like_count: tw.like_count,
              quote_count: tw.quote_count,
              hashtags: tw.hashtags,
              mentions: tw.mentions,
              urls: tw.urls
            },
            parsed_data: payload,
            processing_timestamp: new Date().toISOString(),
            parser_version: PARSER_VERSION
          });

        } catch (e) {
          lastErr = e;
          report.retried += 1;
          await sleep(200 + Math.floor(Math.random()*400)); // jitter
        }
      }
      if (!done) {
        report.errors += 1;
        console.error("FAILED:", tw.tweet_id, lastErr?.message);
        report.ids.push({ id: tw.tweet_id, error: lastErr?.message, attempt: 3 });
      }
      // brief pause to respect rate/cost
      await sleep(40);
    } catch (e) {
      report.errors += 1;
      console.error("BATCH ITEM ERROR:", tw.tweet_id, e.message);
      report.ids.push({ id: tw.tweet_id, error: e.message });
    }
  }

  // Create backup after batch processing
  if (processedData.length > 0) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(BACKUP_DIR, `parsed_tweets_${timestamp}.json`);
    const backupData = {
      metadata: {
        batch_start: START,
        batch_size: BATCH,
        processed_count: processedData.length,
        parser_version: PARSER_VERSION,
        timestamp: new Date().toISOString(),
        checksum: hash(processedData)
      },
      tweets: processedData
    };

    fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2));
    console.log(`BACKUP CREATED: ${backupFile} (${processedData.length} tweets)`);

    // Validate backup
    const saved = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
    if (saved.tweets.length !== processedData.length) {
      throw new Error(`Backup validation failed: expected ${processedData.length}, got ${saved.tweets.length}`);
    }
  }

  const out = path.join(REPORT_DIR, `report_${START}_${BATCH}.json`);
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(CKPT_DIR, `offset.json`), JSON.stringify({ next: START + BATCH }, null, 2));
  console.log("REPORT:", out, report);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});