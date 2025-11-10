import { NextResponse } from 'next/server';
import { setLearningFlag } from '../status/route'; // Import the setter from the status route

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { isEnabled } = body;

    if (typeof isEnabled !== 'boolean') {
      return NextResponse.json({ error: 'Invalid "isEnabled" value. Must be a boolean.' }, { status: 400 });
    }

    setLearningFlag(isEnabled);
    return NextResponse.json({ success: true, isEnabled });
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
}
