import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ProgressSidebar from '@/components/review/ProgressSidebar';

const mockTweets = [
  {
    id: '1',
    confidence: 0.3,
    review_status: 'pending',
  },
  {
    id: '2',
    confidence: 0.8,
    review_status: 'approved',
  },
  {
    id: '3',
    confidence: 0.9,
    review_status: 'corrected',
  },
  {
    id: '4',
    confidence: 0.4,
    review_status: 'skipped',
  },
  {
    id: '5',
    confidence: 0.6,
    review_status: 'pending',
  },
];

describe('ProgressSidebar', () => {
  const defaultProps = {
    tweets: mockTweets,
    currentIndex: 0,
    onFilterByStatus: jest.fn(),
    onJumpToTweet: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render progress statistics correctly', () => {
    render(<ProgressSidebar {...defaultProps} />);
    
    expect(screen.getByText('समीक्षा प्रगति')).toBeInTheDocument();
    expect(screen.getByText('आंकड़े')).toBeInTheDocument();
    expect(screen.getByText('औसत विश्वास')).toBeInTheDocument();
  });

  it('should display correct counts for each status', () => {
    render(<ProgressSidebar {...defaultProps} />);
    
    // Pending: tweets with status 'pending' or no status
    expect(screen.getByText('2')).toBeInTheDocument(); // 2 pending tweets
    
    // Approved: 1 approved tweet
    expect(screen.getByText('1')).toBeInTheDocument(); // 1 approved tweet
    
    // Edited: 1 corrected tweet
    expect(screen.getByText('1')).toBeInTheDocument(); // 1 edited tweet
    
    // Skipped: 1 skipped tweet
    expect(screen.getByText('1')).toBeInTheDocument(); // 1 skipped tweet
  });

  it('should display current position correctly', () => {
    render(<ProgressSidebar {...defaultProps} />);
    
    expect(screen.getByText('Current Position')).toBeInTheDocument();
    expect(screen.getByText('1 / 5')).toBeInTheDocument();
  });

  it('should show low confidence alert when there are low confidence tweets', () => {
    render(<ProgressSidebar {...defaultProps} />);
    
    expect(screen.getByText('Low Confidence')).toBeInTheDocument();
    expect(screen.getByText('2 tweets need attention')).toBeInTheDocument();
  });

  it('should call onJumpToTweet when clicking on pending tweets', () => {
    render(<ProgressSidebar {...defaultProps} />);
    
    const pendingElement = screen.getByText('Pending').closest('div');
    fireEvent.click(pendingElement!);
    
    expect(defaultProps.onJumpToTweet).toHaveBeenCalledWith(0); // First pending tweet index
  });

  it('should call onJumpToTweet when clicking on approved tweets', () => {
    render(<ProgressSidebar {...defaultProps} />);
    
    const approvedElement = screen.getByText('Approved').closest('div');
    fireEvent.click(approvedElement!);
    
    expect(defaultProps.onJumpToTweet).toHaveBeenCalledWith(1); // First approved tweet index
  });

  it('should call onJumpToTweet when clicking on low confidence alert', () => {
    render(<ProgressSidebar {...defaultProps} />);
    
    const lowConfidenceElement = screen.getByText('2 tweets need attention');
    fireEvent.click(lowConfidenceElement);
    
    expect(defaultProps.onJumpToTweet).toHaveBeenCalledWith(0); // First low confidence tweet index
  });

  it('should call onFilterByStatus when clicking quick action buttons', () => {
    render(<ProgressSidebar {...defaultProps} />);
    
    const showPendingButton = screen.getByText('📝 Show Pending Only');
    fireEvent.click(showPendingButton);
    
    expect(defaultProps.onFilterByStatus).toHaveBeenCalledWith('pending');
  });

  it('should calculate progress percentage correctly', () => {
    render(<ProgressSidebar {...defaultProps} />);
    
    // Progress should be (reviewed + skipped) / total * 100
    // Reviewed = 1 approved + 1 edited = 2
    // Skipped = 1
    // Total = 5
    // Progress = (2 + 1) / 5 * 100 = 60%
    expect(screen.getByText('60%')).toBeInTheDocument();
  });

  it('should display average confidence correctly', () => {
    render(<ProgressSidebar {...defaultProps} />);
    
    // Average confidence = (0.3 + 0.8 + 0.9 + 0.4 + 0.6) / 5 = 0.6 = 60%
    expect(screen.getByText('60%')).toBeInTheDocument();
  });

  it('should not show low confidence alert when no low confidence tweets', () => {
    const highConfidenceTweets = mockTweets.map(tweet => ({
      ...tweet,
      confidence: 0.9,
    }));
    
    render(
      <ProgressSidebar
        {...defaultProps}
        tweets={highConfidenceTweets}
      />
    );
    
    expect(screen.queryByText('Low Confidence')).not.toBeInTheDocument();
  });

  it('should handle empty tweets array', () => {
    render(
      <ProgressSidebar
        {...defaultProps}
        tweets={[]}
      />
    );
    
    expect(screen.getByText('0 / 0')).toBeInTheDocument();
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('should handle tweets with no confidence values', () => {
    const tweetsWithoutConfidence = mockTweets.map(tweet => ({
      ...tweet,
      confidence: undefined,
    }));
    
    render(
      <ProgressSidebar
        {...defaultProps}
        tweets={tweetsWithoutConfidence}
      />
    );
    
    expect(screen.getByText('0%')).toBeInTheDocument(); // Average confidence should be 0
  });

  it('should handle tweets with no review status', () => {
    const tweetsWithoutStatus = mockTweets.map(tweet => ({
      ...tweet,
      review_status: undefined,
    }));
    
    render(
      <ProgressSidebar
        {...defaultProps}
        tweets={tweetsWithoutStatus}
      />
    );
    
    // All tweets should be considered pending
    expect(screen.getByText('5')).toBeInTheDocument(); // All 5 tweets pending
  });
});
