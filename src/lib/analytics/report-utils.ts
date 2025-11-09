import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { formatHindiDate } from '@/utils/parse';
import type { AnalyticsData } from './data-source';

type EntryLike = Record<string, number>;

function entriesArray(record: EntryLike): [string, number][] {
  return Object.entries(record || {});
}

export function generateCsvReport(data: AnalyticsData): string {
  const rows: string[][] = [['section', 'metric', 'value']];

  const pushEntries = (section: string, entries: [string, number][]) => {
    entries.forEach(([key, value]) => rows.push([section, key, String(value)]));
  };

  pushEntries('event_distribution', entriesArray(data.event_distribution));
  pushEntries('location_distribution', entriesArray(data.location_distribution));
  pushEntries('scheme_usage', entriesArray(data.scheme_usage));
  pushEntries('target_groups', entriesArray(data.target_groups));
  pushEntries('thematic_analysis', entriesArray(data.thematic_analysis));

  data.timeline.forEach((item) => {
    rows.push(['timeline', formatHindiDate(item.date), String(item.count)]);
  });

  data.raigarh_section.local_events.forEach((event) => {
    rows.push([
      'raigarh_events',
      `${event.date} - ${event.location}`,
      `${event.type}: ${event.description}`,
    ]);
  });

  rows.push(['raigarh_coverage', 'percentage', String(data.raigarh_section.coverage_percentage)]);
  rows.push(['raigarh_engagement', 'likes', String(data.raigarh_section.engagement_metrics.total_likes)]);
  rows.push(['raigarh_engagement', 'retweets', String(data.raigarh_section.engagement_metrics.total_retweets)]);
  rows.push(['raigarh_engagement', 'replies', String(data.raigarh_section.engagement_metrics.total_replies)]);
  rows.push(['summary', 'total_tweets', String(data.total_tweets)]);

  const escape = (value: string) => {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };

  return rows.map((row) => row.map(escape).join(',')).join('\n');
}

export async function generateExcelReport(data: AnalyticsData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Project Dhruv';
  workbook.created = new Date();

  const summary = workbook.addWorksheet('Summary');
  summary.columns = [
    { header: 'मेट्रिक', key: 'metric', width: 40 },
    { header: 'मान', key: 'value', width: 30 },
  ];
  summary.addRow({ metric: 'कुल ट्वीट', value: data.total_tweets });
  summary.addRow({ metric: 'रायगढ़ कवरेज %', value: `${data.raigarh_section.coverage_percentage}%` });
  summary.addRow({
    metric: 'रायगढ़ कुल एंगेजमेंट',
    value:
      data.raigarh_section.engagement_metrics.total_likes +
      data.raigarh_section.engagement_metrics.total_retweets +
      data.raigarh_section.engagement_metrics.total_replies,
  });

  const addSheetFromEntries = (title: string, entries: [string, number][]) => {
    const sheet = workbook.addWorksheet(title);
    sheet.columns = [
      { header: 'शीर्षक', key: 'key', width: 40 },
      { header: 'मान', key: 'value', width: 20 },
    ];
    entries.forEach(([key, value]) => sheet.addRow({ key, value }));
  };

  addSheetFromEntries('इवेंट प्रकार', entriesArray(data.event_distribution));
  addSheetFromEntries('स्थान', entriesArray(data.location_distribution));
  addSheetFromEntries('योजनाएँ', entriesArray(data.scheme_usage));
  addSheetFromEntries('वर्ग', entriesArray(data.target_groups));
  addSheetFromEntries('विषय', entriesArray(data.thematic_analysis));

  const timelineSheet = workbook.addWorksheet('Timeline');
  timelineSheet.columns = [
    { header: 'दिनांक', key: 'date', width: 20 },
    { header: 'संख्या', key: 'count', width: 15 },
  ];
  data.timeline.forEach((item) => {
    timelineSheet.addRow({ date: formatHindiDate(item.date), count: item.count });
  });

  const raigarhSheet = workbook.addWorksheet('रायगढ़ कार्यक्रम');
  raigarhSheet.columns = [
    { header: 'दिनांक', key: 'date', width: 20 },
    { header: 'स्थान', key: 'location', width: 30 },
    { header: 'प्रकार', key: 'type', width: 20 },
    { header: 'विवरण', key: 'description', width: 80 },
  ];
  data.raigarh_section.local_events.forEach((event) => {
    raigarhSheet.addRow({
      date: formatHindiDate(event.date),
      location: event.location,
      type: event.type,
      description: event.description,
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export async function generatePdfReport(data: AnalyticsData): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(18).text('सोशल मीडिया एनालिटिक्स रिपोर्ट', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`कुल ट्वीट: ${data.total_tweets.toLocaleString()}`);
    doc.text(`रायगढ़ कवरेज: ${data.raigarh_section.coverage_percentage}%`);
    doc.text(
      `एंगेजमेंट (लाइक/रीट्वीट/रिप्लाई): ${data.raigarh_section.engagement_metrics.total_likes.toLocaleString()} / ${data.raigarh_section.engagement_metrics.total_retweets.toLocaleString()} / ${data.raigarh_section.engagement_metrics.total_replies.toLocaleString()}`,
    );

    const addSection = (title: string, entries: [string, number][]) => {
      if (!entries.length) return;
      doc.moveDown();
      doc.fontSize(14).text(title);
      doc.moveDown(0.2);
      doc.fontSize(10);
      entries.slice(0, 15).forEach(([key, value]) => doc.text(`${key}: ${value}`));
    };

    addSection('इवेंट प्रकार', entriesArray(data.event_distribution));
    addSection('स्थान', entriesArray(data.location_distribution));
    addSection('योजनाएँ', entriesArray(data.scheme_usage));
    addSection('समाज आधारित पहुँच', entriesArray(data.caste_community));
    addSection('वर्ग आधारित विश्लेषण', entriesArray(data.target_groups));
    addSection('विषयगत विश्लेषण', entriesArray(data.thematic_analysis));

    if (data.timeline.length) {
      doc.moveDown();
      doc.fontSize(14).text('टाइमलाइन स्नैपशॉट');
      doc.fontSize(10);
      data.timeline.slice(-10).forEach((item) => {
        doc.text(`${formatHindiDate(item.date)} — ${item.count}`);
      });
    }

    if (data.raigarh_section.local_events.length) {
      doc.moveDown();
      doc.fontSize(14).text('रायगढ़ कार्यक्रम');
      doc.fontSize(10);
      data.raigarh_section.local_events.slice(0, 8).forEach((event) => {
        doc.text(`${formatHindiDate(event.date)} | ${event.location} | ${event.type}`);
        doc.text(event.description, { indent: 12 });
      });
    }

    doc.end();
  });
}
