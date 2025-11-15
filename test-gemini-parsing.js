#!/usr/bin/env node

/**
 * Test script to run Gemini parsing on 2 specific tweets
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

import pg from 'pg';
import { GoogleGenerativeAI } from '@google/generative-ai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env.local') });

// Specific tweet IDs to test
const TEST_TWEET_IDS = [
    '1985938919578616076', // Guru Nanak Dev Ji tweet
    '1985933171205214303'  // Kartik Purnima tweet
];

async function main() {
    console.log('🧪 Testing Gemini parsing on 2 specific tweets...\n');

    // Check environment
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
        console.error('❌ Missing GEMINI_API_KEY environment variable.');
        process.exit(1);
    }

    // Setup database connection
    const dbClient = new pg.Client({
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
        port: process.env.DB_PORT,
    });

    await dbClient.connect();
    console.log('✅ Connected to database');

    // Setup Gemini client
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const geminiClient = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    try {
        // Fetch the specific tweets
        const tweets = await fetchSpecificTweets(dbClient, TEST_TWEET_IDS);
        console.log(`📋 Found ${tweets.length} tweets to process:\n`);

        // Process each tweet
        for (const tweet of tweets) {
            console.log(`--- Processing Tweet ${tweet.id} ---`);
            console.log(`Author: ${tweet.author_id}`);
            console.log(`Text: ${tweet.text}`);
            console.log(`Created: ${tweet.created_at}\n`);

            try {
                const parsedData = await parseTweetWithGemini(tweet, geminiClient);
                console.log('✅ Gemini parsing successful!');
                console.log('📊 Parsed Categories:', JSON.stringify(parsedData.categories, null, 2));
                console.log('📊 Metadata:', JSON.stringify(parsedData.metadata, null, 2));
                console.log('\n' + '='.repeat(80) + '\n');

                // Store the result for later use
                tweet.parsedData = parsedData;

            } catch (error) {
                console.error(`❌ Gemini parsing failed: ${error.message}`);
                console.log('\n' + '='.repeat(80) + '\n');
            }
        }

        // Save results to file for next step
        const resultsFile = path.join(__dirname, 'test_tweets.json');
        fs.writeFileSync(resultsFile, JSON.stringify(tweets, null, 2));
        console.log(`💾 Results saved to ${resultsFile}`);

    } finally {
        await dbClient.end();
        console.log('✅ Database connection closed');
    }
}

async function fetchSpecificTweets(dbClient, tweetIds) {
    const placeholders = tweetIds.map((_, i) => `$${i + 1}`).join(',');
    const query = `SELECT tweet_id as id, text, created_at, author_handle as author_id FROM raw_tweets WHERE tweet_id IN (${placeholders})`;

    const result = await dbClient.query(query, tweetIds);
    return result.rows;
}

async function parseTweetWithGemini(tweet, geminiClient) {
    console.log(`  [Gemini] Parsing tweet ${tweet.id} with Gemini 2.0 Flash...`);

    const prompt = `Analyze this Chhattisgarh-focused social media post/tweet for political discourse and governance information. Extract structured information with high accuracy for Hindi-English mixed content.

Return ONLY a JSON object with this exact structure:
{
  "categories": {
    "locations": ["location1", "location2"],
    "people": ["person1", "person2"],
    "event": ["event_type"],
    "organisation": ["org1", "org2"],
    "schemes": ["scheme1", "scheme2"],
    "communities": ["community1", "community2"]
  },
  "metadata": {
    "model": "gemini-2.0-flash",
    "confidence": 0.85,
    "processing_time_ms": 1500,
    "discourse_type": "political_governance",
    "language_mix": "hi_en"
  }
}

Tweet Content: "${tweet.text}"

Advanced Social Media Discourse Analysis Instructions:

LOCATIONS (Chhattisgarh-specific):
- Extract: Cities (रायपुर, बिलासपुर, रायगढ़, दुर्ग, अंबिकापुर), Districts, Blocks, Villages, Assembly constituencies
- Include administrative divisions and geographical references
- Handle common spelling variations (Raipur/Raypur, Bilaspur/Billaspur)

PEOPLE (Political & Public Figures):
- Extract: Politicians (CM, PM, MLAs, MPs), Government officials, Activists
- Include honorifics (श्री, सुश्री, डॉ, प्रोफेसर) and titles
- Common names: भूपेश बघेल, विष्णु देव साय, रमन सिंह, राहुल गांधी, नरेन्द्र मोदी

EVENT TYPES (Governance-focused):
- political_rally (सभा, रैली, जनसभा)
- government_program (कार्यक्रम, योजना लॉन्च)
- protest_demonstration (आंदोलन, विरोध, प्रदर्शन)
- aid_distribution (वितरण, राहत, मदद)
- community_meeting (बैठक, बैठक, सम्मेलन)
- election_campaign (चुनाव प्रचार, अभियान)
- policy_announcement (घोषणा, नीति, निर्णय)
- infrastructure_inauguration (शिलान्यास, उद्घाटन, लोकार्पण)

ORGANIZATIONS (Government & Civil Society):
- Government: मुख्यमंत्री कार्यालय, राज्य सरकार, केंद्र सरकार, जिला प्रशासन
- Political parties: कांग्रेस, भाजपा, बसपा, झामुमो
- Government bodies: पंचायत, नगर निगम, विभाग (स्वास्थ्य, शिक्षा, कृषि)
- NGOs and civil society organizations

SCHEMES & PROGRAMS (Government Initiatives):
- National: PM-KISAN (प्रधान मंत्री किसान सम्मान निधि), Ayushman Bharat, Ujjwala, MGNREGA (मनरेगा)
- State: मुख्यमंत्री ग्रामीण विकास योजना, मुख्यमंत्री स्वास्थ्य योजना, मुख्यमंत्री शिक्षा योजना
- Common abbreviations: PM-KISAN, PMAY, NRLM, NSAP

COMMUNITIES (Social Groups):
- Caste/community references: आदिवासी, दलित, ओबीसी, ब्राह्मण, वैश्य
- Religious groups: हिंदू, मुस्लिम, सिख, ईसाई
- Professional groups: किसान, मजदूर, व्यापारी, अध्यापक

DISCOURSE ANALYSIS RULES:
1. Prioritize explicit mentions over implicit references
2. Handle Hindi-English code-switching (e.g., "PM Modi" vs "नरेन्द्र मोदी")
3. Consider context: Political tweets often mention multiple entities
4. Use confidence scoring: High confidence for direct mentions, lower for ambiguous references
5. Empty arrays are acceptable when no relevant entities are found

Return only valid JSON, no additional text or explanations.`;

    const result = await geminiClient.generateContent(prompt);
    const response = await result.response;
    const text = response.text().trim();

    // Clean up the response (remove markdown code blocks if present)
    const jsonText = text.replace(/^```json\s*/, '').replace(/\s*```$/, '');

    const parsed = JSON.parse(jsonText);

    // Validate structure
    if (!parsed.categories || !parsed.metadata) {
        throw new Error('Invalid response structure from Gemini');
    }

    return parsed;
}

// Run the script
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main().catch(error => {
        console.error('\n❌ An unexpected error occurred:', error);
        process.exit(1);
    });
}