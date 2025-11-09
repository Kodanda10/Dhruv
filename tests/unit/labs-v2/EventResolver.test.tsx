import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import EventResolver from '@/app/labs-v2/review/EventResolver';

// Mock the fetch API
global.fetch = jest.fn();

const mockSuggestions = [
  { id: 'evt-type-1', name: 'Political Rally', score: 0.92 },
  { id: 'evt-type-2', name: 'Protest', score: 0.75 },
];

describe('EventResolver', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockSuggestions),
    });
  });

  test('should render parsed event type and fetch suggestions', async () => {
    const onResolveMock = jest.fn();
    render(<EventResolver parsedEventType="Political Rally" tweetText="some text" onResolve={onResolveMock} />);

    expect(screen.getByRole('heading', { name: /Parsed Event Type: Political Rally/i })).toBeInTheDocument();
    expect(screen.getByText('Loading suggestions...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Political Rally (Score: 0.92)')).toBeInTheDocument();
      expect(screen.getByText('Protest (Score: 0.75)')).toBeInTheDocument();
    });
  });

  test('should auto-select the suggestion matching the parsed event type', async () => {
    const onResolveMock = jest.fn();
    render(<EventResolver parsedEventType="Political Rally" tweetText="some text" onResolve={onResolveMock} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Political Rally (Score: 0.92)')).toBeChecked();
    });
  });

  test('should call onResolve with selected suggestion when confirmed', async () => {
    const onResolveMock = jest.fn();
    render(<EventResolver parsedEventType="Some other type" tweetText="some text" onResolve={onResolveMock} />);

    await waitFor(() => {
      // Default is the first one
      expect(screen.getByLabelText('Political Rally (Score: 0.92)')).toBeChecked();
    });

    // Select a different one
    fireEvent.click(screen.getByLabelText('Protest (Score: 0.75)'));
    expect(screen.getByLabelText('Protest (Score: 0.75)')).toBeChecked();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm Event' }));
    expect(onResolveMock).toHaveBeenCalledWith('Protest');
  });
});