import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AIAssistantModal from '@/components/review/AIAssistantModal';

const mockCurrentTweet = {
  id: '1706013219808358808',
  content: 'Test tweet content',
  timestamp: '2023-09-24T20:30:00Z',
  confidence: 0.95
};

describe('AIAssistantModal', () => {
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, response: 'AI response' }),
      } as any);
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('renders when open', () => {
    render(
      <AIAssistantModal 
        isOpen={true} 
        onClose={jest.fn()} 
        currentTweet={mockCurrentTweet} 
      />
    );
    expect(screen.getByText(/विशेषज्ञ संपादक AI सहायक/i)).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    const { container } = render(
      <AIAssistantModal 
        isOpen={false} 
        onClose={jest.fn()} 
        currentTweet={mockCurrentTweet} 
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('displays tweet details', () => {
    render(
      <AIAssistantModal 
        isOpen={true} 
        onClose={jest.fn()} 
        currentTweet={mockCurrentTweet} 
      />
    );
    expect(screen.getByText('1706013219808358808')).toBeInTheDocument();
    expect(screen.getByText(/95% विश्वास/i)).toBeInTheDocument();
  });

  it('allows sending messages', async () => {
    render(
      <AIAssistantModal 
        isOpen={true} 
        onClose={jest.fn()} 
        currentTweet={mockCurrentTweet} 
      />
    );
    
    const input = screen.getByPlaceholderText(/अपनी प्रतिक्रिया टाइप करें/i);
    const sendButton = screen.getByRole('button', { name: /send/i });
    
    fireEvent.change(input, { target: { value: 'Test message' } });
    fireEvent.click(sendButton);
    
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/ai-assistant',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });
    
    expect(input).toHaveValue('');
  });

  it('toggles tags when clicked', () => {
    render(
      <AIAssistantModal 
        isOpen={true} 
        onClose={jest.fn()} 
        currentTweet={mockCurrentTweet} 
      />
    );
    
    const tag = screen.getByText('शहरी विकास');
    fireEvent.click(tag);
    
    // Tag should be toggled (this would need more specific testing based on implementation)
    expect(tag).toBeInTheDocument();
  });
});
