#!/usr/bin/env node

/**
 * Script to insert parsed tweet data with review_status = 'pending'
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env.local') });

const API_BASE = process.env.API_BASE || 'http://127.0.0.1:3000';

async function main() {
    console.log('📤 Inserting parsed tweet data with review_status = "pending"...\n');

    // Read the test tweets file
    const tweetsFile = path.join(__dirname, 'test_tweets.json');
    if (!fs.existsSync(tweetsFile)) {
        console.error(`❌ Test tweets file not found: ${tweetsFile}`);
        process.exit(1);
    }

    const tweets = JSON.parse(fs.readFileSync(tweetsFile, 'utf8'));
    console.log(`📋 Found ${tweets.length} tweets to insert\n`);

    for (const tweet of tweets) {
        console.log(`--- Inserting Tweet ${tweet.id} ---`);
        console.log(`Text: ${tweet.text.substring(0, 80)}${tweet.text.length > 80 ? '...' : ''}`);

        try {
            // Prepare the data structure for the API
            const data = {
                tweet: {
                    id: tweet.id,
                    text: tweet.text,
                    created_at: tweet.created_at,
                    author_id: tweet.author_id
                },
                categories: tweet.parsedData.categories,
                gemini_metadata: tweet.parsedData.metadata
            };

            console.log('📊 Data to insert:', JSON.stringify(data, null, 2));

            const response = await fetch(`${API_BASE}/api/ingest-parsed-tweet`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            if (response.status === 409) {
                console.log('⚠️  Tweet already exists (duplicate)');
                continue;
            }

            if (!response.ok) {
                const errorBody = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorBody}`);
            }

            const result = await response.json();
            console.log('✅ Successfully inserted tweet');
            console.log('📊 Response:', JSON.stringify(result, null, 2));

        } catch (error) {
            console.error(`❌ Failed to insert tweet ${tweet.id}: ${error.message}`);
        }

        console.log('\n' + '='.repeat(80) + '\n');
    }

    console.log('🎉 Insert operation completed!');
}

// Run the script
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main().catch(error => {
        console.error('\n❌ An unexpected error occurred:', error);
        process.exit(1);
    });
}