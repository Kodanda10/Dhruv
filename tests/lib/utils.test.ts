import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { cn, formatDate, truncateText, debounce, groupBy, sortBy, percentage, downloadJSON, downloadCSV } from '@/lib/utils';

describe('utils', () => {
  describe('cn', () => {
    it('should merge class names', () => {
      expect(cn('class1', 'class2')).toBe('class1 class2');
    });

    it('should handle conditional classes', () => {
      expect(cn('class1', false && 'class2', true && 'class3')).toBe('class1 class3');
    });

    it('should merge Tailwind classes with proper precedence', () => {
      expect(cn('p-2', 'p-4')).toBe('p-4'); // Later class should override
    });

    it('should handle empty inputs', () => {
      expect(cn()).toBe('');
      expect(cn('', null, undefined)).toBe('');
    });

    it('should handle arrays', () => {
      expect(cn(['class1', 'class2'])).toBe('class1 class2');
    });
  });

  describe('formatDate', () => {
    it('should format date in Hindi by default', () => {
      const date = new Date('2024-01-15');
      const formatted = formatDate(date);
      
      expect(formatted).toContain('15');
      expect(formatted).toContain('जनवरी');
      expect(formatted).toContain('2024');
    });

    it('should format date in Hindi when locale is hi', () => {
      const date = new Date('2024-03-20');
      const formatted = formatDate(date, 'hi');
      
      expect(formatted).toContain('20');
      expect(formatted).toContain('मार्च');
    });

    it('should format date in English when locale is en', () => {
      const date = new Date('2024-01-15');
      const formatted = formatDate(date, 'en');
      
      expect(formatted).toMatch(/15.*Jan.*2024/);
    });

    it('should handle string dates', () => {
      const formatted = formatDate('2024-05-10', 'hi');
      
      expect(formatted).toContain('10');
      expect(formatted).toContain('मई');
    });

    it('should handle all Hindi months', () => {
      const months = ['जनवरी', 'फरवरी', 'मार्च', 'अप्रैल', 'मई', 'जून', 
                     'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर'];
      
      months.forEach((month, index) => {
        const date = new Date(2024, index, 15);
        const formatted = formatDate(date, 'hi');
        expect(formatted).toContain(month);
      });
    });
  });

  describe('truncateText', () => {
    it('should return text as-is if shorter than maxLength', () => {
      expect(truncateText('Short text', 100)).toBe('Short text');
    });

    it('should truncate text longer than maxLength', () => {
      const longText = 'a'.repeat(150);
      const truncated = truncateText(longText, 100);
      
      expect(truncated.length).toBe(103); // 100 + '...'
      expect(truncated.endsWith('...')).toBe(true);
    });

    it('should use default maxLength of 100', () => {
      const longText = 'a'.repeat(150);
      const truncated = truncateText(longText);
      
      expect(truncated.length).toBe(103);
    });

    it('should handle exact length text', () => {
      const text = 'a'.repeat(100);
      expect(truncateText(text, 100)).toBe(text);
    });

    it('should handle empty string', () => {
      expect(truncateText('', 100)).toBe('');
    });
  });

  describe('debounce', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should delay function execution', () => {
      const mockFn = jest.fn();
      const debouncedFn = debounce(mockFn, 100);

      debouncedFn();
      expect(mockFn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(100);
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should cancel previous call if called again before delay', () => {
      const mockFn = jest.fn();
      const debouncedFn = debounce(mockFn, 100);

      debouncedFn();
      jest.advanceTimersByTime(50);
      debouncedFn();
      jest.advanceTimersByTime(50);
      
      expect(mockFn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(50);
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should pass arguments to function', () => {
      const mockFn = jest.fn();
      const debouncedFn = debounce(mockFn, 100);

      debouncedFn('arg1', 'arg2');
      jest.advanceTimersByTime(100);

      expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2');
    });
  });

  describe('groupBy', () => {
    it('should group array by key', () => {
      const array = [
        { category: 'A', value: 1 },
        { category: 'B', value: 2 },
        { category: 'A', value: 3 }
      ];
      
      const grouped = groupBy(array, 'category');
      
      expect(grouped['A']).toHaveLength(2);
      expect(grouped['B']).toHaveLength(1);
      expect(grouped['A'][0].value).toBe(1);
      expect(grouped['A'][1].value).toBe(3);
    });

    it('should handle empty array', () => {
      expect(groupBy([], 'category' as any)).toEqual({});
    });

    it('should handle single item', () => {
      const array = [{ category: 'A', value: 1 }];
      const grouped = groupBy(array, 'category');
      expect(grouped['A']).toHaveLength(1);
    });
  });

  describe('sortBy', () => {
    it('should sort by single key ascending', () => {
      const array = [
        { name: 'Charlie', age: 30 },
        { name: 'Alice', age: 25 },
        { name: 'Bob', age: 30 }
      ];
      
      const sorted = sortBy(array, 'name');
      
      expect(sorted[0].name).toBe('Alice');
      expect(sorted[1].name).toBe('Bob');
      expect(sorted[2].name).toBe('Charlie');
    });

    it('should sort by single key descending', () => {
      const array = [
        { name: 'Alice', age: 25 },
        { name: 'Bob', age: 30 },
        { name: 'Charlie', age: 30 }
      ];
      
      const sorted = sortBy(array, '-name');
      
      expect(sorted[0].name).toBe('Charlie');
      expect(sorted[1].name).toBe('Bob');
      expect(sorted[2].name).toBe('Alice');
    });

    it('should sort by multiple keys', () => {
      const array = [
        { name: 'Bob', age: 30 },
        { name: 'Alice', age: 25 },
        { name: 'Charlie', age: 30 }
      ];
      
      const sorted = sortBy(array, 'age', 'name');
      
      expect(sorted[0].name).toBe('Alice');
      expect(sorted[1].name).toBe('Bob');
      expect(sorted[2].name).toBe('Charlie');
    });

    it('should not modify original array', () => {
      const array = [{ name: 'B' }, { name: 'A' }];
      const sorted = sortBy(array, 'name');
      
      expect(array[0].name).toBe('B');
      expect(sorted[0].name).toBe('A');
    });
  });

  describe('percentage', () => {
    it('should calculate percentage', () => {
      expect(percentage(25, 100)).toBe(25);
      expect(percentage(50, 200)).toBe(25);
      expect(percentage(1, 3)).toBe(33);
    });

    it('should handle zero total', () => {
      expect(percentage(10, 0)).toBe(0);
    });

    it('should handle decimal places', () => {
      expect(percentage(1, 3, 2)).toBe(33.33);
      expect(percentage(1, 3, 4)).toBe(33.3333);
    });

    it('should handle zero value', () => {
      expect(percentage(0, 100)).toBe(0);
    });

    it('should handle negative numbers', () => {
      expect(percentage(-10, 100)).toBe(-10);
    });
  });

  describe('downloadJSON', () => {
    beforeEach(() => {
      // Mock DOM APIs
      global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
      global.URL.revokeObjectURL = jest.fn();
      global.document.createElement = jest.fn(() => ({
        href: '',
        download: '',
        click: jest.fn()
      } as any));
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should create JSON blob and trigger download', () => {
      const data = { test: 'value' };
      downloadJSON(data, 'test.json');
      
      expect(global.URL.createObjectURL).toHaveBeenCalled();
      expect(global.document.createElement).toHaveBeenCalledWith('a');
    });
  });

  describe('downloadCSV', () => {
    beforeEach(() => {
      global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
      global.URL.revokeObjectURL = jest.fn();
      global.document.createElement = jest.fn(() => ({
        href: '',
        download: '',
        click: jest.fn()
      } as any));
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should create CSV from array of objects', () => {
      const data = [
        { name: 'Alice', age: 25 },
        { name: 'Bob', age: 30 }
      ];
      
      downloadCSV(data, 'test.csv');
      
      expect(global.URL.createObjectURL).toHaveBeenCalled();
      expect(global.document.createElement).toHaveBeenCalledWith('a');
    });

    it('should handle empty array', () => {
      downloadCSV([], 'test.csv');
      
      expect(global.URL.createObjectURL).not.toHaveBeenCalled();
    });

    it('should escape commas in values', () => {
      const data = [{ name: 'Alice, Smith', age: 25 }];
      downloadCSV(data, 'test.csv');
      
      expect(global.URL.createObjectURL).toHaveBeenCalled();
    });

    it('should escape quotes in values', () => {
      const data = [{ name: 'Alice "Smith"', age: 25 }];
      downloadCSV(data, 'test.csv');
      
      expect(global.URL.createObjectURL).toHaveBeenCalled();
    });

    it('should handle values with both commas and quotes', () => {
      const data = [{ name: 'Alice, "Smith"', age: 25 }];
      downloadCSV(data, 'test.csv');
      
      expect(global.URL.createObjectURL).toHaveBeenCalled();
    });

    it('should handle non-string values', () => {
      const data = [
        { name: 'Alice', age: 25, active: true },
        { name: 'Bob', age: 30, active: false }
      ];
      downloadCSV(data, 'test.csv');
      
      expect(global.URL.createObjectURL).toHaveBeenCalled();
    });

    it('should handle array with single object', () => {
      const data = [{ name: 'Alice', age: 25 }];
      downloadCSV(data, 'test.csv');
      
      expect(global.URL.createObjectURL).toHaveBeenCalled();
      expect(global.document.createElement).toHaveBeenCalledWith('a');
    });
  });

  describe('downloadJSON edge cases', () => {
    it('should handle null data', () => {
      downloadJSON(null, 'null.json');
      expect(global.URL.createObjectURL).toHaveBeenCalled();
    });

    it('should handle array data', () => {
      downloadJSON([1, 2, 3], 'array.json');
      expect(global.URL.createObjectURL).toHaveBeenCalled();
    });

    it('should handle nested objects', () => {
      downloadJSON({ nested: { deep: { value: 'test' } } }, 'nested.json');
      expect(global.URL.createObjectURL).toHaveBeenCalled();
    });
  });
});

