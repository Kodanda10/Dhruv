# Kusha Dashboard Theme - Complete Extraction

## 🎨 Color Palette

### Primary Colors
```css
/* Mint Green - Primary Accent Color */
--mint-green: #66FFCC;

/* Purple Gradient Background */
--dark-purple: #5B2C87;
--darker-purple: #3A1A5C;

/* Background Gradient */
background-image: linear-gradient(135deg, #5B2C87 0%, #3A1A5C 100%);
```

### Status Colors
```css
/* Status Indicators */
--status-approved: #10B981;    /* Emerald - स्वीकृत */
--status-pending: #F59E0B;      /* Amber - लंबित */
--status-rejected: #EF4444;     /* Red - निराकृत */

/* Category Colors */
--color-total: #66FFCC;         /* Mint green - कुल आवेदन */
--color-rural: #8B5CF6;         /* Purple - ग्रामीण */
--color-urban: #F59E0B;         /* Amber - शहरी */
```

### Glassmorphic Transparency Values
```css
/* Background Opacity Levels */
--glass-bg-light: rgba(255, 255, 255, 0.05);    /* Subtle */
--glass-bg-medium: rgba(255, 255, 255, 0.10);    /* Standard cards */
--glass-bg-hover: rgba(255, 255, 255, 0.15);      /* Hover state */

/* Border Opacity */
--glass-border-subtle: rgba(255, 255, 255, 0.1);  /* Standard */
--glass-border-medium: rgba(255, 255, 255, 0.2);  /* Active */
--glass-border-accent: rgba(102, 255, 204, 0.3); /* Mint green accent */
--glass-border-active: rgba(102, 255, 204, 0.4);  /* Active tabs */

/* Status Hover Effects */
--hover-approved: rgba(16, 185, 129, 0.1);        /* Green hover bg */
--hover-approved-border: rgba(16, 185, 129, 0.3); /* Green hover border */
--hover-pending: rgba(245, 158, 11, 0.1);         /* Amber hover bg */
--hover-pending-border: rgba(245, 158, 11, 0.3);  /* Amber hover border */
--hover-rejected: rgba(239, 68, 68, 0.1);        /* Red hover bg */
--hover-rejected-border: rgba(239, 68, 68, 0.3);  /* Red hover border */
```

## 🔍 Glassmorphic Design Patterns

### Core Glassmorphic Classes

#### 1. Base Glassmorphic
```css
.glassmorphic {
  @apply bg-white bg-opacity-10 backdrop-blur-md border border-white border-opacity-20 rounded-lg;
}

/* Breakdown: */
background: rgba(255, 255, 255, 0.1);
backdrop-filter: blur(12px);
-webkit-backdrop-filter: blur(12px);
border: 1px solid rgba(255, 255, 255, 0.2);
border-radius: 0.5rem;
```

#### 2. Glassmorphic Card
```css
.glassmorphic-card {
  @apply bg-white bg-opacity-10 backdrop-blur-md border border-white border-opacity-20 rounded-xl p-6;
}

/* Breakdown: */
background: rgba(255, 255, 255, 0.1);
backdrop-filter: blur(12px);
-webkit-backdrop-filter: blur(12px);
border: 1px solid rgba(255, 255, 255, 0.2);
border-radius: 0.75rem;
padding: 1.5rem;
```

#### 3. Glassmorphic Hover Effect
```css
.glassmorphic-hover {
  transition: all 0.3s ease;
}

.glassmorphic-hover:hover {
  background-color: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.4);
  transform: translateY(-2px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}
```

#### 4. Tab Glassmorphic
```css
.tab-glassmorphic {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: all 0.3s ease;
}

.tab-glassmorphic:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(102, 255, 204, 0.3);
  transform: translateY(-1px);
}

.tab-glassmorphic.active {
  background: rgba(102, 255, 204, 0.1);
  border-color: rgba(102, 255, 204, 0.4);
  color: #66FFCC;
}
```

#### 5. Modal Backdrop
```css
/* Modal overlay */
bg-black bg-opacity-50 backdrop-blur-sm

/* Breakdown: */
background: rgba(0, 0, 0, 0.5);
backdrop-filter: blur(4px);
```

#### 6. Pipeline Node
```css
.pipeline-node {
  @apply bg-mint-green bg-opacity-15 border-2 border-mint-green rounded-lg p-4 text-center;
}

/* Breakdown: */
background: rgba(102, 255, 204, 0.15);
border: 2px solid #66FFCC;
border-radius: 0.5rem;
padding: 1rem;
```

## 📐 Typography

### Font Family
```css
font-family: 'Noto Sans Devanagari', sans-serif;
```

### Font Sizes & Weights
```css
/* Header */
font-size: 42px;
font-weight: bold;
font-family: 'Noto Sans Devanagari, sans-serif';

/* Subtitle */
text-xl; /* 1.25rem */
text-gray-300;

/* Body */
text-white;
text-gray-300; /* Secondary text */
```

## 🎭 Visual Effects

### Shadows
```css
/* Standard glassmorphic hover */
box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);

/* Text shadow for charts */
text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
```

### Transitions
```css
transition: all 0.3s ease;
```

### Transform Effects
```css
/* Hover lift */
transform: translateY(-2px);

/* Scale on hover */
transform: scale(1.05);
```

## 🌈 Component-Specific Patterns

### Status Cards
```css
.status-card {
  transition: all 0.3s ease;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.status-card:hover.approved {
  background-color: rgba(16, 185, 129, 0.1);
  border-color: rgba(16, 185, 129, 0.3);
}

.status-card:hover.pending {
  background-color: rgba(245, 158, 11, 0.1);
  border-color: rgba(245, 158, 11, 0.3);
}

.status-card:hover.rejected {
  background-color: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.3);
}
```

### Progress Ring
```css
.progress-ring {
  @apply w-12 h-12 rounded-full border-2 border-white border-opacity-30 border-t-mint-green;
}

/* Breakdown: */
width: 3rem;
height: 3rem;
border-radius: 9999px;
border: 2px solid rgba(255, 255, 255, 0.3);
border-top-color: #66FFCC;
```

### Active Tab
```css
.tab-active {
  @apply bg-mint-green bg-opacity-20 border-mint-green text-mint-green;
}

/* Breakdown: */
background: rgba(102, 255, 204, 0.2);
border-color: #66FFCC;
color: #66FFCC;
```

## 🎨 Complete Color System

```typescript
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
    dark: '#1a0a2e', // Approximate dark background
  },
  
  // Status Colors
  status: {
    approved: '#10B981',   // Emerald
    pending: '#F59E0B',    // Amber
    rejected: '#EF4444',   // Red
  },
  
  // Category Colors
  category: {
    total: '#66FFCC',      // Mint green
    rural: '#8B5CF6',      // Purple
    urban: '#F59E0B',      // Amber
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
};
```

## 📝 Tailwind Configuration

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        'mint-green': '#66FFCC',
        'dark-purple': '#5B2C87',
        'darker-purple': '#3A1A5C',
      },
      fontFamily: {
        'devanagari': ['Noto Sans Devanagari', 'sans-serif'],
      },
      backgroundImage: {
        'dark-gradient': 'linear-gradient(135deg, #5B2C87 0%, #3A1A5C 100%)',
      },
      backdropBlur: {
        'md': '12px',
      },
    },
  },
};
```

## 🎯 Key Design Principles

1. **Purple Gradient Background**: Dark purple gradient (#5B2C87 → #3A1A5C) creates depth
2. **Mint Green Accent**: #66FFCC used for highlights, active states, and CTAs
3. **10-15% White Opacity**: Standard glassmorphic backgrounds
4. **12px Backdrop Blur**: Standard blur for glass effect
5. **20% White Border Opacity**: Subtle borders for definition
6. **Smooth Transitions**: 0.3s ease for all interactions
7. **Hover Elevation**: translateY(-2px) for depth
8. **Status Color Hovers**: Semantic color overlays on hover

## 🚀 Implementation Guide

### Step 1: Update Tailwind Config
```typescript
// tailwind.config.ts
export default {
  theme: {
    extend: {
      colors: {
        'mint-green': '#66FFCC',
        'dark-purple': '#5B2C87',
        'darker-purple': '#3A1A5C',
      },
      backgroundImage: {
        'dark-gradient': 'linear-gradient(135deg, #5B2C87 0%, #3A1A5C 100%)',
      },
      backdropBlur: {
        'md': '12px',
      },
    },
  },
};
```

### Step 2: Add Glassmorphic Utilities to globals.css
```css
/* Glassmorphic Base */
.glassmorphic {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 0.5rem;
}

.glassmorphic-card {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 0.75rem;
  padding: 1.5rem;
}

.glassmorphic-hover {
  transition: all 0.3s ease;
}

.glassmorphic-hover:hover {
  background-color: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.4);
  transform: translateY(-2px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}
```

### Step 3: Update Background
```tsx
<div className="min-h-screen bg-dark-gradient">
  {/* Content */}
</div>
```

## 📊 Comparison with Current Project

| Aspect | Current Project | Kusha Theme |
|--------|----------------|-------------|
| **Background** | `#101922` (dark blue-gray) | Purple gradient `#5B2C87 → #3A1A5C` |
| **Primary Accent** | Green `#10B981` | Mint Green `#66FFCC` |
| **Card Background** | `#192734` (solid) | `rgba(255,255,255,0.1)` (glass) |
| **Blur** | `blur(10px)` | `blur(12px)` |
| **Border** | `border-gray-800` | `rgba(255,255,255,0.2)` |
| **Font** | Noto Sans Devanagari | Noto Sans Devanagari ✅ |

## ✅ Next Steps

1. Create `src/lib/kusha-theme.ts` with color constants
2. Update `tailwind.config.ts` with Kusha colors
3. Add glassmorphic utilities to `globals.css`
4. Update component backgrounds to use purple gradient
5. Replace green accents with mint green (#66FFCC)
6. Apply glassmorphic classes to cards and components

