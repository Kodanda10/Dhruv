import { NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db/pool';

type ConfigPayload = {
  key: string;
  value: any;
  description?: string;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get('key');

  const pool = getDbPool();

  try {
    if (key) {
      // Get specific config
      const result = await pool.query(
        'SELECT config_key, config_value, description FROM system_config WHERE config_key = $1',
        [key]
      );

      if (result.rows.length === 0) {
        return NextResponse.json({ error: 'Config key not found' }, { status: 404 });
      }

      return NextResponse.json({
        key: result.rows[0].config_key,
        value: result.rows[0].config_value,
        description: result.rows[0].description
      });
    } else {
      // Get all configs
      const result = await pool.query(
        'SELECT config_key, config_value, description FROM system_config ORDER BY config_key'
      );

      const configs = result.rows.reduce((acc, row) => {
        acc[row.config_key] = {
          value: row.config_value,
          description: row.description
        };
        return acc;
      }, {});

      return NextResponse.json({ configs });
    }
  } catch (error) {
    console.error('Config fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch config' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let body: ConfigPayload;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const { key, value, description } = body;

  if (!key || value === undefined) {
    return NextResponse.json({
      error: 'key and value are required'
    }, { status: 400 });
  }

  const pool = getDbPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const upsertQuery = `
      INSERT INTO system_config (config_key, config_value, description, updated_by)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (config_key)
      DO UPDATE SET
        config_value = EXCLUDED.config_value,
        description = COALESCE(EXCLUDED.description, system_config.description),
        updated_at = CURRENT_TIMESTAMP,
        updated_by = EXCLUDED.updated_by
      RETURNING config_key, config_value, description;
    `;

    const result = await client.query(upsertQuery, [
      key,
      JSON.stringify(value),
      description || null,
      'system' // In production, get from auth context
    ]);

    await client.query('COMMIT');

    console.log(`Config updated: ${key}`, { value, description });

    return NextResponse.json({
      success: true,
      config: {
        key: result.rows[0].config_key,
        value: JSON.parse(result.rows[0].config_value),
        description: result.rows[0].description
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Config update error:', error);
    return NextResponse.json({ error: 'Failed to update config' }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get('key');

  if (!key) {
    return NextResponse.json({ error: 'key parameter is required' }, { status: 400 });
  }

  const pool = getDbPool();

  try {
    const result = await pool.query(
      'DELETE FROM system_config WHERE config_key = $1 RETURNING config_key',
      [key]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Config key not found' }, { status: 404 });
    }

    console.log(`Config deleted: ${key}`);

    return NextResponse.json({
      success: true,
      message: `Config ${key} deleted successfully`
    });

  } catch (error) {
    console.error('Config delete error:', error);
    return NextResponse.json({ error: 'Failed to delete config' }, { status: 500 });
  }
}