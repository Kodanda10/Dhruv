import posts from '../../data/posts_new.json';
import { parsePost } from '@/utils/parse';

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

export function computeMetrics() {
  const parsed = (posts as Array<{ id: string | number; timestamp: string; content: string }>).map(
    (p) => parsePost(p),
  );
  const allPlaces = parsed.flatMap((p) => p.where);
  const allActions = parsed.flatMap((p) => p.what);
  const placeCounts = tally(allPlaces);
  const actionCounts = tally(allActions);
  return {
    places: topN(placeCounts, 5),
    actions: topN(actionCounts, 10),
  };
}
