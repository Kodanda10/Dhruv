import { NextResponse } from 'next/server';

// Mock posts for review (in real Vercel, fetch from storage or DB)
const mockPosts = [
  { id: 1, timestamp: '2025-09-08T08:00:00Z', content: 'आज रायगढ़ में विकास कार्यों की समीक्षा की। #विकास' },
  { id: 2, timestamp: '2025-09-08T09:30:00Z', content: 'दिल्ली में बैठक में सम्मिलित हुआ। @PMOIndia' },
  { id: 3, timestamp: '2025-09-08T11:00:00Z', content: 'स्वच्छता अभियान में भाग लिया। #स्वच्छता' },
  // Add more as needed
];

export async function GET() {
  return NextResponse.json(mockPosts.slice(0, 10));  // Return sample posts
}
