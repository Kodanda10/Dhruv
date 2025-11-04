import { describe, it, expect, beforeEach } from '@jest/globals';
import * as d3 from 'd3';
import {
  createTimeScale,
  createLinearScale,
  createOrdinalScale,
  createPieScale,
  getHindiDayLabels,
  classifyNarrative,
  generateInsights
} from '@/utils/d3Helpers';

// Mock D3
jest.mock('d3', () => ({
  scaleSequential: jest.fn(() => {
    const scale = jest.fn((value) => `color-${value}`) as any;
    scale.domain = jest.fn().mockReturnValue(scale);
    scale.range = jest.fn().mockReturnValue(scale);
    return scale;
  }),
  interpolateBlues: jest.fn(),
  extent: jest.fn((arr) => [Math.min(...arr), Math.max(...arr)]),
  scaleTime: jest.fn(() => {
    const scale = jest.fn((value) => value) as any;
    scale.domain = jest.fn().mockReturnValue(scale);
    scale.range = jest.fn().mockReturnValue(scale);
    return scale;
  }),
  scaleLinear: jest.fn(() => {
    const scale = jest.fn((value) => value) as any;
    scale.domain = jest.fn().mockReturnValue(scale);
    scale.range = jest.fn().mockReturnValue(scale);
    return scale;
  }),
  scaleBand: jest.fn(() => {
    const scale = jest.fn((value) => value) as any;
    scale.domain = jest.fn().mockReturnValue(scale);
    scale.range = jest.fn().mockReturnValue(scale);
    scale.padding = jest.fn().mockReturnValue(scale);
    return scale;
  }),
  pie: jest.fn(() => {
    const pie = jest.fn((data) => data) as any;
    pie.value = jest.fn().mockReturnValue(pie);
    pie.sort = jest.fn().mockReturnValue(pie);
    return pie;
  }),
}));

describe('d3Helpers extended', () => {
  describe('createTimeScale', () => {
    it('should create time scale with data', () => {
      const data = [
        { date: '2024-01-15', value: 10 },
        { date: '2024-02-15', value: 20 },
      ];

      const scale = createTimeScale(data, 800);

      expect(d3.scaleTime).toHaveBeenCalled();
      expect(scale).toBeDefined();
    });

    it('should handle empty data', () => {
      const scale = createTimeScale([], 800);

      expect(d3.scaleTime).toHaveBeenCalled();
      expect(scale).toBeDefined();
    });

    it('should use custom date field', () => {
      const data = [
        { timestamp: '2024-01-15', value: 10 },
        { timestamp: '2024-02-15', value: 20 },
      ];

      const scale = createTimeScale(data, 800, 'timestamp');

      expect(d3.scaleTime).toHaveBeenCalled();
      expect(scale).toBeDefined();
    });
  });

  describe('createLinearScale', () => {
    it('should create linear scale with data', () => {
      const data = [10, 20, 30, 40, 50];
      const scale = createLinearScale(data, 400);

      expect(d3.scaleLinear).toHaveBeenCalled();
      expect(scale).toBeDefined();
    });

    it('should handle empty data', () => {
      const scale = createLinearScale([], 400);

      expect(d3.scaleLinear).toHaveBeenCalled();
      expect(scale).toBeDefined();
    });

    it('should handle single value', () => {
      const scale = createLinearScale([25], 400);

      expect(d3.scaleLinear).toHaveBeenCalled();
      expect(scale).toBeDefined();
    });
  });

  describe('createOrdinalScale', () => {
    it('should create ordinal scale', () => {
      const data = ['Jan', 'Feb', 'Mar'];
      const scale = createOrdinalScale(data, 800);

      expect(d3.scaleBand).toHaveBeenCalled();
      expect(scale).toBeDefined();
    });

    it('should handle empty data', () => {
      const scale = createOrdinalScale([], 800);

      expect(d3.scaleBand).toHaveBeenCalled();
      expect(scale).toBeDefined();
    });
  });

  describe('createPieScale', () => {
    it('should create pie scale', () => {
      const data = [
        { label: 'A', value: 10 },
        { label: 'B', value: 20 },
      ];

      const pie = createPieScale(data);

      expect(d3.pie).toHaveBeenCalled();
      expect(pie).toBeDefined();
    });

    it('should handle empty data', () => {
      const pie = createPieScale([]);

      expect(d3.pie).toHaveBeenCalled();
      expect(pie).toBeDefined();
    });
  });

  describe('getHindiDayLabels', () => {
    it('should return all Hindi day labels', () => {
      const labels = getHindiDayLabels();

      expect(labels['0']).toBe('रविवार');
      expect(labels['1']).toBe('सोमवार');
      expect(labels['2']).toBe('मंगलवार');
      expect(labels['3']).toBe('बुधवार');
      expect(labels['4']).toBe('गुरुवार');
      expect(labels['5']).toBe('शुक्रवार');
      expect(labels['6']).toBe('शनिवार');
    });

    it('should return all 7 days', () => {
      const labels = getHindiDayLabels();
      expect(Object.keys(labels).length).toBe(7);
    });
  });

  describe('classifyNarrative', () => {
    it('should classify as Schemes', () => {
      const tweet = {
        content: 'योजना की घोषणा',
        parsed: { event_type: 'scheme_announcement' }
      };

      expect(classifyNarrative(tweet)).toBe('Schemes');
    });

    it('should classify as Tribute', () => {
      const tweet = {
        content: 'शोक संदेश',
        parsed: { event_type: 'condolence' }
      };

      expect(classifyNarrative(tweet)).toBe('Tribute');
    });

    it('should classify as Development', () => {
      const tweet = {
        content: 'विकास कार्य',
        parsed: { event_type: 'inauguration' }
      };

      expect(classifyNarrative(tweet)).toBe('Development');
    });

    it('should classify as Politics', () => {
      const tweet = {
        content: 'चुनाव की घोषणा',
        parsed: { event_type: 'other' }
      };

      expect(classifyNarrative(tweet)).toBe('Politics');
    });

    it('should return Other for unknown content', () => {
      const tweet = {
        content: 'सामान्य सूचना',
        parsed: { event_type: 'other' }
      };

      expect(classifyNarrative(tweet)).toBe('Other');
    });

    it('should handle missing parsed data', () => {
      const tweet = {
        content: 'सामान्य सूचना'
      };

      expect(classifyNarrative(tweet)).toBe('Other');
    });

    it('should handle empty content', () => {
      const tweet = {
        content: '',
        parsed: {}
      };

      expect(classifyNarrative(tweet)).toBe('Other');
    });

    it('should be case-insensitive', () => {
      const tweet = {
        content: 'योजना',
        parsed: { event_type: 'SCHEME_ANNOUNCEMENT' }
      };

      expect(classifyNarrative(tweet)).toBe('Schemes');
    });
  });

  describe('generateInsights', () => {
    it('should generate insights from current data', () => {
      const currentData = {
        locations: [{ name: 'रायपुर', count: 10 }],
        avgConfidence: 0.85,
        eventTypes: [{ label: 'बैठक', percentage: 30 }]
      };

      const insights = generateInsights(currentData);

      expect(insights.length).toBeGreaterThan(0);
      expect(insights.length).toBeLessThanOrEqual(4);
    });

    it('should include most active location', () => {
      const currentData = {
        locations: [{ name: 'रायपुर', count: 10 }]
      };

      const insights = generateInsights(currentData);

      const locationInsight = insights.find(i => i.title.includes('स्थान'));
      expect(locationInsight).toBeDefined();
      expect(locationInsight?.value).toContain('रायपुर');
    });

    it('should include average confidence', () => {
      const currentData = {
        avgConfidence: 0.85
      };

      const insights = generateInsights(currentData);

      const confidenceInsight = insights.find(i => i.title.includes('विश्वास'));
      expect(confidenceInsight).toBeDefined();
      expect(confidenceInsight?.value).toContain('85%');
    });

    it('should include most common event type', () => {
      const currentData = {
        eventTypes: [{ label: 'बैठक', percentage: 30 }]
      };

      const insights = generateInsights(currentData);

      const eventTypeInsight = insights.find(i => i.title.includes('दौरा'));
      expect(eventTypeInsight).toBeDefined();
    });

    it('should return max 4 insights', () => {
      const currentData = {
        locations: [
          { name: 'रायपुर', count: 10 },
          { name: 'बिलासपुर', count: 8 }
        ],
        avgConfidence: 0.85,
        eventTypes: [
          { label: 'बैठक', percentage: 30 },
          { label: 'रैली', percentage: 20 }
        ]
      };

      const insights = generateInsights(currentData);

      expect(insights.length).toBeLessThanOrEqual(4);
    });

    it('should handle empty data', () => {
      const insights = generateInsights({});

      expect(Array.isArray(insights)).toBe(true);
    });

    it('should handle missing optional fields', () => {
      const currentData = {
        locations: [{ name: 'रायपुर', count: 10 }]
      };

      const insights = generateInsights(currentData);

      expect(insights.length).toBeGreaterThan(0);
    });

    it('should format confidence as percentage', () => {
      const currentData = {
        avgConfidence: 0.75
      };

      const insights = generateInsights(currentData);

      const confidenceInsight = insights.find(i => i.title.includes('विश्वास'));
      expect(confidenceInsight?.value).toContain('75%');
    });

    it('should handle previous data parameter', () => {
      const currentData = {
        locations: [{ name: 'रायपुर', count: 10 }]
      };
      const previousData = {
        locations: [{ name: 'बिलासपुर', count: 8 }]
      };

      const insights = generateInsights(currentData, previousData);

      expect(Array.isArray(insights)).toBe(true);
    });
  });
});

