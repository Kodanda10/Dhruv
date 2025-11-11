```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ReviewDashboard from '@/components/review/ReviewDashboard';

// Mock child components
jest.mock('@/components/analytics/AIAssistantCard', () => () => <div data-testid="ai-assistant-card">AIAssistantCard</div>);
jest.mock('@/components/analytics/FaissSearchCard', () => () => <div data-testid="faiss-search-card">FaissSearchCard</div>);
jest.mock('@/components/analytics/DynamicLearningCard', () => () => <div data-testid="dynamic-learning-card">DynamicLearningCard</div>);

describe('ReviewDashboard', () => {
  it('renders all child components correctly', () => {
    render(<ReviewDashboard />);

    expect(screen.getByTestId('ai-assistant-card')).toBeInTheDocument();
    expect(screen.getByTestId('faiss-search-card')).toBeInTheDocument();
    expect(screen.getByTestId('dynamic-learning-card')).toBeInTheDocument();
    expect(screen.getByText('Parsed Events Review')).toBeInTheDocument();
  });
});
```