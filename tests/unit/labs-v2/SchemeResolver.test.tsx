import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import SchemeResolver from '@/app/labs-v2/review/SchemeResolver';

describe('SchemeResolver', () => {
  const onResolveMock = jest.fn();
  const initialSchemes = ['Scheme X', 'Scheme Y'];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should render initial schemes and allow adding a new scheme', () => {
    render(<SchemeResolver parsedSchemes={initialSchemes} onResolve={onResolveMock} />);

    expect(screen.getByText('Scheme X')).toBeInTheDocument();
    expect(screen.getByText('Scheme Y')).toBeInTheDocument();

    const input = screen.getByPlaceholderText('Add a scheme');
    const addButton = screen.getByRole('button', { name: 'Add' });

    fireEvent.change(input, { target: { value: 'Scheme Z' } });
    fireEvent.click(addButton);

    expect(screen.getByText('Scheme Z')).toBeInTheDocument();
  });

  test('should allow removing a scheme', () => {
    render(<SchemeResolver parsedSchemes={initialSchemes} onResolve={onResolveMock} />);

    expect(screen.getByText('Scheme X')).toBeInTheDocument();
    const removeButton = screen.getByLabelText('Remove Scheme X');
    fireEvent.click(removeButton);

    expect(screen.queryByText('Scheme X')).not.toBeInTheDocument();
  });

  test('should call onResolve with the final list of schemes when confirmed', () => {
    render(<SchemeResolver parsedSchemes={initialSchemes} onResolve={onResolveMock} />);

    // Add a scheme
    fireEvent.change(screen.getByPlaceholderText('Add a scheme'), { target: { value: 'Scheme Z' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    // Remove a scheme
    fireEvent.click(screen.getByLabelText('Remove Scheme Y'));

    // Confirm
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Schemes' }));

    expect(onResolveMock).toHaveBeenCalledWith(['Scheme X', 'Scheme Z']);
  });
});
