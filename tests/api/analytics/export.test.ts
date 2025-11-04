/**
 * TDD Tests for Analytics Export API
 *
 * Hindi Dashboard: Export functionality for PDF, Excel, CSV formats
 * Security: Input validation, rate limiting, file size limits
 * Performance: Efficient data streaming, memory management
 */

import { NextRequest } from 'next/server';
import { Pool } from 'pg';

// Mock Next.js server
jest.mock('next/server', () => ({
  NextRequest: class MockNextRequest {
    url: string;
    constructor(input: string | URL, init?: RequestInit) {
      this.url = typeof input === 'string' ? input : input.toString();
    }
  },
  NextResponse: {
    json: (data: any, init?: ResponseInit) => ({
      status: init?.status || 200,
      json: async () => data,
    }),
  },
}));

// Mock pg Pool
jest.mock('pg', () => ({
  Pool: jest.fn(),
}));

// Mock ExcelJS for Excel export
jest.mock('exceljs', () => ({
  Workbook: jest.fn(() => ({
    addWorksheet: jest.fn(() => ({
      addRow: jest.fn(),
      getCell: jest.fn(() => ({ value: 'test' })),
    })),
    xlsx: {
      writeBuffer: jest.fn(() => Buffer.from('excel-data')),
    },
  })),
}));

// Mock jsPDF for PDF export
jest.mock('jspdf', () => {
  return jest.fn(() => ({
    addPage: jest.fn(),
    text: jest.fn(),
    save: jest.fn(),
    output: jest.fn(() => 'pdf-data'),
  }));
});

// Import after mocks
import { GET as exportGet } from '../../../src/app/api/analytics/export/route';

describe('GET /api/analytics/export - Analytics Export API', () => {
  let mockPool: any;
  let mockQuery: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockQuery = jest.fn();
    mockPool = {
      query: mockQuery,
    };
    (Pool as unknown as jest.Mock).mockImplementation(() => mockPool);
  });

  afterEach(() => {
    jest.resetModules();
  });

  describe('CSV Export Format', () => {
    it('should export analytics data in CSV format', async () => {
      const mockData = [
        {
          id: '1',
          tweet_id: '123',
          event_type: 'meeting',
          event_type_hi: 'बैठक',
          locations: ['रायगढ़'],
          people_mentioned: ['मुख्यमंत्री'],
          schemes_mentioned: ['योजना'],
          created_at: '2025-11-01T10:00:00Z'
        }
      ];

      mockQuery.mockResolvedValue({ rows: mockData });

      const request = new NextRequest('http://localhost:3000/api/analytics/export?format=csv');
      const response = await exportGet(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/csv; charset=utf-8');
      expect(response.headers.get('Content-Disposition')).toContain('analytics-report.csv');

      // Verify CSV headers in Hindi
      const csvContent = await response.text();
      expect(csvContent).toContain('ट्वीट ID');
      expect(csvContent).toContain('घटना प्रकार');
      expect(csvContent).toContain('स्थान');
      expect(csvContent).toContain('उल्लिखित व्यक्ति');
      expect(csvContent).toContain('योजनाएं');
    });

    it('should handle CSV export with date filters', async () => {
      const mockData = [
        {
          id: '1',
          tweet_id: '123',
          event_type: 'meeting',
          locations: ['रायगढ़'],
          created_at: '2025-11-01T10:00:00Z'
        }
      ];

      mockQuery.mockResolvedValue({ rows: mockData });

      const request = new NextRequest(
        'http://localhost:3000/api/analytics/export?format=csv&start_date=2025-11-01&end_date=2025-11-30'
      );
      const response = await exportGet(request);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE pe.created_at >= $1 AND pe.created_at <= $2'),
        expect.arrayContaining(['2025-11-01T00:00:00.000Z', '2025-11-30T23:59:59.999Z'])
      );
    });
  });

  describe('Excel Export Format', () => {
    it('should export analytics data in Excel format', async () => {
      const mockData = [
        {
          id: '1',
          tweet_id: '123',
          event_type: 'rally',
          event_type_hi: 'रैली',
          locations: ['रायगढ़', 'रायपुर'],
          people_mentioned: ['मुख्यमंत्री'],
          schemes_mentioned: ['पीएमएवाई'],
          created_at: '2025-11-01T10:00:00Z'
        }
      ];

      mockQuery.mockResolvedValue({ rows: mockData });

      const request = new NextRequest('http://localhost:3000/api/analytics/export?format=excel');
      const response = await exportGet(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      expect(response.headers.get('Content-Disposition')).toContain('analytics-report.xlsx');
    });

    it('should create multiple worksheets for different data types', async () => {
      const mockData = [
        {
          id: '1',
          tweet_id: '123',
          event_type: 'meeting',
          locations: ['रायगढ़'],
          created_at: '2025-11-01T10:00:00Z'
        }
      ];

      mockQuery.mockResolvedValue({ rows: mockData });

      const request = new NextRequest('http://localhost:3000/api/analytics/export?format=excel');
      await exportGet(request);

      // Verify ExcelJS workbook creation with multiple sheets
      const ExcelJS = require('exceljs');
      expect(ExcelJS.Workbook).toHaveBeenCalled();
      const mockWorkbook = (ExcelJS.Workbook as jest.Mock).mock.results[0].value;

      // Should create summary and detailed sheets
      expect(mockWorkbook.addWorksheet).toHaveBeenCalledWith('सारांश');
      expect(mockWorkbook.addWorksheet).toHaveBeenCalledWith('विस्तृत डेटा');
    });
  });

  describe('PDF Export Format', () => {
    it('should export analytics summary in PDF format', async () => {
      const mockAnalyticsData = {
        total_tweets: 150,
        event_distribution: { 'बैठक': 45, 'दौरा': 30 },
        location_distribution: { 'रायगढ़': 50, 'छत्तीसगढ़': 35 },
        timeline: [{ date: '2025-11-01', count: 10 }]
      };

      mockQuery.mockResolvedValueOnce({ rows: [] }); // No detailed data
      mockQuery.mockResolvedValueOnce({ rows: [] }); // No summary data

      const request = new NextRequest('http://localhost:3000/api/analytics/export?format=pdf');
      const response = await exportGet(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('application/pdf');
      expect(response.headers.get('Content-Disposition')).toContain('analytics-report.pdf');
    });

    it('should include Hindi text and charts in PDF', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const request = new NextRequest('http://localhost:3000/api/analytics/export?format=pdf');
      await exportGet(request);

      const jsPDF = require('jspdf');
      const mockDoc = (jsPDF as jest.Mock).mock.results[0].value;

      // Should contain Hindi text
      expect(mockDoc.text).toHaveBeenCalledWith(
        expect.stringContaining('सोशल मीडिया एनालिटिक्स रिपोर्ट'),
        expect.any(Number),
        expect.any(Number)
      );
    });
  });

  describe('Input Validation and Security', () => {
    it('should reject invalid format parameter', async () => {
      const request = new NextRequest('http://localhost:3000/api/analytics/export?format=invalid');
      const response = await exportGet(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('अमान्य निर्यात प्रारूप');
    });

    it('should validate date format parameters', async () => {
      const request = new NextRequest('http://localhost:3000/api/analytics/export?format=csv&start_date=invalid-date');
      const response = await exportGet(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('अमान्य दिनांक प्रारूप');
    });

    it('should handle SQL injection attempts in location filter', async () => {
      const maliciousLocation = "'; DROP TABLE users; --";
      const request = new NextRequest(
        `http://localhost:3000/api/analytics/export?format=csv&location=${encodeURIComponent(maliciousLocation)}`
      );
      const response = await exportGet(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('अमान्य स्थान पैरामीटर');
    });

    it('should prevent path traversal in filename', async () => {
      const request = new NextRequest('http://localhost:3000/api/analytics/export?format=csv&filename=../../../etc/passwd');
      const response = await exportGet(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('अमान्य फ़ाइल नाम');
    });
  });

  describe('Performance and Resource Management', () => {
    it('should limit export to reasonable data size', async () => {
      // Mock large dataset
      const largeData = Array(10000).fill({
        id: '1',
        tweet_id: '123',
        event_type: 'meeting',
        locations: ['रायगढ़'],
        created_at: '2025-11-01T10:00:00Z'
      });

      mockQuery.mockResolvedValue({ rows: largeData });

      const request = new NextRequest('http://localhost:3000/api/analytics/export?format=csv&limit=1000');
      const response = await exportGet(request);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT 1000'),
        expect.any(Array)
      );
    });

    it('should implement streaming for large CSV exports', async () => {
      const mockData = Array(1000).fill({
        id: '1',
        tweet_id: '123',
        event_type: 'meeting',
        locations: ['रायगढ़'],
        created_at: '2025-11-01T10:00:00Z'
      });

      mockQuery.mockResolvedValue({ rows: mockData });

      const request = new NextRequest('http://localhost:3000/api/analytics/export?format=csv');
      const response = await exportGet(request);

      expect(response.status).toBe(200);
      // Should handle large datasets without memory issues
    });

    it('should timeout long-running exports', async () => {
      mockQuery.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ rows: [] }), 35000))
      );

      const request = new NextRequest('http://localhost:3000/api/analytics/export?format=csv');
      const response = await exportGet(request);

      expect(response.status).toBe(408);
      const data = await response.json();
      expect(data.error).toBe('निर्यात समय समाप्त');
    });
  });

  describe('Database Query Optimization', () => {
    it('should use efficient queries with proper indexing hints', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const request = new NextRequest('http://localhost:3000/api/analytics/export?format=csv');
      await exportGet(request);

      const queryCall = mockQuery.mock.calls[0];
      const query = queryCall[0];

      // Should use JOIN efficiently
      expect(query).toContain('LEFT JOIN raw_tweets rt ON pe.tweet_id = rt.tweet_id');
      // Should select only needed columns
      expect(query).toContain('pe.id, pe.tweet_id, pe.event_type');
    });

    it('should apply filters in correct order for query optimization', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const request = new NextRequest(
        'http://localhost:3000/api/analytics/export?format=csv&event_type=meeting&location=रायगढ़'
      );
      await exportGet(request);

      const queryCall = mockQuery.mock.calls[0];
      const query = queryCall[0];

      // Should apply WHERE clauses efficiently
      expect(query).toContain('WHERE');
      expect(query).toContain('event_type =');
      expect(query).toContain('locations @>');
    });
  });

  describe('Audit Logging', () => {
    it('should log all export operations', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      mockQuery.mockResolvedValue({ rows: [] });

      const request = new NextRequest('http://localhost:3000/api/analytics/export?format=csv');
      await exportGet(request);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Analytics export:',
        expect.objectContaining({
          format: 'csv',
          userAgent: expect.any(String),
          timestamp: expect.any(String)
        })
      );

      consoleSpy.mockRestore();
    });

    it('should log export size and performance metrics', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      const mockData = Array(500).fill({
        id: '1',
        tweet_id: '123',
        event_type: 'meeting',
        locations: ['रायगढ़'],
        created_at: '2025-11-01T10:00:00Z'
      });

      mockQuery.mockResolvedValue({ rows: mockData });

      const request = new NextRequest('http://localhost:3000/api/analytics/export?format=excel');
      await exportGet(request);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Analytics export completed:',
        expect.objectContaining({
          format: 'excel',
          recordCount: 500,
          duration: expect.any(Number)
        })
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle database connection errors gracefully', async () => {
      mockQuery.mockRejectedValue(new Error('Connection lost'));

      const request = new NextRequest('http://localhost:3000/api/analytics/export?format=csv');
      const response = await exportGet(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('डेटाबेस कनेक्शन त्रुटि');
    });

    it('should handle Excel generation errors', async () => {
      const ExcelJS = require('exceljs');
      const mockWorkbook = (ExcelJS.Workbook as jest.Mock).mock.results[0].value;
      mockWorkbook.xlsx.writeBuffer.mockRejectedValue(new Error('Excel generation failed'));

      mockQuery.mockResolvedValue({ rows: [] });

      const request = new NextRequest('http://localhost:3000/api/analytics/export?format=excel');
      const response = await exportGet(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Excel निर्यात त्रुटि');
    });

    it('should handle PDF generation errors', async () => {
      const jsPDF = require('jspdf');
      const mockDoc = (jsPDF as jest.Mock).mock.results[0].value;
      mockDoc.output.mockImplementation(() => {
        throw new Error('PDF generation failed');
      });

      mockQuery.mockResolvedValue({ rows: [] });

      const request = new NextRequest('http://localhost:3000/api/analytics/export?format=pdf');
      const response = await exportGet(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('PDF निर्यात त्रुटि');
    });
  });
});
