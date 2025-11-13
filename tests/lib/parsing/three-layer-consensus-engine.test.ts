import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ThreeLayerConsensusEngine } from '@/lib/parsing/three-layer-consensus-engine';
import { RateLimiter } from '@/lib/parsing/rate-limiter';
import { NormalizedLocationHierarchy } from '@/lib/parsing/location-normalizer';

const mockConfig = {
  rateLimiter: new RateLimiter({
    geminiRPM: 1,
    ollamaRPM: 1,
    maxRetries: 1,
    backoffMultiplier: 1,
    initialBackoffMs: 10,
  }),
  consensusThreshold: 0.7,
  enableFallback: true,
  logLevel: 'error' as const,
};

describe('ThreeLayerConsensusEngine.validateWithFAISS', () => {
  let engine: ThreeLayerConsensusEngine;

  beforeEach(() => {
    engine = new ThreeLayerConsensusEngine(mockConfig);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns geo_verified result when FAISS yields valid matches', async () => {
    const candidates: NormalizedLocationHierarchy[] = [
      {
        originalTokens: ['Chhattisgarh', 'Raigarh', 'Ward-1'],
        normalizedTokens: ['chhattisgarh', 'raigarh', 'ward 1'],
        query: 'chhattisgarh raigarh ward 1',
      },
    ];

    const searchSpy = vi
      .spyOn(engine as any, 'searchFAISS')
      .mockResolvedValue([{ score: 0.91, match_type: 'exact' }]);

    const result = await (engine as any).validateWithFAISS(candidates, 'tweet-123');

    expect(searchSpy).toHaveBeenCalledWith('chhattisgarh raigarh ward 1');
    expect(result.geo_verified).toBe(true);
    expect(result.locations).toEqual(['chhattisgarh > raigarh > ward 1']);
  });

  it('marks geo_verified false when FAISS returns low-confidence matches', async () => {
    const candidates: NormalizedLocationHierarchy[] = [
      {
        originalTokens: ['Village Foo', 'Block Bar'],
        normalizedTokens: ['village foo', 'block bar'],
        query: 'village foo block bar',
      },
    ];

    vi.spyOn(engine as any, 'searchFAISS').mockResolvedValue([{ score: 0.5, match_type: 'fuzzy' }]);

    const result = await (engine as any).validateWithFAISS(candidates, 'tweet-456');

    expect(result.geo_verified).toBe(false);
    expect(result.locations).toEqual([]);
  });

  it('falls back to Milvus when FAISS cannot validate locations', async () => {
    const originalMilvusFlag = process.env.MILVUS_ENABLE;
    process.env.MILVUS_ENABLE = 'true';

    const candidates: NormalizedLocationHierarchy[] = [
      {
        originalTokens: ['Ward 5', 'Raigarh'],
        normalizedTokens: ['ward 5', 'raigarh'],
        query: 'ward 5 raigarh',
      },
    ];

    vi.spyOn(engine as any, 'searchFAISS').mockResolvedValue([]);
    vi.spyOn(engine as any, 'searchMilvus').mockResolvedValue([{ score: 0.82, match_type: 'semantic' }]);

    const result = await (engine as any).validateWithFAISS(candidates, 'tweet-789');

    expect(result.geo_verified).toBe(true);
    expect(result.geo_backend).toBe('milvus');

    process.env.MILVUS_ENABLE = originalMilvusFlag;
  });

  it('maps consensus event type back to Hindi labels', () => {
    const now = new Date('2024-11-13T10:00:00Z');
    const layerResults = [
      {
        layer: 'gemini',
        event_type: 'meeting',
        confidence: 0.9,
        locations: [],
        people_mentioned: [],
        organizations: [],
        schemes_mentioned: [],
      },
      {
        layer: 'ollama',
        event_type: 'meeting',
        confidence: 0.8,
        locations: [],
        people_mentioned: [],
        organizations: [],
        schemes_mentioned: [],
      },
    ];

    const consensus = (engine as any).applyConsensusVoting(layerResults, 'बैठक रायपुर में आयोजित', now);
    expect(consensus.event_type).toBe('meeting');
    expect(consensus.event_type_hi).toBe('बैठक');
  });

  it('extracts meaningful Hindi/English locations with administrative cues', () => {
    const sample =
      'आज ग्राम जामुनपाली वार्ड 12 रायगढ़ जिला में बड़ी बैठक हुई और Ward 14 Raigarh Nagar Nigam को निर्देश दिए गए। Specific village ward names का उल्लेख नहीं।';
    const locations = (engine as any).extractLocations(sample);

    expect(locations).toContain('जामुनपाली');
    expect(locations).toContain('रायगढ़');
    expect(locations).not.toContain('Specific village ward names');
  });
});
