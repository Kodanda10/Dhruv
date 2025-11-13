import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { tweetIds } = await request.json();

    if (!Array.isArray(tweetIds) || tweetIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'tweetIds must be a non-empty array' },
        { status: 400 }
      );
    }

    console.log(`[Vector API] Triggering batch indexing for ${tweetIds.length} tweets:`, tweetIds);

    // Try FAISS first
    try {
      const faissResponse = await fetch(`${process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3000'}/api/labs/faiss/batch-index`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tweetIds }),
      });

      if (faissResponse.ok) {
        const result = await faissResponse.json();
        console.log(`[Vector API] ✅ FAISS indexing successful for ${tweetIds.length} tweets`);
        return NextResponse.json({
          success: true,
          service: 'faiss',
          indexed: tweetIds.length,
          result
        });
      }
    } catch (faissError: any) {
      console.warn(`[Vector API] FAISS indexing failed: ${faissError.message}`);
    }

    // Fallback to Milvus
    try {
      const milvusResponse = await fetch(`${process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3000'}/api/labs/milvus/batch-index`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tweetIds }),
      });

      if (milvusResponse.ok) {
        const result = await milvusResponse.json();
        console.log(`[Vector API] ✅ Milvus indexing successful for ${tweetIds.length} tweets`);
        return NextResponse.json({
          success: true,
          service: 'milvus',
          indexed: tweetIds.length,
          result
        });
      }
    } catch (milvusError: any) {
      console.warn(`[Vector API] Milvus indexing failed: ${milvusError.message}`);
    }

    // If both fail, return success: false but don't throw error
    console.error(`[Vector API] ❌ Both FAISS and Milvus indexing failed for ${tweetIds.length} tweets`);
    return NextResponse.json({
      success: false,
      error: 'Both vector services are unavailable',
      tweetIds
    }, { status: 503 });

  } catch (error: any) {
    console.error('[Vector API] Error triggering batch indexing:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to trigger vector indexing',
      },
      { status: 500 }
    );
  }
}