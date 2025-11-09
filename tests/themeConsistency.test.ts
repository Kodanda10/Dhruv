/**
 * CSS Token / Theme Consistency Tests
 * 
 * Ensures all pages use unified glass theme tokens and prevents
 * rogue hex codes or magenta variants from sneaking in.
 */

import fs from 'fs';
import path from 'path';

describe('Theme Consistency - CSS Token Validation', () => {
  const globalsCssPath = path.join(process.cwd(), 'src/app/globals.css');
  const tailwindConfigPath = path.join(process.cwd(), 'tailwind.config.ts');
  
  let globalsCss: string;
  let tailwindConfig: string;
  
  beforeAll(() => {
    globalsCss = fs.readFileSync(globalsCssPath, 'utf8');
    tailwindConfig = fs.readFileSync(tailwindConfigPath, 'utf8');
  });
  
  test('CSS uses unified glass theme gradient', () => {
    // Expect single source of truth gradient token
    expect(globalsCss).toMatch(/--gradient-bg:\s*linear-gradient\(135deg,\s*#5C47D4/);
    expect(globalsCss).toMatch(/#7D4BCE/);
    expect(globalsCss).toMatch(/#8F6FE8/);
  });
  
  test('CSS uses correct accent glow color', () => {
    expect(globalsCss).toMatch(/--glow-color:\s*rgba\(180,\s*255,\s*250,\s*0\.2\)/);
  });
  
  test('CSS uses correct card background and border', () => {
    expect(globalsCss).toMatch(/--card-bg:\s*rgba\(120,\s*90,\s*210,\s*0\.25\)/);
    expect(globalsCss).toMatch(/--card-border:\s*rgba\(200,\s*220,\s*255,\s*0\.25\)/);
  });
  
  test('No magenta/reddish/pink tones in CSS', () => {
    // Prevent magenta/red tones that would break theme consistency
    const forbiddenPatterns = [
      /#FF00/i,  // Pure magenta
      /#E500/i,  // Red-magenta
      /#FF33/i,  // Bright magenta
      /#FF69/i,  // Hot pink
      /#E91E/i,  // Material pink
      /magenta/i,
      /rgb\(255,\s*0,\s*255\)/i, // Pure magenta RGB
      /rgb\(255,\s*20,\s*147\)/i, // Deep pink
    ];
    
    for (const pattern of forbiddenPatterns) {
      expect(globalsCss).not.toMatch(pattern);
    }
  });
  
  test('Tailwind config uses unified gradient', () => {
    expect(tailwindConfig).toMatch(/linear-gradient\(135deg,\s*#5C47D4\s*0%,\s*#7D4BCE\s*50%,\s*#8F6FE8\s*100%\)/);
  });
  
  test('Glassmorphic card utility uses correct values', () => {
    expect(tailwindConfig).toMatch(/background:\s*['"]rgba\(120,\s*90,\s*210,\s*0\.25\)['"]/);
    expect(tailwindConfig).toMatch(/border:\s*['"]1px\s+solid\s+rgba\(200,\s*220,\s*255,\s*0\.25\)['"]/);
    expect(tailwindConfig).toMatch(/boxShadow:\s*['"]0\s+0\s+25px\s+rgba\(180,\s*255,\s*250,\s*0\.2\)['"]/);
  });
  
  test('Consistent border radius (rounded-2xl = 1rem)', () => {
    expect(globalsCss).toMatch(/border-radius:\s*1rem/);
  });
  
  test('Consistent backdrop blur (blur-16px)', () => {
    expect(globalsCss).toMatch(/backdrop-filter:\s*blur\(16px\)/);
  });
  
  test('Active tab uses correct teal accent color', () => {
    expect(globalsCss).toMatch(/--active-tab:\s*#8FFAE8/);
    expect(tailwindConfig).toMatch(/borderColor:\s*['"]#8FFAE8['"]/);
  });
});
