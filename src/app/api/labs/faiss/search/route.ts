import { NextResponse } from 'next/server';
import { search, FaissSearchResult } from '@/labs/faiss/search';

type ErrorResponse = {
  error: string;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');
  const limit = searchParams.get('limit');

  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    traceId: request.headers.get('x-trace-id') || 'local-dev',
    service: 'faiss-search',
    method: request.method,
    url: request.url,
    query: { q, limit },
    message: 'Received FAISS search request.',
  }));

  if (typeof q !== 'string' || q.trim() === '') {
    return NextResponse.json({ error: 'Query parameter "q" is required.' }, { status: 400 });
  }

  const parsedLimit = parseInt(limit || '5', 10);

  try {
    const results = await search(q, parsedLimit);
    return NextResponse.json(results);
  } catch (error: any) {
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      traceId: request.headers.get('x-trace-id') || 'local-dev',
      service: 'faiss-search',
      method: request.method,
      url: request.url,
      query: { q, limit },
      error: error.message,
      stack: error.stack,
      message: 'Error during FAISS search.',
    }));
    return NextResponse.json({ error: 'An error occurred during the search.' }, { status: 500 });
  }
}