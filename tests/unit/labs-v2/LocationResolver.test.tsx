import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import LocationResolver from '@/app/labs-v2/review/LocationResolver';

// Mock the fetch API
global.fetch = jest.fn();

const mockSuggestions = [
  { id: 'loc1', name_hindi: 'रायगढ़ शहर', name_english: 'Raigarh City', type: 'city', state: 'Chhattisgarh', score: 0.95 },
  { id: 'loc2', name_hindi: 'रायगढ़ जिला', name_english: 'Raigarh District', type: 'district', state: 'Chhattisgarh', score: 0.88 },
];

describe('LocationResolver', () => {
  const mockTweetId = 'tweet-123';

  beforeEach(() => {
    jest.clearAllMocks();
    (fetch as jest.Mock).mockImplementation((url) => {
      if (url.startsWith('/api/labs/locations/resolve')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockSuggestions),
        });
      }
      if (url.startsWith('/api/labs/locations/confirm')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, logId: 1 }),
        });
      }
      return Promise.reject(new Error(`Unhandled request: ${url}`));
    });
  });

  test('should render parsed location and fetch suggestions on mount', async () => {
    const onResolveMock = jest.fn();
    render(<LocationResolver parsedLocation="Raigarh" tweetId={mockTweetId} onResolve={onResolveMock} />);

    expect(screen.getByRole('heading', { name: /Parsed Location: Raigarh/i })).toBeInTheDocument();
    expect(screen.getByText('Loading suggestions...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByText('Loading suggestions...')).not.toBeInTheDocument();
      expect(screen.getByText('Raigarh City (Score: 0.95)')).toBeInTheDocument();
      expect(screen.getByText('Raigarh District (Score: 0.88)')).toBeInTheDocument();
    });
  });

  test('should display error message if fetching suggestions fails', async () => {
    (fetch as jest.Mock).mockImplementation((url) => {
      if (url.startsWith('/api/labs/locations/resolve')) {
        return Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ error: 'API Error' }),
        });
      }
      return Promise.reject(new Error(`Unhandled request: ${url}`));
    });
    const onResolveMock = jest.fn();
    render(<LocationResolver parsedLocation="Raigarh" tweetId={mockTweetId} onResolve={onResolveMock} />);

    await waitFor(() => {
      expect(screen.getByText('Error: API Error')).toBeInTheDocument();
    });
  });

  test('should auto-select the first suggestion', async () => {
    const onResolveMock = jest.fn();
    render(<LocationResolver parsedLocation="Raigarh" tweetId={mockTweetId} onResolve={onResolveMock} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Raigarh City (Score: 0.95)')).toBeChecked();
    });
  });

  test('should call onResolve and confirm API with selected suggestion when confirmed', async () => {
    const onResolveMock = jest.fn();
    render(<LocationResolver parsedLocation="Raigarh" tweetId={mockTweetId} onResolve={onResolveMock} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Raigarh City (Score: 0.95)')).toBeChecked();
    });

    fireEvent.click(screen.getByLabelText('Raigarh District (Score: 0.88)'));
    expect(screen.getByLabelText('Raigarh District (Score: 0.88)')).toBeChecked();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm Location' }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/labs/locations/confirm', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          parsedLocation: 'Raigarh',
          resolvedLocationId: 'loc2',
          reviewStatus: 'confirmed',
          manualEntryName: null,
          reviewerId: 'human_reviewer_1',
          tweetId: mockTweetId,
        }),
      }));
      expect(onResolveMock).toHaveBeenCalledWith('Raigarh District');
    });
  });

  test('should switch to manual entry mode', async () => {
    const onResolveMock = jest.fn();
    render(<LocationResolver parsedLocation="Raigarh" tweetId={mockTweetId} onResolve={onResolveMock} />);

    await waitFor(() => {
      expect(screen.getByText('Raigarh City (Score: 0.95)')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Manual Entry' }));
    expect(screen.getByPlaceholderText('Enter location manually')).toBeInTheDocument();
    expect(screen.queryByText('Raigarh City (Score: 0.95)')).not.toBeInTheDocument();
  });

  test('should call onResolve and confirm API with manual entry when confirmed', async () => {
    const onResolveMock = jest.fn();
    render(<LocationResolver parsedLocation="Raigarh" tweetId={mockTweetId} onResolve={onResolveMock} />);

    await waitFor(() => {
      expect(screen.getByText('Raigarh City (Score: 0.95)')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Manual Entry' }));
    const manualInput = screen.getByPlaceholderText('Enter location manually');
    fireEvent.change(manualInput, { target: { value: 'Custom Location' } });

    fireEvent.click(screen.getByRole('button', { name: 'Confirm Location' }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/labs/locations/confirm', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          parsedLocation: 'Raigarh',
          resolvedLocationId: null,
          reviewStatus: 'manual_entry',
          manualEntryName: 'Custom Location',
          reviewerId: 'human_reviewer_1',
          tweetId: mockTweetId,
        }),
      }));
      expect(onResolveMock).toHaveBeenCalledWith('Custom Location');
    });
  });

  test('should call onResolve with null when "Clear Selection" is clicked', async () => {
    const onResolveMock = jest.fn();
    render(<LocationResolver parsedLocation="Raigarh" tweetId={mockTweetId} onResolve={onResolveMock} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Raigarh City (Score: 0.95)')).toBeChecked();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Clear Selection' }));
    expect(onResolveMock).toHaveBeenCalledWith(null);
    // Ensure confirm API is NOT called for clear selection
    expect(fetch).not.toHaveBeenCalledWith('/api/labs/locations/confirm', expect.any(Object));
  });
});