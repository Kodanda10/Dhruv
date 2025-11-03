import { test, expect } from '@playwright/test';

test('health endpoint returns healthy with timestamp', async ({ request }) => {
  const res = await request.get('http://localhost:3000/api/health');
  expect(res.status()).toBe(200);
  const json = await res.json();
  expect(json.status).toBe('healthy');
  expect(typeof json.timestamp).toBe('string');
  expect(json.timestamp.length).toBeGreaterThan(0);
  expect(json.dbConnections).toBeDefined();
});

