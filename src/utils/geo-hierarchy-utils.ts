/**
 * Utility functions for geo-hierarchy navigation and manipulation
 * Extracted for testability and reusability
 */

import type { GeoHierarchyNode } from '@/types/geo-analytics';

/**
 * Get next level in hierarchy after current level
 */
export const getNextLevel = (
  currentLevel: 'district' | 'assembly' | 'block' | 'village' | 'ulb'
): 'district' | 'assembly' | 'block' | 'village' | 'ulb' => {
  const levels: ('district' | 'assembly' | 'block' | 'village' | 'ulb')[] = [
    'district',
    'assembly',
    'block',
    'village',
    'ulb',
  ];
  const currentIndex = levels.indexOf(currentLevel);
  return levels[Math.min(currentIndex + 1, levels.length - 1)];
};

/**
 * Get previous level in hierarchy before current level
 */
export const getPreviousLevel = (
  currentLevel: 'district' | 'assembly' | 'block' | 'village' | 'ulb'
): 'district' | 'assembly' | 'block' | 'village' | 'ulb' => {
  const levels: ('district' | 'assembly' | 'block' | 'village' | 'ulb')[] = [
    'district',
    'assembly',
    'block',
    'village',
    'ulb',
  ];
  const currentIndex = levels.indexOf(currentLevel);
  return levels[Math.max(currentIndex - 1, 0)];
};

/**
 * Find a node in the hierarchy by traversing a path
 */
export const findNodeByPath = (
  nodes: GeoHierarchyNode[],
  path: string[],
  currentIndex: number = 0
): GeoHierarchyNode | null => {
  if (currentIndex >= path.length) return null;

  const targetName = path[currentIndex];
  const node = nodes.find((n) => n.name === targetName);

  if (!node) return null;

  if (currentIndex === path.length - 1) {
    // Found the target node
    return node;
  }

  // Continue searching in children
  if (node.children && node.children.length > 0) {
    return findNodeByPath(node.children, path, currentIndex + 1);
  }

  return null;
};

/**
 * Calculate color based on event count (intensity gradient)
 */
export const calculateColorByIntensity = (value: number, maxValue: number): string => {
  if (maxValue === 0) return '#10B981';
  const intensity = Math.min(value / maxValue, 1);
  // Gradient from light green (#D1FAE5) to dark green (#10B981)
  const r = Math.round(209 - (209 - 16) * intensity);
  const g = Math.round(250 - (250 - 185) * intensity);
  const b = Math.round(229 - (229 - 129) * intensity);
  return `rgb(${r}, ${g}, ${b})`;
};

