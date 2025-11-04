import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import GeoHierarchyEditor from '@/components/review/GeoHierarchyEditor';
import { GeoHierarchy } from '@/lib/geo-extraction/hierarchy-resolver';

// Mock data for testing
const mockGeoHierarchy: GeoHierarchy = {
  village: 'रायपुर',
  gram_panchayat: 'रायपुर',
  block: 'रायपुर',
  assembly: 'रायपुर शहर उत्तर',
  district: 'रायपुर',
  is_urban: false,
  confidence: 0.95
};

const mockUrbanHierarchy: GeoHierarchy = {
  village: 'रायपुर वार्ड 5',
  block: 'रायपुर',
  assembly: 'रायपुर शहर उत्तर',
  district: 'रायपुर',
  is_urban: true,
  ulb: 'रायपुर नगर निगम',
  ward_no: 5,
  confidence: 0.98
};

const mockCandidates: GeoHierarchy[] = [
  {
    village: 'बिलासपुर',
    gram_panchayat: 'बिलासपुर',
    block: 'बिलासपुर',
    assembly: 'बिलासपुर शहर',
    district: 'बिलासपुर',
    is_urban: false,
    confidence: 0.92
  },
  {
    village: 'बिलासपुर शहर',
    block: 'बिलासपुर',
    assembly: 'बिलासपुर ग्रामीण',
    district: 'बिलासपुर',
    is_urban: false,
    confidence: 0.85
  },
  mockUrbanHierarchy
];

describe('GeoHierarchyEditor Component', () => {
  const mockOnConfirm = jest.fn();
  const mockOnReject = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should render error state when no candidates', () => {
    render(
      <GeoHierarchyEditor
        locationName="अज्ञात स्थान"
        currentHierarchy={null}
        candidates={[]}
        needs_review={true}
        explanations={[]}
        onConfirm={mockOnConfirm}
        onReject={mockOnReject}
      />
    );

    // @ts-expect-error - @testing-library/jest-dom matcher types
    expect(screen.getByText('No matches found')).toBeInTheDocument();
    // @ts-expect-error - @testing-library/jest-dom matcher types
    expect(screen.getByText(/No geographic matches found for location/)).toBeInTheDocument();
    // @ts-expect-error - @testing-library/jest-dom matcher types
    expect(screen.getByText('Reject Location')).toBeInTheDocument();
  });

  test('should render location name and needs_review badge', () => {
    render(
      <GeoHierarchyEditor
        locationName="बिलासपुर"
        currentHierarchy={null}
        candidates={[mockCandidates[0]]}
        needs_review={true}
        explanations={[]}
        onConfirm={mockOnConfirm}
        onReject={mockOnReject}
      />
    );

    // @ts-expect-error - @testing-library/jest-dom matcher types
    expect(screen.getByText(/Location Review: बिलासपुर/)).toBeInTheDocument();
    // @ts-expect-error - @testing-library/jest-dom matcher types
    expect(screen.getByText('Needs Review')).toBeInTheDocument();
  });

  test('should render explanations when provided', () => {
    const explanations = [
      'Multiple candidates (2) found for location "बिलासपुर" — human confirmation required',
      'Candidates: बिलासपुर (बिलासपुर, बिलासपुर), बिलासपुर शहर (बिलासपुर, बिलासपुर)'
    ];

    render(
      <GeoHierarchyEditor
        locationName="बिलासपुर"
        currentHierarchy={null}
        candidates={mockCandidates}
        needs_review={true}
        explanations={explanations}
        onConfirm={mockOnConfirm}
        onReject={mockOnReject}
      />
    );

    explanations.forEach(explanation => {
      // @ts-expect-error - @testing-library/jest-dom matcher types
      expect(screen.getByText(explanation)).toBeInTheDocument();
    });
  });

  test('should display all candidates with village names', () => {
    render(
      <GeoHierarchyEditor
        locationName="बिलासपुर"
        currentHierarchy={null}
        candidates={mockCandidates}
        needs_review={true}
        explanations={[]}
        onConfirm={mockOnConfirm}
        onReject={mockOnReject}
      />
    );

    // @ts-expect-error - @testing-library/jest-dom matcher types
    expect(screen.getByText('बिलासपुर')).toBeInTheDocument();
    // @ts-expect-error - @testing-library/jest-dom matcher types
    expect(screen.getByText('बिलासपुर शहर')).toBeInTheDocument();
    // @ts-expect-error - @testing-library/jest-dom matcher types
    expect(screen.getByText('रायपुर वार्ड 5')).toBeInTheDocument();
  });

  test('should display confidence scores and labels', () => {
    render(
      <GeoHierarchyEditor
        locationName="बिलासपुर"
        currentHierarchy={null}
        candidates={mockCandidates}
        needs_review={true}
        explanations={[]}
        onConfirm={mockOnConfirm}
        onReject={mockOnReject}
      />
    );

    // @ts-expect-error - @testing-library/jest-dom matcher types
    expect(screen.getByText(/92% — High Confidence/)).toBeInTheDocument();
    // @ts-expect-error - @testing-library/jest-dom matcher types
    expect(screen.getByText(/85% — High Confidence/)).toBeInTheDocument();
    // @ts-expect-error - @testing-library/jest-dom matcher types
    expect(screen.getByText(/98% — Exact Match/)).toBeInTheDocument();
  });

  test('should highlight highest confidence candidate as suggested', () => {
    render(
      <GeoHierarchyEditor
        locationName="बिलासपुर"
        currentHierarchy={null}
        candidates={mockCandidates}
        needs_review={true}
        explanations={[]}
        onConfirm={mockOnConfirm}
        onReject={mockOnReject}
      />
    );

    // The highest confidence candidate (0.98) should have "Suggested" badge
    const suggestedBadges = screen.getAllByText('Suggested');
    expect(suggestedBadges.length).toBeGreaterThan(0);
  });

  test('should toggle expand/collapse on candidate click', async () => {
    render(
      <GeoHierarchyEditor
        locationName="बिलासपुर"
        currentHierarchy={null}
        candidates={[mockCandidates[0]]}
        needs_review={true}
        explanations={[]}
        onConfirm={mockOnConfirm}
        onReject={mockOnReject}
      />
    );

    // Initially collapsed - should show village name and compact path
    // @ts-expect-error - @testing-library/jest-dom matcher types
    expect(screen.getByText('बिलासपुर')).toBeInTheDocument();
    // Compact path may be visible (check for village name which is part of the path)

    // Find and click expand button (ChevronRight icon)
    const expandButton = screen.getByLabelText('Expand');
    fireEvent.click(expandButton);

    // After expanding, should show detailed hierarchy
    await waitFor(() => {
      // @ts-expect-error - @testing-library/jest-dom matcher types
      expect(screen.getByText('स्थान:')).toBeInTheDocument();
      // @ts-expect-error - @testing-library/jest-dom matcher types
      expect(screen.getByText('ब्लॉक:')).toBeInTheDocument();
      // @ts-expect-error - @testing-library/jest-dom matcher types
      expect(screen.getByText('विधानसभा:')).toBeInTheDocument();
      // @ts-expect-error - @testing-library/jest-dom matcher types
      expect(screen.getByText('जिला:')).toBeInTheDocument();
    });

    // Click again to collapse
    const collapseButton = screen.getByLabelText('Collapse');
    fireEvent.click(collapseButton);

    // Should be collapsed again - check for compact path
    await waitFor(() => {
      // When collapsed, detailed hierarchy labels should not be visible
      // @ts-expect-error - @testing-library/jest-dom matcher types
      expect(screen.queryByText('स्थान:')).not.toBeInTheDocument();
      // @ts-expect-error - @testing-library/jest-dom matcher types
      expect(screen.getByText('बिलासपुर')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  test('should display detailed hierarchy when expanded', async () => {
    render(
      <GeoHierarchyEditor
        locationName="रायपुर"
        currentHierarchy={null}
        candidates={[mockUrbanHierarchy]}
        needs_review={true}
        explanations={[]}
        onConfirm={mockOnConfirm}
        onReject={mockOnReject}
      />
    );

    // Expand candidate
    const expandButton = screen.getByLabelText('Expand');
    fireEvent.click(expandButton);

    // Wait for expanded view to appear
    await waitFor(() => {
      // Check for expanded hierarchy details - look for specific labels that only appear when expanded
      // @ts-expect-error - @testing-library/jest-dom matcher types
      expect(screen.getByText('ब्लॉक:')).toBeInTheDocument();
      // @ts-expect-error - @testing-library/jest-dom matcher types
      expect(screen.getByText('विधानसभा:')).toBeInTheDocument();
      // @ts-expect-error - @testing-library/jest-dom matcher types
      expect(screen.getByText('जिला:')).toBeInTheDocument();
    }, { timeout: 2000 });

    // Verify ULB and ward information is visible in expanded view
    // ULB name appears multiple times (in path and expanded view), so use getAllByText
    const ulbElements = screen.getAllByText(/रायपुर नगर निगम/);
    expect(ulbElements.length).toBeGreaterThan(0);
    // Ward info may also appear multiple times, use getAllByText
    const wardElements = screen.getAllByText(/वार्ड 5/);
    expect(wardElements.length).toBeGreaterThan(0);
  });

  test('should call onConfirm with confidence 1.0 when confirm button clicked', async () => {
    render(
      <GeoHierarchyEditor
        locationName="बिलासपुर"
        currentHierarchy={null}
        candidates={[mockCandidates[0]]}
        needs_review={true}
        explanations={[]}
        onConfirm={mockOnConfirm}
        onReject={mockOnReject}
      />
    );

    const confirmButton = screen.getByText('Confirm');
    fireEvent.click(confirmButton);

    expect(mockOnConfirm).toHaveBeenCalledTimes(1);
    expect(mockOnConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        ...mockCandidates[0],
        confidence: 1.0
      })
    );
  });

  test('should disable confirm button after confirmation', async () => {
    render(
      <GeoHierarchyEditor
        locationName="बिलासपुर"
        currentHierarchy={null}
        candidates={[mockCandidates[0]]}
        needs_review={true}
        explanations={[]}
        onConfirm={mockOnConfirm}
        onReject={mockOnReject}
      />
    );

    const confirmButton = screen.getByText('Confirm');
    fireEvent.click(confirmButton);

    // Button should now show "Confirmed" and be disabled
    await waitFor(() => {
      // @ts-expect-error - @testing-library/jest-dom matcher types
      expect(screen.getByText('Confirmed')).toBeInTheDocument();
      const confirmedButton = screen.getByText('Confirmed');
      // @ts-expect-error - @testing-library/jest-dom matcher types
      expect(confirmedButton).toBeDisabled();
    });
  });

  test('should call onReject when reject button clicked', async () => {
    render(
      <GeoHierarchyEditor
        locationName="बिलासपुर"
        currentHierarchy={null}
        candidates={mockCandidates}
        needs_review={true}
        explanations={[]}
        onConfirm={mockOnConfirm}
        onReject={mockOnReject}
      />
    );

    const rejectButton = screen.getByText('Reject All');
    fireEvent.click(rejectButton);

    expect(mockOnReject).toHaveBeenCalledTimes(1);
  });

  test('should display candidate count', () => {
    render(
      <GeoHierarchyEditor
        locationName="बिलासपुर"
        currentHierarchy={null}
        candidates={mockCandidates}
        needs_review={true}
        explanations={[]}
        onConfirm={mockOnConfirm}
        onReject={mockOnReject}
      />
    );

    // @ts-expect-error - @testing-library/jest-dom matcher types
    expect(screen.getByText('3 candidates found')).toBeInTheDocument();
  });

  test('should display current hierarchy if provided', () => {
    render(
      <GeoHierarchyEditor
        locationName="बिलासपुर"
        currentHierarchy={mockGeoHierarchy}
        candidates={mockCandidates}
        needs_review={true}
        explanations={[]}
        onConfirm={mockOnConfirm}
        onReject={mockOnReject}
      />
    );

    // @ts-expect-error - @testing-library/jest-dom matcher types
    expect(screen.getByText('Current hierarchy:')).toBeInTheDocument();
    // @ts-expect-error - @testing-library/jest-dom matcher types
    expect(screen.getByText(/रायपुर → रायपुर शहर उत्तर → रायपुर → रायपुर → रायपुर/)).toBeInTheDocument();
  });

  test('should handle multiple candidates with different confidence levels', () => {
    const mixedCandidates: GeoHierarchy[] = [
      { ...mockCandidates[0], confidence: 0.99 }, // Exact match
      { ...mockCandidates[1], confidence: 0.87 }, // High confidence
      { ...mockCandidates[2], confidence: 0.75 }  // Low confidence
    ];

    render(
      <GeoHierarchyEditor
        locationName="बिलासपुर"
        currentHierarchy={null}
        candidates={mixedCandidates}
        needs_review={true}
        explanations={[]}
        onConfirm={mockOnConfirm}
        onReject={mockOnReject}
      />
    );

    // @ts-expect-error - @testing-library/jest-dom matcher types
    expect(screen.getByText(/99% — Exact Match/)).toBeInTheDocument();
    // @ts-expect-error - @testing-library/jest-dom matcher types
    expect(screen.getByText(/87% — High Confidence/)).toBeInTheDocument();
    // @ts-expect-error - @testing-library/jest-dom matcher types
    expect(screen.getByText(/75% — Low Confidence/)).toBeInTheDocument();
  });

  test('should handle rural location with gram panchayat', async () => {
    const ruralHierarchy: GeoHierarchy = {
      village: 'ग्राम पंचायत गांव',
      gram_panchayat: 'ग्राम पंचायत',
      block: 'ब्लॉक',
      assembly: 'विधानसभा',
      district: 'जिला',
      is_urban: false,
      confidence: 0.9
    };

    render(
      <GeoHierarchyEditor
        locationName="ग्राम पंचायत गांव"
        currentHierarchy={null}
        candidates={[ruralHierarchy]}
        needs_review={true}
        explanations={[]}
        onConfirm={mockOnConfirm}
        onReject={mockOnReject}
      />
    );

    // Expand to see details
    const expandButton = screen.getByLabelText('Expand');
    fireEvent.click(expandButton);

    await waitFor(() => {
      // @ts-expect-error - @testing-library/jest-dom matcher types
      expect(screen.getByText('GP/ULB:')).toBeInTheDocument();
      // @ts-expect-error - @testing-library/jest-dom matcher types
      expect(screen.getByText('ग्राम पंचायत')).toBeInTheDocument();
      // @ts-expect-error - @testing-library/jest-dom matcher types
      expect(screen.getByText(/Type: ग्रामीण \(Rural\)/)).toBeInTheDocument();
    });
  });
});

