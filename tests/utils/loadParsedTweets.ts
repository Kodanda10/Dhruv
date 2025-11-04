import fs from "fs";
import path from "path";

type GeoRecord = {
  district?: string;
  block?: string;
  gp?: string;
  gram_panchayat?: string;
  gramPanchayat?: string;
  assembly?: string;
  village?: string;
  name?: string;
};

interface ParsedTweet {
  id: string;
  text?: string;
  content?: string;
  date?: string;
  timestamp?: string;
  geo?: GeoRecord;
  geo_hierarchy?: GeoRecord[];
  locations?: Array<string | GeoRecord>;
  hierarchy?: GeoRecord;
  review_status?: string;
  type?: string;
  scheme?: string;
  schemes?: string[];
  hashtags?: string[];
  parsed?: any;
}

interface GeoHierarchySnapshot {
  districts: string[];
  blocks: string[];
  gps: string[];
  villages: string[];
}

const jsonPath = path.resolve("data/parsed_tweets.json");

export function loadParsedTweets(): ParsedTweet[] {
  if (!fs.existsSync(jsonPath)) {
    console.warn("⚠️ Missing parsed_tweets.json file, returning empty array");
    return [];
  }
  const content = fs.readFileSync(jsonPath, "utf-8");
  const raw = JSON.parse(content);
  if (!Array.isArray(raw)) {
    console.warn('⚠️ parsed_tweets.json is not an array, returning empty array');
    return [];
  }

  return raw.map((entry: any) => {
    const parsed = entry?.parsed ?? {};
    const normalized: ParsedTweet = {
      ...entry,
      parsed,
    };

    // Normalise event type / intent
    const candidateEventTypes: Array<string | undefined> = [
      entry?.type,
      parsed?.event_type,
      parsed?.intent,
      parsed?.intent_type,
    ];
    normalized.type = candidateEventTypes.find(value => typeof value === 'string' && value.trim().length > 0) ?? normalized.type;

    // Normalise schemes
    const schemeSet = new Set<string>();
    const addScheme = (value: unknown) => {
      if (typeof value === 'string' && value.trim().length > 0) {
        schemeSet.add(value.trim());
      }
    };
    addScheme(entry?.scheme);
    (Array.isArray(entry?.schemes) ? entry.schemes : []).forEach(addScheme);
    (Array.isArray(parsed?.schemes) ? parsed.schemes : []).forEach(addScheme);
    (Array.isArray(parsed?.scheme_names) ? parsed.scheme_names : []).forEach(addScheme);
    if (schemeSet.size > 0) {
      normalized.schemes = Array.from(schemeSet);
      normalized.scheme = normalized.scheme ?? normalized.schemes[0];
    }

    // Normalise hashtags
    const hashtagSet = new Set<string>();
    const addHashtag = (value: unknown) => {
      if (typeof value === 'string' && value.trim().length > 0) {
        hashtagSet.add(value.trim());
      }
    };
    (Array.isArray(entry?.hashtags) ? entry.hashtags : []).forEach(addHashtag);
    (Array.isArray(parsed?.generated_hashtags) ? parsed.generated_hashtags : []).forEach(addHashtag);
    (Array.isArray(parsed?.hashtags) ? parsed.hashtags : []).forEach(addHashtag);
    if (hashtagSet.size > 0) {
      normalized.hashtags = Array.from(hashtagSet);
    }

    // Normalise locations / geo hierarchy
    const geoEntries: GeoRecord[] = [];
    const addGeoRecord = (value: unknown) => {
      if (typeof value === 'string' && value.trim().length > 0) {
        geoEntries.push({ name: value.trim(), village: value.trim() });
      } else if (value && typeof value === 'object') {
        const record = value as GeoRecord;
        if (Object.keys(record).length > 0) {
          geoEntries.push(record);
        }
      }
    };

    addGeoRecord(entry?.geo);
    (Array.isArray(entry?.locations) ? entry.locations : []).forEach(addGeoRecord);
    (Array.isArray(parsed?.locations) ? parsed.locations : []).forEach(addGeoRecord);
    (Array.isArray(parsed?.geo_hierarchy) ? parsed.geo_hierarchy : []).forEach(addGeoRecord);
    addGeoRecord(entry?.hierarchy);
    addGeoRecord(parsed?.hierarchy);

    if (geoEntries.length > 0) {
      normalized.geo_hierarchy = geoEntries;
      normalized.locations = geoEntries;
      const primary = geoEntries.find(record => record.district || record.block || record.village);
      if (primary) {
        normalized.geo = {
          district: primary.district,
          block: primary.block,
          gp: primary.gp ?? primary.gram_panchayat ?? primary.gramPanchayat,
          village: primary.village ?? primary.name,
        };
      }
    }

    return normalized;
  });
}

export function getApprovedTweets(): ParsedTweet[] {
  return loadParsedTweets().filter(t => t.review_status === "approved");
}

export function extractGeoHierarchy(): GeoHierarchySnapshot {
  const tweets = loadParsedTweets();
  const districts = new Set<string>();
  const blocks = new Set<string>();
  const gps = new Set<string>();
  const villages = new Set<string>();

  for (const t of tweets) {
    if (t.geo?.district) districts.add(t.geo.district);
    if (t.geo?.block) blocks.add(t.geo.block);
    if (t.geo?.gp) gps.add(t.geo.gp);
    if (t.geo?.village) villages.add(t.geo.village);

    if (Array.isArray(t.geo_hierarchy)) {
      for (const level of t.geo_hierarchy) {
        if (level?.district) districts.add(level.district);
        if (level?.block) blocks.add(level.block);
        if (level?.gram_panchayat) gps.add(level.gram_panchayat);
        if (level?.village) villages.add(level.village);
      }
    }

    if (Array.isArray(t.locations)) {
      for (const loc of t.locations) {
        if (typeof loc === 'string') {
          villages.add(loc);
          continue;
        }
        if (loc?.district) districts.add(loc.district);
        if (loc?.block) blocks.add(loc.block);
        if (loc?.gp) gps.add(loc.gp);
        if (loc?.gram_panchayat) gps.add(loc.gram_panchayat);
        if (loc?.village) villages.add(loc.village);
        if (loc?.name) villages.add(loc.name);
      }
    }

    if (t.hierarchy) {
      if (t.hierarchy.district) districts.add(t.hierarchy.district);
      if (t.hierarchy.block) blocks.add(t.hierarchy.block);
      if (t.hierarchy.gramPanchayat) gps.add(t.hierarchy.gramPanchayat);
      if ((t.hierarchy as GeoRecord).gram_panchayat) gps.add((t.hierarchy as GeoRecord).gram_panchayat as string);
      if (t.hierarchy.village) villages.add(t.hierarchy.village);
    }
  }

  return {
    districts: Array.from(districts),
    blocks: Array.from(blocks),
    gps: Array.from(gps),
    villages: Array.from(villages),
  };
}
