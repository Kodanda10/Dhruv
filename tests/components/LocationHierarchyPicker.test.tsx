import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import LocationHierarchyPicker from '@/components/review/LocationHierarchyPicker';

describe('LocationHierarchyPicker', () => {
  beforeEach(() => {
    // @ts-ignore
    global.fetch = jest.fn(async (url: string) => {
      if (url.includes('/api/geo/search')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            results: [
              {
                label: 'Raigarh › Kharsia › Ward 12',
                path: [
                  { type: 'district', name: 'Raigarh' },
                  { type: 'ac', name: 'Kharsia' },
                  { type: 'ward', name: '12' },
                ],
              },
            ],
          }),
        } as any;
      }
      return { ok: true, json: async () => ({}) } as any;
    });
  });

  it('fetches suggestions and adds selection chip', async () => {
    const onChange = jest.fn();
    const { rerender } = render(<LocationHierarchyPicker value={[]} onChange={onChange} />);

    const input = screen.getByPlaceholderText('Search location…');
    fireEvent.change(input, { target: { value: 'Raig' } });

    await waitFor(() => expect(screen.getByText('Raigarh › Kharsia › Ward 12')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Raigarh › Kharsia › Ward 12'));

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const last = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    rerender(<LocationHierarchyPicker value={last} onChange={onChange} />);
    expect(screen.getByTestId('loc-chip-0')).toHaveTextContent('Raigarh › Kharsia › Ward 12');
  });
});

