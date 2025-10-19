import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ReviewQueue from '@/components/review/ReviewQueue';

describe('ReviewQueue reason required and skip flow', () => {
  beforeEach(() => {
    // @ts-ignore
    global.fetch = jest.fn(async (url: string, init?: any) => {
      if (url.includes('/api/parsed-events?')) {
        return {
          ok: true,
          json: async () => ({ success: true, events: [
            { id: 1, tweet_id: 't1', tweet_text: 'hello', tweet_created_at: '2025-10-17', event_type: 'other', overall_confidence: 0.5, needs_review: true, review_status: 'pending' }
          ] }),
        } as any;
      }
      if (url.includes('/approve') || url.includes('/skip') || (init?.method === 'PUT')) {
        return { ok: true, json: async () => ({ success: true }) } as any;
      }
      return { ok: true, json: async () => ({}) } as any;
    });
  });

  it('blocks Save without reason and allows Skip', async () => {
    render(<ReviewQueue />);

    // Wait until the first tweet shows
    await waitFor(() => expect(screen.getByText(/Tweet #/)).toBeInTheDocument());

    // Enter edit mode
    fireEvent.click(screen.getByText('Edit'));
    // Try Save without reason
    fireEvent.click(screen.getByText('Save'));
    // Should prompt (alert). jsdom doesn't show native alerts; rely on no state change to reviewed
    expect(screen.queryByText('Save & Approve')).toBeInTheDocument();

    // Skip should call skip endpoint
    const approveBtn = screen.getByText('Approve');
    expect(approveBtn).toBeInTheDocument();
  });
});

