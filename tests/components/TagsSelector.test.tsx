import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TagsSelector from '@/components/review/TagsSelector';

describe('TagsSelector', () => {
  beforeEach(() => {
    // mock fetch
    global.fetch = jest.fn().mockResolvedValue({
      json: async () => ({ success: true, tags: [ { id: 1, label_hi: 'जल जीवन मिशन' }, { id: 2, label_hi: 'स्वच्छ भारत मिशन' } ] }),
    } as any);
  });

  it('renders bubbles and toggles selection', async () => {
    const onChange = jest.fn();
    render(<TagsSelector tweetId="123" onChange={onChange} />);

    await waitFor(() => {
      expect(screen.getByText('जल जीवन मिशन')).toBeInTheDocument();
    });

    const bubble = screen.getByText('जल जीवन मिशन');
    fireEvent.click(bubble);
    expect(onChange).toHaveBeenCalledWith(['जल जीवन मिशन']);

    fireEvent.click(bubble);
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it('adds a new tag and persists', async () => {
    const persistMock = jest.fn().mockResolvedValue({ ok: true });
    (global.fetch as any) = jest.fn((url: string, opts?: any) => {
      if (url.startsWith('/api/tags') && opts?.method === 'POST') {
        return Promise.resolve({ json: async () => ({ success: true, id: 99 }) });
      }
      if (url.startsWith('/api/tweets/') && url.endsWith('/tags')) {
        persistMock();
        return Promise.resolve({ json: async () => ({ success: true }) });
      }
      return Promise.resolve({ json: async () => ({ success: true, tags: [] }) });
    });

    render(<TagsSelector tweetId="123" />);
    const input = screen.getByPlaceholderText('टैग खोजें या नया जोड़ें');
    fireEvent.change(input, { target: { value: 'नया' } });

    fireEvent.click(screen.getByText('+ जोड़ें'));
    fireEvent.click(screen.getByText('सहेजें'));

    await waitFor(() => {
      expect(persistMock).toHaveBeenCalled();
    });
  });
});


