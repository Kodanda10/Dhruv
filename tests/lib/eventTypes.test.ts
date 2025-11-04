import { describe, it, expect } from '@jest/globals';
import { getEventTypeHindi, EVENT_TYPE_HI, EVENT_TYPE_OPTIONS } from '@/lib/eventTypes';

describe('eventTypes', () => {
  describe('getEventTypeHindi', () => {
    it('should return Hindi translation for valid event type', () => {
      expect(getEventTypeHindi('meeting')).toBe('बैठक');
      expect(getEventTypeHindi('rally')).toBe('रैली');
      expect(getEventTypeHindi('inspection')).toBe('निरीक्षण');
      expect(getEventTypeHindi('inauguration')).toBe('उद्घाटन');
    });

    it('should return empty string for undefined key', () => {
      expect(getEventTypeHindi(undefined)).toBe('');
    });

    it('should return empty string for null key', () => {
      expect(getEventTypeHindi(null as any)).toBe('');
    });

    it('should return key itself for unknown event type', () => {
      expect(getEventTypeHindi('unknown_event')).toBe('unknown_event');
      expect(getEventTypeHindi('custom_type')).toBe('custom_type');
    });

    it('should handle all defined event types', () => {
      const allTypes = Object.keys(EVENT_TYPE_HI) as Array<keyof typeof EVENT_TYPE_HI>;
      
      allTypes.forEach(key => {
        const hindi = getEventTypeHindi(key);
        expect(hindi).toBe(EVENT_TYPE_HI[key]);
      });
    });

    it('should handle scheme_announcement', () => {
      expect(getEventTypeHindi('scheme_announcement')).toBe('योजना घोषणा');
    });

    it('should handle birthday_wishes', () => {
      expect(getEventTypeHindi('birthday_wishes')).toBe('जन्मदिन शुभकामनाएं');
    });

    it('should handle condolence', () => {
      expect(getEventTypeHindi('condolence')).toBe('शोक संदेश');
    });

    it('should handle other', () => {
      expect(getEventTypeHindi('other')).toBe('अन्य');
    });
  });

  describe('EVENT_TYPE_OPTIONS', () => {
    it('should have correct structure', () => {
      expect(EVENT_TYPE_OPTIONS).toBeInstanceOf(Array);
      expect(EVENT_TYPE_OPTIONS.length).toBeGreaterThan(0);
    });

    it('should have value and label for each option', () => {
      EVENT_TYPE_OPTIONS.forEach(option => {
        expect(option).toHaveProperty('value');
        expect(option).toHaveProperty('label');
        expect(typeof option.value).toBe('string');
        expect(typeof option.label).toBe('string');
      });
    });

    it('should have all standard event types', () => {
      const expectedTypes = ['meeting', 'rally', 'inspection', 'inauguration', 
                            'scheme_announcement', 'birthday_wishes', 'condolence', 'other'];
      
      const actualValues = EVENT_TYPE_OPTIONS.map(opt => opt.value);
      
      expectedTypes.forEach(type => {
        expect(actualValues).toContain(type);
      });
    });

    it('should have Hindi labels matching EVENT_TYPE_HI', () => {
      EVENT_TYPE_OPTIONS.forEach(option => {
        expect(option.label).toBe(EVENT_TYPE_HI[option.value as keyof typeof EVENT_TYPE_HI]);
      });
    });
  });
});

