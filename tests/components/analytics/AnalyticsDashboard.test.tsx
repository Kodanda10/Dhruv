/**
 * TDD Tests for Analytics Dashboard - Hindi Layout Specification
 *
 * Based on the detailed layout specification with 9 modules (A-I):
 * A. इवेंट प्रकार विश्लेषण, B. भू-मानचित्रण और माइंडमैप, C. टूर कवरेज विश्लेषण,
 * D. विकास कार्य और लोकार्पण विश्लेषण, E. समाज आधारित पहुँच,
 * F. योजनाएँ / स्कीम विश्लेषण, G. वर्ग-आधारित विश्लेषण,
 * H. विषयगत विश्लेषण, I. रायगढ़ विधानसभा अनुभाग
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AnalyticsDashboard from '../../../src/components/analytics/AnalyticsDashboard';

// Mock the useAuth hook
jest.mock('../../../src/hooks/useAuth', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    user: { id: 'admin', username: 'admin', role: 'admin' },
    loginUser: jest.fn(),
    logoutUser: jest.fn(),
    loading: false,
    error: null
  })
}));

// Mock fetch for API calls
global.fetch = jest.fn();

describe('AnalyticsDashboard Component - Hindi Layout Specification', () => {
  const mockAnalyticsData = {
    total_tweets: 150,
    event_distribution: {
      'बैठक': 45,
      'दौरा': 30,
      'लोकार्पण': 25,
      'शोक': 20,
      'समीक्षा': 15,
      'अन्य': 15
    },
    location_distribution: {
      'रायगढ़': 50,
      'छत्तीसगढ़': 35,
      'रायपुर': 25,
      'बिलासपुर': 20,
      'कोरबा': 15,
      'अन्य': 5
    },
    scheme_usage: {
      'पीएमएवाई': 40,
      'जल जीवन मिशन': 30,
      'युवा स्वरोजगार': 25,
      'मनरेगा': 20,
      'आयुष्मान भारत': 15,
      'अन्य': 20
    },
    timeline: [
      { date: '2025-11-01', count: 10 },
      { date: '2025-11-02', count: 15 },
      { date: '2025-11-03', count: 20 }
    ],
    day_of_week: {
      'सोमवार': 25,
      'मंगलवार': 20,
      'बुधवार': 30,
      'गुरुवार': 15,
      'शुक्रवार': 35,
      'शनिवार': 15,
      'रविवार': 10
    },
    caste_community: {
      'साहू': 30,
      'तेली': 25,
      'मुस्लिम': 20,
      'यादव': 15,
      'अन्य': 10
    },
    target_groups: {
      'महिला': 40,
      'युवा': 35,
      'किसान': 25,
      'वरिष्ठ नागरिक': 15,
      'अन्य': 35
    },
    thematic_analysis: {
      'रोजगार': 45,
      'शिक्षा': 30,
      'स्वास्थ्य': 25,
      'आधारभूत संरचना': 20,
      'अन्य': 30
    },
    raigarh_section: {
      coverage_percentage: 75,
      local_events: [
        { date: '2025-11-01', location: 'रायगढ़', type: 'दौरा', description: 'ग्राम विकास दौरा' },
        { date: '2025-11-02', location: 'तमनार', type: 'लोकार्पण', description: 'पानी टंकी लोकार्पण' }
      ],
      community_data: {
        'साहू': 15,
        'तेली': 12,
        'मुस्लिम': 10,
        'यादव': 8,
        'अन्य': 5
      },
      engagement_metrics: {
        total_likes: 1250,
        total_retweets: 340,
        total_replies: 89
      }
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    const blobPayload = new Blob([JSON.stringify(mockAnalyticsData)], {
      type: 'application/json',
    });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: mockAnalyticsData }),
      blob: async () => blobPayload,
    });
  });

  describe('Hindi Layout Structure - All 9 Modules', () => {
    it('should display all 9 analytics modules with Hindi labels', async () => {
      render(<AnalyticsDashboard />);

      await waitFor(() => {
        // Module A
        expect(screen.getByText('A. इवेंट प्रकार विश्लेषण')).toBeInTheDocument();
        expect(screen.getByText('बैठक')).toBeInTheDocument();

        // Module B
        expect(screen.getByText('B. भू-मानचित्रण और माइंडमैप')).toBeInTheDocument();
        expect(screen.getByText('छत्तीसगढ़ → जिला → ब्लॉक → ग्राम पंचायत / वार्ड')).toBeInTheDocument();

        // Module C
        expect(screen.getByText('C. टूर कवरेज विश्लेषण')).toBeInTheDocument();
        expect(screen.getByText('कुल जिलों / ग्रामों का कवरेज %')).toBeInTheDocument();

        // Module D
        expect(screen.getByText('D. विकास कार्य और लोकार्पण विश्लेषण')).toBeInTheDocument();

        // Module E
        expect(screen.getByText('E. समाज आधारित पहुँच')).toBeInTheDocument();
        expect(screen.getByText('साहू / तेली / मुस्लिम / यादव / अन्य समाज')).toBeInTheDocument();

        // Module F
        expect(screen.getByText('F. योजनाएँ / स्कीम विश्लेषण')).toBeInTheDocument();
        expect(screen.getByText('पीएमएवाई / जल जीवन मिशन / युवा स्वरोजगार')).toBeInTheDocument();

        // Module G
        expect(screen.getByText('G. वर्ग-आधारित विश्लेषण')).toBeInTheDocument();
        expect(screen.getByText('महिला / युवा / किसान / वरिष्ठ नागरिक')).toBeInTheDocument();

        // Module H
        expect(screen.getByText('H. विषयगत विश्लेषण')).toBeInTheDocument();
        expect(screen.getByText('रोज़गार / शिक्षा / स्वास्थ्य / आधारभूत संरचना')).toBeInTheDocument();

        // Module I
        expect(screen.getByText('I. रायगढ़ विधानसभा अनुभाग')).toBeInTheDocument();
        expect(screen.getByText('रायगढ़ जिला → ब्लॉक → वार्ड/ग्राम')).toBeInTheDocument();
      });
    });

    it('should show filter section with Hindi labels', async () => {
      render(<AnalyticsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('🔍 फ़िल्टर सेक्शन')).toBeInTheDocument();
        expect(screen.getByText('स्थान ▸')).toBeInTheDocument();
        expect(screen.getByText('विषय ▸')).toBeInTheDocument();
        expect(screen.getByText('दिनांक से ▸')).toBeInTheDocument();
        expect(screen.getByText('तक ▸')).toBeInTheDocument();
        expect(screen.getByText('फ़िल्टर साफ करें')).toBeInTheDocument();
      });
    });

    it('should display export buttons in Hindi', async () => {
      render(<AnalyticsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('📄 रिपोर्ट / निर्यात')).toBeInTheDocument();
        expect(screen.getByText('[ PDF ]')).toBeInTheDocument();
        expect(screen.getByText('[ Excel ]')).toBeInTheDocument();
        expect(screen.getByText('[ CSV ]')).toBeInTheDocument();
      });
    });
  });

  describe('Data Display and Charts', () => {
    it('should render donut chart for event distribution', async () => {
      render(<AnalyticsDashboard />);

      await waitFor(() => {
        // Check if chart data is displayed
        expect(screen.getByText('बैठक: 45')).toBeInTheDocument();
        expect(screen.getByText('दौरा: 30')).toBeInTheDocument();
        expect(screen.getByText('लोकार्पण: 25')).toBeInTheDocument();
      });
    });

    it('should show timeline data', async () => {
      render(<AnalyticsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('2025-11-01: 10')).toBeInTheDocument();
        expect(screen.getByText('2025-11-02: 15')).toBeInTheDocument();
        expect(screen.getByText('2025-11-03: 20')).toBeInTheDocument();
      });
    });

    it('should display caste/community data in Module E', async () => {
      render(<AnalyticsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('साहू: 30')).toBeInTheDocument();
        expect(screen.getByText('तेली: 25')).toBeInTheDocument();
        expect(screen.getByText('मुस्लिम: 20')).toBeInTheDocument();
        expect(screen.getByText('यादव: 15')).toBeInTheDocument();
      });
    });

    it('should show target group analysis in Module G', async () => {
      render(<AnalyticsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('महिला: 40')).toBeInTheDocument();
        expect(screen.getByText('युवा: 35')).toBeInTheDocument();
        expect(screen.getByText('किसान: 25')).toBeInTheDocument();
        expect(screen.getByText('वरिष्ठ नागरिक: 15')).toBeInTheDocument();
      });
    });
  });

  describe('Raigarh Dedicated Section (Module I)', () => {
    it('should display coverage percentage', async () => {
      render(<AnalyticsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('कवरेज प्रगति: ग्राम/वार्ड विज़िट प्रतिशत')).toBeInTheDocument();
        expect(screen.getByText('75%')).toBeInTheDocument();
      });
    });

    it('should show local events list', async () => {
      render(<AnalyticsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('रायगढ़')).toBeInTheDocument();
        expect(screen.getByText('तमनार')).toBeInTheDocument();
        expect(screen.getByText('ग्राम विकास दौरा')).toBeInTheDocument();
        expect(screen.getByText('पानी टंकी लोकार्पण')).toBeInTheDocument();
      });
    });

    it('should display engagement metrics', async () => {
      render(<AnalyticsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('💬 पब्लिक रिस्पॉन्स')).toBeInTheDocument();
        expect(screen.getByText('Likes: 1250')).toBeInTheDocument();
        expect(screen.getByText('Retweets: 340')).toBeInTheDocument();
        expect(screen.getByText('Replies: 89')).toBeInTheDocument();
      });
    });
  });

  describe('Filter Functionality', () => {
    it('should handle location filter changes', async () => {
      render(<AnalyticsDashboard />);

      await waitFor(() => {
        const locationInput = screen.getByDisplayValue('रायगढ़ / छत्तीसगढ़');
        fireEvent.change(locationInput, { target: { value: 'बिलासपुर' } });

        expect(locationInput).toHaveValue('बिलासपुर');
      });
    });

    it('should handle date range filtering', async () => {
      render(<AnalyticsDashboard />);

      await waitFor(() => {
        const startDateInput = screen.getByLabelText('दिनांक से');
        const endDateInput = screen.getByLabelText('तक');

        fireEvent.change(startDateInput, { target: { value: '2025-11-01' } });
        fireEvent.change(endDateInput, { target: { value: '2025-11-30' } });

        expect(startDateInput).toHaveValue('2025-11-01');
        expect(endDateInput).toHaveValue('2025-11-30');
      });
    });

    it('should clear all filters', async () => {
      render(<AnalyticsDashboard />);

      await waitFor(() => {
        const clearButton = screen.getByText('फ़िल्टर साफ करें');
        fireEvent.click(clearButton);

        // Should reset to default values
        expect(screen.getByDisplayValue('रायगढ़ / छत्तीसगढ़')).toBeInTheDocument();
      });
    });
  });

  describe('Export Functionality', () => {
    it('should handle PDF export', async () => {
      const mockCreateObjectURL = jest.fn(() => 'blob:pdf-url');
      global.URL.createObjectURL = mockCreateObjectURL;
      global.URL.revokeObjectURL = jest.fn();

      render(<AnalyticsDashboard />);

      await waitFor(() => {
        const pdfButton = screen.getByText('[ PDF ]');
        fireEvent.click(pdfButton);

        expect(mockCreateObjectURL).toHaveBeenCalled();
      });
    });

    it('should handle Excel export', async () => {
      render(<AnalyticsDashboard />);

      await waitFor(() => {
        const excelButton = screen.getByText('[ Excel ]');
        fireEvent.click(excelButton);

        // Should trigger download
        expect(global.fetch).toHaveBeenCalledWith('/api/analytics/export?format=excel');
      });
    });

    it('should handle CSV export', async () => {
      render(<AnalyticsDashboard />);

      await waitFor(() => {
        const csvButton = screen.getByText('[ CSV ]');
        fireEvent.click(csvButton);

        expect(global.fetch).toHaveBeenCalledWith('/api/analytics/export?format=csv');
      });
    });
  });

  describe('Loading and Error States', () => {
    it('should show loading state while fetching data', () => {
      const loadingPromise = new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            ok: true,
            json: async () => ({ success: true, data: mockAnalyticsData }),
            blob: async () => new Blob(),
          });
        }, 100);
      });
      (global.fetch as jest.Mock).mockImplementation(() => loadingPromise);

      render(<AnalyticsDashboard />);

      expect(screen.getByText('एनालिटिक्स डेटा लोड हो रहा है...')).toBeInTheDocument();
    });

    it('should handle API errors gracefully in Hindi', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      render(<AnalyticsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('एनालिटिक्स डेटा लोड करने में त्रुटि')).toBeInTheDocument();
      });
    });

    it('should show retry button on error', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      render(<AnalyticsDashboard />);

      await waitFor(() => {
        const retryButton = screen.getByText('पुनः प्रयास करें');
        expect(retryButton).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility - WCAG 2.1 AA', () => {
    it('should have proper heading structure', async () => {
      render(<AnalyticsDashboard />);

      await waitFor(() => {
        const headings = screen.getAllByRole('heading');
        expect(headings.length).toBeGreaterThan(5); // At least one for each module

        // Check heading levels
        const h2Headings = screen.getAllByRole('heading', { level: 2 });
        expect(h2Headings.some(h => h.textContent?.includes('इवेंट प्रकार विश्लेषण'))).toBe(true);
      });
    });

    it('should have descriptive alt text for charts', async () => {
      render(<AnalyticsDashboard />);

      await waitFor(() => {
        // Charts should expose accessible labels for screen readers
        const charts = screen.getAllByRole('img', { hidden: true });
        charts.forEach((chart) => {
          expect(chart).toHaveAttribute('aria-label');
        });
      });
    });

    it('should support keyboard navigation', async () => {
      render(<AnalyticsDashboard />);

      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        buttons.forEach((button) => {
          expect(button.tabIndex).toBeGreaterThanOrEqual(0);
        });
      });
    });
  });
});
