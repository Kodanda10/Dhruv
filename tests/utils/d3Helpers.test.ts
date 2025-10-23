// Mock D3 for tests
jest.mock('d3', () => ({
  scaleSequential: jest.fn(() => {
    const scale = jest.fn((value) => `color-${value}`) as any;
    scale.domain = jest.fn().mockReturnValue(scale);
    scale.range = jest.fn().mockReturnValue(scale);
    return scale;
  }),
  interpolateBlues: jest.fn(),
  extent: jest.fn(),
  scaleTime: jest.fn(() => {
    const scale = jest.fn((value) => value) as any;
    scale.domain = jest.fn().mockReturnValue(scale);
    scale.range = jest.fn().mockReturnValue(scale);
    return scale;
  }),
  scaleLinear: jest.fn(() => {
    const scale = jest.fn((value) => value);
    scale.domain = jest.fn().mockReturnValue(scale);
    scale.range = jest.fn().mockReturnValue(scale);
    return scale;
  }),
  scaleBand: jest.fn(() => {
    const scale = jest.fn((value) => value);
    scale.domain = jest.fn().mockReturnValue(scale);
    scale.range = jest.fn().mockReturnValue(scale);
    scale.padding = jest.fn().mockReturnValue(scale);
    return scale;
  }),
  pie: jest.fn(() => {
    const pie = jest.fn((data) => data);
    pie.value = jest.fn().mockReturnValue(pie);
    pie.sort = jest.fn().mockReturnValue(pie);
    return pie;
  }),
}));

import { formatDateForChart, getColorScale, calculateChartDimensions } from '@/utils/d3Helpers';

describe('d3Helpers', () => {
  describe('formatDateForChart', () => {
    it('should format date string to Date object', () => {
      const dateString = '2024-01-15T10:30:00Z';
      const result = formatDateForChart(dateString);
      
      expect(result).toBeInstanceOf(Date);
      expect(result.toISOString()).toBe('2024-01-15T10:30:00.000Z');
    });

    it('should handle invalid date strings', () => {
      const invalidDate = 'invalid-date';
      const result = formatDateForChart(invalidDate);
      
      expect(result).toBeInstanceOf(Date);
      expect(isNaN(result.getTime())).toBe(true);
    });

    it('should handle empty string', () => {
      const emptyString = '';
      const result = formatDateForChart(emptyString);
      
      expect(result).toBeInstanceOf(Date);
      expect(isNaN(result.getTime())).toBe(true);
    });
  });

  describe('getColorScale', () => {
    it('should return color scale for given data range', () => {
      const data = [10, 20, 30, 40, 50];
      const scale = getColorScale(data);
      
      expect(typeof scale).toBe('function');
      expect(scale(10)).toBeDefined();
      expect(scale(50)).toBeDefined();
    });

    it('should handle empty data array', () => {
      const data: number[] = [];
      const scale = getColorScale(data);
      
      expect(typeof scale).toBe('function');
    });

    it('should handle single value data', () => {
      const data = [25];
      const scale = getColorScale(data);
      
      expect(typeof scale).toBe('function');
      expect(scale(25)).toBeDefined();
    });
  });

  describe('calculateChartDimensions', () => {
    it('should calculate dimensions for given container size', () => {
      const containerWidth = 800;
      const containerHeight = 400;
      const result = calculateChartDimensions(containerWidth, containerHeight);
      
      expect(result).toEqual({
        width: 760,
        height: 360,
        margin: {
          top: 20,
          right: 20,
          bottom: 20,
          left: 20
        }
      });
    });

    it('should handle minimum dimensions', () => {
      const containerWidth = 100;
      const containerHeight = 50;
      const result = calculateChartDimensions(containerWidth, containerHeight);
      
      expect(result.width).toBeGreaterThan(0);
      expect(result.height).toBeGreaterThan(0);
      expect(result.margin.top).toBe(20);
    });

    it('should handle zero dimensions', () => {
      const containerWidth = 0;
      const containerHeight = 0;
      const result = calculateChartDimensions(containerWidth, containerHeight);
      
      expect(result.width).toBeGreaterThanOrEqual(0);
      expect(result.height).toBeGreaterThanOrEqual(0);
    });
  });
});
