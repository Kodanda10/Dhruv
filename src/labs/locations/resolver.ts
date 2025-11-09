import { performance } from 'perf_hooks';
import { search as faissSearch } from '@/labs/faiss/search';
import { findEntriesByName } from './gazetteer';
import { normalizePlaceName, buildPlaceKey } from './normalize';
import { persistResolvedChoice } from './persistence';
import { LocationResolveInput, LocationResolutionResult, PlaceCandidate, PlaceKind } from './types';
import { searchMilvus } from '@/labs/milvus/search';

const HIGH_CONFIDENCE = 0.88;
const LOW_CONFIDENCE = 0.72;
const TOP_K = 5;

function expandCandidates(
  results: { name: string; score: number; source: 'faiss' | 'milvus' }[],
  source: 'faiss' | 'milvus',
  kindHint?: PlaceKind,
): PlaceCandidate[] {
  const candidates: PlaceCandidate[] = [];
  results.forEach((result) => {
    const entries = findEntriesByName(result.name);
    if (!entries.length) {
      candidates.push({
        name: result.name,
        kind: kindHint || 'unknown',
        score: result.score,
        source,
        pathComplete: false,
        reason: 'Gazetteer entry not found',
      });
      return;
    }
    entries.forEach((entry) => {
      const pathComplete = entry.path.length >= 4;
      candidates.push({
        name: entry.name,
        kind: entry.kind,
        score: result.score,
        source,
        entry,
        pathComplete,
        reason: pathComplete ? undefined : 'Path incomplete',
      });
    });
  });
  return candidates;
}

function mergeCandidates(
  faissCandidates: PlaceCandidate[],
  milvusCandidates: PlaceCandidate[],
  kindHint?: PlaceKind,
): PlaceCandidate[] {
  const merged = [...faissCandidates];
  milvusCandidates.forEach((candidate) => {
    merged.push(candidate);
  });

  return merged
    .map((candidate) => {
      let score = candidate.score;
      if (kindHint && candidate.kind === kindHint) {
        score += 0.02;
      }
      if (candidate.pathComplete) {
        score += 0.01;
      }
      return { ...candidate, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_K);
}

function shouldEscalate(candidate?: PlaceCandidate): boolean {
  if (!candidate) return true;
  if (!candidate.pathComplete) return true;
  if (candidate.score >= HIGH_CONFIDENCE) return false;
  return candidate.score < HIGH_CONFIDENCE;
}

export async function resolveLocation(input: LocationResolveInput): Promise<LocationResolutionResult> {
  const started = performance.now();
  const normalizedQuery = normalizePlaceName(input.detected_place);
  if (!normalizedQuery) {
    throw new Error('detected_place is required');
  }

  const placeKey = buildPlaceKey(input.detected_place, input.place_kind_hint || 'unknown');
  const faissResults = await faissSearch(normalizedQuery, TOP_K);
  const faissCandidates = expandCandidates(
    faissResults.map((r) => ({ name: r.name, score: r.score, source: 'faiss' as const })),
    'faiss',
    input.place_kind_hint,
  );

  let mergedCandidates = [...faissCandidates];
  let bestCandidate = mergedCandidates[0];
  const indicesHit = ['faiss'];

  if (!bestCandidate || bestCandidate.score < HIGH_CONFIDENCE) {
    const milvusResults = await searchMilvus(normalizedQuery, TOP_K, input.place_kind_hint);
    if (milvusResults.length) {
      indicesHit.push('milvus');
      const milvusCandidates = expandCandidates(
        milvusResults.map((r) => ({ name: r.name, score: r.score, source: 'milvus' as const })),
        'milvus',
        input.place_kind_hint,
      );
      mergedCandidates = mergeCandidates(faissCandidates, milvusCandidates, input.place_kind_hint);
      bestCandidate = mergedCandidates[0];
    }
  }

  const needsReview = shouldEscalate(bestCandidate);
  let persistedChoice;

  if (!needsReview && bestCandidate?.entry) {
    persistedChoice = await persistResolvedChoice({
      placeName: input.detected_place,
      kind: bestCandidate.kind,
      choice: {
        id: bestCandidate.entry.id,
        name: bestCandidate.entry.name,
        kind: bestCandidate.kind,
        block: bestCandidate.entry.block,
        district: bestCandidate.entry.district,
        state: bestCandidate.entry.state,
        country: bestCandidate.entry.country,
        ulb_or_gp: bestCandidate.entry.ulb_or_gp,
        full_path: bestCandidate.entry.path,
        codes: bestCandidate.entry.codes,
        confidence: bestCandidate.score,
        decided_by: 'auto',
        decided_at: new Date().toISOString(),
        version: 0,
      },
      audit: {
        indices_hit: indicesHit,
        normalized_query: normalizedQuery,
      },
      context: input.context,
      alias: normalizedQuery,
    });
  }

  const latency = Math.round(performance.now() - started);

  return {
    status: needsReview ? 'needs_review' : 'auto_accepted',
    normalized_query: normalizedQuery,
    place_key: placeKey,
    best_candidate: bestCandidate,
    candidates: mergedCandidates,
    persisted_choice: persistedChoice,
    audit: {
      tweet_id: input?.context?.tweet_id,
      candidates_considered: mergedCandidates.length,
      indices_hit: indicesHit,
      latency_ms: latency,
    },
  };
}
