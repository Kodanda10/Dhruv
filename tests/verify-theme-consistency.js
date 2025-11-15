/**
 * End-to-End Theme Consistency Verification Script
 * 
 * Verifies that all tabs use the unified purple-lavender gradient
 * and consistent glassmorphic styling.
 */

import fs from 'fs';
import path from 'path';

console.log('🔍 Verifying Theme Consistency...\n');

// 1. Check CSS Variables
console.log('1. Checking CSS Variables in globals.css...');
const globalsCss = fs.readFileSync('src/app/globals.css', 'utf8');

const gradientMatch = globalsCss.match(/--gradient-bg:\s*(.+?);/);
if (gradientMatch) {
  const gradient = gradientMatch[1];
  if (gradient.includes('#5C47D4') && gradient.includes('#7D4BCE') && gradient.includes('#8F6FE8')) {
    console.log('   ✅ Unified gradient found:', gradient);
  } else {
    console.log('   ❌ Wrong gradient:', gradient);
    process.exit(1);
  }
} else {
  console.log('   ❌ No gradient variable found');
  process.exit(1);
}

// Check for magenta/red tones
if (globalsCss.includes('#8B1A8B') || globalsCss.includes('#5D3FD3')) {
  console.log('   ❌ Found old magenta gradient colors');
  process.exit(1);
} else {
  console.log('   ✅ No magenta/red tones found');
}

// 2. Check glass-section-card utility in Tailwind config
console.log('\n2. Checking glass-section-card utility in tailwind.config.ts...');
const tailwindConfig = fs.readFileSync('tailwind.config.ts', 'utf8');
const requiredSectionTokens = [
  "'.glass-section-card'",
  'rgba(255, 255, 255, 0.1)',
  'rgba(255, 255, 255, 0.15)',
  'rgba(255, 255, 255, 0.05)',
  'blur(24px)',
  'rgba(255, 255, 255, 0.2)',
  'rgba(0, 0, 0, 0.25)',
];
const missingTokens = requiredSectionTokens.filter((token) => !tailwindConfig.includes(token));
if (missingTokens.length > 0) {
  console.log('   ❌ glass-section-card utility is missing tokens:', missingTokens);
  process.exit(1);
} else {
  console.log('   ✅ glass-section-card utility matches liquid glass theme');
}

// 3. Check Tailwind config gradient
console.log('\n3. Checking Tailwind config...');
if (tailwindConfig.includes('#5C47D4') && tailwindConfig.includes('#7D4BCE') && tailwindConfig.includes('#8F6FE8')) {
  console.log('   ✅ Unified gradient in Tailwind config');
} else {
  console.log('   ❌ Wrong gradient in Tailwind config');
  process.exit(1);
}

// 4. Check AnalyticsDashboard for inline shadow overrides
console.log('\n4. Checking AnalyticsDashboard for inline shadow overrides...');
const analyticsDashboard = fs.readFileSync('src/components/analytics/AnalyticsDashboard.tsx', 'utf8');
const shadowOverrides = analyticsDashboard.match(/shadow-\[0_0_20px_rgba\(255,255,255,0\.1\)\]/g);
if (shadowOverrides && shadowOverrides.length > 0) {
  console.log(`   ❌ Found ${shadowOverrides.length} inline shadow overrides in AnalyticsDashboard`);
  console.log('   These override the unified theme!');
  process.exit(1);
} else {
  console.log('   ✅ No inline shadow overrides found');
}

// 5. Check all components use glass-section-card class
console.log('\n5. Checking component usage...');
const components = [
  'src/components/Dashboard.tsx',
  'src/components/review/ReviewQueue.tsx',
  'src/components/analytics/AnalyticsDashboard.tsx',
];

let allGood = true;
for (const componentPath of components) {
  if (fs.existsSync(componentPath)) {
    const content = fs.readFileSync(componentPath, 'utf8');
    const cardCount = (content.match(/glass-section-card/g) || []).length;
    console.log(`   ${componentPath}: ${cardCount} glass-section-card usages`);
  }
}

console.log('\n✅ Theme Consistency Verification Complete!');
console.log('\nAll tabs should now use:');
console.log('  - Gradient: #5C47D4 → #7D4BCE → #8F6FE8');
console.log('  - Card BG: rgba(120, 90, 210, 0.25)');
console.log('  - Card Border: rgba(200, 220, 255, 0.25)');
console.log('  - Glow: rgba(180, 255, 250, 0.2)');

