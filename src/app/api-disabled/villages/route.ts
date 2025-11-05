import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), 'data', 'processed_villages.json');
    const data = fs.readFileSync(filePath, 'utf-8');
    const villages = JSON.parse(data);
    return NextResponse.json(villages);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to load data' }, { status: 500 });
  }
}
