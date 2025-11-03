/**
 * Unit tests for geo-hierarchy utility functions
 * These functions are extracted from GeoHierarchyMindmap component for testability
 */

import {
  getNextLevel,
  getPreviousLevel,
  findNodeByPath,
  calculateColorByIntensity,
} from '@/utils/geo-hierarchy-utils';
import type { GeoHierarchyNode } from '@/types/geo-analytics';

describe('geo-hierarchy-utils', () => {
  describe('getNextLevel', () => {
    it('should return next level for district', () => {
      expect(getNextLevel('district')).toBe('assembly');
    });

    it('should return next level for assembly', () => {
      expect(getNextLevel('assembly')).toBe('block');
    });

    it('should return next level for block', () => {
      expect(getNextLevel('block')).toBe('village');
    });

    it('should return next level for village', () => {
      expect(getNextLevel('village')).toBe('ulb');
    });

    it('should return ulb when already at ulb (max level)', () => {
      expect(getNextLevel('ulb')).toBe('ulb');
    });
  });

  describe('getPreviousLevel', () => {
    it('should return previous level for assembly', () => {
      expect(getPreviousLevel('assembly')).toBe('district');
    });

    it('should return previous level for block', () => {
      expect(getPreviousLevel('block')).toBe('assembly');
    });

    it('should return previous level for village', () => {
      expect(getPreviousLevel('village')).toBe('block');
    });

    it('should return previous level for ulb', () => {
      expect(getPreviousLevel('ulb')).toBe('village');
    });

    it('should return district when already at district (root level)', () => {
      expect(getPreviousLevel('district')).toBe('district');
    });
  });

  describe('findNodeByPath', () => {
    const mockHierarchy: GeoHierarchyNode[] = [
      {
        name: 'रायपुर',
        value: 5,
        level: 'district',
        district: 'रायपुर',
        path: ['रायपुर'],
        children: [
          {
            name: 'रायपुर शहर',
            value: 3,
            level: 'assembly',
            district: 'रायपुर',
            assembly: 'रायपुर शहर',
            path: ['रायपुर', 'रायपुर शहर'],
            children: [
              {
                name: 'रायपुर ब्लॉक',
                value: 2,
                level: 'block',
                district: 'रायपुर',
                assembly: 'रायपुर शहर',
                block: 'रायपुर ब्लॉक',
                path: ['रायपुर', 'रायपुर शहर', 'रायपुर ब्लॉक'],
                children: [],
              },
            ],
          },
          {
            name: 'रायपुर ग्रामीण',
            value: 2,
            level: 'assembly',
            district: 'रायपुर',
            assembly: 'रायपुर ग्रामीण',
            path: ['रायपुर', 'रायपुर ग्रामीण'],
            children: [],
          },
        ],
      },
      {
        name: 'बिलासपुर',
        value: 5,
        level: 'district',
        district: 'बिलासपुर',
        path: ['बिलासपुर'],
        children: [],
      },
    ];

    it('should find node at root level', () => {
      const result = findNodeByPath(mockHierarchy, ['रायपुर']);
      expect(result).not.toBeNull();
      expect(result?.name).toBe('रायपुर');
      expect(result?.level).toBe('district');
    });

    it('should find node at second level (assembly)', () => {
      const result = findNodeByPath(mockHierarchy, ['रायपुर', 'रायपुर शहर']);
      expect(result).not.toBeNull();
      expect(result?.name).toBe('रायपुर शहर');
      expect(result?.level).toBe('assembly');
    });

    it('should find node at third level (block)', () => {
      const result = findNodeByPath(mockHierarchy, ['रायपुर', 'रायपुर शहर', 'रायपुर ब्लॉक']);
      expect(result).not.toBeNull();
      expect(result?.name).toBe('रायपुर ब्लॉक');
      expect(result?.level).toBe('block');
    });

    it('should return null for invalid path', () => {
      const result = findNodeByPath(mockHierarchy, ['Nonexistent']);
      expect(result).toBeNull();
    });

    it('should return null for partially valid path', () => {
      const result = findNodeByPath(mockHierarchy, ['रायपुर', 'Nonexistent']);
      expect(result).toBeNull();
    });

    it('should return null for empty path', () => {
      const result = findNodeByPath(mockHierarchy, []);
      expect(result).toBeNull();
    });

    it('should return null when path exceeds node depth', () => {
      const result = findNodeByPath(mockHierarchy, ['रायपुर', 'रायपुर ग्रामीण', 'Nonexistent']);
      expect(result).toBeNull();
    });

    it('should handle node with no children', () => {
      const result = findNodeByPath(mockHierarchy, ['बिलासपुर']);
      expect(result).not.toBeNull();
      expect(result?.name).toBe('बिलासपुर');
      expect(result?.children).toEqual([]);
    });

    it('should handle empty hierarchy', () => {
      const result = findNodeByPath([], ['रायपुर']);
      expect(result).toBeNull();
    });

    it('should find second district in hierarchy', () => {
      const result = findNodeByPath(mockHierarchy, ['बिलासपुर']);
      expect(result).not.toBeNull();
      expect(result?.name).toBe('बिलासपुर');
    });
  });

  describe('calculateColorByIntensity', () => {
    it('should return default color for zero maxValue', () => {
      expect(calculateColorByIntensity(10, 0)).toBe('#10B981');
    });

    it('should return light green for minimum intensity', () => {
      const color = calculateColorByIntensity(0, 100);
      expect(color).toBe('rgb(209, 250, 229)'); // Light green #D1FAE5
    });

    it('should return dark green for maximum intensity', () => {
      const color = calculateColorByIntensity(100, 100);
      expect(color).toBe('rgb(16, 185, 129)'); // Dark green #10B981
    });

    it('should return medium color for 50% intensity', () => {
      const color = calculateColorByIntensity(50, 100);
      // Should be between light and dark green
      expect(color).toMatch(/^rgb\(\d+, \d+, \d+\)$/);
      const [r, g, b] = color.match(/\d+/g)!.map(Number);
      expect(r).toBeGreaterThan(16);
      expect(r).toBeLessThan(209);
      expect(g).toBeGreaterThan(185);
      expect(g).toBeLessThan(250);
      expect(b).toBeGreaterThan(129);
      expect(b).toBeLessThan(229);
    });

    it('should cap intensity at 1.0 when value exceeds maxValue', () => {
      const color = calculateColorByIntensity(200, 100);
      // Should return maximum intensity color (dark green)
      expect(color).toBe('rgb(16, 185, 129)');
    });

    it('should handle fractional values', () => {
      const color = calculateColorByIntensity(25.5, 100);
      expect(color).toMatch(/^rgb\(\d+, \d+, \d+\)$/);
    });

    it('should handle very small values', () => {
      const color = calculateColorByIntensity(1, 1000);
      expect(color).toMatch(/^rgb\(\d+, \d+, \d+\)$/);
      // Should be very close to light green
      const [r, g, b] = color.match(/\d+/g)!.map(Number);
      expect(r).toBeGreaterThan(200);
      expect(g).toBeGreaterThan(245);
      expect(b).toBeGreaterThan(220);
    });

    it('should handle equal value and maxValue', () => {
      const color = calculateColorByIntensity(50, 50);
      expect(color).toBe('rgb(16, 185, 129)'); // Maximum intensity
    });

    it('should handle zero value with non-zero maxValue', () => {
      const color = calculateColorByIntensity(0, 100);
      expect(color).toBe('rgb(209, 250, 229)'); // Minimum intensity (light green)
    });
  });
});

