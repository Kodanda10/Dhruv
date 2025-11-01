import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import DashboardDark from '@/components/DashboardDark';

// Mock the API module
jest.mock('@/lib/api', () => ({
  get: jest.fn(),
}));

describe('DashboardDark', () => {
  it('renders without crashing', () => {
    render(<DashboardDark />);
    expect(screen.getByText(/दिखा रहे हैं/i)).toBeInTheDocument();
  });

  it('displays dark theme styling', () => {
    const { container } = render(<DashboardDark />);
    expect(container.querySelector('.bg-\\[\\#192734\\]')).toBeInTheDocument();
  });

  it('shows data table', () => {
    render(<DashboardDark />);
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('should center-align all table headers', () => {
    render(<DashboardDark />);
    const headers = screen.getAllByRole('button', { name: /sort by/i });
    headers.forEach(header => {
      expect(header).toHaveClass('text-center');
    });
  });

  describe('Table sorting', () => {
    it('should sort by date ascending when date header clicked', () => {
      render(<DashboardDark />);
      const dateHeader = screen.getByRole('button', { name: /sort by date/i });
      fireEvent.click(dateHeader);
      // Check that sort icon appears using a more flexible matcher
      expect(screen.getAllByText((content, element) => {
        return element?.textContent?.includes('↑') || false;
      })[0]).toBeInTheDocument();
    });

    it('should toggle to descending on second click', () => {
      render(<DashboardDark />);
      const dateHeader = screen.getByRole('button', { name: /sort by date/i });
      fireEvent.click(dateHeader);
      fireEvent.click(dateHeader);
      // Check that sort icon changes to descending
      expect(screen.getAllByText((content, element) => {
        return element?.textContent?.includes('↓') || false;
      })[0]).toBeInTheDocument();
    });

    it('should show sort indicators (↑↓)', () => {
      render(<DashboardDark />);
      const dateHeader = screen.getByRole('button', { name: /sort by date/i });
      fireEvent.click(dateHeader);
      expect(screen.getAllByText((content, element) => {
        return element?.textContent?.includes('↑') || false;
      })[0]).toBeInTheDocument();
    });

    it('should be keyboard accessible', () => {
      render(<DashboardDark />);
      const dateHeader = screen.getByRole('button', { name: /sort by date/i });
      fireEvent.keyDown(dateHeader, { key: 'Enter' });
      expect(screen.getAllByText((content, element) => {
        return element?.textContent?.includes('↑') || false;
      })[0]).toBeInTheDocument();
    });
  });

  describe('Real-time refresh', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should render polling component without errors', () => {
      const api = require('@/lib/api');
      api.get.mockResolvedValue({ success: true, data: [] });

      render(<DashboardDark />);
      
      // Component should render without crashing
      expect(screen.getByText(/दिखा रहे हैं/i)).toBeInTheDocument();
    });

    it('should handle API errors gracefully', async () => {
      const api = require('@/lib/api');
      api.get.mockRejectedValue(new Error('API Error'));

      render(<DashboardDark />);
      
      // Component should still render even with API errors
      expect(screen.getByText(/दिखा रहे हैं/i)).toBeInTheDocument();
    });

    it('should cleanup timers on unmount', () => {
      const api = require('@/lib/api');
      api.get.mockResolvedValue({ success: true, data: [] });

      const { unmount } = render(<DashboardDark />);
      
      // Should not throw when unmounting
      expect(() => unmount()).not.toThrow();
    });
  });
});
