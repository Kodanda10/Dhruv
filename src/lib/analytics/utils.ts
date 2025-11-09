import fs from 'fs';
import path from 'path';

export const HINDI_DAYS = ['रविवार', 'सोमवार', 'मंगलवार', 'बुधवार', 'गुरुवार', 'शुक्रवार', 'शनिवार'];

export const COMMUNITY_KEYWORDS = [/समाज/, /सभा/, /महासभा/, /कमेटी/, /यादव/i, /साहू/i, /तेली/i, /गौंड/i, /मुस्लिम/i, /खरी/];
export const TARGET_GROUPS: Record<string, RegExp[]> = {
  'महिला': [/महिला/, /नारी/],
  'युवा': [/युवा/, /छात्र/, /छात्रा/],
  'किसान': [/किसान/, /कृषक/],
  'वरिष्ठ नागरिक': [/वरिष्ठ/, /सीनियर/],
  'उद्यमी': [/उद्यमी/, /व्यवसाय/],
};

export const THEME_KEYWORDS: Record<string, RegExp[]> = {
  'रोज़गार': [/रोजगार/, /रोज़गार/, /रोजगार/i],
  'शिक्षा': [/शिक्षा/, /school/i, /college/i],
  'स्वास्थ्य': [/स्वास्थ्य/, /health/, /अस्पताल/],
  'आधारभूत संरचना': [/सड़क/, /पुल/, /इन्फ्रा/, /आधारभूत/],
  'कृषि': [/कृषि/, /खेती/],
  'खेल': [/खेल/, /sports/i],
};


export interface AnalyticsFilters {
  startDate?: string;
  endDate?: string;
  location?: string;
}

interface FilterClause {
  whereClause: string;
  values: any[];
}

function normalizeDate(value?: string | null): string | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString().slice(0, 10);
}

export function normalizeVillage(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function normalizeLocation(value?: string | null): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed === 'रायगढ़ / छत्तीसगढ़') return undefined;
  return trimmed;
}

const APPROVED_EVENT_CONDITION =
  `pe.needs_review = false AND (pe.review_status IS NULL OR pe.review_status = 'approved')`;

export function buildFilterClause(filters: AnalyticsFilters): FilterClause {
  const conditions: string[] = [APPROVED_EVENT_CONDITION];
  const values: any[] = [];
  let index = 1;

  const startDate = normalizeDate(filters.startDate);
  const endDate = normalizeDate(filters.endDate);
  const location = normalizeLocation(filters.location);

  if (startDate) {
    conditions.push(`COALESCE(pe.event_date, DATE(pe.parsed_at)) >= $${index}`);
    values.push(startDate);
    index += 1;
  }

  if (endDate) {
    conditions.push(`COALESCE(pe.event_date, DATE(pe.parsed_at)) <= $${index}`);
    values.push(endDate);
    index += 1;
  }

  if (location) {
    conditions.push(`EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(pe.locations, '[]'::jsonb)) loc
      WHERE COALESCE(loc->>'district', '') ILIKE $${index}
        OR COALESCE(loc->>'name', '') ILIKE $${index}
    )`);
    values.push(`%${location}%`);
    index += 1;
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  return { whereClause, values };
}

export function summarizeText(text: string, limit = 120): string {
  const trimmed = text.replace(/\s+/g, ' ').trim();
  if (trimmed.length <= limit) return trimmed;
  return `${trimmed.slice(0, limit)}...`;
}

export function rowsToMap(rows: any[], fallback?: string): Record<string, number> {
  if (!rows || rows.length === 0) {
    return fallback ? { [fallback]: 0 } : {};
  }
  return rows.reduce<Record<string, number>>((acc, row) => {
    const key = row.key || fallback || 'अनिर्दिष्ट';
    acc[key] = Number(row.count) || 0;
    return acc;
  }, {});
}

export function deriveTagInsights(rows: {
  label_hi: string | null;
  label_en: string | null;
  slug: string | null;
  count: number;
}[] = []): {
  casteMap: Record<string, number>;
  targetMap: Record<string, number>;
  themeMap: Record<string, number>;
} {
  const casteMap: Record<string, number> = {};
  const targetMap: Record<string, number> = Object.keys(TARGET_GROUPS).reduce<Record<string, number>>((acc, key) => {
    acc[key] = 0;
    return acc;
  }, {});
  const themeMap: Record<string, number> = Object.keys(THEME_KEYWORDS).reduce<Record<string, number>>((acc, key) => {
    acc[key] = 0;
    return acc;
  }, {});

  rows.forEach((row) => {
    const label = row.label_hi || row.label_en || row.slug || '';
    if (!label) return;
    const normalized = label.trim();
    const count = Number(row.count) || 0;

    if (COMMUNITY_KEYWORDS.some((regex) => regex.test(normalized))) {
      casteMap[normalized] = (casteMap[normalized] || 0) + count;
    }

    Object.entries(TARGET_GROUPS).forEach(([group, patterns]) => {
      if (patterns.some((regex) => regex.test(normalized))) {
        targetMap[group] = (targetMap[group] || 0) + count;
      }
    });

    Object.entries(THEME_KEYWORDS).forEach(([theme, patterns]) => {
      if (patterns.some((regex) => regex.test(normalized))) {
        themeMap[theme] = (themeMap[theme] || 0) + count;
      }
    });
  });

  return { casteMap, targetMap, themeMap };
}


function loadRaigarhTargets(): number {
  try {
    const filePath = path.join(process.cwd(), 'data', 'raigarh_assembly_constituency_detailed.json');
    const file = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(file);
    const uniqueVillages = new Set<string>();
    const blocks = data?.blocks || {};
    Object.values<any>(blocks).forEach((block) => {
      const gps = block?.gram_panchayats || {};
      Object.values<any>(gps).forEach((villages: string[]) => {
        (villages || []).forEach((v) => {
          if (typeof v === 'string' && v.trim()) {
            uniqueVillages.add(normalizeVillage(v));
          }
        });
      });
    });
    return uniqueVillages.size || 0;
  } catch (error) {
    console.warn('Unable to load Raigarh targets for coverage calculation:', error);
    return 0;
  }
}

export const RAIGARH_TARGET_TOTAL = loadRaigarhTargets();
