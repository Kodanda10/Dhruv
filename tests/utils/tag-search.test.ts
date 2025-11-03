import { describe, it, expect } from '@jest/globals';
import { buildSearchKeys, matchTagFlexible, matchTextFlexible, transliterateDevanagariToLatin } from '@/utils/tag-search';

describe('transliterateDevanagariToLatin', () => {
  it('should transliterate Devanagari to Latin', () => {
    const result = transliterateDevanagariToLatin('राजनीति');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('should convert to lowercase', () => {
    const result = transliterateDevanagariToLatin('राजनीति');
    expect(result).toBe(result.toLowerCase());
  });

  it('should handle nukta characters', () => {
    const result = transliterateDevanagariToLatin('क़');
    expect(result).toBeDefined();
  });

  it('should handle matra characters', () => {
    const result = transliterateDevanagariToLatin('ा');
    expect(result).toBeDefined();
  });

  it('should return empty string for empty input', () => {
    const result = transliterateDevanagariToLatin('');
    expect(result).toBe('');
  });
});

describe('buildSearchKeys', () => {
  it('should build search keys from tag', () => {
    const keys = buildSearchKeys('#रोज़गार');
    
    expect(keys).toBeInstanceOf(Set);
    expect(keys.size).toBeGreaterThan(0);
  });

  it('should strip hash from beginning', () => {
    const keys = buildSearchKeys('#test');
    
    expect(Array.from(keys).some(k => !k.startsWith('#'))).toBe(true);
  });

  it('should strip @ from beginning', () => {
    const keys = buildSearchKeys('@test');
    
    expect(Array.from(keys).some(k => !k.startsWith('@'))).toBe(true);
  });

  it('should convert to lowercase', () => {
    const keys = buildSearchKeys('TEST');
    
    Array.from(keys).forEach(key => {
      expect(key).toBe(key.toLowerCase());
    });
  });

  it('should create variants for Delhi', () => {
    const keys = buildSearchKeys('new delhi');
    
    expect(Array.from(keys).some(k => k.includes('delhi'))).toBe(true);
    expect(Array.from(keys).some(k => k.includes('dilli'))).toBe(true);
  });

  it('should create variants for Raigarh', () => {
    const keys = buildSearchKeys('raigarh');
    
    expect(Array.from(keys).some(k => k.includes('raigarh') || k.includes('raygarh'))).toBe(true);
  });

  it('should create variants for Raipur', () => {
    const keys = buildSearchKeys('raipur');
    
    expect(Array.from(keys).some(k => k.includes('raipur'))).toBe(true);
  });

  it('should handle Hindi input', () => {
    const keys = buildSearchKeys('रायपुर');
    
    expect(keys.size).toBeGreaterThan(0);
  });

  it('should create transliteration variants', () => {
    const keys = buildSearchKeys('रोज़गार');
    
    // Should include transliterated variants
    expect(keys.size).toBeGreaterThan(1);
  });
});

describe('matchTagFlexible', () => {
  it('should match exact tags', () => {
    expect(matchTagFlexible('#test', '#test')).toBe(true);
  });

  it('should match case-insensitive', () => {
    expect(matchTagFlexible('#Test', '#test')).toBe(true);
  });

  it('should match variants with different diacritics', () => {
    expect(matchTagFlexible('#रोज़गार', '#रोजगार')).toBe(true);
  });

  it('should match Devanagari to Latin transliteration', () => {
    expect(matchTagFlexible('रोज़गार', 'rozgar')).toBe(true);
  });

  it('should match substring matches', () => {
    expect(matchTagFlexible('testtag', 'test')).toBe(true);
  });

  it('should return false for empty strings', () => {
    expect(matchTagFlexible('', 'test')).toBe(false);
    expect(matchTagFlexible('test', '')).toBe(false);
  });

  it('should match Delhi variants', () => {
    expect(matchTagFlexible('new delhi', 'delhi')).toBe(true);
    expect(matchTagFlexible('delhi', 'dilli')).toBe(true);
  });

  it('should match Raigarh variants', () => {
    expect(matchTagFlexible('raigarh', 'raygarh')).toBe(true);
  });

  it('should handle hash symbols', () => {
    expect(matchTagFlexible('#test', 'test')).toBe(true);
    expect(matchTagFlexible('test', '#test')).toBe(true);
  });
});

describe('matchTextFlexible', () => {
  it('should be an alias for matchTagFlexible', () => {
    expect(matchTextFlexible('test', 'test')).toBe(true);
    expect(matchTextFlexible('#test', '#test')).toBe(true);
  });
});

