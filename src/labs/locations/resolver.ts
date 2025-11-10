import pool from '@/lib/db';

export interface LocationSuggestion {
  id: string;
  name_hindi: string;
  name_english: string;
  type: string;
  state: string;
  district?: string;
  block?: string;
  score: number; // Similarity score
}

export async function resolveLocation(parsedLocation: string): Promise<LocationSuggestion[]> {
  try {
    // Basic search for now, will be enhanced with fuzzy matching and scoring later
    const query = `
      SELECT 
        id, 
        name_hindi, 
        name_english, 
        type, 
        state, 
        district, 
        block
      FROM locations
      WHERE name_hindi ILIKE $1 OR name_english ILIKE $1
      LIMIT 5;
    `;
    const values = [`%${parsedLocation}%`];
    const result = await pool.query(query, values);

    // For now, assign a dummy score. Real scoring will be implemented later.
    return result.rows.map(row => ({
      ...row,
      score: 1.0, // Placeholder score
    }));
  } catch (error) {
    console.error('Error resolving location:', error);
    throw new Error('Failed to resolve location suggestions.');
  }
}