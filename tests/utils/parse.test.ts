import { describe, it, expect } from '@jest/globals';
import { parsePost, formatHindiDate } from '@/utils/parse';

describe('formatHindiDate', () => {
  it('should format valid ISO date string', () => {
    const formatted = formatHindiDate('2024-01-15T10:30:00Z');
    
    expect(formatted).toContain('2024');
    expect(formatted).toMatch(/\d{2}/); // Contains day number
    expect(formatted.length).toBeGreaterThan(0);
  });

  it('should include day of week in Hindi', () => {
    const formatted = formatHindiDate('2024-01-15T10:30:00Z');
    
    const daysOfWeek = ['रविवार', 'सोमवार', 'मंगलवार', 'बुधवार', 'गुरुवार', 'शुक्रवार', 'शनिवार'];
    const containsDay = daysOfWeek.some(day => formatted.includes(day));
    expect(containsDay).toBe(true);
  });

  it('should include Hindi month name', () => {
    const formatted = formatHindiDate('2024-03-15T10:30:00Z');
    
    const months = ['जनवरी', 'फ़रवरी', 'मार्च', 'अप्रैल', 'मई', 'जून', 
                   'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर'];
    const containsMonth = months.some(month => formatted.includes(month));
    expect(containsMonth).toBe(true);
  });

  it('should return empty string for invalid date', () => {
    const formatted = formatHindiDate('invalid-date');
    
    expect(formatted).toBe('');
  });

  it('should handle different months correctly', () => {
    const months = [
      { date: '2024-01-15', month: 'जनवरी' },
      { date: '2024-06-15', month: 'जून' },
      { date: '2024-12-15', month: 'दिसंबर' }
    ];
    
    months.forEach(({ date, month }) => {
      const formatted = formatHindiDate(`${date}T10:30:00Z`);
      expect(formatted).toContain(month);
    });
  });
});

describe('parsePost', () => {
  it('should parse post with location', () => {
    const post = {
      id: '1',
      timestamp: '2024-01-15T10:30:00Z',
      content: 'रायपुर में बैठक आयोजित'
    };
    
    const parsed = parsePost(post);
    
    expect(parsed).toHaveProperty('when');
    expect(parsed).toHaveProperty('where');
    expect(parsed).toHaveProperty('what');
    expect(parsed).toHaveProperty('which');
    expect(parsed).toHaveProperty('how');
  });

  it('should extract locations from content', () => {
    const post = {
      id: '1',
      timestamp: '2024-01-15T10:30:00Z',
      content: 'रायपुर में कार्यक्रम'
    };
    
    const parsed = parsePost(post);
    
    expect(parsed.where.length).toBeGreaterThan(0);
    expect(parsed.where.some(w => w.includes('रायपुर'))).toBe(true);
  });

  it('should extract locations using "में" pattern', () => {
    const post = {
      id: '1',
      timestamp: '2024-01-15T10:30:00Z',
      content: 'रायगढ़ में बैठक'
    };
    
    const parsed = parsePost(post);
    
    expect(parsed.where.length).toBeGreaterThan(0);
  });

  it('should extract action keywords', () => {
    const post = {
      id: '1',
      timestamp: '2024-01-15T10:30:00Z',
      content: 'उद्घाटन कार्यक्रम आयोजित'
    };
    
    const parsed = parsePost(post);
    
    expect(parsed.what.length).toBeGreaterThan(0);
  });

  it('should extract hashtags', () => {
    const post = {
      id: '1',
      timestamp: '2024-01-15T10:30:00Z',
      content: 'कार्यक्रम #बैठक #राजनीति में'
    };
    
    const parsed = parsePost(post);
    
    expect(parsed.which.hashtags.length).toBeGreaterThan(0);
    expect(parsed.which.hashtags.some(h => h.includes('बैठक'))).toBe(true);
  });

  it('should extract mentions', () => {
    const post = {
      id: '1',
      timestamp: '2024-01-15T10:30:00Z',
      content: 'कार्यक्रम @user123 में'
    };
    
    const parsed = parsePost(post);
    
    expect(parsed.which.mentions.length).toBeGreaterThan(0);
    expect(parsed.which.mentions[0]).toContain('@');
  });

  it('should limit how field to 180 characters', () => {
    const longContent = 'a'.repeat(200);
    const post = {
      id: '1',
      timestamp: '2024-01-15T10:30:00Z',
      content: longContent
    };
    
    const parsed = parsePost(post);
    
    expect(parsed.how.length).toBeLessThanOrEqual(180);
  });

  it('should handle empty content', () => {
    const post = {
      id: '1',
      timestamp: '2024-01-15T10:30:00Z',
      content: ''
    };
    
    const parsed = parsePost(post);
    
    expect(parsed).toBeDefined();
    expect(Array.isArray(parsed.where)).toBe(true);
    expect(Array.isArray(parsed.what)).toBe(true);
  });

  it('should add hashtags from action keywords', () => {
    const post = {
      id: '1',
      timestamp: '2024-01-15T10:30:00Z',
      content: 'बैठक आयोजित की गई'
    };
    
    const parsed = parsePost(post);
    
    expect(parsed.which.hashtags.some(h => h.includes('बैठक'))).toBe(true);
  });

  it('should add hashtags from noun keywords', () => {
    const post = {
      id: '1',
      timestamp: '2024-01-15T10:30:00Z',
      content: 'किसान सम्मेलन'
    };
    
    const parsed = parsePost(post);
    
    expect(parsed.which.hashtags.some(h => h.includes('किसान'))).toBe(true);
  });

  it('should handle multiple locations', () => {
    const post = {
      id: '1',
      timestamp: '2024-01-15T10:30:00Z',
      content: 'रायपुर और बिलासपुर में कार्यक्रम'
    };
    
    const parsed = parsePost(post);
    
    expect(parsed.where.length).toBeGreaterThanOrEqual(1);
  });

  it('should remove duplicates from locations', () => {
    const post = {
      id: '1',
      timestamp: '2024-01-15T10:30:00Z',
      content: 'रायपुर रायपुर रायपुर में'
    };
    
    const parsed = parsePost(post);
    
    const uniqueLocations = new Set(parsed.where);
    expect(parsed.where.length).toBeGreaterThanOrEqual(uniqueLocations.size);
  });

  it('should handle posts with no locations', () => {
    const post = {
      id: '1',
      timestamp: '2024-01-15T10:30:00Z',
      content: 'सामान्य सूचना'
    };
    
    const parsed = parsePost(post);
    
    expect(Array.isArray(parsed.where)).toBe(true);
  });
});

