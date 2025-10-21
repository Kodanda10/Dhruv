import { z } from 'zod';

const PostSchema = z.object({
  id: z.union([z.string(), z.number()]),
  timestamp: z.string(),
  content: z.string(),
});

type Post = z.infer<typeof PostSchema>;

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

export function formatHindiDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const dayNum = String(d.getUTCDate()).padStart(2, '0');
  const month = MONTHS_HI[d.getUTCMonth()];
  const year = d.getUTCFullYear();
  const dow = DAYS_HI[d.getUTCDay()];
  return `${dow}, ${dayNum} ${month} ${year}`;
}

// Known places and variants; extendable
const PLACE_REGEX =
  /(नई दिल्ली|नयी दिल्ली|रायगढ़|दिल्ली|रायपुर|भारत|छत्तीसगढ़|खरसिया|गढ़ उमरिया|बस्तर|सरगुजा|जशपुर|बगीचा)/g;
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
const NOUN_TAG_KEYWORDS = ['किसान', 'सड़क', 'शिविर', 'महिला', 'स्टार्टअप'];

export function parsePost(post: Post) {
  const validatedPost = PostSchema.parse(post);
  const when = formatHindiDate(validatedPost.timestamp);
  const whereSet = new Set<string>();
  // Direct matches from known list
  const matchWhere = post.content.match(PLACE_REGEX) || [];
  matchWhere.forEach((w) => whereSet.add(w));
  // Heuristic: tokens before 'में' (e.g., 'रायगढ़ में' -> 'रायगढ़')
  const inMatches = Array.from(post.content.matchAll(/([\p{L} ]{2,}?)\s+में/gu));
  for (const m of inMatches) {
    const token = (m[1] || '').trim();
    if (token.length >= 2) {
      // If token includes a known place word, prefer it
      const known = (token.match(PLACE_REGEX) || [])[0];
      if (known) whereSet.add(known);
    }
  }
  const where = Array.from(whereSet);

  const hashtagsSet = new Set<string>(post.content.match(HASHTAG_REGEX) || []);
  const mentions = Array.from(new Set(post.content.match(MENTION_REGEX) || []));

  const what: string[] = [];
  for (const k of ACTION_KEYWORDS) {
    if (post.content.includes(k)) {
      what.push(k);
      hashtagsSet.add(`#${k}`);
    }
  }
  for (const k of NOUN_TAG_KEYWORDS) {
    if (post.content.includes(k)) hashtagsSet.add(`#${k}`);
  }

  const hashtags = Array.from(hashtagsSet);

  const how = post.content.trim().slice(0, 180);

  return {
    when,
    where,
    what,
    which: { mentions, hashtags },
    how,
  };
}
