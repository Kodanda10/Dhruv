type Post = { id: string | number; timestamp: string; content: string };

const MONTHS_HI = [
  'जनवरी',
  'फ़रवरी',
  'मार्च',
  'अप्रैल',
  'मई',
  'जून',
  'जुलाई',
  'अगस्त',
  'सितंबर',
  'अक्टूबर',
  'नवंबर',
  'दिसंबर',
];

const DAYS_HI = ['रविवार', 'सोमवार', 'मंगलवार', 'बुधवार', 'गुरुवार', 'शुक्रवार', 'शनिवार'];

export function formatHindiDate(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
  const dayNum = String(d.getUTCDate()).padStart(2, '0');
  const month = MONTHS_HI[d.getUTCMonth()];
  const year = d.getUTCFullYear();
  const dow = DAYS_HI[d.getUTCDay()];
  return `${dow}, ${dayNum} ${month} ${year}`;
}

// Known places and variants; extendable
const PLACE_REGEX = /(नई दिल्ली|नयी दिल्ली|रायगढ़|दिल्ली|रायपुर|भारत|छत्तीसगढ़|खरसिया|गढ़ उमरिया|बस्तर|सरगुजा|जशपुर|बगीचा)/g;
const HASHTAG_REGEX = /#[^\s#]+/g;
const MENTION_REGEX = /@[A-Za-z0-9_]+/g;
const ACTION_KEYWORDS = [
  'बैठक',
  'समापन',
  'शिलान्यास',
  'निरीक्षण',
  'भूमिपूजन',
  'उद्घाटन',
  'संवाद',
  'जन्मदिन',
  'स्वागत',
  'नमन',
  'प्रार्थना',
  'शुभकामनायें',
  'लोकार्पण',
  'समीक्षा',
  'समारोह',
  'सम्मिलित',
];

// Noun/subject keywords to surface also as hashtags from content
const NOUN_TAG_KEYWORDS = [
  'किसान',
  'सड़क',
  'शिविर',
  'महिला',
  'स्टार्टअप',
];

export function parsePost(post: Post) {
  const content = post.content || '';
  const when = formatHindiDate(post.timestamp);
  const whereSet = new Set<string>();
  // Direct matches from known list
  const matchWhere = content.match(PLACE_REGEX) || [];
  matchWhere.forEach((w) => whereSet.add(w));
  // Heuristic: tokens before 'में' (e.g., 'रायगढ़ में' -> 'रायगढ़')
  // Replace unsupported \p{L} (Python-style) with explicit Unicode ranges + ASCII letters
  const inMatches = Array.from(content.matchAll(/([\u0900-\u097F\u0600-\u06FFA-Za-z ]{2,}?)\s+में/gu));
  for (const m of inMatches) {
    const token = (m[1] || '').trim();
    if (token.length >= 2) {
      // If token includes a known place word, prefer it
      const known = (token.match(PLACE_REGEX) || [])[0];
      if (known) whereSet.add(known);
    }
  }
  const where = Array.from(whereSet);

  const hashtagsSet = new Set<string>(content.match(HASHTAG_REGEX) || []);
  const mentions = Array.from(new Set(content.match(MENTION_REGEX) || []));

  const what: string[] = [];
  for (const k of ACTION_KEYWORDS) {
    if (content.includes(k)) {
      what.push(k);
      hashtagsSet.add(`#${k}`);
    }
  }
  for (const k of NOUN_TAG_KEYWORDS) {
    if (content.includes(k)) hashtagsSet.add(`#${k}`);
  }

  const hashtags = Array.from(hashtagsSet);

  const how = content.trim().slice(0, 180);

  return {
    when,
    where,
    what,
    which: { mentions, hashtags },
    how,
  };
}
