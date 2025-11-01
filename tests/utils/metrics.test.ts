import { describe, it, expect } from '@jest/globals';
import { computeMetrics } from '@/utils/metrics';

describe('computeMetrics', () => {
  it('should compute metrics from parsed tweets', () => {
    const metrics = computeMetrics();
    
    expect(metrics).toHaveProperty('places');
    expect(metrics).toHaveProperty('actions');
    expect(Array.isArray(metrics.places)).toBe(true);
    expect(Array.isArray(metrics.actions)).toBe(true);
  });

  it('should return top 5 places', () => {
    const metrics = computeMetrics();
    
    expect(metrics.places.length).toBeLessThanOrEqual(5);
    metrics.places.forEach(place => {
      expect(place).toHaveProperty('key');
      expect(place).toHaveProperty('count');
      expect(typeof place.key).toBe('string');
      expect(typeof place.count).toBe('number');
    });
  });

  it('should return top 10 actions', () => {
    const metrics = computeMetrics();
    
    expect(metrics.actions.length).toBeLessThanOrEqual(10);
    metrics.actions.forEach(action => {
      expect(action).toHaveProperty('key');
      expect(action).toHaveProperty('count');
      expect(typeof action.key).toBe('string');
      expect(typeof action.count).toBe('number');
    });
  });

  it('should sort places by count descending', () => {
    const metrics = computeMetrics();
    
    if (metrics.places.length > 1) {
      for (let i = 0; i < metrics.places.length - 1; i++) {
        expect(metrics.places[i].count).toBeGreaterThanOrEqual(metrics.places[i + 1].count);
      }
    }
  });

  it('should sort actions by count descending', () => {
    const metrics = computeMetrics();
    
    if (metrics.actions.length > 1) {
      for (let i = 0; i < metrics.actions.length - 1; i++) {
        expect(metrics.actions[i].count).toBeGreaterThanOrEqual(metrics.actions[i + 1].count);
      }
    }
  });

  it('should handle empty parsed data gracefully', () => {
    const metrics = computeMetrics();
    
    // Should return valid structure even if no data
    expect(metrics.places).toBeDefined();
    expect(metrics.actions).toBeDefined();
  });

  it('should have non-negative counts', () => {
    const metrics = computeMetrics();
    
    metrics.places.forEach(place => {
      expect(place.count).toBeGreaterThanOrEqual(0);
    });
    
    metrics.actions.forEach(action => {
      expect(action.count).toBeGreaterThanOrEqual(0);
    });
  });
});

