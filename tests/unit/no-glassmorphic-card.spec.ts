/**
 * Legacy glassmorphic-card Prevention Test
 *
 * Ensures no future PR reintroduces the old .glassmorphic-card class
 * by scanning all component files for forbidden patterns.
 */

import fs from 'fs';
import path from 'path';
import fg from 'fast-glob';

describe('Legacy glassmorphic-card prevention', () => {
  it('no glassmorphic-card in src/components', () => {
    const componentFiles = fg.sync('src/components/**/*.tsx');
    const violations: Array<{ file: string; count: number; lines: number[] }> = [];

    componentFiles.forEach(file => {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n');
      const matches: number[] = [];

      lines.forEach((line, index) => {
        if (line.includes('glassmorphic-card')) {
          matches.push(index + 1); // 1-based line numbers
        }
      });

      if (matches.length > 0) {
        violations.push({
          file: path.relative(process.cwd(), file),
          count: matches.length,
          lines: matches,
        });
      }
    });

    if (violations.length > 0) {
      console.error('\n🚫 FOUND LEGACY glassmorphic-card USAGE:');
      violations.forEach(v => {
        console.error(`  ${v.file}: ${v.count} occurrences on lines ${v.lines.join(', ')}`);
      });
      console.error('\n💡 Replace with: glass-section-card');
      console.error('   Or use: <GlassSectionCard> component\n');
    }

    expect(violations).toHaveLength(0);
  });

  it('no glassmorphic-card in src/app', () => {
    const appFiles = fg.sync('src/app/**/*.tsx');
    const violations: Array<{ file: string; count: number }> = [];

    appFiles.forEach(file => {
      const content = fs.readFileSync(file, 'utf8');
      const count = (content.match(/glassmorphic-card/g) || []).length;

      if (count > 0) {
        violations.push({
          file: path.relative(process.cwd(), file),
          count,
        });
      }
    });

    if (violations.length > 0) {
      console.error('\n🚫 FOUND LEGACY glassmorphic-card IN APP FILES:');
      violations.forEach(v => {
        console.error(`  ${v.file}: ${v.count} occurrences`);
      });
    }

    expect(violations).toHaveLength(0);
  });

  it('no glassmorphic-card in styles or config', () => {
    const configFiles = fg.sync('{tailwind.config.*,src/app/globals.css,postcss.config.*,next.config.*}');
    const violations: Array<{ file: string; count: number }> = [];

    configFiles.forEach(file => {
      if (fs.existsSync(file)) {
        const content = fs.readFileSync(file, 'utf8');
        const count = (content.match(/glassmorphic-card/g) || []).length;

        if (count > 0) {
          violations.push({
            file: path.relative(process.cwd(), file),
            count,
          });
        }
      }
    });

    if (violations.length > 0) {
      console.error('\n🚫 FOUND LEGACY glassmorphic-card IN CONFIG/STYLES:');
      violations.forEach(v => {
        console.error(`  ${v.file}: ${v.count} occurrences`);
      });
    }

    expect(violations).toHaveLength(0);
  });

  it('glass-section-card is properly defined in Tailwind config', () => {
    const tailwindConfig = fs.readFileSync('tailwind.config.ts', 'utf8');

    // Must have the complete utility definition
    const requiredTokens = [
      "'.glass-section-card'",
      'rgba(255, 255, 255, 0.1)',
      'rgba(255, 255, 255, 0.15)',
      'rgba(255, 255, 255, 0.05)',
      'blur(24px)',
      'rgba(255, 255, 255, 0.2)',
      'rgba(0, 0, 0, 0.25)',
      '1.5rem',
      'all 0.3s ease',
    ];

    const missingTokens = requiredTokens.filter(token => !tailwindConfig.includes(token));

    if (missingTokens.length > 0) {
      console.error('\n🚫 MISSING glass-section-card TOKENS IN TAILWIND CONFIG:');
      missingTokens.forEach(token => {
        console.error(`  - ${token}`);
      });
    }

    expect(missingTokens).toHaveLength(0);
  });

  it('GlassSectionCard component exists and exports correctly', () => {
    expect(fs.existsSync('src/components/GlassSectionCard.tsx')).toBe(true);

    const componentContent = fs.readFileSync('src/components/GlassSectionCard.tsx', 'utf8');

    // Should export default
    expect(componentContent).toMatch(/export default function GlassSectionCard/);

    // Should use glass-section-card class
    expect(componentContent).toContain('glass-section-card');

    // Should enforce text-white
    expect(componentContent).toContain('text-white');
  });

  it('no accidental glassmorphic-card in test files', () => {
    const testFiles = fg.sync('tests/**/*.spec.ts');
    const violations: Array<{ file: string; count: number; lines: number[] }> = [];

    testFiles.forEach(file => {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n');
      const matches: number[] = [];

      lines.forEach((line, index) => {
        // Allow references in this specific guard test file
        if (!file.includes('no-glassmorphic-card.spec.ts')) {
          // Allow legitimate test code that checks for absence of legacy classes
          const isAllowedCheck = line.includes('locator(\'.glassmorphic-card\')') ||
                                line.includes('querySelectorAll(\'.glassmorphic-card\')') ||
                                line.includes('querySelector(\'.glassmorphic-card\')') ||
                                line.includes('getElementsByClassName(\'glassmorphic-card\')') ||
                                line.includes('className.includes(\'glassmorphic-card\')') ||
                                line.includes('No legacy glassmorphic-card classes exist') ||
                                line.includes('legacyCardsCount = await page.locator(\'.glassmorphic-card\')') ||
                                line.includes('has no legacy glassmorphic-card classes anywhere') ||
                                line.includes('has no legacy glassmorphic-card classes') ||
                                line.includes('legacyElements = document.querySelectorAll(\'.glassmorphic-card\')') ||
                                line.includes('expect(legacyElements.length).toBe(0)') ||
                                line.includes('Check that no element has the legacy class') ||
                                line.includes('doesn\'t leak legacy glassmorphic-card classes');

          if (line.includes('glassmorphic-card') && !isAllowedCheck) {
            matches.push(index + 1); // 1-based line numbers
          }
        }
      });

      if (matches.length > 0) {
        violations.push({
          file: path.relative(process.cwd(), file),
          count: matches.length,
          lines: matches,
        });
      }
    });

    if (violations.length > 0) {
      console.error('\n🚫 FOUND LEGACY glassmorphic-card IN TEST FILES:');
      violations.forEach(v => {
        console.error(`  ${v.file}: ${v.count} occurrences on lines ${v.lines.join(', ')}`);
      });
      console.error('\n💡 These should be replaced with: glass-section-card');
      console.error('   Or remove if testing for absence of legacy classes\n');
    }

    expect(violations).toHaveLength(0);
  });
});