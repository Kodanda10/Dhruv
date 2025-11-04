import { NextResponse } from 'next/server';

// In-memory storage (replace with Vercel KV or DB in production)
const reviewedData: any[] = [];

export async function POST(request: Request) {
  const data = await request.json();
  reviewedData.push(data);
  return NextResponse.json({ stored: true });
}
