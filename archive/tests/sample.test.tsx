import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import HomePage from '@/app/page';

describe('HomePage', () => {
  it('renders heading in Hindi', () => {
    render(<HomePage />);
    expect(screen.getByRole('heading', { name: 'ध्रुव डैशबोर्ड' })).toBeInTheDocument();
  });
});

