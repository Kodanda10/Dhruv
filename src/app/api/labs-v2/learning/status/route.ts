import { NextResponse } from 'next/server';
import { getLearningFlag } from '@/lib/learningStore';

export async function GET() {
  const isEnabled = getLearningFlag();
  return NextResponse.json({ isEnabled });
}
