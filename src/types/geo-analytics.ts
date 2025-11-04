export interface GeoAnalyticsFilters {
  start_date: string | null;
  end_date: string | null;
  event_type: string | null;
}

export interface GeoHierarchyMindmapProps {
  data?: any;
  filters?: GeoAnalyticsFilters;
  onFilterChange?: (filters: GeoAnalyticsFilters) => void;
  className?: string;
  height?: number;
  width?: number;
}
