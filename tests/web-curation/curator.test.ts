import fs from 'fs';
import os from 'os';
import path from 'path';

import {
  MissingEntry,
  WebCurator,
  deriveTransliteration,
  writeOutputs,
} from '@/../scripts/web-curation/curator';

const SAMPLE_MAPPING = {
  Badwahi: {
    hindi: 'बडवाही',
    nuktaHindi: 'बड़वाही',
    transliteration: 'Badwahi',
    sources: ['https://rural.cg.gov.in/badwahi'],
  },
  Harchoka: {
    hindi: 'हर्चोका',
    nuktaHindi: 'हर्चोका',
    transliteration: 'Harchoka',
    sources: ['https://prd.cg.nic.in/harchoka'],
  },
} as const;

const SAMPLE_ENTRIES: MissingEntry[] = [
  { kind: 'village', english: 'Badwahi' },
  { kind: 'gram_panchayat', english: 'Harchoka' },
  { kind: 'village', english: 'UnknownVillage' },
];

describe('WebCurator', () => {
  it('curates entries with four variants and provenance', async () => {
    const curator = new WebCurator({
      budget: 5,
      rateLimitMs: 0,
      now: () => new Date('2025-09-06T00:00:00Z'),
      mappings: SAMPLE_MAPPING,
    });

    const result = await curator.curate(SAMPLE_ENTRIES);

    expect(result.records).toHaveLength(2);
    for (const record of result.records) {
      expect(record.kind).toMatch(/village|gram_panchayat/);
      expect(record.variants.hindi).toMatch(/\p{Script=Devanagari}/u);
      expect(record.variants.nuktaHindi).toMatch(/\p{Script=Devanagari}/u);
      expect(record.variants.transliteration).toMatch(/[A-Za-z]/);
      expect(record.provenance.source).toContain('https://');
      expect(record.provenance.verifiedBy).toBe('web-curator');
      expect(record.variants.english).toBe(record.english);
    }

    expect(result.skipped).toEqual(['UnknownVillage']);
    expect(result.stats).toEqual(
      expect.objectContaining({
        attempted: 3,
        curated: 2,
        skipped: 1,
      }),
    );
  });

  it('throws when search budget is exceeded', async () => {
    const curator = new WebCurator({
      budget: 1,
      rateLimitMs: 0,
      now: () => new Date('2025-09-06T00:00:00Z'),
      mappings: SAMPLE_MAPPING,
    });

    await expect(curator.curate(SAMPLE_ENTRIES)).rejects.toThrow(/budget/i);
  });

  it('writes deterministic NDJSON and JSON outputs', async () => {
    const curator = new WebCurator({
      budget: 3,
      rateLimitMs: 0,
      now: () => new Date('2025-09-06T00:00:00Z'),
      mappings: SAMPLE_MAPPING,
    });
    const { records } = await curator.curate(SAMPLE_ENTRIES.slice(0, 2));

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'web-curation-'));
    const ndjsonPath = path.join(tmpDir, 'out.ndjson');
    const jsonPath = path.join(tmpDir, 'map.json');

    writeOutputs(records, ndjsonPath, jsonPath);

    const ndjson = fs.readFileSync(ndjsonPath, 'utf8').trim().split('\n');
    expect(ndjson).toHaveLength(2);
    for (const line of ndjson) {
      const parsed = JSON.parse(line);
      expect(parsed).toHaveProperty('english');
      expect(parsed).toHaveProperty('hindi');
      expect(parsed).toHaveProperty('nuktaHindi');
      expect(parsed).toHaveProperty('transliteration');
      expect(parsed).toHaveProperty('source');
    }

    const json = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    expect(Object.keys(json.entries)).toEqual(['Badwahi', 'Harchoka']);
    expect(json.metadata.curated).toBe(2);
  });
});

describe('deriveTransliteration', () => {
  it('falls back to ascii if no diacritics map', () => {
    expect(deriveTransliteration('हर्चोका')).toBe('harchoka');
    expect(deriveTransliteration('बड़वाही')).toBe('badwahi');
  });
});
