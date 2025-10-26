import { useState, useMemo } from 'react';

export type SortField = 'date' | 'location' | 'event_type' | 'tags' | 'content';
export type SortOrder = 'asc' | 'desc';

export interface SortConfig {
  field: SortField | null;
  order: SortOrder;
}

export function useSortableTable<T>(data: T[], getFieldValue: (item: T, field: SortField) => any) {
  const [sortConfig, setSortConfig] = useState<SortConfig>({ field: null, order: 'asc' });

  const sortedData = useMemo(() => {
    if (!sortConfig.field) return data;

    return [...data].sort((a, b) => {
      const aValue = getFieldValue(a, sortConfig.field!);
      const bValue = getFieldValue(b, sortConfig.field!);

      if (aValue < bValue) {
        return sortConfig.order === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.order === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }, [data, sortConfig, getFieldValue]);

  const handleSort = (field: SortField) => {
    setSortConfig(prev => ({
      field,
      order: prev.field === field && prev.order === 'asc' ? 'desc' : 'asc'
    }));
  };

  const getSortIcon = (field: SortField) => {
    if (sortConfig.field !== field) return '';
    return sortConfig.order === 'asc' ? '↑' : '↓';
  };

  return {
    sortedData,
    sortConfig,
    handleSort,
    getSortIcon
  };
}
