import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const { text } = await request.json();

  // Mock parsing (simulate LangExtract)
  const mockParsed = {
    when: '2025-09-08',
    where: text?.includes('रायगढ़') ? ['रायगढ़'] : ['दिल्ली'],
    themes: text?.includes('विकास') ? ['विकास'] : ['स्वास्थ्य'],
    sentiment: 'neutral',
    entities: [{ text: 'रायगढ़', type: 'LOC', start: 0, end: 0 }],
  };

  return NextResponse.json({ extraction: mockParsed });
}
