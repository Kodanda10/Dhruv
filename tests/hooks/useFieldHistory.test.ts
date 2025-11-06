import { renderHook, act } from '@testing-library/react';
import { useFieldHistory } from '@/hooks/useFieldHistory';

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('useFieldHistory', () => {
  beforeEach(() => {
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
  });

  it('should initialize with empty history when no localStorage data', () => {
    localStorageMock.getItem.mockReturnValue(null);
    
    const { result } = renderHook(() => useFieldHistory('test_field'));
    
    expect(result.current.history).toEqual([]);
  });

  it('should load existing history from localStorage', () => {
    const mockHistory = ['value1', 'value2', 'value3'];
    localStorageMock.getItem.mockReturnValue(JSON.stringify(mockHistory));
    
    const { result } = renderHook(() => useFieldHistory('test_field'));
    
    expect(result.current.history).toEqual(mockHistory);
    expect(localStorageMock.getItem).toHaveBeenCalledWith('review_history_test_field');
  });

  it('should add new value to history and update localStorage', () => {
    localStorageMock.getItem.mockReturnValue(null);
    
    const { result } = renderHook(() => useFieldHistory('test_field'));
    
    act(() => {
      result.current.addToHistory('new_value');
    });
    
    expect(result.current.history).toEqual(['new_value']);
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'review_history_test_field',
      JSON.stringify(['new_value'])
    );
  });

  it('should not add empty values to history', () => {
    localStorageMock.getItem.mockReturnValue(null);
    
    const { result } = renderHook(() => useFieldHistory('test_field'));
    
    act(() => {
      result.current.addToHistory('');
      result.current.addToHistory('   ');
    });
    
    expect(result.current.history).toEqual([]);
    expect(localStorageMock.setItem).not.toHaveBeenCalled();
  });

  it('should move existing value to front when adding duplicate', () => {
    const mockHistory = ['value1', 'value2', 'value3'];
    localStorageMock.getItem.mockReturnValue(JSON.stringify(mockHistory));
    
    const { result } = renderHook(() => useFieldHistory('test_field'));
    
    act(() => {
      result.current.addToHistory('value2');
    });
    
    expect(result.current.history).toEqual(['value2', 'value1', 'value3']);
  });

  it('should limit history to 10 items', () => {
    const mockHistory = Array.from({ length: 10 }, (_, i) => `value${i}`);
    localStorageMock.getItem.mockReturnValue(JSON.stringify(mockHistory));
    
    const { result } = renderHook(() => useFieldHistory('test_field'));
    
    act(() => {
      result.current.addToHistory('new_value');
    });
    
    expect(result.current.history).toHaveLength(10);
    expect(result.current.history[0]).toBe('new_value');
  });

  it('should filter history based on query', () => {
    const mockHistory = ['apple', 'banana', 'grape', 'orange'];
    localStorageMock.getItem.mockReturnValue(JSON.stringify(mockHistory));
    
    const { result } = renderHook(() => useFieldHistory('test_field'));
    
    const filtered = result.current.getFilteredHistory('ap');
    expect(filtered).toEqual(['apple', 'grape']);
  });

  it('should return all history when query is empty', () => {
    const mockHistory = ['apple', 'banana'];
    localStorageMock.getItem.mockReturnValue(JSON.stringify(mockHistory));
    
    const { result } = renderHook(() => useFieldHistory('test_field'));
    
    const filtered = result.current.getFilteredHistory('');
    expect(filtered).toEqual(mockHistory);
  });

  it('should handle localStorage errors gracefully', () => {
    localStorageMock.getItem.mockImplementation(() => {
      throw new Error('localStorage error');
    });
    
    const { result } = renderHook(() => useFieldHistory('test_field'));
    
    expect(result.current.history).toEqual([]);
  });
});
