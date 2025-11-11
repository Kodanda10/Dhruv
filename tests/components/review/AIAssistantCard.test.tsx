
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import AIAssistantCard from '@/components/analytics/AIAssistantCard';

// Mock fetch
global.fetch = vi.fn();

describe('AIAssistantCard', () => {
  beforeEach(() => {
    (fetch as any).mockClear();
  });

  it('renders the initial state correctly', () => {
    render(<AIAssistantCard />);
    expect(screen.getByText('AI Review Assistant')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter tweet text for analysis...')).toBeInTheDocument();
    expect(screen.getByText('Analyze Tweet')).toBeInTheDocument();
    expect(screen.getByText('No suggestions to display.')).toBeInTheDocument();
  });

  it('updates the textarea value on user input', () => {
    render(<AIAssistantCard />);
    const textarea = screen.getByPlaceholderText('Enter tweet text for analysis...') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'This is a test tweet.' } });
    expect(textarea.value).toBe('This is a test tweet.');
  });

  it('shows an error if the tweet text is empty on analysis', async () => {
    render(<AIAssistantCard />);
    const analyzeButton = screen.getByText('Analyze Tweet');
    fireEvent.click(analyzeButton);
    expect(await screen.findByText('Please enter tweet text to analyze.')).toBeInTheDocument();
  });

  it('calls the API and displays suggestions on successful analysis', async () => {
    const mockSuggestions = {
      success: true,
      suggestions: {
        event_type: 'Protest',
        event_type_confidence: 0.85,
        locations: ['City Hall'],
        reasoning: 'The text mentions a gathering and demands.',
      },
    };
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockSuggestions,
    });

    render(<AIAssistantCard />);
    const textarea = screen.getByPlaceholderText('Enter tweet text for analysis...');
    const analyzeButton = screen.getByText('Analyze Tweet');

    fireEvent.change(textarea, { target: { value: 'A protest is happening at City Hall.' } });
    fireEvent.click(analyzeButton);

    expect(screen.getByText('Analyzing...')).toBeInTheDocument();

    await waitFor(() => {
      const suggestionElements = screen.getAllByText(/Suggest to change/);
      expect(suggestionElements).toHaveLength(2);

      // Check first suggestion
      const firstSuggestion = suggestionElements[0].closest('div');
      expect(firstSuggestion).toHaveTextContent(/event_type/);
      expect(firstSuggestion).toHaveTextContent(/"Protest"/);
      expect(firstSuggestion).toHaveTextContent('Confidence: 85%');
      expect(firstSuggestion).toHaveTextContent('Rationale: The text mentions a gathering and demands.');

      // Check second suggestion
      const secondSuggestion = suggestionElements[1].closest('div');
      expect(secondSuggestion).toHaveTextContent(/locations/);
      expect(secondSuggestion).toHaveTextContent(/"City Hall"/);
    });
  });

  it('displays a "no suggestions" message when the API returns no suggestions', async () => {
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, suggestions: {} }),
    });

    render(<AIAssistantCard />);
    const textarea = screen.getByPlaceholderText('Enter tweet text for analysis...');
    const analyzeButton = screen.getByText('Analyze Tweet');

    fireEvent.change(textarea, { target: { value: 'Just a normal day.' } });
    fireEvent.click(analyzeButton);

    await waitFor(() => {
      expect(screen.getByText('No suggestions to display.')).toBeInTheDocument();
    });
  });

  it('displays an error message when the API call fails', async () => {
    (fetch as any).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Internal Server Error' }),
    });

    render(<AIAssistantCard />);
    const textarea = screen.getByPlaceholderText('Enter tweet text for analysis...');
    const analyzeButton = screen.getByText('Analyze Tweet');

    fireEvent.change(textarea, { target: { value: 'This will fail.' } });
    fireEvent.click(analyzeButton);

    await waitFor(() => {
      expect(screen.getByText('Internal Server Error')).toBeInTheDocument();
    });
  });
});
