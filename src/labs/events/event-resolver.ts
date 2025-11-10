import pool from '@/lib/db';

export interface EventTypeSuggestion {
  id: string;
  name_hindi: string;
  name_english: string;
  description_hindi?: string;
  description_english?: string;
  category?: string;
  score: number; // Similarity score
}

export async function suggestEventTypes(parsedEventType: string, tweetText: string): Promise<EventTypeSuggestion[]> {
  try {
    // Basic search for now, will be enhanced with fuzzy matching and scoring later
    // For now, we'll just search based on parsedEventType
    const query = `
      SELECT 
        id, 
        name_hindi, 
        name_english, 
        description_hindi, 
        description_english, 
        category
      FROM event_types
      WHERE name_hindi ILIKE $1 OR name_english ILIKE $1
      LIMIT 5;
    `;
    const values = [`%${parsedEventType}%`];
    const result = await pool.query(query, values);

    // For now, assign a dummy score. Real scoring will be implemented later.
    return result.rows.map(row => ({
      ...row,
      score: 1.0, // Placeholder score
    }));
  } catch (error) {
    console.error('Error suggesting event types:', error);
    throw new Error('Failed to suggest event types.');
  }
}