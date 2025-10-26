import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ReviewQueueNew from '@/components/review/ReviewQueueNew';

// Mock fetch globally
global.fetch = jest.fn();

describe('ReviewQueueNew - Debug AI Assistant', () => {
  beforeEach(() => {
    (global.fetch as jest.Mock).mockClear();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should render the component and show edit button', async () => {
    render(<ReviewQueueNew />);
    
    // Wait for loading to finish
    await waitFor(() => {
      expect(screen.queryByText('समीक्षा डेटा लोड हो रहा है...')).not.toBeInTheDocument();
    }, { timeout: 3000 });
    
    // Check if the edit button exists
    const editButton = screen.getByText('संपादित करें');
    expect(editButton).toBeInTheDocument();
    
    // Check if the button is clickable
    expect(editButton).not.toBeDisabled();
  });

  it('should open AI Assistant modal when edit button is clicked', async () => {
    render(<ReviewQueueNew />);
    
    // Wait for loading to finish
    await waitFor(() => {
      expect(screen.queryByText('समीक्षा डेटा लोड हो रहा है...')).not.toBeInTheDocument();
    }, { timeout: 3000 });
    
    // Click the Edit button
    const editButton = screen.getByText('संपादित करें');
    fireEvent.click(editButton);

    // Wait for modal to appear
    await waitFor(() => {
      // Check if modal header appears
      expect(screen.getByText('विशेषज्ञ संपादक AI सहायक')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('should show modal content after opening', async () => {
    render(<ReviewQueueNew />);
    
    // Wait for loading to finish
    await waitFor(() => {
      expect(screen.queryByText('समीक्षा डेटा लोड हो रहा है...')).not.toBeInTheDocument();
    }, { timeout: 3000 });
    
    // Click the Edit button
    const editButton = screen.getByText('संपादित करें');
    fireEvent.click(editButton);

    // Wait for modal content
    await waitFor(() => {
      expect(screen.getByText(/नमस्कार! मैं आपका AI सहायक हूँ/)).toBeInTheDocument();
    }, { timeout: 3000 });
  });
});
