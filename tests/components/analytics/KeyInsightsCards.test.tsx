import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import KeyInsightsCards from '@/components/analytics/KeyInsightsCards';

const mockData = [
  {
    id: 'insight-1',
    title: 'सबसे अधिक सक्रिय स्थान',
    value: 'रायपुर',
    description: 'रायपुर में सबसे अधिक पोस्ट्स हैं',
    trend: 'up' as const,
    change: '+15%',
    icon: '📍'
  },
  {
    id: 'insight-2',
    title: 'शीर्ष विषय',
    value: 'विकास',
    description: 'विकास संबंधी पोस्ट्स सबसे अधिक हैं',
    trend: 'neutral' as const,
    change: '0%',
    icon: '📈'
  },
  {
    id: 'insight-3',
    title: 'साप्ताहिक वृद्धि',
    value: '23%',
    description: 'पिछले सप्ताह की तुलना में वृद्धि',
    trend: 'down' as const,
    change: '-5%',
    icon: '📊'
  },
  {
    id: 'insight-4',
    title: 'कुल पोस्ट्स',
    value: '1,234',
    description: 'सभी समय के कुल पोस्ट्स',
    trend: 'up' as const,
    change: '+12%',
    icon: '📝'
  }
];

const defaultProps = {
  insights: mockData,
  className: 'test-insights',
};

describe('KeyInsightsCards', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('Title should render correctly', () => {
    render(<KeyInsightsCards {...defaultProps} />);
    expect(screen.getByText('मुख्य अंतर्दृष्टि')).toBeInTheDocument();
  });

  it('Insights container should render with correct test id', () => {
    render(<KeyInsightsCards {...defaultProps} />);
    expect(screen.getByTestId('key-insights-cards')).toBeInTheDocument();
  });

  it('All insight cards should be rendered', () => {
    render(<KeyInsightsCards {...defaultProps} />);
    expect(screen.getByText('सबसे अधिक सक्रिय स्थान')).toBeInTheDocument();
    expect(screen.getByText('शीर्ष विषय')).toBeInTheDocument();
    expect(screen.getByText('साप्ताहिक वृद्धि')).toBeInTheDocument();
    expect(screen.getByText('कुल पोस्ट्स')).toBeInTheDocument();
  });

  it('Insight values should be displayed correctly', () => {
    render(<KeyInsightsCards {...defaultProps} />);
    expect(screen.getByText('रायपुर')).toBeInTheDocument();
    expect(screen.getByText('विकास')).toBeInTheDocument();
    expect(screen.getByText('23%')).toBeInTheDocument();
    expect(screen.getByText('1,234')).toBeInTheDocument();
  });

  it('Trend indicators should be displayed', () => {
    render(<KeyInsightsCards {...defaultProps} />);
    expect(screen.getByText('+15%')).toBeInTheDocument();
    expect(screen.getByText('0%')).toBeInTheDocument();
    expect(screen.getByText('-5%')).toBeInTheDocument();
    expect(screen.getByText('+12%')).toBeInTheDocument();
  });

  it('Custom className should be applied', () => {
    const { container } = render(<KeyInsightsCards {...defaultProps} className="custom-insights" />);
    const outerDiv = container.firstChild as HTMLElement;
    expect(outerDiv).toHaveClass('custom-insights');
  });

  it('Empty insights should be handled gracefully', () => {
    render(<KeyInsightsCards {...defaultProps} insights={[]} />);
    expect(screen.getByText('मुख्य अंतर्दृष्टि')).toBeInTheDocument();
    expect(screen.getByTestId('key-insights-cards')).toBeInTheDocument();
  });

  it('Single insight should be handled', () => {
    const singleInsight = [mockData[0]];
    render(<KeyInsightsCards {...defaultProps} insights={singleInsight} />);
    expect(screen.getByText('सबसे अधिक सक्रिय स्थान')).toBeInTheDocument();
    expect(screen.getByText('रायपुर')).toBeInTheDocument();
  });

  it('Should display insight descriptions', () => {
    render(<KeyInsightsCards {...defaultProps} />);
    expect(screen.getByText('रायपुर में सबसे अधिक पोस्ट्स हैं')).toBeInTheDocument();
    expect(screen.getByText('विकास संबंधी पोस्ट्स सबसे अधिक हैं')).toBeInTheDocument();
    expect(screen.getByText('पिछले सप्ताह की तुलना में वृद्धि')).toBeInTheDocument();
    expect(screen.getByText('सभी समय के कुल पोस्ट्स')).toBeInTheDocument();
  });

  it('Should display trend icons correctly', () => {
    render(<KeyInsightsCards {...defaultProps} />);
    expect(screen.getByText('📍')).toBeInTheDocument();
    expect(screen.getByText('📈')).toBeInTheDocument();
    expect(screen.getByText('📊')).toBeInTheDocument();
    expect(screen.getByText('📝')).toBeInTheDocument();
  });

  it('Should handle different trend types', () => {
    render(<KeyInsightsCards {...defaultProps} />);
    // Check if trend indicators are present
    expect(screen.getByText('+15%')).toBeInTheDocument();
    expect(screen.getByText('0%')).toBeInTheDocument();
    expect(screen.getByText('-5%')).toBeInTheDocument();
    expect(screen.getByText('+12%')).toBeInTheDocument();
  });

  it('Should be responsive with proper grid layout', () => {
    render(<KeyInsightsCards {...defaultProps} />);
    const container = screen.getByTestId('key-insights-cards');
    expect(container).toHaveClass('grid', 'grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-4');
  });
});
