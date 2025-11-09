/**
 * CMS Config Import API Endpoint
 * Phase 7.7: Config Export/Import
 * Imports CMS configuration from JSON with validation and backup
 */

import { NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db/pool';
import { validateAdminSession } from '@/lib/auth/server';
import { NextRequest } from 'next/server';
import { sanitizeInput } from '@/lib/utils/security';

export const dynamic = 'force-dynamic';

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
    const { titles, modules, config } = body;

    if (!titles || !modules || !config) {
      return NextResponse.json(
        { success: false, error: 'Invalid import data structure' },
        { status: 400 }
      );
    }

    const pool = getDbPool();
    const username = session.username || 'admin';

    // Create backup before import
    const backupTitles = await pool.query('SELECT * FROM cms_titles');
    const backupModules = await pool.query('SELECT * FROM analytics_modules');
    const backupConfig = await pool.query('SELECT * FROM system_config');

    const backup = {
      titles: backupTitles.rows,
      modules: backupModules.rows,
      config: backupConfig.rows,
      created_at: new Date().toISOString(),
    };

    // Store backup in system_config
    await pool.query(
      `INSERT INTO system_config (config_key, config_value, updated_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (config_key) DO UPDATE SET config_value = EXCLUDED.config_value, updated_by = EXCLUDED.updated_by`,
      ['config_backup_' + Date.now(), JSON.stringify(backup), username]
    );

    // Import titles
    if (Array.isArray(titles)) {
      for (const title of titles) {
        const sanitizedKey = sanitizeInput(title.key || '', { maxLength: 255 });
        const sanitizedValueHi = sanitizeInput(title.value_hi || '', { maxLength: 1000 });
        const sanitizedValueEn = title.value_en ? sanitizeInput(title.value_en, { maxLength: 1000 }) : null;
        const sanitizedSection = sanitizeInput(title.section || '', { maxLength: 100 });

        await pool.query(
          `INSERT INTO cms_titles (key, value_hi, value_en, section, updated_by)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (key) DO UPDATE SET
             value_hi = EXCLUDED.value_hi,
             value_en = EXCLUDED.value_en,
             section = EXCLUDED.section,
             updated_by = EXCLUDED.updated_by,
             updated_at = CURRENT_TIMESTAMP`,
          [sanitizedKey, sanitizedValueHi, sanitizedValueEn, sanitizedSection, username]
        );
      }
    }

    // Import modules
    if (Array.isArray(modules)) {
      for (const mod of modules) {
        const sanitizedKey = sanitizeInput(mod.module_key || '', { maxLength: 100 });
        const enabled = Boolean(mod.enabled);

        await pool.query(
          `UPDATE analytics_modules
           SET enabled = $1, updated_by = $2, updated_at = CURRENT_TIMESTAMP
           WHERE module_key = $3`,
          [enabled, username, sanitizedKey]
        );
      }
    }

    // Import config
    if (Array.isArray(config)) {
      for (const cfg of config) {
        const sanitizedKey = sanitizeInput(cfg.config_key || '', { maxLength: 255 });
        const configValue = typeof cfg.config_value === 'object' ? JSON.stringify(cfg.config_value) : cfg.config_value;

        await pool.query(
          `INSERT INTO system_config (config_key, config_value, description, updated_by)
           VALUES ($1, $2::jsonb, $3, $4)
           ON CONFLICT (config_key) DO UPDATE SET
             config_value = EXCLUDED.config_value,
             description = EXCLUDED.description,
             updated_by = EXCLUDED.updated_by,
             updated_at = CURRENT_TIMESTAMP`,
          [sanitizedKey, configValue, cfg.description || null, username]
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Configuration imported successfully',
      backup_created: true,
    });
  } catch (error) {
    console.error('Config Import API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to import configuration',
      },
      { status: 500 }
    );
  }
}

