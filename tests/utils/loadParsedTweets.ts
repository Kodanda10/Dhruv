import fs from "fs";
import path from "path";

interface ParsedTweet {
  id: string;
  text?: string;
  content?: string;
  date?: string;
  timestamp?: string;
  geo?: { district?: string; block?: string; gp?: string; village?: string };
  geo_hierarchy?: Array<{
    district?: string;
    block?: string;
    assembly?: string;
    gram_panchayat?: string;
    village?: string;
  }>;
  locations?: Array<
    | string
    | {
        district?: string;
        block?: string;
        gp?: string;
        gram_panchayat?: string;
        village?: string;
        name?: string;
      }
  >;
  hierarchy?: {
    district?: string;
    block?: string;
    gramPanchayat?: string;
    village?: string;
  };
  review_status?: string;
  type?: string;
  scheme?: string;
  schemes?: string[];
  hashtags?: string[];
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
  return JSON.parse(content);
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
