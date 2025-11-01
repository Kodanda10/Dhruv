import fs from 'fs';
import path from 'path';
import { transliterate as transliterateText } from 'transliteration';

export type MissingEntry = {
  kind: 'village' | 'gram_panchayat';
  english: string;
  why?: string;
};

export type MappingRecord = {
  english?: string;
  hindi: string;
  nuktaHindi?: string;
  transliteration?: string;
  sources: string[];
};

export type CuratedRecord = {
  kind: MissingEntry['kind'];
  english: string;
  variants: {
    english: string;
    hindi: string;
    nuktaHindi: string;
    transliteration: string;
  };
  provenance: {
    source: string;
    verifiedOn: string;
    verifiedBy: 'web-curator';
  };
};

export type CurateResult = {
  records: CuratedRecord[];
  skipped: string[];
  stats: {
    attempted: number;
    curated: number;
    skipped: number;
    budgetUsed: number;
  };
};

export type WebCuratorOptions = {
  budget: number;
  rateLimitMs: number;
  mappings: Record<string, MappingRecord>;
  now?: () => Date;
  reporter?: (message: string) => void;
};

const DEFAULT_SOURCE = 'https://data.invalid/web-curation';

export class WebCurator {
  private readonly budget: number;
  private readonly rateLimitMs: number;
  private readonly now: () => Date;
  private readonly reporter: (message: string) => void;
  private readonly lookup: Map<string, MappingRecord>;

  constructor(options: WebCuratorOptions) {
    if (options.budget <= 0) {
      throw new Error('Curator budget must be greater than zero');
    }
    this.budget = options.budget;
    this.rateLimitMs = Math.max(0, options.rateLimitMs);
    this.now = options.now ?? (() => new Date());
    this.reporter = options.reporter ?? (() => undefined);
    this.lookup = new Map(
      Object.entries(options.mappings ?? {}).map(([key, value]) => [normaliseKey(key), value]),
    );
  }

  async curate(entries: MissingEntry[]): Promise<CurateResult> {
    const records: CuratedRecord[] = [];
    const skipped: string[] = [];
    const seen = new Set<string>();
    let budgetUsed = 0;

    for (const entry of entries) {
      const key = entry.english?.trim();
      if (!key) continue;
      const normalised = normaliseKey(key);
      if (seen.has(normalised)) continue;
      seen.add(normalised);

      if (budgetUsed >= this.budget) {
        throw new Error(`Search budget exceeded (${this.budget}) while processing "${key}"`);
      }
      budgetUsed += 1;

      const mapping = this.lookup.get(normalised);
      if (!mapping) {
        skipped.push(key);
        this.reporter(`No mapping found for "${key}"`);
        await this.sleepIfNeeded(budgetUsed);
        continue;
      }

      const record = this.buildRecord(entry, mapping);
      records.push(record);
      await this.sleepIfNeeded(budgetUsed);
    }

    records.sort((a, b) => a.english.localeCompare(b.english, 'en'));

    return {
      records,
      skipped,
      stats: {
        attempted: entries.length,
        curated: records.length,
        skipped: skipped.length,
        budgetUsed,
      },
    };
  }

  private buildRecord(entry: MissingEntry, mapping: MappingRecord): CuratedRecord {
    const english = mapping.english?.trim() || entry.english.trim();
    const hindi = mapping.hindi.trim();
    const nuktaHindi = (mapping.nuktaHindi ?? mapping.hindi).trim();
    const transliteration =
      (mapping.transliteration && mapping.transliteration.trim()) ||
      deriveTransliteration(nuktaHindi || hindi || english);
    const source = mapping.sources?.[0] ?? DEFAULT_SOURCE;

    return {
      kind: entry.kind,
      english,
      variants: {
        english,
        hindi,
        nuktaHindi,
        transliteration,
      },
      provenance: {
        source,
        verifiedOn: this.now().toISOString(),
        verifiedBy: 'web-curator',
      },
    };
  }

  private async sleepIfNeeded(budgetUsed: number) {
    if (this.rateLimitMs <= 0) return;
    if (budgetUsed >= this.budget) return;
    await new Promise<void>((resolve) => setTimeout(resolve, this.rateLimitMs));
  }
}

const VOWEL_SIGNS = new Set(['ा', 'ि', 'ी', 'ु', 'ू', 'े', 'ै', 'ो', 'ौ', 'ृ', 'ॄ']);
const VIRAMA = '्';
const NUKTA = '़';
const NO_INHERENT_VOWEL = new Set(['ड़', 'ड़']);

function normaliseKey(value: string): string {
  return value.trim().toLowerCase();
}

const CONSONANT_MAP: Record<string, string> = {
  ब: 'b',
  ह: 'h',
  र: 'r',
  च: 'ch',
  क: 'k',
  व: 'w',
  'ं': 'n',
  अ: 'a',
  ड: 'd',
  ढ: 'dh',
  ग: 'g',
  द: 'd',
  न: 'n',
  म: 'm',
  स: 's',
  ल: 'l',
  ट: 't',
  प: 'p',
  त: 't',
  य: 'y',
  ण: 'n',
  ज: 'j',
  घ: 'gh',
  ध: 'dh',
  थ: 'th',
  भ: 'bh',
  फ: 'ph',
  श: 'sh',
  ष: 'sh',
  ऱ: 'r',
  ळ: 'l',
  ड़: 'd',
  'ड़': 'd',
};

const VOWEL_MAP: Record<string, string> = {
  'आ': 'aa',
  'इ': 'i',
  'ई': 'ii',
  'उ': 'u',
  'ऊ': 'uu',
  'ए': 'e',
  'ऐ': 'ai',
  'ओ': 'o',
  'औ': 'au',
  'ा': 'a',
  'ि': 'i',
  'ी': 'i',
  'ु': 'u',
  'ू': 'u',
  'े': 'e',
  'ै': 'ai',
  'ो': 'o',
  'ौ': 'au',
  'ृ': 'ri',
  'ॄ': 'ri',
};

export function deriveTransliteration(input: string): string {
  if (!input) return '';
  const manual = manualTransliterate(input);
  if (manual) return manual;

  const ascii = transliterateText(input);
  const compact = ascii.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, '');
  if (compact) return compact;

  return input.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function manualTransliterate(input: string): string {
  let result = '';
  const chars = Array.from(input);
  for (let i = 0; i < chars.length; i += 1) {
    const current = chars[i];
    if (!current || current === NUKTA) continue;
    if (current === VIRAMA) continue;
    if (current === ' ' || current === '\t' || current === '\n' || current === ',' || current === '-') {
      continue;
    }

    if (VOWEL_MAP[current]) {
      result += VOWEL_MAP[current];
      continue;
    }

    let base = CONSONANT_MAP[current];
    const nextChar = chars[i + 1];
    let composedKey = current;
    let consumedNukta = false;
    if (nextChar === NUKTA) {
      const combined = `${current}${nextChar}`;
      if (CONSONANT_MAP[combined]) {
        base = CONSONANT_MAP[combined];
        composedKey = combined;
      }
      consumedNukta = true;
      i += 1;
    }
    if (!base) continue;

    const next = chars[i + 1];
    const hasVowelSign = next ? VOWEL_SIGNS.has(next) : false;
    const usesInherent =
      !hasVowelSign && next !== VIRAMA && !NO_INHERENT_VOWEL.has(composedKey);

    result += base;
    if (hasVowelSign && next) {
      result += VOWEL_MAP[next] ?? '';
      i += 1;
    } else if (usesInherent) {
      result += 'a';
    }
  }
  return result.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export function parseNdjsonFile(filePath: string): MissingEntry[] {
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, 'utf8');
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        const parsed = JSON.parse(line);
        return {
          kind: parsed.kind,
          english: parsed.english,
          why: parsed.why,
        } as MissingEntry;
      } catch (error) {
        throw new Error(`Invalid NDJSON line in ${filePath}: ${line}`);
      }
    });
}

export function loadMappings(filePath: string): Record<string, MappingRecord> {
  if (!fs.existsSync(filePath)) return {};
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, MappingRecord>;
  return parsed;
}

export function writeOutputs(records: CuratedRecord[], ndjsonPath: string, jsonPath: string) {
  ensureDir(path.dirname(ndjsonPath));
  ensureDir(path.dirname(jsonPath));

  const ndjson = records
    .map((record) =>
      JSON.stringify({
        english: record.variants.english,
        hindi: record.variants.hindi,
        nuktaHindi: record.variants.nuktaHindi,
        transliteration: record.variants.transliteration,
        source: record.provenance.source,
        verifiedOn: record.provenance.verifiedOn,
        verifiedBy: record.provenance.verifiedBy,
        kind: record.kind,
      }),
    )
    .join('\n');

  fs.writeFileSync(ndjsonPath, ndjson ? `${ndjson}\n` : '');

  const map = {
    metadata: {
      curated: records.length,
      generatedAt: new Date().toISOString(),
    },
    entries: records.reduce<Record<string, unknown>>((acc, record) => {
      acc[record.english] = {
        kind: record.kind,
        variants: record.variants,
        provenance: record.provenance,
      };
      return acc;
    }, {}),
  };

  fs.writeFileSync(jsonPath, `${JSON.stringify(map, null, 2)}\n`);
}

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}
