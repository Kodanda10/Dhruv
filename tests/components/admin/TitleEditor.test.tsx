/**
 * Title Editor Component Tests
 * Phase 7.2: Tests for Dynamic Title & Header Editor
 */

import { describe, it, expect } from '@jest/globals';
import { render, screen, waitFor } from '@testing-library/react';
import TitleEditor from '@/components/admin/TitleEditor';

// Mock the hook
jest.mock('@/hooks/useEditableTitles', () => ({
  useEditableTitles: () => ({
    titles: [
      {
        id: 1,
        key: 'dashboard.main_title',
        value_hi: 'सोशल मीडिया एनालिटिक्स डैशबोर्ड',
        value_en: 'Social Media Analytics Dashboard',
        section: 'dashboard',
        updated_at: '2024-01-01T00:00:00Z',
        created_at: '2024-01-01T00:00:00Z',
      },
    ],
    loading: false,
    error: null,
    updateTitle: jest.fn().mockResolvedValue(true),
    refreshTitles: jest.fn(),
  }),
}));

describe('TitleEditor Component', () => {
  it('should render title editor', () => {
    render(<TitleEditor />);
    expect(screen.getByText('शीर्षक संपादक')).toBeInTheDocument();
  });

  it('should display titles grouped by section', () => {
    render(<TitleEditor />);
    expect(screen.getByText('dashboard')).toBeInTheDocument();
    expect(screen.getByText('सोशल मीडिया एनालिटिक्स डैशबोर्ड')).toBeInTheDocument();
  });

  it('should show edit button for each title', () => {
    render(<TitleEditor />);
    const editButtons = screen.getAllByText('संपादित करें');
    expect(editButtons.length).toBeGreaterThan(0);
  });

  it('should display loading state', () => {
    jest.mock('@/hooks/useEditableTitles', () => ({
      useEditableTitles: () => ({
        titles: [],
        loading: true,
        error: null,
        updateTitle: jest.fn(),
        refreshTitles: jest.fn(),
      }),
    }));
    render(<TitleEditor />);
    expect(screen.getByText('लोड हो रहा है...')).toBeInTheDocument();
  });

  it('should display error state', () => {
    jest.mock('@/hooks/useEditableTitles', () => ({
      useEditableTitles: () => ({
        titles: [],
        loading: false,
        error: 'Failed to load',
        updateTitle: jest.fn(),
        refreshTitles: jest.fn(),
      }),
    }));
    render(<TitleEditor />);
    expect(screen.getByText('Failed to load')).toBeInTheDocument();
  });
});


