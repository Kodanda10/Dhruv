/**
 * TypeScript interfaces for Geo Analytics
 * 
 * These types match the API response structure from:
 * - /api/geo-analytics/summary
 * - /api/geo-analytics/by-district
 * - /api/geo-analytics/by-assembly
 */

/**
 * Single district with event count
 */
export interface DistrictAnalytics {
  district: string;
  event_count: number;
}

/**
 * Single assembly with event count
 */
export interface AssemblyAnalytics {
  district: string;
  assembly: string;
  event_count: number;
}

/**
 * Single block with event count
 */
export interface BlockAnalytics {
  district: string;
  assembly: string;
  block: string;
  event_count: number;
}

/**
 * Top location entry
 */
export interface TopLocation {
  location: string;
  district: string;
  ulb: string | null;
  is_urban: boolean;
  event_count: number;
}

/**
 * Urban vs Rural distribution
 */
export interface UrbanRuralDistribution {
  urban?: number;
  rural?: number;
}

/**
 * Applied filters in API response
 */
export interface GeoAnalyticsFilters {
  start_date: string | null;
  end_date: string | null;
  event_type: string | null;
}

/**
 * Complete response from /api/geo-analytics/summary
 */
export interface GeoAnalyticsSummaryResponse {
  success: boolean;
  data: {
    total_events: number;
    by_district: DistrictAnalytics[];
    by_assembly: AssemblyAnalytics[];
    by_block: BlockAnalytics[];
    urban_rural: UrbanRuralDistribution;
    top_locations: TopLocation[];
    filters: GeoAnalyticsFilters;
  };
  source: string;
  error?: string;
  message?: string;
}

/**
 * Geo Hierarchy Node for Treemap visualization
 * Compatible with recharts Treemap component structure
 */
export interface GeoHierarchyNode {
  name: string;
  value: number; // Event count
  children?: GeoHierarchyNode[];
  // Hierarchy path for breadcrumbs
  path?: string[];
  // Level in hierarchy: 'district' | 'assembly' | 'block' | 'village' | 'ulb'
  level?: 'district' | 'assembly' | 'block' | 'village' | 'ulb';
  // Additional metadata
  district?: string;
  assembly?: string;
  block?: string;
  village?: string;
  ulb?: string;
  is_urban?: boolean;
  // For drilldown state
  expanded?: boolean;
}

/**
 * Drilldown state for navigation
 */
export interface DrilldownState {
  level: 'district' | 'assembly' | 'block' | 'village' | 'ulb';
  selectedPath: string[]; // [district, assembly, block, village/ulb]
  currentData: GeoHierarchyNode[];
}

/**
 * Component props for GeoHierarchyMindmap
 */
export interface GeoHierarchyMindmapProps {
  data?: GeoAnalyticsSummaryResponse['data'];
  filters?: GeoAnalyticsFilters;
  onFilterChange?: (filters: GeoAnalyticsFilters) => void;
  className?: string;
  height?: number;
  width?: number;
}

/**
 * Export data structure for CSV/JSON export
 */
export interface GeoHierarchyExportData {
  hierarchy_path: string;
  event_count: number;
  location_type: 'district' | 'assembly' | 'block' | 'village' | 'ulb';
  district: string;
  assembly?: string;
  block?: string;
  village?: string;
  ulb?: string;
  is_urban?: boolean;
}

