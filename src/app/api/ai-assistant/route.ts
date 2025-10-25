import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  let body: any = null;
  
  try {
    body = await request.json();
    const { message, tweetData } = body;
    
    if (!message) {
      return NextResponse.json(
        { success: false, error: 'Message is required' },
        { status: 400 }
      );
    }
    
    const geminiApiKey = process.env.GEMINI_API_KEY;
    
    if (!geminiApiKey || geminiApiKey === 'your_gemini_api_key_here') {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Gemini API key not configured',
          fallback: true,
          response: generateFallbackResponse(message, tweetData)
        },
        { status: 200 }
      );
    }
    
    // Use Gemini API
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `You are an AI assistant helping with tweet analysis and tagging in Hindi. 

Tweet Data: ${JSON.stringify(tweetData, null, 2)}

User Message: ${message}

Please respond in Hindi and help with:
1. Analyzing the tweet content
2. Suggesting appropriate tags
3. Identifying location, event type, people mentioned
4. Providing insights about the tweet

Keep your response concise and helpful.`
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024,
          }
        })
      }
    );
    
    if (!geminiResponse.ok) {
      throw new Error(`Gemini API error: ${geminiResponse.status}`);
    }
    
    const geminiData = await geminiResponse.json();
    const aiResponse = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || 'Sorry, I could not generate a response.';
    
    return NextResponse.json({
      success: true,
      response: aiResponse,
      source: 'gemini'
    });
    
  } catch (error) {
    console.error('AI Assistant error:', error);
    
    // Fallback response
    return NextResponse.json({
      success: true,
      response: generateFallbackResponse(body?.message || '', body?.tweetData || null),
      source: 'fallback',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

function generateFallbackResponse(message: string, tweetData: any): string {
  const responses = [
    'मैं आपकी सहायता करने के लिए यहाँ हूँ। कृपया बताएं कि आप इस ट्वीट के बारे में क्या जानना चाहते हैं?',
    'इस ट्वीट का विश्लेषण करने में आपकी सहायता कर सकता हूँ। क्या आप टैग जोड़ना चाहते हैं या कोई अन्य जानकारी चाहते हैं?',
    'ट्वीट की सामग्री को समझने में आपकी मदद कर सकता हूँ। कृपया बताएं कि आप क्या करना चाहते हैं।',
    'मैं इस ट्वीट के लिए उपयुक्त टैग और श्रेणियां सुझा सकता हूँ। आप क्या चाहते हैं?'
  ];
  
  return responses[Math.floor(Math.random() * responses.length)];
}
