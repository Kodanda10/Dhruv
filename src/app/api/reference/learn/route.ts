import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'dhruv_db',
  user: process.env.DB_USER || 'dhruv_user',
  password: process.env.DB_PASSWORD || 'dhruv_pass',
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      entity_type,  // 'scheme', 'event_type', 'hashtag', 'organization'
      value_hi,
      value_en,
      aliases,
      source_tweet_id,
      approved_by = 'human'
    } = body;
    
    // Insert into user_contributed_data
    const insertResult = await pool.query(
      `INSERT INTO user_contributed_data 
       (entity_type, value_hi, value_en, aliases, source_tweet_id, approved_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [entity_type, value_hi, value_en, aliases || [], source_tweet_id, approved_by]
    );
    
    const contributionId = insertResult.rows[0].id;
    
    // Check if this value has been contributed 3+ times
    const countResult = await pool.query(
      `SELECT COUNT(*) as count FROM user_contributed_data
       WHERE entity_type = $1 AND value_hi = $2 AND approval_status = 'approved'`,
      [entity_type, value_hi]
    );
    
    const usageCount = parseInt(countResult.rows[0].count);
    
    // Auto-promote to reference table if 3+ uses
    if (usageCount >= 3) {
      if (entity_type === 'scheme') {
        await pool.query(
          `INSERT INTO ref_schemes 
           (scheme_code, name_hi, name_en, category, ministry, usage_count)
           VALUES ($1, $2, $3, 'user_contributed', 'Various', $4)
           ON CONFLICT (scheme_code) DO UPDATE SET usage_count = ref_schemes.usage_count + 1`,
          [value_hi.replace(/\s/g, '_').toUpperCase(), value_hi, value_en || value_hi, usageCount]
        );
      } else if (entity_type === 'event_type') {
        await pool.query(
          `INSERT INTO ref_event_types 
           (event_code, name_hi, name_en, aliases_hi, aliases_en, category, usage_count)
           VALUES ($1, $2, $3, $4, $5, 'user_contributed', $6)
           ON CONFLICT (event_code) DO UPDATE SET usage_count = ref_event_types.usage_count + 1`,
          [value_hi.replace(/\s/g, '_').toUpperCase(), value_hi, value_en || value_hi, 
           aliases || [], [], usageCount]
        );
      }
    }
    
    return NextResponse.json({
      success: true,
      contribution_id: contributionId,
      usage_count: usageCount,
      promoted: usageCount >= 3
    });
    
  } catch (error) {
    console.error('Learning API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save contribution' },
      { status: 500 }
    );
  }
}

// GET endpoint for suggestions
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type'); // 'scheme', 'event_type', etc.
  const query = searchParams.get('q') || '';
  
  try {
    let results = [];
    
    if (type === 'scheme') {
      const dbResult = await pool.query(
        `SELECT name_hi, name_en, category, usage_count 
         FROM ref_schemes
         WHERE is_active = true 
         AND (name_hi ILIKE $1 OR name_en ILIKE $1)
         ORDER BY usage_count DESC, name_hi
         LIMIT 10`,
        [`%${query}%`]
      );
      results = dbResult.rows;
    } else if (type === 'event_type') {
      const dbResult = await pool.query(
        `SELECT name_hi, name_en, category, usage_count 
         FROM ref_event_types
         WHERE is_active = true 
         AND (name_hi ILIKE $1 OR name_en ILIKE $1 OR $1 = ANY(aliases_hi))
         ORDER BY usage_count DESC, name_hi
         LIMIT 10`,
        [`%${query}%`]
      );
      results = dbResult.rows;
    }
    
    return NextResponse.json({
      success: true,
      suggestions: results
    });
    
  } catch (error) {
    console.error('Suggestions API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch suggestions' },
      { status: 500 }
    );
  }
}
