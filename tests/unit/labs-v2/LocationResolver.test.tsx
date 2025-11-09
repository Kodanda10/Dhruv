import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import LocationResolver from '@/app/labs-v2/review/LocationResolver';

// Mock the fetch API
global.fetch = jest.fn();

const mockSuggestions = [
  { id: 'loc1', name: 'Raigarh City', score: 0.95, type: 'city' },
  { id: 'loc2', name: 'Raigarh District', score: 0.88, type: 'district' },
];

describe('LocationResolver', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockSuggestions),
    });
  });

  test('should render parsed location and fetch suggestions on mount', async () => {
    const onResolveMock = jest.fn();
    render(<LocationResolver parsedLocation="Raigarh" onResolve={onResolveMock} />);

    // Assert the parsed location heading
    expect(screen.getByRole('heading', { name: /Parsed Location: Raigarh/i })).toBeInTheDocument();
    expect(screen.getByText('Loading suggestions...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByText('Loading suggestions...')).not.toBeInTheDocument();
      expect(screen.getByText('Raigarh City (Score: 0.95)')).toBeInTheDocument();
      expect(screen.getByText('Raigarh District (Score: 0.88)')).toBeInTheDocument();
    });
  });

  test('should display error message if fetching suggestions fails', async () => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'API Error' }),
    });
    const onResolveMock = jest.fn();
    render(<LocationResolver parsedLocation="Raigarh" onResolve={onResolveMock} />);

    await waitFor(() => {
      expect(screen.getByText('Error: API Error')).toBeInTheDocument();
    });
  });

  test('should call onResolve with selected suggestion when confirmed', async () => {
    const onResolveMock = jest.fn();
    render(<LocationResolver parsedLocation="Raigarh" onResolve={onResolveMock} />);

    await waitFor(() => {
      // Default selected is the first one
      expect(screen.getByLabelText('Raigarh City (Score: 0.95)')).toBeChecked();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Confirm Location' }));
    expect(onResolveMock).toHaveBeenCalledWith('Raigarh City');
  });

  test('should call onResolve with null when "None of these" is clicked', async () => {
    const onResolveMock = jest.fn();
    render(<LocationResolver parsedLocation="Raigarh" onResolve={onResolveMock} />);

    await waitFor(() => {
      expect(screen.getByText('Raigarh City (Score: 0.95)')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'None of these' }));
    expect(onResolveMock).toHaveBeenCalledWith(null);
  });

  test('should allow manual input and call onResolve with manual value', async () => {
    const onResolveMock = jest.fn();
    render(<LocationResolver parsedLocation="Raigarh" onResolve={onResolveMock} />);

    await waitFor(() => {
      expect(screen.getByText('Suggestions')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Manual' }));
    const manualInput = screen.getByPlaceholderText('Enter location manually');
    fireEvent.change(manualInput, { target: { value: 'Custom Location' } });

    fireEvent.click(screen.getByRole('button', { name: 'Confirm Location' }));
    expect(onResolveMock).toHaveBeenCalledWith('Custom Location');
  });
});