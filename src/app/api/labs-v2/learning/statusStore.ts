import { NextResponse } from 'next/server';

// In-memory store for the learning flag (for mocking purposes)
let isLearningEnabled = true;

export async function GET() {
  return NextResponse.json({ isEnabled: isLearningEnabled });
}

// This function is for testing purposes to reset the state
export function setLearningFlag(status: boolean) {
  isLearningEnabled = status;
}
