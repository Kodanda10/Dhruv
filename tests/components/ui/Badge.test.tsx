/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import Badge from '@/components/ui/Badge';

describe('Badge Component', () => {
  it('should render badge with children', () => {
    render(<Badge>Test Badge</Badge>);
    expect(screen.getByText('Test Badge')).toBeInTheDocument();
  });

  it('should apply default variant styles', () => {
    const { container } = render(<Badge>Badge</Badge>);
    const badge = container.firstChild as HTMLElement;
    expect(badge).toHaveClass('bg-gray-100', 'text-gray-800');
  });

  it('should apply success variant styles', () => {
    const { container } = render(<Badge variant="success">Success</Badge>);
    const badge = container.firstChild as HTMLElement;
    expect(badge).toHaveClass('bg-green-100', 'text-green-800');
  });

  it('should apply warning variant styles', () => {
    const { container } = render(<Badge variant="warning">Warning</Badge>);
    const badge = container.firstChild as HTMLElement;
    expect(badge).toHaveClass('bg-amber-100', 'text-amber-800');
  });

  it('should apply error variant styles', () => {
    const { container } = render(<Badge variant="error">Error</Badge>);
    const badge = container.firstChild as HTMLElement;
    expect(badge).toHaveClass('bg-red-100', 'text-red-800');
  });

  it('should apply info variant styles', () => {
    const { container } = render(<Badge variant="info">Info</Badge>);
    const badge = container.firstChild as HTMLElement;
    expect(badge).toHaveClass('bg-blue-100', 'text-blue-800');
  });

  it('should show remove button when removable is true', () => {
    render(<Badge removable onRemove={() => {}}>Removable</Badge>);
    const removeButton = screen.getByLabelText('Remove');
    expect(removeButton).toBeInTheDocument();
  });

  it('should not show remove button when removable is false', () => {
    render(<Badge removable={false}>Not Removable</Badge>);
    expect(screen.queryByLabelText('Remove')).not.toBeInTheDocument();
  });

  it('should call onRemove when remove button is clicked', () => {
    const handleRemove = jest.fn();
    render(<Badge removable onRemove={handleRemove}>Removable</Badge>);
    const removeButton = screen.getByLabelText('Remove');
    fireEvent.click(removeButton);
    expect(handleRemove).toHaveBeenCalledTimes(1);
  });

  it('should apply custom className', () => {
    const { container } = render(<Badge className="custom-class">Badge</Badge>);
    const badge = container.firstChild as HTMLElement;
    expect(badge).toHaveClass('custom-class');
  });

  it('should forward ref', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(<Badge ref={ref}>Badge</Badge>);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });
});

