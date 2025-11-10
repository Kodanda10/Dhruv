import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(request: Request) {
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
