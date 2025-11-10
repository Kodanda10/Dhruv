import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import EventResolver from '@/app/labs-v2/review/EventResolver';

// Mock the fetch API
global.fetch = jest.fn();

const mockSuggestions = [
  { id: 'evt-type-1', name_english: 'Political Rally', score: 0.92 },
  { id: 'evt-type-2', name_english: 'Protest', score: 0.75 },
];

describe('EventResolver', () => {
  const mockTweetId = 'tweet-123';

  beforeEach(() => {
    jest.clearAllMocks();
    (fetch as jest.Mock).mockImplementation((url) => {
      if (url.startsWith('/api/labs/event-types/suggest')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockSuggestions),
        });
      }
      if (url.startsWith('/api/labs/event-types/confirm')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, logId: 1 }),
        });
      }
      return Promise.reject(new Error(`Unhandled request: ${url}`));
    });
  });

  test('should render parsed event type and fetch suggestions', async () => {
    const onResolveMock = jest.fn();
    render(<EventResolver parsedEventType="Political Rally" tweetText="some text" tweetId={mockTweetId} onResolve={onResolveMock} />);

    // Assert that loading state is initially shown
    expect(screen.getByText('Loading suggestions...')).toBeInTheDocument();

    // Wait for the loading to finish and the actual content to appear
    await waitFor(() => {
      expect(screen.queryByText('Loading suggestions...')).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /Parsed Event Type: Political Rally/i })).toBeInTheDocument();
      expect(screen.getByText('Political Rally (Score: 0.92)')).toBeInTheDocument();
      expect(screen.getByText('Protest (Score: 0.75)')).toBeInTheDocument();
    });
  });

  test('should auto-select the first suggestion', async () => {
    const onResolveMock = jest.fn();
    render(<EventResolver parsedEventType="Political Rally" tweetText="some text" tweetId={mockTweetId} onResolve={onResolveMock} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Political Rally (Score: 0.92)')).toBeChecked();
    });
  });

  test('should call onResolve and confirm API with selected suggestion when confirmed', async () => {
    const onResolveMock = jest.fn();
    render(<EventResolver parsedEventType="Some other type" tweetText="some text" tweetId={mockTweetId} onResolve={onResolveMock} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Political Rally (Score: 0.92)')).toBeChecked();
    });

    fireEvent.click(screen.getByLabelText('Protest (Score: 0.75)'));
    expect(screen.getByLabelText('Protest (Score: 0.75)')).toBeChecked();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm Event' }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/labs/event-types/confirm', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          parsedEventType: 'Some other type',
          resolvedEventTypeId: 'evt-type-2',
          reviewStatus: 'confirmed',
          manualEntryName: null,
          reviewerId: 'human_reviewer_1',
          tweetId: mockTweetId,
        }),
      }));
      expect(onResolveMock).toHaveBeenCalledWith('Protest');
    });
  });

  test('should switch to manual entry mode', async () => {
    const onResolveMock = jest.fn();
    render(<EventResolver parsedEventType="Political Rally" tweetText="some text" tweetId={mockTweetId} onResolve={onResolveMock} />);

    await waitFor(() => {
      expect(screen.getByText('Political Rally (Score: 0.92)')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Manual Entry' }));
    expect(screen.getByPlaceholderText('Enter event type manually')).toBeInTheDocument();
    expect(screen.queryByText('Political Rally (Score: 0.92)')).not.toBeInTheDocument();
  });

  test('should call onResolve and confirm API with manual entry when confirmed', async () => {
    const onResolveMock = jest.fn();
    render(<EventResolver parsedEventType="Political Rally" tweetText="some text" tweetId={mockTweetId} onResolve={onResolveMock} />);

    await waitFor(() => {
      expect(screen.getByText('Political Rally (Score: 0.92)')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Manual Entry' }));
    const manualInput = screen.getByPlaceholderText('Enter event type manually');
    fireEvent.change(manualInput, { target: { value: 'New Custom Event' } });

    fireEvent.click(screen.getByRole('button', { name: 'Confirm Event' }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/labs/event-types/confirm', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          parsedEventType: 'Political Rally',
          resolvedEventTypeId: null,
          reviewStatus: 'manual_entry',
          manualEntryName: 'New Custom Event',
          reviewerId: 'human_reviewer_1',
          tweetId: mockTweetId,
        }),
      }));
      expect(onResolveMock).toHaveBeenCalledWith('New Custom Event');
    });
  });

  test('should clear selection when "Clear Selection" is clicked', async () => {
    const onResolveMock = jest.fn();
    render(<EventResolver parsedEventType="Political Rally" tweetText="some text" tweetId={mockTweetId} onResolve={onResolveMock} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Political Rally (Score: 0.92)')).toBeChecked();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Clear Selection' }));
    expect(onResolveMock).toHaveBeenCalledWith(null);
  });
});