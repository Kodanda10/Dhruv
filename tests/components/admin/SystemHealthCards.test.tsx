/**
 * System Health Cards Component - TDD Tests
 *
 * Tests for system health overview dashboard displaying API chain health,
 * database connection status, frontend build health, and backend service uptime.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import SystemHealthCards from '../../../src/components/admin/SystemHealthCards';
import { useAuth } from '../../../src/hooks/useAuth';

// Mock the auth hook
jest.mock('../../../src/hooks/useAuth', () => ({
  useAuth: jest.fn(),
}));

// Mock fetch for health checks
global.fetch = jest.fn();

// Extend Jest matchers for accessibility
expect.extend(toHaveNoViolations);

describe('System Health Overview', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock admin authentication
    (useAuth as jest.Mock).mockReturnValue({
      isAuthenticated: true,
      user: { username: 'admin', role: 'admin' },
    });
  });

  describe('System Health Cards Rendering', () => {
    it('should display API chain health status', async () => {
      // Mock successful health responses
      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/api/health')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              status: 'healthy',
              services: {
                database: { status: 'healthy', latency: 45 },
                twitter_api: { status: 'healthy', latency: 120 },
                gemini_api: { status: 'healthy', latency: 180 },
                ollama_api: { status: 'healthy', latency: 95 },
              }
            })
          });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      render(<SystemHealthCards />);

      // Wait for health data to load
      await waitFor(() => {
        expect(screen.getByText(/API Chain Health/i)).toBeInTheDocument();
      });

      // Verify all health indicators are displayed
      expect(screen.getByText('Database')).toBeInTheDocument();
      expect(screen.getByText('Twitter API')).toBeInTheDocument();
      expect(screen.getByText('Gemini API')).toBeInTheDocument();
      expect(screen.getByText('Ollama API')).toBeInTheDocument();
    });

    it('should show database connection status', async () => {
      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/api/health')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              status: 'healthy',
              services: {
                database: { status: 'healthy', latency: 45, connection_pool: 8 }
              }
            })
          });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      render(<SystemHealthCards />);

      await waitFor(() => {
        expect(screen.getByText(/Database Connection/i)).toBeInTheDocument();
      });

      // Verify database-specific metrics
      expect(screen.getByText(/Connection Pool: 8/i)).toBeInTheDocument();
    });

    it('should display frontend build health', async () => {
      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/api/health')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              status: 'healthy',
              frontend: {
                build_status: 'success',
                last_build: '2025-11-04T10:30:00Z',
                bundle_size: '2.4MB'
              }
            })
          });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      render(<SystemHealthCards />);

      await waitFor(() => {
        expect(screen.getByText(/Frontend Build/i)).toBeInTheDocument();
      });

      expect(screen.getByText(/Build Status: success/i)).toBeInTheDocument();
      expect(screen.getByText(/Bundle Size: 2.4MB/i)).toBeInTheDocument();
    });

    it('should show backend service uptime', async () => {
      const uptime = 86400; // 1 day in seconds
      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/api/health')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              status: 'healthy',
              uptime_seconds: uptime,
              version: '1.0.0'
            })
          });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      render(<SystemHealthCards />);

      await waitFor(() => {
        expect(screen.getByText(/Backend Service/i)).toBeInTheDocument();
      });

      expect(screen.getByText(/Uptime: 1 day/i)).toBeInTheDocument();
      expect(screen.getByText(/Version: 1.0.0/i)).toBeInTheDocument();
    });
  });

  describe('Health Status Indicators', () => {
    it('should show green status for healthy services', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          status: 'healthy',
          services: {
            database: { status: 'healthy', latency: 45 }
          }
        })
      });

      render(<SystemHealthCards />);

      await waitFor(() => {
        const statusIndicator = screen.getByTestId('database-status');
        expect(statusIndicator).toHaveClass('bg-green-500');
      });
    });

    it('should show yellow status for degraded services', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          status: 'degraded',
          services: {
            twitter_api: { status: 'degraded', latency: 500 }
          }
        })
      });

      render(<SystemHealthCards />);

      await waitFor(() => {
        const statusIndicator = screen.getByTestId('twitter-api-status');
        expect(statusIndicator).toHaveClass('bg-yellow-500');
      });
    });

    it('should show red status for unhealthy services', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          status: 'unhealthy',
          services: {
            gemini_api: { status: 'unhealthy', error: 'API quota exceeded' }
          }
        })
      });

      render(<SystemHealthCards />);

      await waitFor(() => {
        const statusIndicator = screen.getByTestId('gemini-api-status');
        expect(statusIndicator).toHaveClass('bg-red-500');
      });
    });
  });

  describe('Clickable Health Cards', () => {
    it('should allow clicking on cards to view details', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          status: 'healthy',
          services: {
            database: { status: 'healthy', latency: 45, details: 'Connection pool active' }
          }
        })
      });

      render(<SystemHealthCards />);

      await waitFor(() => {
        const databaseCard = screen.getByText('Database').closest('div');
        expect(databaseCard).toBeInTheDocument();
      });

      // Click on database card should show details
      const databaseCard = screen.getByText('Database');
      databaseCard.click();

      await waitFor(() => {
        expect(screen.getByText('Connection pool active')).toBeInTheDocument();
      });
    });
  });

  describe('Performance Requirements', () => {
    it('should render health cards within performance budget', async () => {
      const startTime = performance.now();

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          status: 'healthy',
          services: { database: { status: 'healthy' } }
        })
      });

      render(<SystemHealthCards />);

      await waitFor(() => {
        expect(screen.getByText(/Database/i)).toBeInTheDocument();
      });

      const renderTime = performance.now() - startTime;
      expect(renderTime).toBeLessThan(200); // < 200ms budget
    });
  });

  describe('Accessibility Compliance', () => {
    it('should meet WCAG 2.1 AA standards', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          status: 'healthy',
          services: { database: { status: 'healthy' } }
        })
      });

      const { container } = render(<SystemHealthCards />);

      await waitFor(() => {
        expect(screen.getByText(/Database/i)).toBeInTheDocument();
      });

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should be keyboard navigable', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          status: 'healthy',
          services: { database: { status: 'healthy' } }
        })
      });

      render(<SystemHealthCards />);

      await waitFor(() => {
        const healthCards = screen.getAllByRole('button');
        expect(healthCards.length).toBeGreaterThan(0);
      });

      // Verify all health cards are focusable
      const healthCards = screen.getAllByRole('button');
      healthCards.forEach(card => {
        expect(card).toHaveAttribute('tabIndex');
      });
    });

    it('should have proper ARIA labels', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          status: 'healthy',
          services: { database: { status: 'healthy' } }
        })
      });

      render(<SystemHealthCards />);

      await waitFor(() => {
        expect(screen.getByLabelText(/Database health status/i)).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle API failures gracefully', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      render(<SystemHealthCards />);

      await waitFor(() => {
        expect(screen.getByText(/Unable to load health status/i)).toBeInTheDocument();
      });
    });

    it('should show retry option on API failure', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      render(<SystemHealthCards />);

      await waitFor(() => {
        const retryButton = screen.getByRole('button', { name: /Retry/i });
        expect(retryButton).toBeInTheDocument();
      });
    });
  });
});
