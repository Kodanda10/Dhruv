/**
 * CMS Configuration API Endpoint
 * Handles GET (fetch all config) and POST (update config)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db/pool';
import { validateAdminSession } from '@/lib/auth/server';
import { sanitizeInput } from '@/lib/utils/security';

export const dynamic = 'force-dynamic';

interface TitleUpdateRequest {
  key: string;
  value_hi: string;
  value_en?: string;
  section: string;
}

// GET: Fetch all CMS configuration
export async function GET(request: NextRequest) {
  try {
    // Verify admin authentication
    const session = validateAdminSession(request);
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const pool = getDbPool();

    // Fetch titles
    const titlesResult = await pool.query(`
      SELECT id, key, value_hi, value_en, section, updated_at, updated_by, created_at
      FROM cms_titles
      ORDER BY section, key
    `);

    // Fetch modules
    const modulesResult = await pool.query(`
      SELECT id, module_key, module_name_hi, module_name_en, enabled, display_order, updated_at, updated_by, created_at
      FROM analytics_modules
      ORDER BY display_order
    `);

    // Fetch system config
    const configResult = await pool.query(`
      SELECT id, config_key, config_value, description, updated_at, updated_by, created_at
      FROM system_config
      ORDER BY config_key
    `);

    return NextResponse.json({
      success: true,
      data: {
        titles: titlesResult.rows,
        modules: modulesResult.rows,
        config: configResult.rows,
      },
    });
  } catch (error) {
    console.error('CMS Config GET error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch CMS configuration',
      },
      { status: 500 }
    );
  }
}

// POST: Update CMS configuration (titles, modules, or config)
export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const session = validateAdminSession(request);
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { type, data } = body;

    if (!type || !data) {
      return NextResponse.json(
        { success: false, error: 'Missing type or data' },
        { status: 400 }
      );
    }

    const pool = getDbPool();
    const username = session.username || 'admin';

    // Sanitize inputs to prevent XSS
    const sanitizeTitle = (text: string) => sanitizeInput(text, { maxLength: 1000, allowHtml: false });

    if (type === 'title') {
      const { key, value_hi, value_en, section } = data as TitleUpdateRequest;
      
      if (!key || !value_hi || !section) {
        return NextResponse.json(
          { success: false, error: 'Missing required fields' },
          { status: 400 }
        );
      }

      // Sanitize inputs
      const sanitizedKey = sanitizeInput(key, { maxLength: 255, allowHtml: false });
      const sanitizedValueHi = sanitizeTitle(value_hi);
      const sanitizedValueEn = value_en ? sanitizeTitle(value_en) : null;
      const sanitizedSection = sanitizeInput(section, { maxLength: 100, allowHtml: false });

      // Upsert title
      const result = await pool.query(`
        INSERT INTO cms_titles (key, value_hi, value_en, section, updated_by)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (key) 
        DO UPDATE SET 
          value_hi = EXCLUDED.value_hi,
          value_en = EXCLUDED.value_en,
          section = EXCLUDED.section,
          updated_by = EXCLUDED.updated_by,
          updated_at = CURRENT_TIMESTAMP
        RETURNING id, key, value_hi, value_en, section, updated_at, updated_by, created_at
      `, [sanitizedKey, sanitizedValueHi, sanitizedValueEn, sanitizedSection, username]);

      return NextResponse.json({
        success: true,
        data: result.rows[0],
      });
    }

    if (type === 'module') {
      const { module_key, enabled } = data;
      
      if (!module_key || typeof enabled !== 'boolean') {
        return NextResponse.json(
          { success: false, error: 'Missing required fields' },
          { status: 400 }
        );
      }

      const sanitizedKey = sanitizeInput(module_key, { maxLength: 100, allowHtml: false });

      const result = await pool.query(`
        UPDATE analytics_modules
        SET enabled = $1, updated_by = $2, updated_at = CURRENT_TIMESTAMP
        WHERE module_key = $3
        RETURNING id, module_key, module_name_hi, module_name_en, enabled, display_order, updated_at, updated_by, created_at
      `, [enabled, username, sanitizedKey]);

      if (result.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Module not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: result.rows[0],
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid type' },
      { status: 400 }
    );
  } catch (error) {
    console.error('CMS Config POST error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update CMS configuration',
      },
      { status: 500 }
    );
  }
}


