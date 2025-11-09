import fs from 'fs';
import path from 'path';
import { GazetteerEntry, PlaceKind } from './types';
import { normalizePlaceName, stableId } from './normalize';

interface RawGazetteer {
  assembly_constituency?: string;
  district?: string;
  state?: string;
  country?: string;
  blocks?: Record<string, { gram_panchayats?: Record<string, string[]> }>;
}

const DISTRICT_FALLBACK = {
  id: 'CG-RGH',
  name: 'रायगढ़',
};
const STATE_FALLBACK = {
  id: 'CG',
  name: 'छत्तीसगढ़',
};
const COUNTRY_FALLBACK = {
  id: 'IN',
  name: 'India',
};

let loaded = false;
const entryIndex = new Map<string, GazetteerEntry[]>();
const entries: GazetteerEntry[] = [];

function pushEntry(entry: GazetteerEntry) {
  entries.push(entry);
  const key = normalizePlaceName(entry.name);
  if (!entryIndex.has(key)) {
    entryIndex.set(key, []);
  }
  entryIndex.get(key)!.push(entry);
}

function createEntry(opts: {
  name: string;
  kind: PlaceKind;
  blockName?: string;
  gpName?: string;
  path: string[];
}): GazetteerEntry {
  const blockNode = opts.blockName
    ? { id: stableId(['block', opts.blockName]), name: opts.blockName }
    : undefined;
  const gpNode = opts.gpName
    ? { type: 'GP' as const, name: opts.gpName }
    : undefined;
  return {
    id: stableId(opts.path),
    name: opts.name,
    kind: opts.kind,
    block: blockNode,
    district: DISTRICT_FALLBACK,
    state: STATE_FALLBACK,
    country: COUNTRY_FALLBACK,
    ulb_or_gp: gpNode,
    path: opts.path,
  };
}

function loadGazetteer(): void {
  if (loaded) return;
  loaded = true;

  const filePath = path.join(process.cwd(), 'data', 'raigarh_assembly_constituency_detailed.json');
  if (!fs.existsSync(filePath)) {
    console.warn('[Gazetteer] File not found:', filePath);
    return;
  }

  try {
    const raw: RawGazetteer = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const districtName = raw.district || raw.assembly_constituency || DISTRICT_FALLBACK.name;
    if (districtName !== DISTRICT_FALLBACK.name) {
      DISTRICT_FALLBACK.name = districtName;
    }
    if (raw.state) STATE_FALLBACK.name = raw.state;
    if (raw.country) COUNTRY_FALLBACK.name = raw.country;

    const blocks = raw.blocks || {};
    Object.entries(blocks).forEach(([blockName, blockData]) => {
      const gps = blockData?.gram_panchayats || {};
      Object.entries(gps).forEach(([gpName, villages]) => {
        const gpPath = [gpName, blockName, DISTRICT_FALLBACK.name, STATE_FALLBACK.name, COUNTRY_FALLBACK.name];
        const gpEntry = createEntry({
          name: gpName,
          kind: 'gp',
          blockName,
          gpName,
          path: gpPath,
        });
        pushEntry(gpEntry);

        (villages || []).forEach((villageName) => {
          const vPath = [
            villageName,
            gpName,
            blockName,
            DISTRICT_FALLBACK.name,
            STATE_FALLBACK.name,
            COUNTRY_FALLBACK.name,
          ];
          const villageEntry = createEntry({
            name: villageName,
            kind: 'village',
            blockName,
            gpName,
            path: vPath,
          });
          pushEntry(villageEntry);
        });
      });

      // Block level entry
      const blockPath = [blockName, DISTRICT_FALLBACK.name, STATE_FALLBACK.name, COUNTRY_FALLBACK.name];
      const blockEntry = createEntry({
        name: blockName,
        kind: 'block',
        blockName,
        path: blockPath,
      });
      pushEntry(blockEntry);
    });
    console.log(`[Gazetteer] Loaded ${entries.length} entries`);
  } catch (error) {
    console.error('[Gazetteer] Failed to parse gazetteer file:', error);
  }
}

export function findEntriesByName(name: string): GazetteerEntry[] {
  loadGazetteer();
  const normalized = normalizePlaceName(name);
  return entryIndex.get(normalized) || [];
}

export function getAllGazetteerEntries(): GazetteerEntry[] {
  loadGazetteer();
  return entries;
}
