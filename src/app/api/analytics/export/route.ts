import { Buffer } from 'node:buffer';
import { fetchAnalyticsData } from '@/lib/analytics/data-source';
import { generateCsvReport, generateExcelReport, generatePdfReport } from '@/lib/analytics/report-utils';

// Force dynamic rendering to avoid static generation issues
export const dynamic = 'force-dynamic';

const asUint8Array = (buffer: Buffer) => new Uint8Array(buffer);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const format = (searchParams.get('format') || 'json').toLowerCase();
    const startDate = searchParams.get('start_date') ?? undefined;
    const endDate = searchParams.get('end_date') ?? undefined;
    const location = searchParams.get('location') ?? undefined;

    const data = await fetchAnalyticsData({ startDate, endDate, location });

    switch (format) {
      case 'json':
        return new Response(
          JSON.stringify({
            success: true,
            data,
            format: 'json',
          }),
          {
            headers: { 'content-type': 'application/json' },
          },
        );
      case 'csv': {
        const csv = generateCsvReport(data);
        return new Response(csv, {
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': 'attachment; filename="analytics-report.csv"',
          },
        });
      }
      case 'excel': {
        const buffer = await generateExcelReport(data);
        return new Response(asUint8Array(buffer), {
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': 'attachment; filename="analytics-report.xlsx"',
          },
        });
      }
      case 'pdf': {
        const buffer = await generatePdfReport(data);
        return new Response(asUint8Array(buffer), {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': 'attachment; filename="analytics-report.pdf"',
          },
        });
      }
      default: {
        return new Response(
          JSON.stringify({
            success: false,
            error: `Unsupported export format: ${format}`,
          }),
          {
            status: 400,
            headers: { 'content-type': 'application/json' },
          },
        );
      }
    }
  } catch (error) {
    console.error('Export API error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to export analytics data',
      }),
      {
        status: 500,
        headers: { 'content-type': 'application/json' },
      },
    );
  }
}
