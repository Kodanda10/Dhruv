import { NextResponse } from 'next/server';

type Recommendation = {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  category: string;
  createdAt: string;
  updatedAt?: string;
};

type RecommendationsResponse = {
  ok: true;
  count: number;
  items: Recommendation[];
  traceId: string;
  timestamp: number;
};

function makeTraceId(): string {
  return Math.random().toString(36).slice(2, 10);
}

// Mock recommendations data for development
const SAMPLE_RECOMMENDATIONS: Recommendation[] = [
  {
    id: 'rec-1',
    title: 'Improve content engagement',
    description: 'Consider adding more interactive elements to increase user engagement.',
    priority: 'high',
    category: 'engagement',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'rec-2',
    title: 'Optimize loading performance',
    description: 'Implement lazy loading for images to improve page load times.',
    priority: 'medium',
    category: 'performance',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
];

export async function GET() {
  const traceId = makeTraceId();
  
  const response: RecommendationsResponse = {
    ok: true,
    count: SAMPLE_RECOMMENDATIONS.length,
    items: SAMPLE_RECOMMENDATIONS,
    traceId,
    timestamp: Date.now(),
  };

  return NextResponse.json(response, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}
