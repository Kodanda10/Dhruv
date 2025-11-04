import { parseServerRows, sanitizeData } from './data-processing';

describe('Data Processing Utilities', () => {
  const mockServerRows = [
    {
      id: '1',
      tweet_id: '123',
      event_type: 'meeting',
      event_date: '2023-01-01T10:00:00Z',
      locations: ['Raipur', { name: 'Bilaspur' }],
      people_mentioned: ['PM Modi'],
      organizations: ['BJP'],
      schemes_mentioned: ['PM Kisan'],
      content: 'Meeting in Raipur',
      confidence: 0.9,
      needs_review: false,
      review_status: 'approved',
    },
    {
      id: '2',
      timestamp: '2023-01-02T11:00:00Z',
      parsed: {
        event_type: 'rally',
        locations: ['Delhi'],
        people: ['Rahul Gandhi'],
        organizations: ['Congress'],
        schemes: ['NYAY'],
        confidence: 0.8,
      },
      content: 'Rally in Delhi',
      needs_review: true,
      review_status: 'pending',
    },
    {
      id: '3',
      content: 'Unparsed tweet',
      timestamp: '2023-01-03T12:00:00Z',
    },
  ];

  describe('parseServerRows', () => {
    it('should correctly parse new database structure', () => {
      const parsed = parseServerRows([mockServerRows[0]]);
      expect(parsed).toHaveLength(1);
      expect(parsed[0]).toEqual({
        id: '1',
        ts: '2023-01-01T10:00:00Z',
        when: expect.any(String),
        where: ['Raipur', 'Bilaspur'],
        what: ['meeting'],
        which: {
          mentions: ['PM Modi'],
          hashtags: ['BJP', 'PM Kisan'],
        },
        schemes: ['PM Kisan'],
        how: 'Meeting in Raipur',
        confidence: 0.9,
        needs_review: false,
        review_status: 'approved',
      });
    });

    it('should correctly parse old parsed structure', () => {
      const parsed = parseServerRows([mockServerRows[1]]);
      expect(parsed).toHaveLength(1);
      expect(parsed[0]).toEqual({
        id: '2',
        ts: '2023-01-02T11:00:00Z',
        when: expect.any(String),
        where: ['Delhi'],
        what: ['rally'],
        which: {
          mentions: ['Rahul Gandhi'],
          hashtags: ['Congress', 'NYAY'],
        },
        schemes: ['NYAY'],
        how: 'Rally in Delhi',
        confidence: 0.8,
        needs_review: true,
        review_status: 'pending',
      });
    });

    it('should handle unparsed data as fallback', () => {
      const parsed = parseServerRows([mockServerRows[2]]);
      expect(parsed).toHaveLength(1);
      expect(parsed[0]).toEqual({
        id: '3',
        ts: '2023-01-03T12:00:00Z',
        when: expect.any(String),
        where: [],
        what: [],
        which: { mentions: [], hashtags: [] },
        schemes: [],
        how: 'Unparsed tweet',
      });
    });

    it('should handle mixed data structures', () => {
      const parsed = parseServerRows(mockServerRows);
      expect(parsed).toHaveLength(3);
      expect(parsed[0].id).toBe('1');
      expect(parsed[1].id).toBe('2');
      expect(parsed[2].id).toBe('3');
    });
  });

  describe('sanitizeData', () => {
    it('should sanitize data correctly, ensuring string arrays and types', () => {
      const parsedData = parseServerRows(mockServerRows);
      const sanitized = sanitizeData(parsedData);

      expect(sanitized).toHaveLength(3);

      // Check first item (new DB structure)
      expect(sanitized[0].where).toEqual(['Raipur', 'Bilaspur']);
      expect(sanitized[0].what).toEqual(['meeting']);
      expect(sanitized[0].which.mentions).toEqual(['PM Modi']);
      expect(sanitized[0].which.hashtags).toEqual(['BJP', 'PM Kisan']);
      expect(sanitized[0].schemes).toEqual(['PM Kisan']);
      expect(typeof sanitized[0].how).toBe('string');
      expect(typeof sanitized[0].when).toBe('string');
      expect(typeof sanitized[0].confidence).toBe('number');
      expect(typeof sanitized[0].needs_review).toBe('boolean');
      expect(typeof sanitized[0].review_status).toBe('string');

      // Check second item (old parsed structure)
      expect(sanitized[1].where).toEqual(['Delhi']);
      expect(sanitized[1].what).toEqual(['rally']);
      expect(sanitized[1].which.mentions).toEqual(['Rahul Gandhi']);
      expect(sanitized[1].which.hashtags).toEqual(['Congress', 'NYAY']);
      expect(sanitized[1].schemes).toEqual(['NYAY']);
      expect(typeof sanitized[1].how).toBe('string');
      expect(typeof sanitized[1].when).toBe('string');
      expect(typeof sanitized[1].confidence).toBe('number');
      expect(typeof sanitized[1].needs_review).toBe('boolean');
      expect(typeof sanitized[1].review_status).toBe('string');

      // Check third item (unparsed fallback)
      expect(sanitized[2].where).toEqual([]);
      expect(sanitized[2].what).toEqual([]);
      expect(sanitized[2].which.mentions).toEqual([]);
      expect(sanitized[2].which.hashtags).toEqual([]);
      expect(sanitized[2].schemes).toEqual([]);
      expect(typeof sanitized[2].how).toBe('string');
      expect(typeof sanitized[2].when).toBe('string');
      expect(sanitized[2].confidence).toBe(0);
      expect(sanitized[2].needs_review).toBe(false);
      expect(sanitized[2].review_status).toBe('pending');
    });

    it('should handle rows with missing or malformed properties gracefully', () => {
      const malformedRows = [
        {
          id: '4',
          ts: '2023-01-04T00:00:00Z',
          where: null, // Malformed
          what: 'single_string', // Malformed
          which: { mentions: null, hashtags: 'single_string' }, // Malformed
          how: 123, // Malformed
          confidence: 'high', // Malformed
          needs_review: 1, // Malformed
          review_status: null, // Malformed
        },
        {
          id: '5',
          ts: '2023-01-05T00:00:00Z',
          where: ['Location A', { invalid: true }], // Mixed malformed
          what: ['Event A', null], // Mixed malformed
          which: { mentions: ['Person A', null], hashtags: ['Tag A', { invalid: true }] }, // Mixed malformed
          schemes: ['Scheme A', null],
        }
      ];

      const parsedMalformed = parseServerRows(malformedRows);
      const sanitized = sanitizeData(parsedMalformed);

      expect(sanitized).toHaveLength(2);

      // Check malformed row 1
      expect(sanitized[0].where).toEqual([]);
      expect(sanitized[0].what).toEqual([]);
      expect(sanitized[0].which.mentions).toEqual([]);
      expect(sanitized[0].which.hashtags).toEqual([]);
      expect(sanitized[0].schemes).toEqual([]);
      expect(typeof sanitized[0].how).toBe('string');
      expect(typeof sanitized[0].confidence).toBe('number');
      expect(sanitized[0].confidence).toBe(0);
      expect(typeof sanitized[0].needs_review).toBe('boolean');
      expect(sanitized[0].needs_review).toBe(false);
      expect(typeof sanitized[0].review_status).toBe('string');
      expect(sanitized[0].review_status).toBe('pending');

      // Check malformed row 2
      expect(sanitized[1].where).toEqual(['Location A']);
      expect(sanitized[1].what).toEqual(['Event A']);
      expect(sanitized[1].which.mentions).toEqual(['Person A']);
      expect(sanitized[1].which.hashtags).toEqual(['Tag A']);
      expect(sanitized[1].schemes).toEqual(['Scheme A']);
    });
  });
});
