/**
 * TDD Tests for AI Review Assistant Component
 *
 * Hindi-Only Dashboard: All text, prompts, and UI elements in Hindi
 * AI Integration: LangGraph assistant provides context-aware suggestions
 * Human-in-the-Loop: Accept/reject AI suggestions with visual feedback
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AIReviewAssistant from '../../../src/components/review/AIReviewAssistant';

// Mock the LangGraph assistant
jest.mock('../../../src/lib/ai-assistant/langgraph-assistant', () => ({
  generateSuggestions: jest.fn(),
}));

// Mock the useAuth hook
jest.mock('../../../src/hooks/useAuth', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    user: { id: 'admin', username: 'admin', role: 'admin' },
    loginUser: jest.fn(),
    logoutUser: jest.fn(),
    loading: false,
    error: null
  })
}));

describe('AIReviewAssistant Component - Hindi UI', () => {
  const mockTweet = {
    id: '123',
    content: 'Test tweet content',
    event_type: 'meeting',
    locations: ['रायगढ़'],
    people_mentioned: ['मुख्यमंत्री'],
    schemes_mentioned: ['योजना'],
    needs_review: true
  };

  const mockSuggestions = {
    event_type: 'rally',
    event_type_confidence: 0.85,
    locations: ['रायगढ़', 'रायपुर'],
    people_mentioned: ['मुख्यमंत्री', 'सांसद'],
    schemes_mentioned: ['स्वच्छ भारत मिशन'],
    reasoning: 'Tweet mentions public gathering and political figures'
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Hindi UI Elements', () => {
    it('should display all UI text in Hindi', () => {
      render(<AIReviewAssistant tweet={mockTweet} onSuggestionAccept={jest.fn()} />);

      expect(screen.getByText('AI सहायक सुझाव')).toBeInTheDocument();
      expect(screen.getByText('स्वीकार करें')).toBeInTheDocument();
      expect(screen.getByText('अस्वीकार करें')).toBeInTheDocument();
      expect(screen.getByText('पुनः प्राप्त करें')).toBeInTheDocument();
    });

    it('should show loading state in Hindi', () => {
      render(<AIReviewAssistant tweet={mockTweet} onSuggestionAccept={jest.fn()} />);

      const button = screen.getByText('पुनः प्राप्त करें');
      fireEvent.click(button);

      expect(screen.getByText('सुझाव प्राप्त हो रहे हैं...')).toBeInTheDocument();
    });

    it('should display error messages in Hindi', async () => {
      const mockLangGraph = require('../../../src/lib/ai-assistant/langgraph-assistant');
      mockLangGraph.generateSuggestions.mockRejectedValue(new Error('API Error'));

      render(<AIReviewAssistant tweet={mockTweet} onSuggestionAccept={jest.fn()} />);

      const button = screen.getByText('पुनः प्राप्त करें');
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText('सुझाव प्राप्त करने में त्रुटि')).toBeInTheDocument();
      });
    });
  });

  describe('AI Suggestion Integration', () => {
    it('should call LangGraph assistant for suggestions', async () => {
      const mockLangGraph = require('../../../src/lib/ai-assistant/langgraph-assistant');
      mockLangGraph.generateSuggestions.mockResolvedValue(mockSuggestions);

      render(<AIReviewAssistant tweet={mockTweet} onSuggestionAccept={jest.fn()} />);

      const button = screen.getByText('पुनः प्राप्त करें');
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockLangGraph.generateSuggestions).toHaveBeenCalledWith(mockTweet);
      });
    });

    it('should display AI suggestions with confidence scores', async () => {
      const mockLangGraph = require('../../../src/lib/ai-assistant/langgraph-assistant');
      mockLangGraph.generateSuggestions.mockResolvedValue(mockSuggestions);

      render(<AIReviewAssistant tweet={mockTweet} onSuggestionAccept={jest.fn()} />);

      const button = screen.getByText('पुनः प्राप्त करें');
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText('रैली')).toBeInTheDocument();
        expect(screen.getByText('85%')).toBeInTheDocument();
        expect(screen.getByText('रायगढ़, रायपुर')).toBeInTheDocument();
        expect(screen.getByText('मुख्यमंत्री, सांसद')).toBeInTheDocument();
        expect(screen.getByText('स्वच्छ भारत मिशन')).toBeInTheDocument();
      });
    });

    it('should show reasoning in Hindi context', async () => {
      const mockLangGraph = require('../../../src/lib/ai-assistant/langgraph-assistant');
      mockLangGraph.generateSuggestions.mockResolvedValue({
        ...mockSuggestions,
        reasoning: 'Tweet mentions public gathering and political figures'
      });

      render(<AIReviewAssistant tweet={mockTweet} onSuggestionAccept={jest.fn()} />);

      const button = screen.getByText('पुनः प्राप्त करें');
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText('Tweet mentions public gathering and political figures')).toBeInTheDocument();
      });
    });
  });

  describe('User Interaction - Accept/Reject', () => {
    it('should call onSuggestionAccept when स्वीकार करें is clicked', async () => {
      const mockOnAccept = jest.fn();
      const mockLangGraph = require('../../../src/lib/ai-assistant/langgraph-assistant');
      mockLangGraph.generateSuggestions.mockResolvedValue(mockSuggestions);

      render(<AIReviewAssistant tweet={mockTweet} onSuggestionAccept={mockOnAccept} />);

      // Get suggestions first
      const getButton = screen.getByText('पुनः प्राप्त करें');
      fireEvent.click(getButton);

      await waitFor(() => {
        expect(screen.getByText('रैली')).toBeInTheDocument();
      });

      // Accept suggestions
      const acceptButton = screen.getByText('स्वीकार करें');
      fireEvent.click(acceptButton);

      expect(mockOnAccept).toHaveBeenCalledWith(mockSuggestions);
    });

    it('should show rejection feedback in Hindi', async () => {
      const mockLangGraph = require('../../../src/lib/ai-assistant/langgraph-assistant');
      mockLangGraph.generateSuggestions.mockResolvedValue(mockSuggestions);

      render(<AIReviewAssistant tweet={mockTweet} onSuggestionAccept={jest.fn()} />);

      const getButton = screen.getByText('पुनः प्राप्त करें');
      fireEvent.click(getButton);

      await waitFor(() => {
        expect(screen.getByText('रैली')).toBeInTheDocument();
      });

      const rejectButton = screen.getByText('अस्वीकार करें');
      fireEvent.click(rejectButton);

      expect(screen.getByText('सुझाव अस्वीकार कर दिया गया')).toBeInTheDocument();
    });

    it('should disable buttons after action', async () => {
      const mockLangGraph = require('../../../src/lib/ai-assistant/langgraph-assistant');
      mockLangGraph.generateSuggestions.mockResolvedValue(mockSuggestions);

      render(<AIReviewAssistant tweet={mockTweet} onSuggestionAccept={jest.fn()} />);

      const getButton = screen.getByText('पुनः प्राप्त करें');
      fireEvent.click(getButton);

      await waitFor(() => {
        expect(screen.getByText('रैली')).toBeInTheDocument();
      });

      const acceptButton = screen.getByText('स्वीकार करें');
      fireEvent.click(acceptButton);

      expect(acceptButton).toBeDisabled();
      expect(screen.getByText('अस्वीकार करें')).toBeDisabled();
    });
  });

  describe('Performance & Error Handling', () => {
    it('should handle API timeout gracefully', async () => {
      const mockLangGraph = require('../../../src/lib/ai-assistant/langgraph-assistant');
      mockLangGraph.generateSuggestions.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(mockSuggestions), 100))
      );

      render(<AIReviewAssistant tweet={mockTweet} onSuggestionAccept={jest.fn()} />);

      const button = screen.getByText('पुनः प्राप्त करें');
      fireEvent.click(button);

      // Should show loading immediately
      expect(screen.getByText('सुझाव प्राप्त हो रहे हैं...')).toBeInTheDocument();

      // Should resolve after delay
      await waitFor(() => {
        expect(screen.getByText('रैली')).toBeInTheDocument();
      }, { timeout: 200 });
    });

    it('should handle network errors in Hindi', async () => {
      const mockLangGraph = require('../../../src/lib/ai-assistant/langgraph-assistant');
      mockLangGraph.generateSuggestions.mockRejectedValue(new Error('Network Error'));

      render(<AIReviewAssistant tweet={mockTweet} onSuggestionAccept={jest.fn()} />);

      const button = screen.getByText('पुनः प्राप्त करें');
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText('सुझाव प्राप्त करने में त्रुटि')).toBeInTheDocument();
      });
    });

    it('should handle malformed AI response', async () => {
      const mockLangGraph = require('../../../src/lib/ai-assistant/langgraph-assistant');
      mockLangGraph.generateSuggestions.mockResolvedValue(null);

      render(<AIReviewAssistant tweet={mockTweet} onSuggestionAccept={jest.fn()} />);

      const button = screen.getByText('पुनः प्राप्त करें');
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText('अमान्य AI प्रतिक्रिया प्राप्त हुई')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility - WCAG 2.1 AA', () => {
    it('should have proper ARIA labels in Hindi', () => {
      render(<AIReviewAssistant tweet={mockTweet} onSuggestionAccept={jest.fn()} />);

      const assistantSection = screen.getByRole('region', { name: 'AI सहायक सुझाव' });
      expect(assistantSection).toBeInTheDocument();

      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button).toHaveAttribute('aria-label');
      });
    });

    it('should support keyboard navigation', () => {
      render(<AIReviewAssistant tweet={mockTweet} onSuggestionAccept={jest.fn()} />);

      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button).toHaveAttribute('tabIndex');
      });
    });

    it('should announce status changes to screen readers', async () => {
      const mockLangGraph = require('../../../src/lib/ai-assistant/langgraph-assistant');
      mockLangGraph.generateSuggestions.mockResolvedValue(mockSuggestions);

      render(<AIReviewAssistant tweet={mockTweet} onSuggestionAccept={jest.fn()} />);

      const button = screen.getByText('पुनः प्राप्त करें');
      fireEvent.click(button);

      await waitFor(() => {
        const statusElement = screen.getByRole('status');
        expect(statusElement).toHaveTextContent('सुझाव प्राप्त हो गए');
      });
    });
  });
});
