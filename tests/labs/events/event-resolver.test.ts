import { describe, it, expect } from '@jest/globals';
import {
  EVENT_TYPE_HINDI,
  EVENT_THRESHOLD,
  suggestEventTypes,
  decideEventAction,
  toHindiLabels,
} from '@/labs/events/event-resolver';

describe('event resolver catalog', () => {
  it('includes canonical Hindi label for public_meeting', () => {
    expect(EVENT_TYPE_HINDI.public_meeting).toBe('जनसभा');
  });
});

describe('suggestEventTypes', () => {
  it('detects multiple event types with evidence spans', () => {
    const text = 'आज ग्राम सभाओं में जनसभा को संबोधित किया और दीपावली की शुभकामनाएं दीं।';
    const suggestions = suggestEventTypes(text, 'hi');
    expect(suggestions.length).toBeGreaterThanOrEqual(2);
    const publicMeeting = suggestions.find((s) => s.key === 'public_meeting');
    const greetings = suggestions.find((s) => s.key === 'greetings');
    expect(publicMeeting).toBeDefined();
    expect(publicMeeting?.score).toBeGreaterThanOrEqual(EVENT_THRESHOLD.HIGH);
    expect(publicMeeting?.evidence).toEqual(expect.arrayContaining(['जनसभा']));
    expect(greetings).toBeDefined();
    expect(greetings?.score).toBeGreaterThan(EVENT_THRESHOLD.LOW);
    expect(greetings?.evidence).toEqual(expect.arrayContaining(['शुभकामनाएं', 'दीपावली']));
  });

  it('returns empty array when no keywords match', () => {
    const suggestions = suggestEventTypes('random unrelated text');
    expect(suggestions).toEqual([]);
  });
});

describe('decideEventAction', () => {
  it('auto accepts when top suggestion >= 0.88', () => {
    const action = decideEventAction([{ key: 'public_meeting', label_hi: 'जनसभा', score: 0.9 }]);
    expect(action).toBe('auto_accept');
  });

  it('requires review when below threshold', () => {
    const action = decideEventAction([{ key: 'public_meeting', label_hi: 'जनसभा', score: 0.7 }]);
    expect(action).toBe('needs_review');
  });
});

describe('toHindiLabels', () => {
  it('returns Hindi labels for known keys and fallback for unknown', () => {
    expect(toHindiLabels(['public_meeting', 'unknown'])).toEqual(['जनसभा', 'अन्य']);
  });
});
