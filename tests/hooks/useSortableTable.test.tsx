import { describe, it, expect } from '@jest/globals';
import { renderHook, act } from '@testing-library/react';
import { useSortableTable, type SortField } from '@/hooks/useSortableTable';

interface TestItem {
  id: number;
  name: string;
  date: string;
  value: number;
}

describe('useSortableTable', () => {
  const mockData: TestItem[] = [
    { id: 1, name: 'Charlie', date: '2024-03-01', value: 30 },
    { id: 2, name: 'Alice', date: '2024-01-15', value: 25 },
    { id: 3, name: 'Bob', date: '2024-02-20', value: 30 },
  ];

  const getFieldValue = (item: TestItem, field: SortField): string | number => {
    if (field === 'date') return item.date;
    if (field === 'name') return item.name;
    if (field === 'value') return item.value;
    if (field === 'location' || field === 'event_type' || field === 'tags' || field === 'content') {
      return (item as any)[field] || item.name;
    }
    return item.name;
  };

  it('should return unsorted data when no sort field is set', () => {
    const { result } = renderHook(() =>
      useSortableTable(mockData, getFieldValue)
    );

    expect(result.current.sortedData).toEqual(mockData);
    expect(result.current.sortConfig.field).toBeNull();
  });

  it('should sort data ascending by field', () => {
    const { result } = renderHook(() =>
      useSortableTable(mockData, getFieldValue)
    );

    act(() => {
      result.current.handleSort('name');
    });

    expect(result.current.sortedData[0].name).toBe('Alice');
    expect(result.current.sortedData[1].name).toBe('Bob');
    expect(result.current.sortedData[2].name).toBe('Charlie');
    expect(result.current.sortConfig.field).toBe('name');
    expect(result.current.sortConfig.order).toBe('asc');
  });

  it('should sort data descending when same field is clicked again', () => {
    const { result } = renderHook(() =>
      useSortableTable(mockData, getFieldValue)
    );

    act(() => {
      result.current.handleSort('name');
    });

    expect(result.current.sortConfig.order).toBe('asc');

    act(() => {
      result.current.handleSort('name');
    });

    expect(result.current.sortedData[0].name).toBe('Charlie');
    expect(result.current.sortedData[1].name).toBe('Bob');
    expect(result.current.sortedData[2].name).toBe('Alice');
    expect(result.current.sortConfig.order).toBe('desc');
  });

  it('should reset to asc when different field is clicked', () => {
    const { result } = renderHook(() =>
      useSortableTable(mockData, getFieldValue)
    );

    act(() => {
      result.current.handleSort('name');
    });

    expect(result.current.sortConfig.field).toBe('name');
    expect(result.current.sortConfig.order).toBe('asc');

    act(() => {
      result.current.handleSort('date');
    });

    expect(result.current.sortConfig.field).toBe('date');
    expect(result.current.sortConfig.order).toBe('asc');
  });

  it('should sort by date correctly', () => {
    const { result } = renderHook(() =>
      useSortableTable(mockData, getFieldValue)
    );

    act(() => {
      result.current.handleSort('date');
    });

    expect(result.current.sortedData[0].date).toBe('2024-01-15');
    expect(result.current.sortedData[1].date).toBe('2024-02-20');
    expect(result.current.sortedData[2].date).toBe('2024-03-01');
  });

  it('should handle equal values', () => {
    const dataWithEqualValues = [
      { id: 1, name: 'Alice', date: '2024-01-15', value: 25 },
      { id: 2, name: 'Bob', date: '2024-01-15', value: 25 },
    ];

    const { result } = renderHook(() =>
      useSortableTable(dataWithEqualValues, getFieldValue)
    );

    act(() => {
      result.current.handleSort('value');
    });

    expect(result.current.sortedData.length).toBe(2);
  });

  it('should return empty string for getSortIcon when field is not sorted', () => {
    const { result } = renderHook(() =>
      useSortableTable(mockData, getFieldValue)
    );

    expect(result.current.getSortIcon('name')).toBe('');
  });

  it('should return up arrow for ascending sort', () => {
    const { result } = renderHook(() =>
      useSortableTable(mockData, getFieldValue)
    );

    act(() => {
      result.current.handleSort('name');
    });

    expect(result.current.getSortIcon('name')).toBe('↑');
  });

  it('should return down arrow for descending sort', () => {
    const { result } = renderHook(() =>
      useSortableTable(mockData, getFieldValue)
    );

    act(() => {
      result.current.handleSort('name');
    });

    act(() => {
      result.current.handleSort('name');
    });

    expect(result.current.getSortIcon('name')).toBe('↓');
  });

  it('should handle empty data array', () => {
    const { result } = renderHook(() =>
      useSortableTable([], getFieldValue)
    );

    expect(result.current.sortedData).toEqual([]);
  });

  it('should handle single item array', () => {
    const singleItem = [{ id: 1, name: 'Alice', date: '2024-01-15', value: 25 }];

    const { result } = renderHook(() =>
      useSortableTable(singleItem, getFieldValue)
    );

    act(() => {
      result.current.handleSort('name');
    });

    expect(result.current.sortedData.length).toBe(1);
    expect(result.current.sortedData[0].name).toBe('Alice');
  });

  it('should update sorted data when input data changes', () => {
    const { result, rerender } = renderHook(
      ({ data }) => useSortableTable(data, getFieldValue),
      { initialProps: { data: mockData } }
    );

    act(() => {
      result.current.handleSort('name');
    });

    expect(result.current.sortedData.length).toBe(3);

    const newData = [{ id: 4, name: 'David', date: '2024-04-01', value: 35 }];
    rerender({ data: newData });

    expect(result.current.sortedData.length).toBe(1);
    expect(result.current.sortedData[0].name).toBe('David');
  });

  it('should maintain sort config when data changes', () => {
    const { result, rerender } = renderHook(
      ({ data }) => useSortableTable(data, getFieldValue),
      { initialProps: { data: mockData } }
    );

    act(() => {
      result.current.handleSort('name');
    });

    expect(result.current.sortConfig.field).toBe('name');

    rerender({ data: [...mockData, { id: 4, name: 'David', date: '2024-04-01', value: 35 }] });

    expect(result.current.sortConfig.field).toBe('name');
  });

  it('should handle numeric sorting', () => {
    const { result } = renderHook(() =>
      useSortableTable(mockData, (item, field) => {
        if (field === 'date') return item.value;
        return getFieldValue(item, field);
      })
    );

    act(() => {
      result.current.handleSort('date');
    });

    expect(result.current.sortedData[0].value).toBe(25);
    expect(result.current.sortedData[1].value).toBe(30);
    expect(result.current.sortedData[2].value).toBe(30);
  });
});

