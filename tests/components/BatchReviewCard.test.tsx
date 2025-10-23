import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import BatchReviewCard from '@/components/review/BatchReviewCard';

const mockTweet = {
  id: '123',
  timestamp: '2024-01-15T10:30:00Z',
  content: 'This is a test tweet about a birthday celebration in Raigarh district.',
  parsed: {
    event_type: 'जन्मदिन शुभकामनाएं',
    locations: [
      { name: 'Raigarh' },
      { name: 'Kharsia' }
    ],
    people_mentioned: ['रमन सिंह', 'नरेंद्र मोदी'],
    organizations: ['भाजपा'],
    schemes_mentioned: ['प्रधानमंत्री आवास योजना']
  },
  confidence: 0.7,
  review_status: 'pending'
};

describe('BatchReviewCard', () => {
  const defaultProps = {
    tweet: mockTweet,
    onApprove: jest.fn(),
    onReject: jest.fn(),
    onEdit: jest.fn(),
    onSkip: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render tweet information correctly', () => {
    render(<BatchReviewCard {...defaultProps} />);
    
    expect(screen.getByText('Tweet #123')).toBeInTheDocument();
    expect(screen.getByText(/This is a test tweet about a birthday celebration/)).toBeInTheDocument();
  });

  it('should display confidence score with correct color coding', () => {
    render(<BatchReviewCard {...defaultProps} />);
    
    expect(screen.getByText('70%')).toBeInTheDocument();
    // Should have yellow border for confidence 0.7
    const card = screen.getByText('Tweet #123').closest('.border-2');
    expect(card).toHaveClass('border-yellow-500');
  });

  it('should show red border for low confidence tweets', () => {
    const lowConfidenceTweet = { ...mockTweet, confidence: 0.3 };
    
    render(<BatchReviewCard {...defaultProps} tweet={lowConfidenceTweet} />);
    
    const card = screen.getByText('Tweet #123').closest('.border-2');
    expect(card).toHaveClass('border-red-500');
  });

  it('should show green border for high confidence tweets', () => {
    const highConfidenceTweet = { ...mockTweet, confidence: 0.9 };
    
    render(<BatchReviewCard {...defaultProps} tweet={highConfidenceTweet} />);
    
    const card = screen.getByText('Tweet #123').closest('.border-2');
    expect(card).toHaveClass('border-green-500');
  });

  it('should display parsed event type', () => {
    render(<BatchReviewCard {...defaultProps} />);
    
    expect(screen.getByText('🎯 Event Type')).toBeInTheDocument();
    expect(screen.getByText('जन्मदिन शुभकामनाएं')).toBeInTheDocument();
  });

  it('should display locations with badges', () => {
    render(<BatchReviewCard {...defaultProps} />);
    
    expect(screen.getByText('📍 Locations')).toBeInTheDocument();
    expect(screen.getByText('Raigarh')).toBeInTheDocument();
    expect(screen.getByText('Kharsia')).toBeInTheDocument();
  });

  it('should display people with badges', () => {
    render(<BatchReviewCard {...defaultProps} />);
    
    expect(screen.getByText('👥 People')).toBeInTheDocument();
    expect(screen.getByText('रमन सिंह')).toBeInTheDocument();
    expect(screen.getByText('नरेंद्र मोदी')).toBeInTheDocument();
  });

  it('should truncate long tweet content', () => {
    const longTweet = {
      ...mockTweet,
      content: 'This is a very long tweet content that should be truncated because it exceeds the maximum length allowed in the batch review card component to maintain a clean and readable interface for the reviewers.'
    };
    
    render(<BatchReviewCard {...defaultProps} tweet={longTweet} />);
    
    expect(screen.getByText(/This is a very long tweet content that should be truncated/)).toBeInTheDocument();
    expect(screen.getByText(/\.\.\./)).toBeInTheDocument();
  });

  it('should show "more" indicator when there are many locations', () => {
    const tweetWithManyLocations = {
      ...mockTweet,
      parsed: {
        ...mockTweet.parsed,
        locations: [
          { name: 'Location1' },
          { name: 'Location2' },
          { name: 'Location3' },
          { name: 'Location4' }
        ]
      }
    };
    
    render(<BatchReviewCard {...defaultProps} tweet={tweetWithManyLocations} />);
    
    expect(screen.getByText('Location1')).toBeInTheDocument();
    expect(screen.getByText('Location2')).toBeInTheDocument();
    expect(screen.getByText('+2 more')).toBeInTheDocument();
  });

  it('should show "more" indicator when there are many people', () => {
    const tweetWithManyPeople = {
      ...mockTweet,
      parsed: {
        ...mockTweet.parsed,
        people_mentioned: ['Person1', 'Person2', 'Person3', 'Person4']
      }
    };
    
    render(<BatchReviewCard {...defaultProps} tweet={tweetWithManyPeople} />);
    
    expect(screen.getByText('Person1')).toBeInTheDocument();
    expect(screen.getByText('Person2')).toBeInTheDocument();
    expect(screen.getByText('+2 more')).toBeInTheDocument();
  });

  it('should call onApprove when approve button is clicked', () => {
    render(<BatchReviewCard {...defaultProps} />);
    
    const approveButton = screen.getByText('Approve');
    fireEvent.click(approveButton);
    
    expect(defaultProps.onApprove).toHaveBeenCalledWith('123');
  });

  it('should call onReject when reject button is clicked', () => {
    render(<BatchReviewCard {...defaultProps} />);
    
    const rejectButton = screen.getByText('Reject');
    fireEvent.click(rejectButton);
    
    expect(defaultProps.onReject).toHaveBeenCalledWith('123');
  });

  it('should call onEdit when edit button is clicked', () => {
    render(<BatchReviewCard {...defaultProps} />);
    
    const editButton = screen.getByText('Edit');
    fireEvent.click(editButton);
    
    expect(defaultProps.onEdit).toHaveBeenCalledWith('123');
  });

  it('should call onSkip when skip button is clicked', () => {
    render(<BatchReviewCard {...defaultProps} />);
    
    const skipButton = screen.getByText('Skip');
    fireEvent.click(skipButton);
    
    expect(defaultProps.onSkip).toHaveBeenCalledWith('123');
  });

  it('should call onSelect when card is clicked', () => {
    const onSelect = jest.fn();
    
    render(<BatchReviewCard {...defaultProps} onSelect={onSelect} />);
    
    const card = screen.getByText('Tweet #123').closest('.cursor-pointer');
    fireEvent.click(card!);
    
    expect(onSelect).toHaveBeenCalled();
  });

  it('should show selected state when isSelected is true', () => {
    render(<BatchReviewCard {...defaultProps} isSelected={true} />);
    
    const card = screen.getByText('Tweet #123').closest('.ring-2');
    expect(card).toHaveClass('ring-blue-500');
  });

  it('should handle tweets with no parsed data', () => {
    const tweetWithoutParsed = {
      ...mockTweet,
      parsed: undefined
    };
    
    render(<BatchReviewCard {...defaultProps} tweet={tweetWithoutParsed} />);
    
    expect(screen.getByText('N/A')).toBeInTheDocument();
  });

  it('should handle tweets with empty parsed data', () => {
    const tweetWithEmptyParsed = {
      ...mockTweet,
      parsed: {
        event_type: '',
        locations: [],
        people_mentioned: [],
        organizations: [],
        schemes_mentioned: []
      }
    };
    
    render(<BatchReviewCard {...defaultProps} tweet={tweetWithEmptyParsed} />);
    
    expect(screen.getByText('N/A')).toBeInTheDocument();
    expect(screen.queryByText('📍 Locations')).not.toBeInTheDocument();
    expect(screen.queryByText('👥 People')).not.toBeInTheDocument();
  });

  it('should prevent event propagation when buttons are clicked', () => {
    const onSelect = jest.fn();
    
    render(<BatchReviewCard {...defaultProps} onSelect={onSelect} />);
    
    const approveButton = screen.getByText('Approve');
    fireEvent.click(approveButton);
    
    expect(defaultProps.onApprove).toHaveBeenCalledWith('123');
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('should show hover effects', () => {
    render(<BatchReviewCard {...defaultProps} />);
    
    const card = screen.getByText('Tweet #123').closest('.cursor-pointer');
    fireEvent.mouseEnter(card!);
    
    expect(card).toHaveClass('shadow-lg');
  });
});
