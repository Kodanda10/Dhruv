/**
 * GlassSectionCard Utility Contract Tests
 *
 * Validates that the glass-section-card utility maintains its contract
 * and provides consistent styling across all implementations.
 */

import { render, screen } from '@testing-library/react';
import GlassSectionCard from '@/components/GlassSectionCard';

describe('glass-section-card utility contract', () => {
  describe('Component contract', () => {
    it('renders with glass-section-card class', () => {
      render(<GlassSectionCard>Test content</GlassSectionCard>);

      const card = screen.getByText('Test content');
      expect(card).toHaveClass('glass-section-card');
      expect(card).toHaveClass('text-white');
    });

    it('accepts custom className prop', () => {
      render(<GlassSectionCard className="custom-class">Test content</GlassSectionCard>);

      const card = screen.getByText('Test content');
      expect(card).toHaveClass('glass-section-card');
      expect(card).toHaveClass('custom-class');
      expect(card).toHaveClass('text-white');
    });

    it('passes through other HTML attributes', () => {
      render(
        <GlassSectionCard data-testid="test-card" aria-label="Test card">
          Test content
        </GlassSectionCard>
      );

      const card = screen.getByTestId('test-card');
      expect(card).toHaveAttribute('aria-label', 'Test card');
    });

    it('renders children correctly', () => {
      render(
        <GlassSectionCard>
          <div data-testid="child">Child content</div>
        </GlassSectionCard>
      );

      expect(screen.getByTestId('child')).toBeInTheDocument();
      expect(screen.getByText('Child content')).toBeInTheDocument();
    });
  });

  describe('CSS class application', () => {
    it('applies glass-section-card class', () => {
      render(<GlassSectionCard data-testid="class-test">Content</GlassSectionCard>);

      const card = screen.getByTestId('class-test');
      expect(card).toHaveClass('glass-section-card');
      expect(card).toHaveClass('text-white');
    });

    it('maintains class application with custom props', () => {
      render(
        <GlassSectionCard
          data-testid="custom-class-test"
          className="custom-extra-class"
        >
          Content
        </GlassSectionCard>
      );

      const card = screen.getByTestId('custom-class-test');
      expect(card).toHaveClass('glass-section-card');
      expect(card).toHaveClass('text-white');
      expect(card).toHaveClass('custom-extra-class');
    });
  });

  describe('Component behavior', () => {
    it('handles hover events without errors', () => {
      render(<GlassSectionCard data-testid="hover-test">Content</GlassSectionCard>);

      const card = screen.getByTestId('hover-test');

      // Simulate hover - should not throw errors
      card.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      card.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));

      // Component should still be rendered and functional
      expect(card).toBeInTheDocument();
      expect(card).toHaveClass('glass-section-card');
    });

    it('maintains functionality after interactions', () => {
      render(<GlassSectionCard data-testid="interaction-test">Content</GlassSectionCard>);

      const card = screen.getByTestId('interaction-test');

      // Simulate various interactions
      card.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      card.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
      card.focus();
      card.blur();

      // Component should maintain its structure
      expect(card).toBeInTheDocument();
      expect(card).toHaveClass('glass-section-card');
      expect(card).toHaveClass('text-white');
    });
  });

  describe('Responsive behavior', () => {
    it('maintains styling across different screen sizes', () => {
      // Mock different viewport sizes
      const originalInnerWidth = window.innerWidth;

      // Test mobile
      Object.defineProperty(window, 'innerWidth', { value: 375 });
      render(<GlassSectionCard data-testid="mobile-test">Mobile</GlassSectionCard>);

      const mobileCard = screen.getByTestId('mobile-test');
      expect(mobileCard).toHaveClass('glass-section-card');

      // Reset
      Object.defineProperty(window, 'innerWidth', { value: originalInnerWidth });
    });
  });

  describe('Theme consistency', () => {
    it('maintains consistent styling with theme changes', () => {
      // Test that the component doesn't break with different theme contexts
      render(
        <div data-theme="dark">
          <GlassSectionCard data-testid="theme-test">Themed content</GlassSectionCard>
        </div>
      );

      const card = screen.getByTestId('theme-test');
      expect(card).toHaveClass('glass-section-card');
      expect(card).toHaveClass('text-white');
    });
  });
});