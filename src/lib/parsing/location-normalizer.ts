export type RawLocationCandidate = string | string[];

export type NormalizedLocationHierarchy = {
  originalTokens: string[];
  normalizedTokens: string[];
  query: string;
};

const ZERO_WIDTH_PATTERN = /[\u200B-\u200D\u200E-\u200F\u202A-\u202E\u2060\uFEFF]/g;
const PUNCTUATION_PATTERN = /[!"#$%&'()*+,./:;<=>?@[\\\]^_`{|}~₹।|•·–—-]+/g;
const MULTI_SEPARATOR_PATTERN = /\s{2,}/g;
const HIERARCHY_DELIMITER = /[>|,\/\\]|(?:\s+-\s+)|(?:\s+>\s+)|(?:\s*→\s*)/;

/**
 * Normalizes a single location token by removing zero-width chars, punctuation,
 * and repeated whitespace. Returns lowercase tokens so deduplication can work
 * across Gemini, Ollama, and Regex hierarchies.
 */
export function normalizeLocationToken(token: string | undefined | null): string {
  if (!token) return '';

  const cleaned = token
    .normalize('NFKC')
    .replace(ZERO_WIDTH_PATTERN, '')
    .replace(PUNCTUATION_PATTERN, ' ')
    .replace(MULTI_SEPARATOR_PATTERN, ' ')
    .trim()
    .toLowerCase();

  return cleaned;
}

/**
 * Formats a hierarchy so logs / prompts always use the same normalized context.
 * Useful when falling back to ULB/village components.
 */
export function formatHierarchyForContext(tokens: string[]): string {
  return tokens
    .map(normalizeLocationToken)
    .filter(Boolean)
    .join(' > ');
}

/**
 * Collects FAISS candidates by exploding potential hierarchies, normalizing them
 * once, and deduplicating by the normalized representation. The original tokens
 * are preserved for logging/debugging purposes.
 */
export function collectFaissCandidates(
  rawCandidates: RawLocationCandidate[]
): NormalizedLocationHierarchy[] {
  const seen = new Set<string>();
  const candidates: NormalizedLocationHierarchy[] = [];

  for (const candidate of rawCandidates) {
    const exploded = explodeHierarchy(candidate);
    if (exploded.length === 0) continue;

    const normalizedTokens = exploded
      .map(normalizeLocationToken)
      .filter(Boolean);

    if (normalizedTokens.length === 0) continue;

    const key = normalizedTokens.join('>');
    if (seen.has(key)) continue;
    seen.add(key);

    candidates.push({
      originalTokens: exploded,
      normalizedTokens,
      query: normalizedTokens.join(' '),
    });
  }

  return candidates;
}

function explodeHierarchy(candidate: RawLocationCandidate): string[] {
  if (!candidate) return [];

  if (Array.isArray(candidate)) {
    return candidate.map(token => token?.trim()).filter((token): token is string => Boolean(token));
  }

  return candidate
    .split(HIERARCHY_DELIMITER)
    .map(token => token.trim())
    .filter(Boolean);
}
