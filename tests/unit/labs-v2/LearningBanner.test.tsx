import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import LearningBanner from '@/app/labs-v2/review/LearningBanner';

// Mock the fetch API
global.fetch = jest.fn();

describe('LearningBanner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should fetch initial status and render correctly', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ isEnabled: true }),
    });

    render(<LearningBanner />);

    await waitFor(() => {
      expect(screen.getByText('Dynamic Learning Active')).toBeInTheDocument();
      expect(screen.getByRole('checkbox')).toBeChecked();
    });
  });

  test('should toggle status on click and call the API', async () => {
    // Initial status is false
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ isEnabled: false }),
    });

    // Mock the toggle API response
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true, isEnabled: true }),
    });

    render(<LearningBanner />);

    const toggle = await screen.findByRole('checkbox');
    expect(toggle).not.toBeChecked();

    fireEvent.click(toggle);

    // Optimistic update
    expect(toggle).toBeChecked();

    // Check if the toggle API was called
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/labs-v2/learning/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isEnabled: true }),
      });
    });
  });

  test('should revert optimistic update if API call fails', async () => {
    // Initial status is true
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ isEnabled: true }),
    });

    // Mock a failed toggle API response
    (fetch as jest.Mock).mockRejectedValueOnce(new Error('API Failure'));

    render(<LearningBanner />);

    const toggle = await screen.findByRole('checkbox');
    expect(toggle).toBeChecked();

    fireEvent.click(toggle);

    // Optimistic update to off
    expect(toggle).not.toBeChecked();

    // Wait for the API call to fail and revert
    await waitFor(() => {
      expect(toggle).toBeChecked();
    });
  });
});
