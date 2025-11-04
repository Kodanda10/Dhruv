import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { api } from '@/lib/api';

// Mock fetch globally
// @ts-expect-error - Jest mock type compatibility
global.fetch = jest.fn();

describe('api', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset environment variable
    delete process.env.NEXT_PUBLIC_API_BASE;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('api.get', () => {
    it('should make GET request successfully', async () => {
      const mockData = { id: 1, name: 'Test' };
      // @ts-expect-error - Jest mock type compatibility
      const mockJson = jest.fn().mockResolvedValue(mockData);
      // @ts-expect-error - Jest mock type compatibility
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: mockJson
      });

      const result = await api.get<typeof mockData>('/test');

      expect(global.fetch).toHaveBeenCalledWith(
        '/test',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          })
        })
      );
      expect(mockJson).toHaveBeenCalled();
      expect(result).toEqual(mockData);
    });

    // Note: API_BASE is evaluated at module load time, so we can't test dynamic env var changes.
    // This test verifies the default behavior (empty API_BASE uses path as-is).
    it('should use path directly when API_BASE is empty', async () => {
      const mockData = { data: 'test' };
      // @ts-expect-error - Jest mock type compatibility
      const mockJson = jest.fn().mockResolvedValue(mockData);
      // @ts-expect-error - Jest mock type compatibility
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: mockJson
      });

      await api.get('/test');

      expect(global.fetch).toHaveBeenCalledWith(
        '/test',
        expect.any(Object)
      );
    });

    it('should throw error when response is not ok', async () => {
      // @ts-expect-error - Jest mock type compatibility
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404
      });

      await expect(api.get('/test')).rejects.toThrow('GET /test failed: 404');
    });

    it('should handle custom headers', async () => {
      const mockData = { data: 'test' };
      // @ts-expect-error - Jest mock type compatibility
      const mockJson = jest.fn().mockResolvedValue(mockData);
      // @ts-expect-error - Jest mock type compatibility
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: mockJson
      });

      await api.get('/test', {
        headers: { 'Authorization': 'Bearer token' }
      });

      expect(global.fetch).toHaveBeenCalledWith(
        '/test',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer token'
          })
        })
      );
    });
  });

  describe('api.put', () => {
    it('should make PUT request successfully', async () => {
      const mockData = { id: 1, updated: true };
      const requestBody = { name: 'Updated' };
      // @ts-expect-error - Jest mock type compatibility
      const mockJson = jest.fn().mockResolvedValue(mockData);
      // @ts-expect-error - Jest mock type compatibility
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: mockJson
      });

      const result = await api.put<typeof mockData>('/test/1', requestBody);

      expect(global.fetch).toHaveBeenCalledWith(
        '/test/1',
        expect.objectContaining({
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        })
      );
      expect(result).toEqual(mockData);
    });

    // Note: API_BASE is evaluated at module load time, so we can't test dynamic env var changes.
    // This test verifies the default behavior (empty API_BASE uses path as-is).
    it('should use path directly when API_BASE is empty', async () => {
      const mockData = { data: 'test' };
      // @ts-expect-error - Jest mock type compatibility
      const mockJson = jest.fn().mockResolvedValue(mockData);
      // @ts-expect-error - Jest mock type compatibility
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: mockJson
      });

      await api.put('/test', { data: 'value' });

      expect(global.fetch).toHaveBeenCalledWith(
        '/test',
        expect.any(Object)
      );
    });

    it('should throw error when response is not ok', async () => {
      // @ts-expect-error - Jest mock type compatibility
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 400
      });

      await expect(api.put('/test', { data: 'value' })).rejects.toThrow('PUT /test failed: 400');
    });

    it('should stringify request body', async () => {
      const mockData = { success: true };
      const complexBody = { nested: { data: [1, 2, 3] } };
      // @ts-expect-error - Jest mock type compatibility
      const mockJson = jest.fn().mockResolvedValue(mockData);
      // @ts-expect-error - Jest mock type compatibility
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: mockJson
      });

      await api.put('/test', complexBody);

      expect(global.fetch).toHaveBeenCalledWith(
        '/test',
        expect.objectContaining({
          body: JSON.stringify(complexBody)
        })
      );
    });
  });

  describe('api.post', () => {
    it('should make POST request successfully with body', async () => {
      const mockData = { id: 1, created: true };
      const requestBody = { name: 'New Item' };
      // @ts-expect-error - Jest mock type compatibility
      const mockJson = jest.fn().mockResolvedValue(mockData);
      // @ts-expect-error - Jest mock type compatibility
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: mockJson
      });

      const result = await api.post<typeof mockData>('/test', requestBody);

      expect(global.fetch).toHaveBeenCalledWith(
        '/test',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        })
      );
      expect(result).toEqual(mockData);
    });

    it('should make POST request without body', async () => {
      const mockData = { success: true };
      // @ts-expect-error - Jest mock type compatibility
      const mockJson = jest.fn().mockResolvedValue(mockData);
      // @ts-expect-error - Jest mock type compatibility
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: mockJson
      });

      const result = await api.post('/test');

      expect(global.fetch).toHaveBeenCalledWith(
        '/test',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: undefined
        })
      );
      expect(result).toEqual(mockData);
    });

    // Note: API_BASE is evaluated at module load time, so we can't test dynamic env var changes.
    // This test verifies the default behavior (empty API_BASE uses path as-is).
    it('should use path directly when API_BASE is empty', async () => {
      const mockData = { data: 'test' };
      // @ts-expect-error - Jest mock type compatibility
      const mockJson = jest.fn().mockResolvedValue(mockData);
      // @ts-expect-error - Jest mock type compatibility
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: mockJson
      });

      await api.post('/test', { data: 'value' });

      expect(global.fetch).toHaveBeenCalledWith(
        '/test',
        expect.any(Object)
      );
    });

    it('should throw error when response is not ok', async () => {
      // @ts-expect-error - Jest mock type compatibility
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500
      });

      await expect(api.post('/test', { data: 'value' })).rejects.toThrow('POST /test failed: 500');
    });

    it('should handle null body', async () => {
      const mockData = { success: true };
      // @ts-expect-error - Jest mock type compatibility
      const mockJson = jest.fn().mockResolvedValue(mockData);
      // @ts-expect-error - Jest mock type compatibility
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: mockJson
      });

      await api.post('/test', null);

      // null body is converted to undefined in the implementation (body ? JSON.stringify(body) : undefined)
      expect(global.fetch).toHaveBeenCalledWith(
        '/test',
        expect.objectContaining({
          body: undefined
        })
      );
    });
  });
});

