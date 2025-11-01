import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import LocationToggle from '@/components/analytics/LocationToggle';

const defaultProps = {
  currentView: 'bar' as 'bar' | 'leaflet' | 'svg',
  onViewChange: jest.fn(),
  className: 'test-toggle',
};

describe('LocationToggle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('Title should render correctly', () => {
    render(<LocationToggle {...defaultProps} />);
    expect(screen.getByText('स्थान दृश्य विकल्प')).toBeInTheDocument();
  });

  it('Toggle container should render with correct test id', () => {
    render(<LocationToggle {...defaultProps} />);
    expect(screen.getByTestId('location-toggle')).toBeInTheDocument();
  });

  it('All three view options should be rendered', () => {
    render(<LocationToggle {...defaultProps} />);
    expect(screen.getAllByText('बार चार्ट')).toHaveLength(2); // One in button, one in status
    expect(screen.getByText('इंटरैक्टिव मानचित्र')).toBeInTheDocument();
    expect(screen.getByText('SVG मानचित्र')).toBeInTheDocument();
  });

  it('Current view should be highlighted', () => {
    render(<LocationToggle {...defaultProps} currentView="bar" />);
    const buttons = screen.getAllByRole('button');
    const barButton = buttons.find(btn => btn.textContent?.includes('बार चार्ट') && btn.getAttribute('aria-pressed') === 'true');
    expect(barButton).toHaveClass('bg-blue-600', 'text-white');
  });

  it('Non-current views should have default styling', () => {
    render(<LocationToggle {...defaultProps} currentView="bar" />);
    const buttons = screen.getAllByRole('button');
    const mapButton = buttons.find(btn => btn.textContent?.includes('इंटरैक्टिव मानचित्र'));
    const svgButton = buttons.find(btn => btn.textContent?.includes('SVG मानचित्र'));
    expect(mapButton).toHaveClass('bg-gray-200', 'text-gray-700');
    expect(svgButton).toHaveClass('bg-gray-200', 'text-gray-700');
  });

  it('Custom className should be applied', () => {
    const { container } = render(<LocationToggle {...defaultProps} className="custom-toggle" />);
    const outerDiv = container.firstChild as HTMLElement;
    expect(outerDiv).toHaveClass('custom-toggle');
  });

  it('Should call onViewChange when button is clicked', () => {
    render(<LocationToggle {...defaultProps} />);
    const buttons = screen.getAllByRole('button');
    const mapButton = buttons.find(btn => btn.textContent?.includes('इंटरैक्टिव मानचित्र'));
    fireEvent.click(mapButton!);
    expect(defaultProps.onViewChange).toHaveBeenCalledWith('leaflet');
  });

  it('Should handle all view types', () => {
    const { rerender } = render(<LocationToggle {...defaultProps} currentView="bar" />);
    const buttons = screen.getAllByRole('button');
    const barButton = buttons.find(btn => btn.getAttribute('aria-pressed') === 'true');
    expect(barButton).toHaveClass('bg-blue-600');

    rerender(<LocationToggle {...defaultProps} currentView="leaflet" />);
    const buttons2 = screen.getAllByRole('button');
    const leafletButton = buttons2.find(btn => btn.getAttribute('aria-pressed') === 'true');
    expect(leafletButton).toHaveClass('bg-blue-600');

    rerender(<LocationToggle {...defaultProps} currentView="svg" />);
    const buttons3 = screen.getAllByRole('button');
    const svgButton = buttons3.find(btn => btn.getAttribute('aria-pressed') === 'true');
    expect(svgButton).toHaveClass('bg-blue-600');
  });

  it('Should render view descriptions', () => {
    render(<LocationToggle {...defaultProps} />);
    expect(screen.getAllByText('सरल बार चार्ट के साथ स्थान वितरण देखें')).toHaveLength(2); // One in button, one in status
    expect(screen.getByText('इंटरैक्टिव मानचित्र के साथ स्थान देखें')).toBeInTheDocument();
    expect(screen.getByText('SVG मानचित्र के साथ जिला दृश्य देखें')).toBeInTheDocument();
  });

  it('Should handle keyboard navigation', () => {
    render(<LocationToggle {...defaultProps} />);
    const buttons = screen.getAllByRole('button');
    const mapButton = buttons.find(btn => btn.textContent?.includes('इंटरैक्टिव मानचित्र'));
    
    // Test keyboard navigation
    fireEvent.keyDown(mapButton!, { key: 'Enter' });
    expect(defaultProps.onViewChange).toHaveBeenCalledWith('leaflet');
    
    fireEvent.keyDown(mapButton!, { key: ' ' });
    expect(defaultProps.onViewChange).toHaveBeenCalledTimes(2);
  });

  it('Should be accessible with proper ARIA attributes', () => {
    render(<LocationToggle {...defaultProps} />);
    const toggle = screen.getByTestId('location-toggle');
    expect(toggle).toHaveAttribute('role', 'group');
    expect(toggle).toHaveAttribute('aria-label', 'स्थान दृश्य विकल्प');
  });
});
