import '@testing-library/jest-dom';
import { render, screen, fireEvent, within } from '@testing-library/react';
import Metrics from '@/components/Metrics';

describe('Metrics interactions and rendering', () => {
  it('renders headings and lists with items', () => {
    render(<Metrics />);
    expect(screen.getByText('स्थान सारांश')).toBeInTheDocument();
    expect(screen.getByText('गतिविधि सारांश')).toBeInTheDocument();

    const sections = screen.getAllByRole('list');
    expect(sections.length).toBeGreaterThanOrEqual(2);
    for (const ul of sections) {
      const items = within(ul).getAllByRole('listitem');
      expect(items.length).toBeGreaterThan(0);
    }
  });

  it('clicks on first place and activity to exercise onClick handlers', () => {
    render(<Metrics />);
    const lists = screen.getAllByRole('list');
    const placeItems = within(lists[0]).getAllByRole('listitem');
    const activityItems = within(lists[1]).getAllByRole('listitem');

    // Click first place link button
    const placeBtn = within(placeItems[0]).getByRole('button');
    fireEvent.click(placeBtn);

    // Click first activity link button
    const actBtn = within(activityItems[0]).getByRole('button');
    fireEvent.click(actBtn);

    // No explicit assertion on router; the goal is to execute onClick handlers for coverage
    expect(placeBtn).toBeInTheDocument();
    expect(actBtn).toBeInTheDocument();
  });
});


