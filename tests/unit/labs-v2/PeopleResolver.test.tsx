import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import PeopleResolver from '@/app/labs-v2/review/PeopleResolver';

describe('PeopleResolver', () => {
  const onResolveMock = jest.fn();
  const initialPeople = ['Person A', 'Person B'];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should render initial people and allow adding a new person', () => {
    render(<PeopleResolver parsedPeople={initialPeople} onResolve={onResolveMock} />);

    expect(screen.getByText('Person A')).toBeInTheDocument();
    expect(screen.getByText('Person B')).toBeInTheDocument();

    const input = screen.getByPlaceholderText('Add a person');
    const addButton = screen.getByRole('button', { name: 'Add' });

    fireEvent.change(input, { target: { value: 'Person C' } });
    fireEvent.click(addButton);

    expect(screen.getByText('Person C')).toBeInTheDocument();
  });

  test('should allow removing a person', () => {
    render(<PeopleResolver parsedPeople={initialPeople} onResolve={onResolveMock} />);

    expect(screen.getByText('Person A')).toBeInTheDocument();
    const removeButton = screen.getByLabelText('Remove Person A');
    fireEvent.click(removeButton);

    expect(screen.queryByText('Person A')).not.toBeInTheDocument();
  });

  test('should call onResolve with the final list of people when confirmed', () => {
    render(<PeopleResolver parsedPeople={initialPeople} onResolve={onResolveMock} />);

    // Add a person
    fireEvent.change(screen.getByPlaceholderText('Add a person'), { target: { value: 'Person C' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    // Remove a person
    fireEvent.click(screen.getByLabelText('Remove Person B'));

    // Confirm
    fireEvent.click(screen.getByRole('button', { name: 'Confirm People' }));

    expect(onResolveMock).toHaveBeenCalledWith(['Person A', 'Person C']);
  });
});
