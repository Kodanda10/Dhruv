/**
 * k6 Load Tests for Labs API Endpoints
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const faissLatency = new Trend('faiss_latency');
const aiLatency = new Trend('ai_latency');
const mindmapLatency = new Trend('mindmap_latency');

export const options = {
  stages: [
    { duration: '30s', target: 10 },
    { duration: '1m', target: 25 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    'http_req_duration{name:faiss}': ['p(95)<500'],
    'http_req_duration{name:ai}': ['p(95)<1500'],
    'http_req_duration{name:mindmap}': ['p(95)<800'],
    errors: ['rate<0.1'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  // Test FAISS search
  const faissRes = http.get(`${BASE_URL}/api/labs/faiss/search?q=खरसिया&limit=5`, {
    tags: { name: 'faiss' },
  });
  const faissSuccess = check(faissRes, {
    'FAISS search status is 200': (r) => r.status === 200,
    'FAISS search has results': (r) => {
      try {
        const data = JSON.parse(r.body);
        return data.success && Array.isArray(data.results);
      } catch {
        return false;
      }
    },
  });
  errorRate.add(!faissSuccess);
  faissLatency.add(faissRes.timings.duration);

  sleep(1);

  // Test AI Assistant (less frequent due to LLM costs)
  if (__VU % 3 === 0) {
    const aiRes = http.post(
      `${BASE_URL}/api/labs/ai/assist`,
      JSON.stringify({
        tweet_id: '123',
        text: 'रायगढ़ में एक बैठक हुई',
        entities: {
          event_type: 'meeting',
          locations: ['रायगढ़'],
        },
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        tags: { name: 'ai' },
      }
    );
    const aiSuccess = check(aiRes, {
      'AI assist status is 200': (r) => r.status === 200,
    });
    errorRate.add(!aiSuccess);
    aiLatency.add(aiRes.timings.duration);

    sleep(2);
  }

  // Test Mindmap graph
  if (__VU % 5 === 0) {
    const mindmapRes = http.get(`${BASE_URL}/api/labs/mindmap/graph?threshold=2`, {
      tags: { name: 'mindmap' },
    });
    const mindmapSuccess = check(mindmapRes, {
      'Mindmap graph status is 200': (r) => r.status === 200,
      'Mindmap graph has nodes': (r) => {
        try {
          const data = JSON.parse(r.body);
          return data.success && Array.isArray(data.nodes);
        } catch {
          return false;
        }
      },
    });
    errorRate.add(!mindmapSuccess);
    mindmapLatency.add(mindmapRes.timings.duration);

    sleep(1);
  }

  sleep(1);
}

export function handleSummary(data) {
  return {
    'stdout': JSON.stringify(data, null, 2),
    'perf/labs-api-summary.json': JSON.stringify(data, null, 2),
  };
}

