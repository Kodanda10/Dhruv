import { NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db/pool';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  const pool = getDbPool();
  try {
    const query = `
      SELECT 
        id, 
        name_hindi, 
        name_english, 
        description_hindi, 
        description_english, 
        category
      FROM event_types
      ORDER BY name_english;
    `;
    const result = await pool.query(query);
    return NextResponse.json(result.rows);
  } catch (error: any) {
    console.error('API Error fetching event types catalog:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch event types catalog.' }, { status: 500 });
  }
}
