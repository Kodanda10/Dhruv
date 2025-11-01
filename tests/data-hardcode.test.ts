import fs from 'node:fs';
import path from 'node:path';

describe('Hardcoded dataset', () => {
  const dataPath = path.join(process.cwd(), 'data', 'posts.json');

  it('exists and contains posts with required fields', () => {
    expect(fs.existsSync(dataPath)).toBe(true);
    const raw = fs.readFileSync(dataPath, 'utf8');
    const json = JSON.parse(raw);
    expect(Array.isArray(json)).toBe(true);
    expect(json.length).toBeGreaterThan(0);
    for (const post of json) {
      expect(typeof post.id === 'string' || typeof post.id === 'number').toBe(true);
      expect(typeof post.timestamp).toBe('string');
      expect(typeof post.content).toBe('string');
    }
  });
});

