import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const SYSTEM_PROMPT = `You extract structured fields from Hindi/English political/governance tweets.
Return compact JSON only. No prose. Fields: event[], location[], people[], schemes[], tags[].
For each item: include {key OR name, score:0..1, ev:[matched tokens]}.
Prefer specific event types over generic. Multi-label allowed.
If uncertain, include item with score <= 0.60.`;

const EVENT_CATALOG = [
  "public_meeting", "review_meeting", "rally", "inspection", "tour", "inauguration",
  "foundation_stone", "groundbreaking", "press_conference", "public_event", "ceremony",
  "cultural_event", "sports_event", "educational_event", "workshop", "training_program",
  "seminar", "conference", "exhibition", "fair", "greetings", "condolences", "tribute_day",
  "birthday", "jayanti", "festival_celebration", "scheme_announcement", "relief_distribution"
];

export async function POST(request: NextRequest) {
  try {
    const { text, focus } = await request.json();

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    const userPrompt = `TEXT:
${text}

EVENT CATALOG (keys):
${EVENT_CATALOG.join(', ')}

Output JSON:
{"event":[...], "location":[...], "people":[...], "schemes":[...], "tags":[...]}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `${SYSTEM_PROMPT}\n\n${userPrompt}`
    });

    const rawText = response.text || '';
    const cleanedText = rawText.replace(/```json|```/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(cleanedText);
    } catch (parseError) {
      console.warn('Gemini parse error:', parseError, 'Raw text:', rawText);
      // Return empty results if parsing fails
      parsed = { event: [], location: [], people: [], schemes: [], tags: [] };
    }

    // Ensure all fields exist and are arrays
    const result = {
      event: Array.isArray(parsed.event) ? parsed.event : [],
      location: Array.isArray(parsed.location) ? parsed.location : [],
      people: Array.isArray(parsed.people) ? parsed.people : [],
      schemes: Array.isArray(parsed.schemes) ? parsed.schemes : [],
      tags: Array.isArray(parsed.tags) ? parsed.tags : []
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Gemini API error:', error);
    return NextResponse.json({ error: 'LLM processing failed' }, { status: 500 });
  }
}