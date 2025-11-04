import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ReviewQueueNew from '@/components/review/ReviewQueueNew';

const mockTweet = {
  id: 'tweet-1',
  tweet_id: 'tweet-1',
  event_type: 'बैठक',
  event_date: '2024-01-01T10:00:00Z',
  locations: ['रायपुर'],
  people_mentioned: [],
  organizations: [],
  schemes_mentioned: [],
  overall_confidence: 0.9,
  needs_review: true,
  review_status: 'pending',
};

let fetchSpy: jest.SpyInstance;

describe('ReviewQueueNew - Debug AI Assistant', () => {
  beforeEach(() => {
    fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();

      if (url.includes('/api/parsed-events')) {
        if (init?.method === 'PUT') {
          return {
            ok: true,
            json: async () => ({ success: true }),
          } as any;
        }
        return {
          ok: true,
          json: async () => ({ success: true, data: [mockTweet] }),
        } as any;
      }

      if (url.includes('/api/learning')) {
        const body = init?.body ? JSON.parse(init.body as string) : {};
        if (body?.action === 'get_suggestions') {
          return {
            ok: true,
            json: async () => ({
              eventTypes: [],
              schemes: [],
              locations: [],
              hashtags: [],
            }),
          } as any;
        }

        return {
          ok: true,
          json: async () => ({ success: true }),
        } as any;
      }

      if (url.includes('/api/reference/learn?')) {
        return {
          ok: true,
          json: async () => ({ success: true, suggestions: [] }),
        } as any;
      }

      if (url.includes('/api/reference/learn')) {
        return {
          ok: true,
          json: async () => ({ success: true }),
        } as any;
      }

      if (url.includes('/api/ai-assistant')) {
        return {
          ok: true,
          json: async () => ({ success: true, response: 'सहायक प्रतिक्रिया' }),
        } as any;
      }

      if (url.includes('/api/geo-extraction')) {
        return {
          ok: true,
          json: async () => ({
            hierarchies: [
              {
                village: 'रायपुर',
                gram_panchayat: 'रायपुर',
                block: 'रायपुर',
                assembly: 'रायपुर शहर उत्तर',
                district: 'रायपुर',
                is_urban: false,
                confidence: 0.9,
              },
            ],
            ambiguous: [],
            summary: {
              totalLocations: 1,
              resolvedLocations: 1,
              ambiguousLocations: 0,
              confidence: 0.9,
            },
          }),
        } as any;
      }

      return {
        ok: true,
        json: async () => ({ success: true }),
      } as any;
    });
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('should render the component and show edit button', async () => {
    render(<ReviewQueueNew />);
    
    // Wait for loading to finish
    await waitFor(() => {
      expect(screen.queryByText('समीक्षा डेटा लोड हो रहा है...')).not.toBeInTheDocument();
    }, { timeout: 3000 });
    
    // Check if the edit button exists
    const editButton = screen.getByText('संपादित करें');
    expect(editButton).toBeInTheDocument();
    
    // Check if the button is clickable
    expect(editButton).not.toBeDisabled();
  });

  it('should open AI Assistant modal when edit button is clicked', async () => {
    render(<ReviewQueueNew />);
    
    // Wait for loading to finish
    await waitFor(() => {
      expect(screen.queryByText('समीक्षा डेटा लोड हो रहा है...')).not.toBeInTheDocument();
    }, { timeout: 3000 });
    
    // Click the Edit button
    const editButton = screen.getByText('संपादित करें');
    fireEvent.click(editButton);

    // Wait for modal to appear
    await waitFor(() => {
      // Check if modal header appears
      expect(screen.getByText('विशेषज्ञ संपादक AI सहायक')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('should show modal content after opening', async () => {
    render(<ReviewQueueNew />);
    
    // Wait for loading to finish
    await waitFor(() => {
      expect(screen.queryByText('समीक्षा डेटा लोड हो रहा है...')).not.toBeInTheDocument();
    }, { timeout: 3000 });
    
    // Click the Edit button
    const editButton = screen.getByText('संपादित करें');
    fireEvent.click(editButton);

    // Wait for modal content
    await waitFor(() => {
      expect(screen.getByText(/नमस्कार! मैं आपका AI सहायक हूँ/)).toBeInTheDocument();
    }, { timeout: 3000 });
  });
});
