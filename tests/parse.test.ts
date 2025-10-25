import { parsePost, formatHindiDate } from '@/utils/parse';

describe('parse util', () => {
  it('formats date to Hindi (Day, DD MMMM YYYY)', () => {
    const iso = '2025-09-05T10:30:00Z';
    expect(formatHindiDate(iso)).toMatch(/[,\s]05 सितंबर 2025$/);
  });

  it('extracts where, what, which, how from content', () => {
    const post = {
      id: 999,
      timestamp: '2025-09-05T10:30:00Z',
      content:
        'आज दिल्ली में भूमिपूजन समारोह में सम्मिलित हुआ। @PMOIndia के साथ चर्चा हुई। #विकास #समारोह',
    };

    const out = parsePost(post);
    expect(out.when).toMatch(/05 सितंबर 2025$/);
    expect(out.where).toContain('दिल्ली');
    expect(out.what).toEqual(expect.arrayContaining(['भूमिपूजन', 'समारोह']));
    expect(out.which.mentions).toContain('@PMOIndia');
    expect(out.which.hashtags).toEqual(expect.arrayContaining(['#विकास', '#समारोह']));
    expect(typeof out.how).toBe('string');
    expect(out.how.length).toBeGreaterThan(5);
  });

  it('extracts place from में heuristic', () => {
    const post = {
      id: 1000,
      timestamp: '2025-09-05T10:30:00Z',
      content: 'रायगढ़ में कार्यक्रम हुआ।',
    };
    const out = parsePost(post);
    expect(out.where).toContain('रायगढ़');
  });
});
