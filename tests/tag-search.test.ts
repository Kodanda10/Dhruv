import {
  buildSearchKeys,
  matchTagFlexible,
  transliterateDevanagariToLatin,
} from '@/utils/tag-search';

describe('tag search normalization', () => {
  it('builds keys for nukta and transliteration', () => {
    const keys = buildSearchKeys('#रोज़गार');
    // includes nukta-free
    expect(Array.from(keys)).toEqual(expect.arrayContaining(['रोजगार']));
    // includes a latin variant
    const latin = transliterateDevanagariToLatin('रोज़गार');
    expect(Array.from(keys)).toEqual(expect.arrayContaining([latin]));
  });

  it('matches #रोज़गार with #रोजगार (no nukta)', () => {
    expect(matchTagFlexible('#रोज़गार', '#रोजगार')).toBe(true);
  });

  it('matches #रोज़गार with #Rojgar and #Rojgaar (hinglish)', () => {
    expect(matchTagFlexible('#रोज़गार', '#Rojgar')).toBe(true);
    expect(matchTagFlexible('#रोज़गार', '#Rojgaar')).toBe(true);
    expect(matchTagFlexible('#रोज़गार', '#Rozgar')).toBe(true);
  });

  it('builds keys with synonym enrichment for raigarh', () => {
    const keys = buildSearchKeys('raigarh');
    expect(Array.from(keys)).toEqual(expect.arrayContaining(['raygarh']));
  });
});
