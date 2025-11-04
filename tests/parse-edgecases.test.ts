import { parsePost } from '@/utils/parse';

describe('parse.ts edge cases', () => {
  it('returns empty formatted date for invalid ISO timestamp', () => {
    const post = {
      id: '1',
      timestamp: 'not-a-real-date',
      content: 'दिल्ली में कार्यक्रम आयोजित किया गया।',
    };
    const result = parsePost(post);
    expect(result.when).toBe('');
  });

  it('में heuristic adds known place when token before "में" includes a known place (exact token)', () => {
    const post = {
      id: '2',
      timestamp: '2024-10-10T12:00:00.000Z',
      content: 'आज रायगढ़ में शिलान्यास किया गया।',
    };
    const result = parsePost(post);
    expect(result.where).toContain('रायगढ़');
  });

  it('में heuristic extracts known place within a larger token before "में" (substring match)', () => {
    const post = {
      id: '3',
      timestamp: '2024-10-10T12:00:00.000Z',
      content: 'खरसिया नगर में कार्यक्रम सम्पन्न हुआ।',
    };
    const result = parsePost(post);
    // The heuristic should pull the known place "खरसिया" from "खरसिया नगर"
    expect(result.where).toContain('खरसिया');
  });

  it('में heuristic does not add when no known place is present before "में"', () => {
    const post = {
      id: '4',
      timestamp: '2024-10-10T12:00:00.000Z',
      content: 'सुबह में बैठक रखी गई।', // "सुबह" is not a known place in the PLACE_REGEX
    };
    const result = parsePost(post);
    expect(result.where).toEqual([]);
  });
});
