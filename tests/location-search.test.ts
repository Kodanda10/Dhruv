import { matchTextFlexible } from '@/utils/tag-search';

describe('location flexible matching', () => {
  it('matches दिल्ली with Delhi and Dilli', () => {
    expect(matchTextFlexible('दिल्ली', 'Delhi')).toBe(true);
    expect(matchTextFlexible('दिल्ली', 'Dilli')).toBe(true);
  });
  it('matches नई दिल्ली with New Delhi and Nayi Dilli', () => {
    expect(matchTextFlexible('नई दिल्ली', 'New Delhi')).toBe(true);
    expect(matchTextFlexible('नयी दिल्ली', 'Nayi Dilli')).toBe(true);
  });
  it('matches रायगढ़ with Raigarh and Raygarh', () => {
    expect(matchTextFlexible('रायगढ़', 'Raigarh')).toBe(true);
    expect(matchTextFlexible('रायगढ़', 'Raygarh')).toBe(true);
  });
});

