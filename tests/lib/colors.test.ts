import { describe, it, expect } from '@jest/globals';
import { colors, getConfidenceColor, getConfidenceLabel, getConfidenceEmoji, formatConfidence } from '@/lib/colors';

describe('colors', () => {
  describe('colors object', () => {
    it('should have primary colors defined', () => {
      expect(colors.primary.green).toBe('#10B981');
      expect(colors.primary.dark).toBe('#1E293B');
      expect(colors.primary.white).toBe('#FFFFFF');
    });

    it('should have accent colors defined', () => {
      expect(colors.accent.amber).toBe('#F59E0B');
      expect(colors.accent.blue).toBe('#3B82F6');
      expect(colors.accent.red).toBe('#EF4444');
      expect(colors.accent.purple).toBe('#8B5CF6');
    });

    it('should have semantic colors defined', () => {
      expect(colors.semantic.success).toBe('#10B981');
      expect(colors.semantic.warning).toBe('#F59E0B');
      expect(colors.semantic.error).toBe('#EF4444');
      expect(colors.semantic.info).toBe('#3B82F6');
    });

    it('should have confidence colors defined', () => {
      expect(colors.confidence.high).toBe('#10B981');
      expect(colors.confidence.medium).toBe('#F59E0B');
      expect(colors.confidence.low).toBe('#EF4444');
    });

    it('should have gray scale defined', () => {
      expect(colors.gray[50]).toBe('#F9FAFB');
      expect(colors.gray[900]).toBe('#111827');
      expect(Object.keys(colors.gray).length).toBeGreaterThan(5);
    });

    it('should have background colors defined', () => {
      expect(colors.bg.primary).toBe('#FFFFFF');
      expect(colors.bg.secondary).toBe('#F9FAFB');
      expect(colors.bg.tertiary).toBe('#F3F4F6');
      expect(colors.bg.dark).toBe('#1E293B');
    });
  });

  describe('getConfidenceColor', () => {
    it('should return high color for score >= 0.8', () => {
      expect(getConfidenceColor(0.8)).toBe(colors.confidence.high);
      expect(getConfidenceColor(0.9)).toBe(colors.confidence.high);
      expect(getConfidenceColor(1.0)).toBe(colors.confidence.high);
    });

    it('should return high color for percentage >= 80', () => {
      expect(getConfidenceColor(80)).toBe(colors.confidence.high);
      expect(getConfidenceColor(90)).toBe(colors.confidence.high);
      expect(getConfidenceColor(100)).toBe(colors.confidence.high);
    });

    it('should return medium color for score 0.6-0.79', () => {
      expect(getConfidenceColor(0.6)).toBe(colors.confidence.medium);
      expect(getConfidenceColor(0.7)).toBe(colors.confidence.medium);
      expect(getConfidenceColor(0.79)).toBe(colors.confidence.medium);
    });

    it('should return medium color for percentage 60-79', () => {
      expect(getConfidenceColor(60)).toBe(colors.confidence.medium);
      expect(getConfidenceColor(70)).toBe(colors.confidence.medium);
      expect(getConfidenceColor(79)).toBe(colors.confidence.medium);
    });

    it('should return low color for score < 0.6', () => {
      expect(getConfidenceColor(0.5)).toBe(colors.confidence.low);
      expect(getConfidenceColor(0.0)).toBe(colors.confidence.low);
      expect(getConfidenceColor(0.59)).toBe(colors.confidence.low);
    });

    it('should return low color for percentage < 60', () => {
      expect(getConfidenceColor(50)).toBe(colors.confidence.low);
      expect(getConfidenceColor(0)).toBe(colors.confidence.low);
      expect(getConfidenceColor(59)).toBe(colors.confidence.low);
    });
  });

  describe('getConfidenceLabel', () => {
    it('should return high label for score >= 0.8', () => {
      expect(getConfidenceLabel(0.8)).toBe('उच्च (High)');
      expect(getConfidenceLabel(0.9)).toBe('उच्च (High)');
    });

    it('should return high label for percentage >= 80', () => {
      expect(getConfidenceLabel(80)).toBe('उच्च (High)');
      expect(getConfidenceLabel(100)).toBe('उच्च (High)');
    });

    it('should return medium label for score 0.6-0.79', () => {
      expect(getConfidenceLabel(0.6)).toBe('मध्यम (Medium)');
      expect(getConfidenceLabel(0.7)).toBe('मध्यम (Medium)');
    });

    it('should return medium label for percentage 60-79', () => {
      expect(getConfidenceLabel(60)).toBe('मध्यम (Medium)');
      expect(getConfidenceLabel(70)).toBe('मध्यम (Medium)');
    });

    it('should return low label for score < 0.6', () => {
      expect(getConfidenceLabel(0.5)).toBe('निम्न (Low)');
      expect(getConfidenceLabel(0.0)).toBe('निम्न (Low)');
    });

    it('should return low label for percentage < 60', () => {
      expect(getConfidenceLabel(50)).toBe('निम्न (Low)');
      expect(getConfidenceLabel(0)).toBe('निम्न (Low)');
    });
  });

  describe('getConfidenceEmoji', () => {
    it('should return checkmark for score >= 0.8', () => {
      expect(getConfidenceEmoji(0.8)).toBe('✅');
      expect(getConfidenceEmoji(0.9)).toBe('✅');
    });

    it('should return checkmark for percentage >= 80', () => {
      expect(getConfidenceEmoji(80)).toBe('✅');
      expect(getConfidenceEmoji(100)).toBe('✅');
    });

    it('should return warning for score 0.6-0.79', () => {
      expect(getConfidenceEmoji(0.6)).toBe('⚠️');
      expect(getConfidenceEmoji(0.7)).toBe('⚠️');
    });

    it('should return warning for percentage 60-79', () => {
      expect(getConfidenceEmoji(60)).toBe('⚠️');
      expect(getConfidenceEmoji(70)).toBe('⚠️');
    });

    it('should return cross for score < 0.6', () => {
      expect(getConfidenceEmoji(0.5)).toBe('❌');
      expect(getConfidenceEmoji(0.0)).toBe('❌');
    });

    it('should return cross for percentage < 60', () => {
      expect(getConfidenceEmoji(50)).toBe('❌');
      expect(getConfidenceEmoji(0)).toBe('❌');
    });
  });

  describe('formatConfidence', () => {
    it('should format score as percentage (0-1 range)', () => {
      expect(formatConfidence(0.85)).toBe('85%');
      expect(formatConfidence(0.75)).toBe('75%');
      expect(formatConfidence(0.5)).toBe('50%');
      expect(formatConfidence(0.0)).toBe('0%');
      expect(formatConfidence(1.0)).toBe('100%');
    });

    it('should format score as percentage (0-100 range)', () => {
      expect(formatConfidence(85)).toBe('85%');
      expect(formatConfidence(75)).toBe('75%');
      expect(formatConfidence(50)).toBe('50%');
      expect(formatConfidence(0)).toBe('0%');
      expect(formatConfidence(100)).toBe('100%');
    });

    it('should handle NaN', () => {
      expect(formatConfidence(NaN)).toBe('0%');
    });

    it('should handle Infinity', () => {
      expect(formatConfidence(Infinity)).toBe('0%');
      expect(formatConfidence(-Infinity)).toBe('0%');
    });

    it('should round to nearest integer', () => {
      expect(formatConfidence(0.856)).toBe('86%');
      expect(formatConfidence(0.854)).toBe('85%');
      expect(formatConfidence(85.6)).toBe('86%');
      expect(formatConfidence(85.4)).toBe('85%');
    });

    it('should handle decimal scores in 0-1 range', () => {
      expect(formatConfidence(0.123)).toBe('12%');
      expect(formatConfidence(0.999)).toBe('100%');
    });

    it('should handle decimal scores in 0-100 range', () => {
      expect(formatConfidence(12.3)).toBe('12%');
      expect(formatConfidence(99.9)).toBe('100%');
    });
  });
});

