import { config } from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';

config({ path: '.env.local' });

console.log('=== Gemini API Key Test ===');
console.log('🔑 API Key loaded:', process.env.GEMINI_API_KEY ? 'YES (' + process.env.GEMINI_API_KEY.substring(0, 20) + '...)' : 'NO');

if (!process.env.GEMINI_API_KEY) {
  console.error('❌ No GEMINI_API_KEY found in environment');
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function testGemini() {
  try {
    console.log('🤖 Testing Gemini API connection...');
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent('Hello, can you confirm you are working? Just respond with YES.');
    const response = await result.response;
    const text = response.text();
    console.log('✅ Gemini API: SUCCESS');
    console.log('📝 Response:', text.substring(0, 50) + '...');
  } catch (error) {
    console.error('❌ Gemini API: FAILED');
    console.error('Error details:', error.message);

    // Check if it's an authentication error
    if (error.message.includes('API_KEY') || error.message.includes('permission') || error.message.includes('unauthorized')) {
      console.error('🔐 This appears to be an authentication/API key issue');
    } else if (error.message.includes('model') && error.message.includes('not found')) {
      console.error('🤖 Model not found - trying different model...');
      // Try with a different model
      try {
        const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
        const result = await model.generateContent('Hello');
        console.log('✅ Gemini API: SUCCESS with gemini-pro');
      } catch (error2) {
        console.error('❌ Still failed with gemini-pro:', error2.message);
      }
    }
  }
}

testGemini();