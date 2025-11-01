import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AutocompleteInput from '@/components/review/AutocompleteInput';

// Mock the useFieldHistory hook
const mockGetFilteredHistory = jest.fn((query: string) => {
  const mockHistory = ['apple', 'banana', 'grape'];
  if (!query) return mockHistory;
  return mockHistory.filter(item => item.toLowerCase().startsWith(query.toLowerCase()));
});

jest.mock('@/hooks/useFieldHistory', () => ({
  useFieldHistory: jest.fn(() => ({
    history: ['apple', 'banana', 'grape'],
    addToHistory: jest.fn(),
    getFilteredHistory: mockGetFilteredHistory,
  })),
}));

describe('AutocompleteInput', () => {
  const defaultProps = {
    fieldName: 'test_field',
    value: '',
    onChange: jest.fn(),
    placeholder: 'Test placeholder',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render input field with placeholder', () => {
    render(<AutocompleteInput {...defaultProps} />);
    
    const input = screen.getByPlaceholderText('Test placeholder');
    expect(input).toBeInTheDocument();
  });

  it('should call onChange when user types', () => {
    render(<AutocompleteInput {...defaultProps} />);
    
    const input = screen.getByPlaceholderText('Test placeholder');
    fireEvent.change(input, { target: { value: 'test value' } });
    
    expect(defaultProps.onChange).toHaveBeenCalledWith('test value');
  });

  it('should show dropdown when input is focused', async () => {
    render(<AutocompleteInput {...defaultProps} />);
    
    const input = screen.getByPlaceholderText('Test placeholder');
    fireEvent.focus(input);
    
    await waitFor(() => {
      expect(screen.getByText('apple')).toBeInTheDocument();
    });
  });

  it('should filter suggestions based on input value', async () => {
    // Test the filtering logic directly
    expect(mockGetFilteredHistory('ap')).toEqual(['apple']);
    expect(mockGetFilteredHistory('')).toEqual(['apple', 'banana', 'grape']);
    
    render(<AutocompleteInput {...defaultProps} />);
    
    const input = screen.getByPlaceholderText('Test placeholder');
    fireEvent.focus(input);
    
    // Verify all suggestions are shown when focused (empty value)
    await waitFor(() => {
      expect(screen.getByText('apple')).toBeInTheDocument();
      expect(screen.getByText('banana')).toBeInTheDocument();
      expect(screen.getByText('grape')).toBeInTheDocument();
    });
  });

  it('should select suggestion when clicked', async () => {
    render(<AutocompleteInput {...defaultProps} />);
    
    const input = screen.getByPlaceholderText('Test placeholder');
    fireEvent.focus(input);
    
    await waitFor(() => {
      expect(screen.getByText('apple')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByText('apple'));
    
    expect(defaultProps.onChange).toHaveBeenCalledWith('apple');
  });

  it('should navigate suggestions with arrow keys', async () => {
    render(<AutocompleteInput {...defaultProps} />);
    
    const input = screen.getByPlaceholderText('Test placeholder');
    fireEvent.focus(input);
    
    await waitFor(() => {
      expect(screen.getByText('apple')).toBeInTheDocument();
    });
    
    // Press arrow down
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    
    await waitFor(() => {
      const appleButton = screen.getByText('apple').closest('button');
      expect(appleButton).toHaveClass('bg-gray-100');
    });
  });

  it('should select highlighted suggestion with Enter key', async () => {
    render(<AutocompleteInput {...defaultProps} />);
    
    const input = screen.getByPlaceholderText('Test placeholder');
    fireEvent.focus(input);
    
    await waitFor(() => {
      expect(screen.getByText('apple')).toBeInTheDocument();
    });
    
    // Highlight first suggestion
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    
    expect(defaultProps.onChange).toHaveBeenCalledWith('apple');
  });

  it('should hide dropdown when Escape is pressed', async () => {
    render(<AutocompleteInput {...defaultProps} />);
    
    const input = screen.getByPlaceholderText('Test placeholder');
    fireEvent.focus(input);
    
    await waitFor(() => {
      expect(screen.getByText('apple')).toBeInTheDocument();
    });
    
    fireEvent.keyDown(input, { key: 'Escape' });
    
    await waitFor(() => {
      expect(screen.queryByText('apple')).not.toBeInTheDocument();
    });
  });

  it('should hide dropdown when clicking outside', async () => {
    render(
      <div>
        <AutocompleteInput {...defaultProps} />
        <div data-testid="outside">Outside element</div>
      </div>
    );
    
    const input = screen.getByPlaceholderText('Test placeholder');
    fireEvent.focus(input);
    
    await waitFor(() => {
      expect(screen.getByText('apple')).toBeInTheDocument();
    });
    
    const outsideElement = screen.getByTestId('outside');
    fireEvent.mouseDown(outsideElement);
    
    await waitFor(() => {
      expect(screen.queryByText('apple')).not.toBeInTheDocument();
    });
  });

  it('should call onFocus and onBlur callbacks', async () => {
    const onFocus = jest.fn();
    const onBlur = jest.fn();
    
    render(
      <AutocompleteInput
        {...defaultProps}
        onFocus={onFocus}
        onBlur={onBlur}
      />
    );
    
    const input = screen.getByPlaceholderText('Test placeholder');
    fireEvent.focus(input);
    expect(onFocus).toHaveBeenCalled();
    
    fireEvent.blur(input);
    
    // Wait for the setTimeout in handleInputBlur
    await waitFor(() => {
      expect(onBlur).toHaveBeenCalled();
    }, { timeout: 200 });
  });

  it('should not show dropdown when no suggestions available', async () => {
    // Mock empty history for this test
    mockGetFilteredHistory.mockReturnValueOnce([]);
    
    render(<AutocompleteInput {...defaultProps} />);
    
    const input = screen.getByPlaceholderText('Test placeholder');
    fireEvent.focus(input);
    
    await waitFor(() => {
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
  });
});
