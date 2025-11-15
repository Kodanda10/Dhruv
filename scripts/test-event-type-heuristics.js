#!/usr/bin/env node

import pg from 'pg';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config({ path: './.env.local' });

const API_BASE = process.env.API_BASE || 'http://127.0.0.1:3000';

async function main() {
  const client = new pg.Client({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
  });

  await client.connect();

  const tests = [
    {name: 'congratulation', keywords: ['बधाई', 'शुभकामन'], expect: 'congratulation'},
    {name: 'jayanti', keywords: ['जयंती', 'जन्म जयंती', 'jayanti'], expect: 'jayanti'}
  ];

  for (const t of tests) {
    const pattern = `%(${t.keywords.join('|')})%`;
    const res = await client.query('SELECT tweet_id as id, text, created_at, author_handle as author_id FROM raw_tweets WHERE text ILIKE $1 LIMIT 1', [pattern]);
    if (res.rows.length === 0) {
      console.log(`⚠️ No tweet found matching ${t.name} keywords`);
      continue;
    }
    const tweet = res.rows[0];

    console.log(`Testing ${t.name} with tweet ${tweet.id}: ${tweet.text.slice(0,140)}`);

    const payload = {
      tweet,
      categories: {locations: [], people: [], event: ['election_campaign'], organisation: [], schemes: [], communities: []},
      gemini_metadata: { model: 'gemini-2.0-flash', confidence: 0.82 }
    };

    const resp = await fetch(`${API_BASE}/api/ingest-parsed-tweet`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload)});
    const body = await resp.json().catch(() => ({}));
    console.log('Ingest response:', resp.status, body);

    const q = await client.query('SELECT event_type FROM parsed_events WHERE tweet_id = $1', [tweet.id]);
    if (q.rows.length === 0) {
      console.log(`❌ Tweet ${tweet.id} not found in parsed_events`);
    } else {
      console.log('Stored event_type:', q.rows[0].event_type);
    }
  }

  // Mixed-case test
  const mixed = await client.query("SELECT tweet_id as id, text, created_at, author_handle as author_id FROM raw_tweets WHERE text ILIKE '%चुनाव%' AND text ILIKE '%बधाई%' LIMIT 1");
  if (mixed.rows.length === 0) {
    console.log('⚠️ No mixed-case tweet found for test');
    await client.end();
    return;
  }
  const tweet = mixed.rows[0];
  console.log(`Testing mixed-case ${tweet.id}: ${tweet.text.slice(0,140)}`);
  const payload = { tweet, categories: { locations: [], people: [], event:['election_campaign'], organisation: [], schemes: [], communities: [] }, gemini_metadata: { model: 'gemini-2.0-flash', confidence: 0.82 } };
  const resp = await fetch(`${API_BASE}/api/ingest-parsed-tweet`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
  const body = await resp.json().catch(() => ({}));
  console.log('Ingest response:', resp.status, body);
  const q = await client.query('SELECT event_type FROM parsed_events WHERE tweet_id = $1', [tweet.id]);
  if (q.rows.length === 0) console.log('Not found'); else console.log('Stored event_type:', q.rows[0].event_type);

  await client.end();
}

main().catch(err => { console.error(err); process.exit(1); });
