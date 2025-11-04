/**
 * Kusha Dashboard Theme - Glassmorphic Design System
 * 
 * Extracted from: /Users/abhijita/Desktop/Project_Kusha 2
 * 
 * Design Philosophy:
 * - Purple Gradient Background: Creates depth and modern aesthetic
 * - Mint Green Accent (#66FFCC): Fresh, vibrant highlights
 * - Glassmorphic Cards: 10-15% white opacity with 12px blur
 * - Smooth Transitions: 0.3s ease for all interactions
 */

export const kushaTheme = {
  // Primary Colors
  colors: {
    mintGreen: '#66FFCC',
    darkPurple: '#5B2C87',
    darkerPurple: '#3A1A5C',
  },
  
  // Background Gradient
  background: {
    gradient: 'linear-gradient(135deg, #5B2C87 0%, #3A1A5C 100%)',
    gradientClass: 'bg-dark-gradient',
    dark: '#1a0a2e', // Approximate dark background
  },
  
  // Status Colors
  status: {
    approved: '#10B981',   // Emerald - स्वीकृत
    pending: '#F59E0B',    // Amber - लंबित
    rejected: '#EF4444',   // Red - निराकृत
  },
  
  // Category Colors
  category: {
    total: '#66FFCC',      // Mint green - कुल आवेदन
    rural: '#8B5CF6',      // Purple - ग्रामीण
    urban: '#F59E0B',      // Amber - शहरी
  },
  
  // Glassmorphic Transparency
  glass: {
    bg: {
      light: 'rgba(255, 255, 255, 0.05)',
      medium: 'rgba(255, 255, 255, 0.10)',
      hover: 'rgba(255, 255, 255, 0.15)',
      accent: 'rgba(102, 255, 204, 0.1)',
      accentHover: 'rgba(102, 255, 204, 0.2)',
    },
    border: {
      subtle: 'rgba(255, 255, 255, 0.1)',
      medium: 'rgba(255, 255, 255, 0.2)',
      accent: 'rgba(102, 255, 204, 0.3)',
      active: 'rgba(102, 255, 204, 0.4)',
    },
  },
  
  // Blur Levels
  blur: {
    sm: 'blur(4px)',    // Modal backdrop
    md: 'blur(12px)',   // Standard glassmorphic
  },
  
  // Shadows
  shadows: {
    glass: '0 8px 32px rgba(0, 0, 0, 0.2)',
    text: '0 1px 2px rgba(0, 0, 0, 0.8)',
  },
  
  // Typography
  typography: {
    fontFamily: "'Noto Sans Devanagari', sans-serif",
    sizes: {
      header: '42px',
      subtitle: '1.25rem',
      body: '1rem',
    },
    colors: {
      primary: '#FFFFFF',
      secondary: 'rgba(209, 213, 219, 1)', // gray-300
      accent: '#66FFCC',
    },
  },
  
  // Transitions
  transitions: {
    standard: 'all 0.3s ease',
    fast: 'all 0.15s ease',
    slow: 'all 0.5s ease',
  },
  
  // Transform Effects
  transforms: {
    hoverLift: 'translateY(-2px)',
    hoverScale: 'scale(1.05)',
    hoverScaleSmall: 'scale(1.02)',
  },
} as const;

/**
 * Get glassmorphic background style
 */
export function getGlassBg(level: 'light' | 'medium' | 'hover' | 'accent' | 'accentHover' = 'medium'): string {
  return kushaTheme.glass.bg[level];
}

/**
 * Get glassmorphic border style
 */
export function getGlassBorder(level: 'subtle' | 'medium' | 'accent' | 'active' = 'medium'): string {
  return kushaTheme.glass.border[level];
}

/**
 * Get status color
 */
export function getStatusColor(status: 'approved' | 'pending' | 'rejected'): string {
  return kushaTheme.status[status];
}

/**
 * Get category color
 */
export function getCategoryColor(category: 'total' | 'rural' | 'urban'): string {
  return kushaTheme.category[category];
}

