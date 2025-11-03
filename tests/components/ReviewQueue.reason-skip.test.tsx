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

    // Skip button should be visible in non-edit mode
    const skipBtn = screen.getByText('Skip');
    expect(skipBtn).toBeInTheDocument();

    // Enter edit mode
    const editBtn = screen.getAllByText('Edit').find(btn => btn.closest('button'));
    fireEvent.click(editBtn!);
    
    // Should show edit mode with Save and Save & Approve buttons
    await waitFor(() => expect(screen.getByText('Save')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('Save & Approve')).toBeInTheDocument());

    // Skip button should NOT be visible in edit mode
    expect(screen.queryByText('Skip')).not.toBeInTheDocument();
  });
});

