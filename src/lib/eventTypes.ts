export type EventTypeKey =
  | 'meeting'
  | 'rally'
  | 'inspection'
  | 'inauguration'
  | 'scheme_announcement'
  | 'birthday_wishes'
  | 'condolence'
  | 'other'
  | string; // allow custom

export const EVENT_TYPE_HI: Record<EventTypeKey, string> = {
  meeting: 'बैठक',
  rally: 'रैली',
  inspection: 'निरीक्षण',
  inauguration: 'उद्घाटन',
  scheme_announcement: 'योजना घोषणा',
  birthday_wishes: 'जन्मदिन शुभकामनाएं',
  condolence: 'शोक संदेश',
  other: 'अन्य',
};

export function getEventTypeHindi(key: string | undefined): string {
  if (!key) return '';
  return EVENT_TYPE_HI[key as EventTypeKey] ?? key;
}

export const EVENT_TYPE_OPTIONS = (
  Object.keys(EVENT_TYPE_HI) as EventTypeKey[]
).map((k) => ({ value: k, label: EVENT_TYPE_HI[k] }));


