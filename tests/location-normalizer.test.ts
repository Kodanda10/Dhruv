import { describe, expect, it } from 'vitest';

import {
  collectFaissCandidates,
  formatHierarchyForContext,
  normalizeLocationToken,
} from '@/lib/parsing/location-normalizer';

describe('location normalizer', () => {
  it('normalizes tokens by removing zero-width chars and punctuation', () => {
    const raw = '  रायगढ़\u200b जिला!!! ';
    const normalized = normalizeLocationToken(raw);
    expect(normalized).toBe('रायगढ़ जिला');
  });

  it('collects and deduplicates FAISS candidates while preserving originals', () => {
    const candidates = collectFaissCandidates([
      'Chhattisgarh > Raigarh > Ward-1',
      ['chhattisgarh', 'raigarh', 'ward 1'],
      '   ',
    ]);

    expect(candidates).toHaveLength(1);
    expect(candidates[0].originalTokens).toEqual(['Chhattisgarh', 'Raigarh', 'Ward-1']);
    expect(candidates[0].normalizedTokens).toEqual(['chhattisgarh', 'raigarh', 'ward 1']);
  });

  it('formats hierarchies for context strings', () => {
    const formatted = formatHierarchyForContext(['ULB: Raigarh', 'Ward-03']);
    expect(formatted).toBe('ulb raigarh > ward 03');
  });
});
