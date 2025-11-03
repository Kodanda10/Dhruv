import fs from 'node:fs';

describe('Documentation presence', () => {
  it('runbook exists and mentions FLAG_PARSE and rollback', () => {
    const text = fs.readFileSync('runbook.md', 'utf8');
    expect(text).toMatch(/FLAG_PARSE/);
    expect(text).toMatch(/rollback/i);
  });
});

