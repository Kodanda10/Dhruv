/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import Select from '@/components/ui/Select';

describe('Select Component', () => {
  const options = [
    { value: 'option1', label: 'Option 1' },
    { value: 'option2', label: 'Option 2' },
    { value: 'option3', label: 'Option 3' },
  ];

  it('should render select element', () => {
    render(<Select options={options} data-testid="test-select" />);
    expect(screen.getByTestId('test-select')).toBeInTheDocument();
  });

  it('should render all options', () => {
    render(<Select options={options} />);
    expect(screen.getByText('Option 1')).toBeInTheDocument();
    expect(screen.getByText('Option 2')).toBeInTheDocument();
    expect(screen.getByText('Option 3')).toBeInTheDocument();
  });

  it('should handle onChange events', () => {
    const handleChange = jest.fn();
    render(<Select options={options} onChange={handleChange} data-testid="test-select" />);
    const select = screen.getByTestId('test-select');
    fireEvent.change(select, { target: { value: 'option2' } });
    expect(handleChange).toHaveBeenCalled();
  });

  it('should be disabled when disabled prop is true', () => {
    render(<Select options={options} disabled data-testid="test-select" />);
    const select = screen.getByTestId('test-select') as HTMLSelectElement;
    expect(select).toBeDisabled();
  });

  it('should apply custom className', () => {
    const { container } = render(<Select options={options} className="custom-class" />);
    const select = container.querySelector('select');
    expect(select).toHaveClass('custom-class');
  });

  it('should have correct base styles', () => {
    const { container } = render(<Select options={options} />);
    const select = container.querySelector('select');
    expect(select).toHaveClass('rounded-lg', 'border', 'border-gray-300');
  });

  it('should forward ref', () => {
    const ref = React.createRef<HTMLSelectElement>();
    render(<Select options={options} ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLSelectElement);
  });

  it('should display chevron icon', () => {
    const { container } = render(<Select options={options} />);
    const chevron = container.querySelector('svg');
    expect(chevron).toBeInTheDocument();
  });
});

