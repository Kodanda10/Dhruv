import { parsePost } from '@/utils/parse';

describe('parse activities and inferred locations', () => {
  it('detects activities like शिलान्यास and निरीक्षण', () => {
    const p = parsePost({ id: 1, timestamp: '2025-09-06T00:00:00Z', content: 'रायगढ़ में परियोजना का शिलान्यास किया और निरीक्षण भी किया।' });
    expect(p.where).toContain('रायगढ़');
    expect(p.what).toEqual(expect.arrayContaining(['शिलान्यास', 'निरीक्षण']));
  });

  it('extracts multi-activity tokens like जन्मदिन, प्रार्थना, शुभकामनायें', () => {
    const p = parsePost({ id: 2, timestamp: '2025-09-06T00:00:00Z', content: 'भारतीय जनता पार्टी के नेता को जन्मदिन की शुभकामनायें और प्रार्थना।' });
    expect(p.what).toEqual(expect.arrayContaining(['जन्मदिन', 'प्रार्थना', 'शुभकामनायें']));
  });

  it('captures नई दिल्ली from sentence constructs', () => {
    const p = parsePost({ id: 3, timestamp: '2025-09-03T00:00:00Z', content: 'आज नई दिल्ली में महत्वपूर्ण बैठक आयोजित हुई।' });
    expect(p.where).toContain('नई दिल्ली');
    expect(p.what).toContain('बैठक');
  });
});

