/**
 * Professional Color System for OP Choudhary Dashboard
 * 
 * Design Philosophy:
 * - Fresh Green (#10B981): Represents growth, hope, grassroots agriculture
 * - Dark Slate (#1E293B): Professionalism and trust
 * - White (#FFFFFF): Clean, modern, Apple-inspired
 * - Amber (#F59E0B): Highlights and warnings
 */

export const colors = {
  // Primary Colors
  primary: {
    green: '#10B981',      // Fresh Green - buttons, highlights, success
    dark: '#1E293B',       // Dark Slate - text, headers
    white: '#FFFFFF',      // Clean White - backgrounds
  },
  
  // Secondary/Accent Colors
  accent: {
    amber: '#F59E0B',      // Amber - warnings, pending reviews
    blue: '#3B82F6',       // Blue - info, links, interactive
    red: '#EF4444',        // Red - errors, alerts, rejected
    purple: '#8B5CF6',     // Purple - special highlights
  },
  
  // Neutral Grays
  gray: {
    50: '#F9FAFB',         // Very Light Gray - hover states
    100: '#F3F4F6',        // Light Gray - borders, dividers
    200: '#E5E7EB',        // Light Gray - disabled states
    300: '#D1D5DB',        // Medium Light Gray - placeholders
    400: '#9CA3AF',        // Medium Gray - secondary icons
    500: '#6B7280',        // Medium Dark Gray - secondary text
    600: '#4B5563',        // Dark Gray - body text
    700: '#374151',        // Darker Gray - headings
    800: '#1F2937',        // Very Dark Gray - primary text
    900: '#111827',        // Almost Black - emphasis
  },
  
  // Semantic Colors (for UI states)
  semantic: {
    success: '#10B981',    // Green - approved, completed, high confidence
    warning: '#F59E0B',    // Amber - needs review, medium confidence
    error: '#EF4444',      // Red - rejected, errors, low confidence
    info: '#3B82F6',       // Blue - informational messages
  },
  
  // Confidence Score Colors
  confidence: {
    high: '#10B981',       // ≥80% - Green
    medium: '#F59E0B',     // 60-79% - Amber
    low: '#EF4444',        // <60% - Red
  },
  
  // Background Colors
  bg: {
    primary: '#FFFFFF',    // Main background
    secondary: '#F9FAFB',  // Secondary sections
    tertiary: '#F3F4F6',   // Card hover, tertiary sections
    dark: '#1E293B',       // Dark sections (optional)
  },
} as const;

/**
 * Get confidence color based on score
 * @param score - Confidence score (0-1 or 0-100)
 * @returns Color hex code
 */
export function getConfidenceColor(score: number): string {
  // Normalize to 0-1 range if score is 0-100
  const normalizedScore = score > 1 ? score / 100 : score;
  
  if (normalizedScore >= 0.8) return colors.confidence.high;
  if (normalizedScore >= 0.6) return colors.confidence.medium;
  return colors.confidence.low;
}

/**
 * Get confidence label based on score
 * @param score - Confidence score (0-1 or 0-100)
 * @returns Label string
 */
export function getConfidenceLabel(score: number): string {
  const normalizedScore = score > 1 ? score / 100 : score;
  
  if (normalizedScore >= 0.8) return 'उच्च (High)';
  if (normalizedScore >= 0.6) return 'मध्यम (Medium)';
  return 'निम्न (Low)';
}

/**
 * Get confidence emoji based on score
 * @param score - Confidence score (0-1 or 0-100)
 * @returns Emoji string
 */
export function getConfidenceEmoji(score: number): string {
  const normalizedScore = score > 1 ? score / 100 : score;
  
  if (normalizedScore >= 0.8) return '✅';
  if (normalizedScore >= 0.6) return '⚠️';
  return '❌';
}

/**
 * Format confidence score as percentage
 * @param score - Confidence score (0-1 or 0-100)
 * @returns Formatted percentage string
 */
export function formatConfidence(score: number): string {
  if (isNaN(score) || !isFinite(score)) {
    return '0%';
  }
  const percentage = score > 1 ? score : score * 100;
  return `${Math.round(percentage)}%`;
}

