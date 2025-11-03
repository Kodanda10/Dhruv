/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import Input from '@/components/ui/Input';

describe('Input Component', () => {
  it('should render input element', () => {
    render(<Input data-testid="test-input" />);
    expect(screen.getByTestId('test-input')).toBeInTheDocument();
  });

  it('should accept value prop', () => {
    render(<Input data-testid="test-input" value="test value" readOnly />);
    const input = screen.getByTestId('test-input') as HTMLInputElement;
    expect(input.value).toBe('test value');
  });

  it('should handle onChange events', () => {
    const handleChange = jest.fn();
    render(<Input data-testid="test-input" onChange={handleChange} />);
    const input = screen.getByTestId('test-input');
    fireEvent.change(input, { target: { value: 'test' } });
    expect(handleChange).toHaveBeenCalled();
  });

  it('should display placeholder', () => {
    render(<Input placeholder="Enter text" />);
    expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument();
  });

  it('should be disabled when disabled prop is true', () => {
    render(<Input data-testid="test-input" disabled />);
    const input = screen.getByTestId('test-input') as HTMLInputElement;
    expect(input).toBeDisabled();
  });

  it('should apply custom className', () => {
    const { container } = render(<Input className="custom-class" />);
    const input = container.querySelector('input');
    expect(input).toHaveClass('custom-class');
  });

  it('should have correct base styles', () => {
    const { container } = render(<Input />);
    const input = container.querySelector('input');
    expect(input).toHaveClass('rounded-lg', 'border', 'border-gray-300');
  });

  it('should forward ref', () => {
    const ref = React.createRef<HTMLInputElement>();
    render(<Input ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  it('should support different input types', () => {
    const { rerender } = render(<Input type="text" data-testid="test-input" />);
    let input = screen.getByTestId('test-input') as HTMLInputElement;
    expect(input.type).toBe('text');

    rerender(<Input type="email" data-testid="test-input" />);
    input = screen.getByTestId('test-input') as HTMLInputElement;
    expect(input.type).toBe('email');
  });
});

