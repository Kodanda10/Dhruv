/**
 * TDD Tests for Review Edit Form Component
 *
 * Hindi-Only Dashboard: All labels, buttons, and validation messages in Hindi
 * Human-in-the-Loop: Allow editing of all parsed fields with visual feedback
 * Approval Workflow: Approve/Skip/Reject with custom notes
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ReviewEditForm from '../../../src/components/review/ReviewEditForm';

// Mock the Hindi translation functions
jest.mock('../../../src/lib/i18n/event-types-hi', () => ({
  getEventTypeInHindi: jest.fn((type) => {
    const map = {
      meeting: 'बैठक',
      rally: 'रैली',
      inauguration: 'लोकार्पण',
      other: 'अन्य'
    };
    return map[type as keyof typeof map] || type;
  }),
  EVENT_TYPE_HINDI: {
    meeting: 'बैठक',
    rally: 'रैली',
    inauguration: 'लोकार्पण',
    other: 'अन्य'
  }
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

describe('ReviewEditForm Component - Hindi UI', () => {
  const mockTweet = {
    id: '123',
    content: 'Test tweet content for review',
    event_type: 'meeting',
    event_type_hi: 'बैठक',
    locations: ['रायगढ़'],
    people_mentioned: ['मुख्यमंत्री'],
    organizations: ['भाजपा'],
    schemes_mentioned: ['योजना'],
    needs_review: true,
    review_status: 'pending'
  };

  const mockOnSave = jest.fn();
  const mockOnApprove = jest.fn();
  const mockOnReject = jest.fn();
  const mockOnSkip = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Hindi Form Labels and UI', () => {
    it('should display all form labels in Hindi', () => {
      render(
        <ReviewEditForm
          tweet={mockTweet}
          onSave={mockOnSave}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          onSkip={mockOnSkip}
        />
      );

      expect(screen.getByText('घटना प्रकार')).toBeInTheDocument();
      expect(screen.getByText('स्थान')).toBeInTheDocument();
      expect(screen.getByText('उल्लिखित व्यक्ति')).toBeInTheDocument();
      expect(screen.getByText('संगठन')).toBeInTheDocument();
      expect(screen.getByText('योजनाएं')).toBeInTheDocument();
      expect(screen.getByText('टिप्पणी')).toBeInTheDocument();
    });

    it('should show action buttons in Hindi', () => {
      render(
        <ReviewEditForm
          tweet={mockTweet}
          onSave={mockOnSave}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          onSkip={mockOnSkip}
        />
      );

      expect(screen.getByText('सहेजें')).toBeInTheDocument();
      expect(screen.getByText('मंजूरी दें')).toBeInTheDocument();
      expect(screen.getByText('अस्वीकार करें')).toBeInTheDocument();
      expect(screen.getByText('छोड़ें')).toBeInTheDocument();
    });

    it('should display current values in form fields', () => {
      render(
        <ReviewEditForm
          tweet={mockTweet}
          onSave={mockOnSave}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          onSkip={mockOnSkip}
        />
      );

      const eventTypeSelect = screen.getByDisplayValue('बैठक');
      expect(eventTypeSelect).toBeInTheDocument();

      const locationInput = screen.getByDisplayValue('रायगढ़');
      expect(locationInput).toBeInTheDocument();

      const peopleInput = screen.getByDisplayValue('मुख्यमंत्री');
      expect(peopleInput).toBeInTheDocument();

      const orgInput = screen.getByDisplayValue('भाजपा');
      expect(orgInput).toBeInTheDocument();

      const schemeInput = screen.getByDisplayValue('योजना');
      expect(schemeInput).toBeInTheDocument();
    });
  });

  describe('Field Editing Functionality', () => {
    it('should allow editing event type with Hindi options', () => {
      render(
        <ReviewEditForm
          tweet={mockTweet}
          onSave={mockOnSave}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          onSkip={mockOnSkip}
        />
      );

      const eventTypeSelect = screen.getByRole('combobox', { name: /घटना प्रकार/ });
      fireEvent.change(eventTypeSelect, { target: { value: 'rally' } });

      expect(eventTypeSelect).toHaveValue('rally');
    });

    it('should allow adding multiple locations', () => {
      render(
        <ReviewEditForm
          tweet={mockTweet}
          onSave={mockOnSave}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          onSkip={mockOnSkip}
        />
      );

      const locationInput = screen.getByPlaceholderText('नए स्थान जोड़ें...');
      fireEvent.change(locationInput, { target: { value: 'रायपुर' } });
      fireEvent.keyDown(locationInput, { key: 'Enter' });

      expect(screen.getByText('रायपुर')).toBeInTheDocument();
    });

    it('should allow removing locations', () => {
      render(
        <ReviewEditForm
          tweet={mockTweet}
          onSave={mockOnSave}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          onSkip={mockOnSkip}
        />
      );

      const removeButton = screen.getByLabelText('रायगढ़ हटाएं');
      fireEvent.click(removeButton);

      expect(screen.queryByText('रायगढ़')).not.toBeInTheDocument();
    });

    it('should allow editing notes/comments', () => {
      render(
        <ReviewEditForm
          tweet={mockTweet}
          onSave={mockOnSave}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          onSkip={mockOnSkip}
        />
      );

      const notesTextarea = screen.getByPlaceholderText('अपनी टिप्पणी यहाँ लिखें...');
      fireEvent.change(notesTextarea, { target: { value: 'यह एक परीक्षण टिप्पणी है' } });

      expect(notesTextarea).toHaveValue('यह एक परीक्षण टिप्पणी है');
    });
  });

  describe('Save Functionality', () => {
    it('should call onSave with updated data', () => {
      render(
        <ReviewEditForm
          tweet={mockTweet}
          onSave={mockOnSave}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          onSkip={mockOnSkip}
        />
      );

      // Make some changes
      const eventTypeSelect = screen.getByRole('combobox', { name: /घटना प्रकार/ });
      fireEvent.change(eventTypeSelect, { target: { value: 'rally' } });

      const notesTextarea = screen.getByPlaceholderText('अपनी टिप्पणी यहाँ लिखें...');
      fireEvent.change(notesTextarea, { target: { value: 'Updated notes' } });

      const saveButton = screen.getByText('सहेजें');
      fireEvent.click(saveButton);

      expect(mockOnSave).toHaveBeenCalledWith({
        ...mockTweet,
        event_type: 'rally',
        event_type_hi: 'रैली',
        review_notes: 'Updated notes'
      });
    });

    it('should show loading state during save', async () => {
      mockOnSave.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

      render(
        <ReviewEditForm
          tweet={mockTweet}
          onSave={mockOnSave}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          onSkip={mockOnSkip}
        />
      );

      const saveButton = screen.getByText('सहेजें');
      fireEvent.click(saveButton);

      expect(screen.getByText('सहेजा जा रहा है...')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByText('सहेजें')).toBeInTheDocument();
      });
    });
  });

  describe('Approval Actions', () => {
    it('should call onApprove with Hindi confirmation message', () => {
      render(
        <ReviewEditForm
          tweet={mockTweet}
          onSave={mockOnSave}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          onSkip={mockOnSkip}
        />
      );

      const approveButton = screen.getByText('मंजूरी दें');
      fireEvent.click(approveButton);

      // Should show confirmation dialog
      expect(screen.getByText('क्या आप इस ट्वीट को मंजूरी देना चाहते हैं?')).toBeInTheDocument();

      const confirmButton = screen.getByText('हाँ, मंजूरी दें');
      fireEvent.click(confirmButton);

      expect(mockOnApprove).toHaveBeenCalledWith(mockTweet.id, '');
    });

    it('should allow approval with custom notes', () => {
      render(
        <ReviewEditForm
          tweet={mockTweet}
          onSave={mockOnSave}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          onSkip={mockOnSkip}
        />
      );

      const approveButton = screen.getByText('मंजूरी दें');
      fireEvent.click(approveButton);

      const notesInput = screen.getByPlaceholderText('वैकल्पिक टिप्पणी...');
      fireEvent.change(notesInput, { target: { value: 'Approved with modifications' } });

      const confirmButton = screen.getByText('हाँ, मंजूरी दें');
      fireEvent.click(confirmButton);

      expect(mockOnApprove).toHaveBeenCalledWith(mockTweet.id, 'Approved with modifications');
    });

    it('should call onReject with reason', () => {
      render(
        <ReviewEditForm
          tweet={mockTweet}
          onSave={mockOnSave}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          onSkip={mockOnSkip}
        />
      );

      const rejectButton = screen.getByText('अस्वीकार करें');
      fireEvent.click(rejectButton);

      expect(screen.getByText('ट्वीट अस्वीकार करने का कारण')).toBeInTheDocument();

      const reasonInput = screen.getByPlaceholderText('अस्वीकार करने का कारण...');
      fireEvent.change(reasonInput, { target: { value: 'Incorrect classification' } });

      const confirmButton = screen.getByText('अस्वीकार करें');
      fireEvent.click(confirmButton);

      expect(mockOnReject).toHaveBeenCalledWith(mockTweet.id, 'Incorrect classification');
    });

    it('should call onSkip without confirmation', () => {
      render(
        <ReviewEditForm
          tweet={mockTweet}
          onSave={mockOnSave}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          onSkip={mockOnSkip}
        />
      );

      const skipButton = screen.getByText('छोड़ें');
      fireEvent.click(skipButton);

      expect(mockOnSkip).toHaveBeenCalledWith(mockTweet.id);
    });
  });

  describe('Form Validation', () => {
    it('should show validation error for empty event type', () => {
      render(
        <ReviewEditForm
          tweet={{ ...mockTweet, event_type: '' }}
          onSave={mockOnSave}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          onSkip={mockOnSkip}
        />
      );

      const saveButton = screen.getByText('सहेजें');
      fireEvent.click(saveButton);

      expect(screen.getByText('कृपया घटना प्रकार चुनें')).toBeInTheDocument();
    });

    it('should show validation error for invalid location format', () => {
      render(
        <ReviewEditForm
          tweet={mockTweet}
          onSave={mockOnSave}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          onSkip={mockOnSkip}
        />
      );

      const locationInput = screen.getByPlaceholderText('नए स्थान जोड़ें...');
      fireEvent.change(locationInput, { target: { value: '<script>alert("xss")</script>' } });
      fireEvent.keyDown(locationInput, { key: 'Enter' });

      expect(screen.getByText('अमान्य स्थान प्रारूप')).toBeInTheDocument();
    });
  });

  describe('Accessibility - WCAG 2.1 AA', () => {
    it('should have proper ARIA labels in Hindi', () => {
      render(
        <ReviewEditForm
          tweet={mockTweet}
          onSave={mockOnSave}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          onSkip={mockOnSkip}
        />
      );

      const form = screen.getByRole('form', { name: 'ट्वीट समीक्षा फ़ॉर्म' });
      expect(form).toBeInTheDocument();

      const inputs = screen.getAllByRole('textbox');
      inputs.forEach(input => {
        expect(input).toHaveAttribute('aria-describedby');
      });
    });

    it('should support keyboard navigation', () => {
      render(
        <ReviewEditForm
          tweet={mockTweet}
          onSave={mockOnSave}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          onSkip={mockOnSkip}
        />
      );

      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button).toBeEnabled();
      });
    });

    it('should announce validation errors to screen readers', () => {
      render(
        <ReviewEditForm
          tweet={{ ...mockTweet, event_type: '' }}
          onSave={mockOnSave}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          onSkip={mockOnSkip}
        />
      );

      const saveButton = screen.getByText('सहेजें');
      fireEvent.click(saveButton);

      const errorAlert = screen.getByRole('alert');
      expect(errorAlert).toHaveTextContent('कृपया घटना प्रकार चुनें');
    });
  });

  describe('Error Handling', () => {
    it('should handle save errors gracefully in Hindi', async () => {
      mockOnSave.mockRejectedValue(new Error('Database error'));

      render(
        <ReviewEditForm
          tweet={mockTweet}
          onSave={mockOnSave}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          onSkip={mockOnSkip}
        />
      );

      const saveButton = screen.getByText('सहेजें');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('सहेजने में त्रुटि हुई')).toBeInTheDocument();
      });
    });

    it('should handle approval errors in Hindi', async () => {
      mockOnApprove.mockRejectedValue(new Error('Approval failed'));

      render(
        <ReviewEditForm
          tweet={mockTweet}
          onSave={mockOnSave}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          onSkip={mockOnSkip}
        />
      );

      const approveButton = screen.getByText('मंजूरी दें');
      fireEvent.click(approveButton);

      const confirmButton = screen.getByText('हाँ, मंजूरी दें');
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText('मंजूरी देने में त्रुटि हुई')).toBeInTheDocument();
      });
    });
  });
});
