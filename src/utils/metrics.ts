// Removed mock data import - metrics should use database data via API
import { parsePost, formatHindiDate } from '@/utils/parse';

type CountMap = Record<string, number>;

function tally(arr: string[]): CountMap {
  const map: CountMap = {};
  for (const item of arr) {
    if (!item) continue;
    map[item] = (map[item] || 0) + 1;
  }
  return map;
}

function topN(map: CountMap, n: number): Array<{ key: string; count: number }> {
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n)
    .map(([key, count]) => ({ key, count }));
}

export function computeMetrics(parsedTweets: any[] = []) {
  // Accept parsed tweets as parameter - should come from database via API
  // Return empty metrics if no data provided
  if (!parsedTweets || parsedTweets.length === 0) {
    return {
      places: [],
      actions: [],
    };
  }
  
  const parsed = parsedTweets.map((p: any) => {
    if (p.parsed && p.parsed.event_type) {
      return {
        where: p.parsed.locations?.map((l: any) => l.name || l) || [],
        what: [p.parsed.event_type],
      };
    }
    // Fallback to parsePost
    return parsePost(p as any);
  });
  
  const allPlaces = parsed.flatMap((p) => p.where).filter(Boolean);
  const allActions = parsed.flatMap((p) => p.what).filter(Boolean);
  const placeCounts = tally(allPlaces);
  const actionCounts = tally(allActions);
  
  return {
    places: topN(placeCounts, 5),
    actions: topN(actionCounts, 10),
  };
}
