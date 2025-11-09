import { createHash } from 'crypto';
import { PlaceKind } from './types';

const WHITESPACE_REGEX = /\s+/g;
const PUNCT_REGEX = /[.,/#!$%^&*;:{}=_`~()|[\]<>]/g;

export function normalizePlaceName(value?: string | null): string {
  if (!value) return '';
  return value
    .normalize('NFC')
    .replace(PUNCT_REGEX, ' ')
    .replace(WHITESPACE_REGEX, ' ')
    .trim()
    .toLowerCase();
}

export function buildPlaceKey(name: string, kind: PlaceKind | undefined): string {
  const normalized = normalizePlaceName(name);
  const kindSuffix = kind || 'unknown';
  return `${normalized}|${kindSuffix}`;
}

export function stableId(parts: string[]): string {
  const hash = createHash('sha1');
  hash.update(parts.join('>'));
  return hash.digest('hex').slice(0, 16);
}
