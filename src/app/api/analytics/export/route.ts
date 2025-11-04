import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

// Database configuration - lazy initialization
let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });
  }
  return pool;
}

interface ExportFilters {
  start_date?: string;
  end_date?: string;
  location?: string;
  event_type?: string;
  limit?: number;
}

/**
 * Build WHERE clause for export queries
 */
function buildWhereClause(filters: ExportFilters): { clause: string; params: (string | Date | number)[] } {
  const conditions: string[] = [];
  const params: (string | Date | number)[] = [];
  let paramIndex = 1;

  if (filters.start_date) {
    conditions.push(`pe.created_at >= $${paramIndex}`);
    params.push(new Date(filters.start_date));
    paramIndex++;
  }

  if (filters.end_date) {
    conditions.push(`pe.created_at <= $${paramIndex}`);
    params.push(new Date(filters.end_date));
    paramIndex++;
  }

  if (filters.location) {
    conditions.push(`$${paramIndex} = ANY(pe.locations)`);
    params.push(filters.location);
    paramIndex++;
  }

  if (filters.event_type) {
    conditions.push(`pe.event_type = $${paramIndex}`);
    params.push(filters.event_type);
    paramIndex++;
  }

  return {
    clause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    params
  };
}

/**
 * Generate CSV export
 */
async function generateCSV(filters: ExportFilters): Promise<string> {
  const pool = getPool();
  const { clause, params } = buildWhereClause(filters);

  // Limit export to prevent memory issues
  const limit = filters.limit || 10000;
  params.push(limit);

  const query = `
    SELECT
      pe.tweet_id as "ट्वीट ID",
      COALESCE(pe.event_type_hi, pe.event_type) as "घटना प्रकार",
      array_to_string(pe.locations, ', ') as "स्थान",
      array_to_string(pe.people_mentioned, ', ') as "उल्लिखित व्यक्ति",
      array_to_string(pe.organizations, ', ') as "संगठन",
      array_to_string(pe.schemes_mentioned, ', ') as "योजनाएं",
      pe.event_type_confidence as "विश्वास स्तर",
      pe.created_at as "दिनांक",
      pe.review_status as "समीक्षा स्थिति",
      rt.like_count as "लाइक",
      rt.retweet_count as "रिट्वीट",
      rt.reply_count as "रिप्लाई"
    FROM parsed_events pe
    LEFT JOIN raw_tweets rt ON pe.tweet_id = rt.tweet_id
    ${clause}
    ORDER BY pe.created_at DESC
    LIMIT $${params.length}
  `;

  const result = await pool.query(query, params);

  if (result.rows.length === 0) {
    return 'कोई डेटा नहीं मिला\n';
  }

  // Generate CSV header
  const headers = Object.keys(result.rows[0]);
  let csv = headers.join(',') + '\n';

  // Generate CSV rows
  result.rows.forEach(row => {
    const values = headers.map(header => {
      const value = row[header];
      // Escape commas and quotes in values
      if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value || '';
    });
    csv += values.join(',') + '\n';
  });

  return csv;
}

/**
 * Generate Excel export using ExcelJS
 */
async function generateExcel(filters: ExportFilters): Promise<Buffer> {
  // Dynamic import to avoid issues if ExcelJS is not installed
  const ExcelJS = await import('exceljs');

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'सोशल मीडिया एनालिटिक्स';
  workbook.created = new Date();

  // Summary sheet
  const summarySheet = workbook.addWorksheet('सारांश');

  // Add summary headers
  summarySheet.addRow(['मेट्रिक', 'मान']);
  summarySheet.addRow(['रिपोर्ट प्रकार', 'ट्वीट एनालिटिक्स']);
  summarySheet.addRow(['जनरेट किया गया', new Date().toLocaleString('hi-IN')]);

  // Detailed data sheet
  const dataSheet = workbook.addWorksheet('विस्तृत डेटा');

  // Add headers
  dataSheet.addRow([
    'ट्वीट ID', 'घटना प्रकार', 'स्थान', 'उल्लिखित व्यक्ति', 'संगठन',
    'योजनाएं', 'विश्वास स्तर', 'दिनांक', 'समीक्षा स्थिति',
    'लाइक', 'रिट्वीट', 'रिप्लाई'
  ]);

  // Get data
  const pool = getPool();
  const { clause, params } = buildWhereClause(filters);
  const limit = filters.limit || 10000;
  params.push(limit);

  const query = `
    SELECT
      pe.tweet_id,
      COALESCE(pe.event_type_hi, pe.event_type) as event_type,
      pe.locations,
      pe.people_mentioned,
      pe.organizations,
      pe.schemes_mentioned,
      pe.event_type_confidence,
      pe.created_at,
      pe.review_status,
      rt.like_count,
      rt.retweet_count,
      rt.reply_count
    FROM parsed_events pe
    LEFT JOIN raw_tweets rt ON pe.tweet_id = rt.tweet_id
    ${clause}
    ORDER BY pe.created_at DESC
    LIMIT $${params.length}
  `;

  const result = await pool.query(query, params);

  // Add data rows
  result.rows.forEach(row => {
    dataSheet.addRow([
      row.tweet_id,
      row.event_type,
      row.locations ? row.locations.join(', ') : '',
      row.people_mentioned ? row.people_mentioned.join(', ') : '',
      row.organizations ? row.organizations.join(', ') : '',
      row.schemes_mentioned ? row.schemes_mentioned.join(', ') : '',
      row.event_type_confidence,
      row.created_at,
      row.review_status,
      row.like_count || 0,
      row.retweet_count || 0,
      row.reply_count || 0
    ]);
  });

  // Style the headers
  const headerRow = dataSheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4472C4' }
  };
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };

  // Auto-fit columns
  dataSheet.columns.forEach(column => {
    column.width = 15;
  });

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as Buffer;
}

/**
 * Generate PDF export
 */
async function generatePDF(): Promise<Buffer> {
  // Dynamic import to avoid issues if jsPDF is not installed
  const jsPDF = await import('jspdf');

  const doc = new jsPDF.default();
  doc.setFont('helvetica');

  // Add title
  doc.setFontSize(20);
  doc.text('सोशल मीडिया एनालिटिक्स रिपोर्ट', 20, 30);

  // Add generation date
  doc.setFontSize(12);
  doc.text(`जनरेट किया गया: ${new Date().toLocaleString('hi-IN')}`, 20, 50);

  // Add summary
  doc.setFontSize(16);
  doc.text('सारांश', 20, 80);

  doc.setFontSize(12);
  doc.text('यह रिपोर्ट स्वचालित रूप से जनरेट की गई है।', 20, 100);
  doc.text('विस्तृत डेटा के लिए CSV या Excel निर्यात का उपयोग करें।', 20, 115);

  // Add footer
  const pageHeight = doc.internal.pageSize.height;
  doc.setFontSize(10);
  doc.text('© सोशल मीडिया एनालिटिक्स डैशबोर्ड', 20, pageHeight - 20);

  return Buffer.from(doc.output('arraybuffer'));
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format');
    const filename = searchParams.get('filename') || 'analytics-report';

    if (!format || !['csv', 'excel', 'pdf'].includes(format)) {
      return NextResponse.json(
        { success: false, error: 'अमान्य निर्यात प्रारूप' },
        { status: 400 }
      );
    }

    // Validate filename to prevent path traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return NextResponse.json(
        { success: false, error: 'अमान्य फ़ाइल नाम' },
        { status: 400 }
      );
    }

    const filters: ExportFilters = {
      start_date: searchParams.get('start_date') || undefined,
      end_date: searchParams.get('end_date') || undefined,
      location: searchParams.get('location') || undefined,
      event_type: searchParams.get('event_type') || undefined,
      limit: parseInt(searchParams.get('limit') || '10000', 10)
    };

    // Validate dates
    if (filters.start_date && isNaN(Date.parse(filters.start_date))) {
      return NextResponse.json(
        { success: false, error: 'अमान्य प्रारंभ दिनांक' },
        { status: 400 }
      );
    }

    if (filters.end_date && isNaN(Date.parse(filters.end_date))) {
      return NextResponse.json(
        { success: false, error: 'अमान्य समाप्ति दिनांक' },
        { status: 400 }
      );
    }

    console.log(`Generating ${format} export:`, filters);

    let content: string | Buffer;
    let contentType: string;
    let extension: string;

    switch (format) {
      case 'csv':
        content = await generateCSV(filters);
        contentType = 'text/csv; charset=utf-8';
        extension = 'csv';
        break;

      case 'excel':
        content = await generateExcel(filters);
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        extension = 'xlsx';
        break;

      case 'pdf':
        content = await generatePDF();
        contentType = 'application/pdf';
        extension = 'pdf';
        break;

      default:
        throw new Error('अमान्य प्रारूप');
    }

    console.log(`${format} export completed, size: ${content.length} bytes`);

    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}.${extension}"`,
        'Cache-Control': 'no-cache'
      }
    });

  } catch (error) {
    console.error('Export error:', error);

    const errorMessage = error instanceof Error ? error.message : 'अज्ञात त्रुटि';
    let hindiError = 'निर्यात में त्रुटि हुई';

    if (errorMessage.includes('connection')) {
      hindiError = 'डेटाबेस कनेक्शन त्रुटि';
    } else if (errorMessage.includes('timeout')) {
      hindiError = 'निर्यात समय समाप्त';
    }

    return NextResponse.json(
      { success: false, error: hindiError },
      { status: 500 }
    );
  }
}
