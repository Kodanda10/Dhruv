
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import DynamicLearningCard from '@/components/analytics/DynamicLearningCard';

// Mock fetch
global.fetch = vi.fn();

describe('DynamicLearningCard', () => {
  beforeEach(() => {
    (fetch as any).mockClear();
  });

  it('renders the initial state correctly', () => {
    render(<DynamicLearningCard />);
    expect(screen.getByText('Dynamic Learning')).toBeInTheDocument();
    expect(screen.getByText(/Process approved reviews and generate new learning artifacts/)).toBeInTheDocument();
    expect(screen.getByText('Run Learning Job')).toBeInTheDocument();
  });

  it('calls the API and shows a success message when the job runs successfully', async () => {
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: 'Learning job started successfully.' }),
    });

    render(<DynamicLearningCard />);
    const runButton = screen.getByText('Run Learning Job');
    fireEvent.click(runButton);

    expect(screen.getByText('Running Job...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Learning job started successfully.')).toBeInTheDocument();
    });
    expect(screen.queryByText('Running Job...')).not.toBeInTheDocument();
  });

  it('calls the API and shows an error message when the job fails', async () => {
    (fetch as any).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Failed to connect to the learning service.' }),
    });

    render(<DynamicLearningCard />);
    const runButton = screen.getByText('Run Learning Job');
    fireEvent.click(runButton);

    expect(screen.getByText('Running Job...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Failed to connect to the learning service.')).toBeInTheDocument();
    });
    expect(screen.queryByText('Running Job...')).not.toBeInTheDocument();
  });

  it('disables the button while the job is running', () => {
    render(<DynamicLearningCard />);
    const runButton = screen.getByText('Run Learning Job');
    fireEvent.click(runButton);
    expect(runButton).toBeDisabled();
  });
});
