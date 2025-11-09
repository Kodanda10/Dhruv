jest.mock('exceljs');
jest.mock('pdfkit');

import { generateCsvReport, generateExcelReport, generatePdfReport } from '@/lib/analytics/report-utils';
import { sampleAnalyticsData } from './sample-data';

function bufferToString(buffer: Buffer) {
  return buffer.toString('utf-8');
}

describe('analytics report utils', () => {
  it('generates CSV with expected headers and sections', () => {
    const csv = generateCsvReport(sampleAnalyticsData);
    expect(csv).toContain('section,metric,value');
    expect(csv).toContain('event_distribution,विकास कार्य,485');
    expect(csv).toContain('raigarh_coverage,percentage,36');
  });

  it('generates non-empty Excel workbook', async () => {
    const buffer = await generateExcelReport(sampleAnalyticsData);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('generates PDF starting with %PDF header', async () => {
    const buffer = await generatePdfReport(sampleAnalyticsData);
    expect(buffer.slice(0, 4).toString()).toBe('%PDF');
  });
});
