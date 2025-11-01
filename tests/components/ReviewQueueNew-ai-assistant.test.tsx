import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ReviewQueueNew from '@/components/review/ReviewQueueNew';

// Mock the API
global.fetch = jest.fn();

describe('ReviewQueueNew - AI Assistant Modal Functionality', () => {
  beforeEach(() => {
    (global.fetch as jest.Mock).mockClear();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should open AI Assistant modal when Edit button is clicked', async () => {
    render(<ReviewQueueNew />);

    // Wait for loading to finish
    await waitFor(() => {
      expect(screen.queryByText('समीक्षा डेटा लोड हो रहा है...')).not.toBeInTheDocument();
    }, { timeout: 3000 });

    // Wait for component to load
    await waitFor(() => {
      expect(screen.getByText('संपादित करें')).toBeInTheDocument();
    });

    // Click the Edit button
    const editButton = screen.getByText('संपादित करें');
    fireEvent.click(editButton);

    // Verify AI Assistant modal opens
    await waitFor(() => {
      expect(screen.getByText('विशेषज्ञ संपादक AI सहायक')).toBeInTheDocument();
    });

    // Verify modal content is displayed
    expect(screen.getByText(/नमस्कार! मैं आपका AI सहायक हूँ/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('अपनी प्रतिक्रिया टाइप करें...')).toBeInTheDocument();
  });

  it('should close AI Assistant modal when close button is clicked', async () => {
    render(<ReviewQueueNew />);

    // Wait for loading to finish
    await waitFor(() => {
      expect(screen.queryByText('समीक्षा डेटा लोड हो रहा है...')).not.toBeInTheDocument();
    }, { timeout: 3000 });

    // Open the modal
    await waitFor(() => {
      expect(screen.getByText('संपादित करें')).toBeInTheDocument();
    });

    const editButton = screen.getByText('संपादित करें');
    fireEvent.click(editButton);

    // Wait for modal to open
    await waitFor(() => {
      expect(screen.getByText('विशेषज्ञ संपादक AI सहायक')).toBeInTheDocument();
    });

    // Click close button (specifically the modal close button)
    // Get all close buttons and click the first one (modal close button)
    const allCloseButtons = screen.getAllByRole('button', { name: /close/i });
    fireEvent.click(allCloseButtons[0]);

    // Verify modal closes
    await waitFor(() => {
      expect(screen.queryByText('विशेषज्ञ संपादक AI सहायक')).not.toBeInTheDocument();
    });
  });

  it('should send AI message when user types and presses Enter', async () => {
    // Mock all required API calls
    (global.fetch as jest.Mock)
      // Mock geo-extraction API calls
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          hierarchies: [],
          ambiguous: [],
          summary: { totalLocations: 0, resolvedLocations: 0, ambiguousLocations: 0, confidence: 0 }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          hierarchies: [],
          ambiguous: [],
          summary: { totalLocations: 0, resolvedLocations: 0, ambiguousLocations: 0, confidence: 0 }
        })
      })
      // Mock parsed-events API call
      .mockResolvedValueOnce({
        ok: true,
        json: async () => []
      })
      // Mock AI Assistant API call
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          response: 'मैंने आपकी प्रतिक्रिया को समझ लिया है। क्या आप कुछ और बताना चाहेंगे?'
        })
      });

    render(<ReviewQueueNew />);

    // Wait for loading to finish
    await waitFor(() => {
      expect(screen.queryByText('समीक्षा डेटा लोड हो रहा है...')).not.toBeInTheDocument();
    }, { timeout: 3000 });

    // Open the modal
    await waitFor(() => {
      expect(screen.getByText('संपादित करें')).toBeInTheDocument();
    });

    const editButton = screen.getByText('संपादित करें');
    fireEvent.click(editButton);

    // Wait for modal to open
    await waitFor(() => {
      expect(screen.getByPlaceholderText('अपनी प्रतिक्रिया टाइप करें...')).toBeInTheDocument();
    });

    // Type a message
    const input = screen.getByPlaceholderText('अपनी प्रतिक्रिया टाइप करें...');
    fireEvent.change(input, { target: { value: 'कार्यक्रम का प्रकार बैठक है' } });

    // Press Enter
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    // Verify API was called
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/ai-assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: expect.stringContaining('कार्यक्रम का प्रकार बैठक है')
      });
    });

    // Verify user message appears
    await waitFor(() => {
      expect(screen.getByText('कार्यक्रम का प्रकार बैठक है')).toBeInTheDocument();
    });
  });

  it('should handle AI Assistant API errors gracefully', async () => {
    // Mock all required API calls
    (global.fetch as jest.Mock)
      // Mock geo-extraction API calls
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          hierarchies: [],
          ambiguous: [],
          summary: { totalLocations: 0, resolvedLocations: 0, ambiguousLocations: 0, confidence: 0 }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          hierarchies: [],
          ambiguous: [],
          summary: { totalLocations: 0, resolvedLocations: 0, ambiguousLocations: 0, confidence: 0 }
        })
      })
      // Mock parsed-events API call
      .mockResolvedValueOnce({
        ok: true,
        json: async () => []
      })
      // Mock AI Assistant API error
      .mockRejectedValueOnce(new Error('API Error'));

    render(<ReviewQueueNew />);

    // Wait for loading to finish
    await waitFor(() => {
      expect(screen.queryByText('समीक्षा डेटा लोड हो रहा है...')).not.toBeInTheDocument();
    }, { timeout: 3000 });

    // Open the modal and send message
    await waitFor(() => {
      expect(screen.getByText('संपादित करें')).toBeInTheDocument();
    });

    const editButton = screen.getByText('संपादित करें');
    fireEvent.click(editButton);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('अपनी प्रतिक्रिया टाइप करें...')).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText('अपनी प्रतिक्रिया टाइप करें...');
    fireEvent.change(input, { target: { value: 'Test message' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    // Verify error message appears
    await waitFor(() => {
      expect(screen.getByText('क्षमा करें, मैं इस समय आपकी सहायता नहीं कर सकता। कृपया बाद में पुनः प्रयास करें।')).toBeInTheDocument();
    });
  });

  it('should display tweet details in AI Assistant modal', async () => {
    render(<ReviewQueueNew />);

    // Wait for loading to finish
    await waitFor(() => {
      expect(screen.queryByText('समीक्षा डेटा लोड हो रहा है...')).not.toBeInTheDocument();
    }, { timeout: 3000 });

    // Open the modal
    await waitFor(() => {
      expect(screen.getByText('संपादित करें')).toBeInTheDocument();
    });

    const editButton = screen.getByText('संपादित करें');
    fireEvent.click(editButton);

    // Wait for modal to open
    await waitFor(() => {
      expect(screen.getByText('ट्वीट विवरण')).toBeInTheDocument();
    });

    // Verify tweet details are displayed
    expect(screen.getByText('ट्वीट आईडी:')).toBeInTheDocument();
    expect(screen.getByText('समय:')).toBeInTheDocument();
    expect(screen.getAllByText('85% विश्वास')).toHaveLength(2); // Should appear twice (main view and modal)
    expect(screen.getAllByText('1979023456789012345')).toHaveLength(2); // Should appear twice (main view and modal)
  });
});
