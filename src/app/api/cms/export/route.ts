/**
 * CMS Config Export API Endpoint
 * Phase 7.7: Config Export/Import
 * Exports all CMS configuration as JSON
 */

import { NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db/pool';
import { validateAdminSession } from '@/lib/auth/server';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

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

    // Fetch all config
    const titlesResult = await pool.query('SELECT * FROM cms_titles ORDER BY section, key');
    const modulesResult = await pool.query('SELECT * FROM analytics_modules ORDER BY display_order');
    const configResult = await pool.query('SELECT * FROM system_config ORDER BY config_key');

    const exportData = {
      titles: titlesResult.rows,
      modules: modulesResult.rows,
      config: configResult.rows,
      exported_at: new Date().toISOString(),
      exported_by: session.username || 'admin',
    };

    return NextResponse.json({
      success: true,
      data: exportData,
    });
  } catch (error) {
    console.error('Config Export API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to export configuration',
      },
      { status: 500 }
    );
  }
}


