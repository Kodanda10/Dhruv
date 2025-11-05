export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { generateSecureTraceId } from '@/lib/utils/security';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const postId = searchParams.get('post_id');

    if (!postId) {
      return NextResponse.json({ error: 'Missing post_id parameter' }, { status: 400 });
    }

    const feedbackPath = path.join(process.cwd(), 'data', 'human_feedback.json');
    let feedbackData = [];
    if (fs.existsSync(feedbackPath)) {
      feedbackData = JSON.parse(fs.readFileSync(feedbackPath, 'utf8'));
    }

    // Find the most recent feedback for this post
    const postFeedback = feedbackData
      .filter((item: any) => String(item.post_id) === String(postId))
      .sort((a: any, b: any) => b.timestamp - a.timestamp)[0];

    if (postFeedback) {
      return NextResponse.json({
        success: true,
        feedback: postFeedback,
      });
    } else {
      return NextResponse.json({
        success: true,
        feedback: null,
      });
    }
  } catch (error) {
    console.error('Error fetching feedback:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { post_id, corrections } = await request.json();
    if (!post_id || !corrections) {
      return NextResponse.json({ error: 'Missing post_id or corrections' }, { status: 400 });
    }

    const feedbackPath = path.join(process.cwd(), 'data', 'human_feedback.json');
    let feedbackData = [];
    if (fs.existsSync(feedbackPath)) {
      feedbackData = JSON.parse(fs.readFileSync(feedbackPath, 'utf8'));
    }
    feedbackData.push({
      post_id,
      corrections,
      timestamp: Date.now(),
      traceId: generateSecureTraceId(),
    });
    fs.writeFileSync(feedbackPath, JSON.stringify(feedbackData, null, 2));
    return NextResponse.json({ submitted: true });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
