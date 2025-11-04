import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import TagsSelector from '@/components/review/TagsSelector';

describe('TagsSelector', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    // Clear all mocks and timers
    jest.clearAllMocks();
    jest.clearAllTimers();
    
    // Mock fetch with proper cleanup
    fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, tags: [ { id: 1, label_hi: 'जल जीवन मिशन' }, { id: 2, label_hi: 'स्वच्छ भारत मिशन' } ] }),
    } as any);
    global.fetch = fetchMock;
  });

  afterEach(() => {
    // Clean up rendered components
    cleanup();
    // Clear all mocks
    jest.clearAllMocks();
    // Clear any pending timers
    jest.useRealTimers();
  });

  it('renders bubbles and toggles selection', async () => {
    const onChange = jest.fn();
    const { unmount } = render(<TagsSelector tweetId="123" onChange={onChange} />);

    await waitFor(() => {
      expect(screen.getByText('जल जीवन मिशन')).toBeInTheDocument();
    }, { timeout: 3000 });

    const bubble = screen.getByText('जल जीवन मिशन');
    fireEvent.click(bubble);
    expect(onChange).toHaveBeenCalledWith(['जल जीवन मिशन']);

    fireEvent.click(bubble);
    expect(onChange).toHaveBeenLastCalledWith([]);

    // Cleanup component
    unmount();
  });

  it('adds a new tag and persists', async () => {
    const persistMock = jest.fn().mockResolvedValue({ ok: true });
    fetchMock.mockImplementation((url: string, opts?: any) => {
      if (typeof url === 'string' && url.startsWith('/api/tags') && opts?.method === 'POST') {
        return Promise.resolve({ json: async () => ({ success: true, id: 99 }) } as any);
      }
      if (typeof url === 'string' && url.startsWith('/api/tweets/') && url.endsWith('/tags')) {
        persistMock();
        return Promise.resolve({ json: async () => ({ success: true }) } as any);
      }
      return Promise.resolve({ ok: true, json: async () => ({ success: true, tags: [] }) } as any);
    });

    const { unmount } = render(<TagsSelector tweetId="123" />);
    
    await waitFor(() => {
      const input = screen.getByPlaceholderText('टैग खोजें या नया जोड़ें');
      expect(input).toBeInTheDocument();
    }, { timeout: 3000 });

    const input = screen.getByPlaceholderText('टैग खोजें या नया जोड़ें');
    fireEvent.change(input, { target: { value: 'नया' } });

    await waitFor(() => {
      expect(screen.getByText('+ जोड़ें')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('+ जोड़ें'));
    fireEvent.click(screen.getByText('सहेजें'));

    await waitFor(() => {
      expect(persistMock).toHaveBeenCalled();
    }, { timeout: 3000 });

    // Cleanup component
    unmount();
  });
});


