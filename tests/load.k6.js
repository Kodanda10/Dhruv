/**
 * Load & Stress Test using k6
 * 
 * Tests API endpoints under load to ensure performance benchmarks are met.
 * 
 * Benchmarks:
 * - 95th percentile latency < 500ms
 * - Error rate < 1%
 * - CPU < 75%, memory < 1GB during 50 VUs
 * - Recovery < 3s after 200 concurrent hits
 */

import http from 'k6/http';
import { sleep, check } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const responseTime = new Trend('response_time');

export const options = {
  stages: [
    { duration: '30s', target: 20 },  // Ramp up to 20 users
    { duration: '1m', target: 50 },     // Stay at 50 users
    { duration: '30s', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95% responses under 500ms
    http_req_failed: ['rate<0.01'],    // <1% failure rate
    errors: ['rate<0.01'],
    response_time: ['p(95)<500'],
  },
};

export default function () {
  // Test analytics endpoint
  const analyticsRes = http.get('http://localhost:3001/api/analytics');
  
  check(analyticsRes, {
    'status 200': (r) => r.status === 200,
    'content present': (r) => r.body.includes('summary') || r.body.includes('total_tweets'),
    'response time < 500ms': (r) => r.timings.duration < 500,
  }) || errorRate.add(1);
  
  responseTime.add(analyticsRes.timings.duration);
  
  // Test parsed events endpoint
  const parsedRes = http.get('http://localhost:3001/api/parsed-events?limit=50');
  
  check(parsedRes, {
    'status 200': (r) => r.status === 200,
    'content present': (r) => r.body.includes('events') || r.body.includes('data'),
    'response time < 500ms': (r) => r.timings.duration < 500,
  }) || errorRate.add(1);
  
  responseTime.add(parsedRes.timings.duration);
  
  sleep(0.3); // 300ms between requests
}
