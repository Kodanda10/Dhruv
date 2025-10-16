import { NextResponse } from 'next/server';

// In-memory reviewed data (shared with store route for demo; use Vercel KV for persistence)
let reviewedData: any[] = [];

export async function GET() {
  return NextResponse.json(reviewedData);
}