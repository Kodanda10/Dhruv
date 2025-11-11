
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import FaissSearchCard from '@/components/analytics/FaissSearchCard';

// Mock fetch
global.fetch = vi.fn();

describe('FaissSearchCard', () => {
  beforeEach(() => {
    (fetch as any).mockClear();
  });

  it('renders the search card with initial state', () => {
    render(<FaissSearchCard />);
    expect(screen.getByText('Vector Location Search')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search for a location...')).toBeInTheDocument();
    expect(screen.getByText('Search')).toBeInTheDocument();
    expect(screen.getByText('No results to display.')).toBeInTheDocument();
  });

  it('updates the query when the user types in the input', () => {
    render(<FaissSearchCard />);
    const input = screen.getByPlaceholderText('Search for a location...') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Raigarh' } });
    expect(input.value).toBe('Raigarh');
  });

  it('shows an error if the search query is empty on submission', async () => {
    render(<FaissSearchCard />);
    const searchButton = screen.getByText('Search');
    fireEvent.click(searchButton);
    expect(await screen.findByText('Please enter a search query.')).toBeInTheDocument();
  });

  it('performs a search and displays results on successful fetch', async () => {
    const mockResults = [
      { id: '1', name: 'Raigarh', score: 0.98 },
      { id: '2', name: 'Raigarh District', score: 0.95 },
    ];
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResults,
    });

    render(<FaissSearchCard />);
    const input = screen.getByPlaceholderText('Search for a location...');
    const searchButton = screen.getByText('Search');

    fireEvent.change(input, { target: { value: 'Raigarh' } });
    fireEvent.click(searchButton);

    expect(screen.getByText('Searching...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Raigarh')).toBeInTheDocument();
      expect(screen.getByText('Score: 0.9800')).toBeInTheDocument();
      expect(screen.getByText('Raigarh District')).toBeInTheDocument();
      expect(screen.getByText('Score: 0.9500')).toBeInTheDocument();
    });
  });

  it('displays a "no results" message when the fetch is successful but returns an empty array', async () => {
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    render(<FaissSearchCard />);
    const input = screen.getByPlaceholderText('Search for a location...');
    const searchButton = screen.getByText('Search');

    fireEvent.change(input, { target: { value: 'UnknownPlace' } });
    fireEvent.click(searchButton);

    await waitFor(() => {
      expect(screen.getByText('No results to display.')).toBeInTheDocument();
    });
  });

  it('displays an error message when the fetch fails', async () => {
    (fetch as any).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Failed to connect to the server.' }),
    });

    render(<FaissSearchCard />);
    const input = screen.getByPlaceholderText('Search for a location...');
    const searchButton = screen.getByText('Search');

    fireEvent.change(input, { target: { value: 'Raigarh' } });
    fireEvent.click(searchButton);

    await waitFor(() => {
      expect(screen.getByText('Failed to connect to the server.')).toBeInTheDocument();
    });
  });
});
