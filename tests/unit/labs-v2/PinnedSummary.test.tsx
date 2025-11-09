import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import PinnedSummary from '@/app/labs-v2/review/PinnedSummary';

describe('PinnedSummary', () => {
  const mockProps = {
    location: 'Raigarh',
    eventType: 'Political Rally',
    peopleCount: 3,
    schemesCount: 2,
  };

  test('should render all summary information correctly', () => {
    render(<PinnedSummary {...mockProps} />);

    expect(screen.getByText('Pinned Summary')).toBeInTheDocument();
    expect(screen.getByText('Location:')).toBeInTheDocument();
    expect(screen.getByText('Raigarh')).toBeInTheDocument();
    expect(screen.getByText('Event Type:')).toBeInTheDocument();
    expect(screen.getByText('Political Rally')).toBeInTheDocument();
    expect(screen.getByText('People:')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Schemes:')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });
});
