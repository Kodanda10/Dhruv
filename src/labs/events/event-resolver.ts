export type EventSuggestion = {
  key: string;
  label_hi: string;
  score: number;
  evidence: string[];
};

export const EVENT_TYPE_HINDI: Record<string, string> = {
  meeting: 'बैठक',
  review_meeting: 'समीक्षा बैठक',
  public_meeting: 'जनसभा',
  rally: 'रैली',
  press_conference: 'प्रेस वार्ता',
  tour: 'दौरा',
  inspection: 'निरीक्षण',
  public_event: 'कार्यक्रम',
  ceremony: 'समारोह',
  inauguration: 'लोकार्पण',
  foundation_stone: 'शिलान्यास',
  groundbreaking: 'भूमि पूजन',
  completion_ceremony: 'पूर्णता समारोह',
  award_ceremony: 'पुरस्कार समारोह',
  cultural_event: 'सांस्कृतिक कार्यक्रम',
  sports_event: 'खेल कार्यक्रम',
  educational_event: 'शैक्षिक कार्यक्रम',
  workshop: 'कार्यशाला',
  training_program: 'प्रशिक्षण कार्यक्रम',
  seminar: 'सेमिनार',
  conference: 'सम्मेलन',
  exhibition: 'प्रदर्शनी',
  fair: 'मेला',
  greetings: 'शुभकामनाएं',
  condolences: 'शोक संदेश',
  tribute_day: 'पुण्य तिथि',
  birthday: 'जन्मदिन',
  jayanti: 'जयंती',
  festival_celebration: 'त्यौहार समारोह',
  scheme_announcement: 'योजना घोषणा',
  relief_distribution: 'सहायता वितरण',
  compensation_distribution: 'मुआवजा वितरण',
  grant_distribution: 'अनुदान वितरण',
  certificate_distribution: 'प्रमाण पत्र वितरण',
  kit_distribution: 'किट वितरण',
  ration_distribution: 'राशन वितरण',
  blanket_distribution: 'कंबल वितरण',
  medicine_distribution: 'दवा वितरण',
  book_distribution: 'किताब वितरण',
  seed_distribution: 'बीज वितरण',
  equipment_distribution: 'उपकरण वितरण',
  bicycle_distribution: 'साइकिल वितरण',
  laptop_distribution: 'लैपटॉप वितरण',
  mobile_distribution: 'मोबाइल वितरण',
  solar_light_distribution: 'सोलर लाइट वितरण',
  pump_distribution: 'पंप वितरण',
  toilet_distribution: 'शौचालय वितरण',
  house_distribution: 'मकान वितरण',
  land_distribution: 'जमीन वितरण',
  loan_distribution: 'ऋण वितरण',
  subsidy_distribution: 'सब्सिडी वितरण',
  pension_distribution: 'पेंशन वितरण',
  scholarship_distribution: 'छात्रवृत्ति वितरण',
  stipend_distribution: 'मानदेय वितरण',
  other: 'अन्य',
};

const KEYWORD_RULES: Record<string, string[]> = {
  public_meeting: ['जनसभा', 'जन सभा', 'जनसभाओं', 'संबोधित', 'addressed'],
  greetings: ['शुभकामनाएं', 'शुभकामनाये', 'बधाई', 'greetings', 'दीपावली', 'holi', 'eid'],
  review_meeting: ['समीक्षा', 'review meeting'],
  festival_celebration: ['त्यौहार', 'festival', 'दीपावली', 'होली'],
  inauguration: ['लोकार्पण', 'उद्घाटन', 'शुभारंभ', 'inauguration'],
  condolences: ['शोक', 'श्रद्धांजलि', 'condolence'],
  rally: ['रैली', 'rally'],
  tour: ['दौरा', 'tour'],
};

export const EVENT_THRESHOLD = {
  HIGH: 0.88,
  LOW: 0.6,
};

const MIN_SCORE = 0.4;

function normalize(text: string): string {
  return text.normalize('NFC').toLowerCase();
}

function collectEvidence(normalized: string, keywords: string[]): string[] {
  const evidence = new Set<string>();
  keywords.forEach((keyword) => {
    const token = normalize(keyword);
    if (!token) return;
    if (normalized.includes(token)) {
      evidence.add(keyword.trim());
    }
  });
  return Array.from(evidence);
}

export function suggestEventTypes(text: string, lang = 'hi'): EventSuggestion[] {
  if (!text || !text.trim()) return [];
  const normalized = normalize(text);
  const suggestions: EventSuggestion[] = [];

  Object.entries(KEYWORD_RULES).forEach(([key, keywords]) => {
    const evidence = collectEvidence(normalized, keywords);
    if (!evidence.length) return;
    const base = 0.45;
    const score = Math.min(base + evidence.length * 0.25, 0.99);
    suggestions.push({
      key,
      label_hi: EVENT_TYPE_HINDI[key] ?? EVENT_TYPE_HINDI.other,
      score,
      evidence,
    });
  });

  return suggestions
    .filter((s) => s.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score);
}

export function decideEventAction(suggestions: EventSuggestion[]): 'auto_accept' | 'needs_review' {
  const top = suggestions[0];
  if (!top) return 'needs_review';
  return top.score >= EVENT_THRESHOLD.HIGH ? 'auto_accept' : 'needs_review';
}

export function toHindiLabels(keys: string[]): string[] {
  return keys.map((key) => EVENT_TYPE_HINDI[key] ?? EVENT_TYPE_HINDI.other);
}
