# Database Migration 005: CMS Configuration Tables

## Overview
This migration creates tables for CMS (Content Management System) configuration, including dynamic titles, analytics module toggles, and system configuration.

## Migration File
`infra/migrations/005_create_cms_tables.sql`

## Tables Created

### 1. `cms_titles`
Stores dynamic titles and headers that can be edited through the CMS interface.

**Columns:**
- `id` (SERIAL PRIMARY KEY)
- `key` (VARCHAR(255) UNIQUE) - Unique identifier (e.g., "dashboard.main_title")
- `value_hi` (TEXT) - Hindi text value
- `value_en` (TEXT) - English text value (optional)
- `section` (VARCHAR(100)) - Section where title is used
- `updated_at` (TIMESTAMP)
- `updated_by` (VARCHAR(100))
- `created_at` (TIMESTAMP)

**Indexes:**
- `idx_cms_titles_section` on `section`
- `idx_cms_titles_key` on `key`

### 2. `analytics_modules`
Stores analytics module visibility toggles for the 9 analytics modules.

**Columns:**
- `id` (SERIAL PRIMARY KEY)
- `module_key` (VARCHAR(100) UNIQUE) - Module identifier
- `module_name_hi` (VARCHAR(255)) - Hindi module name
- `module_name_en` (VARCHAR(255)) - English module name
- `enabled` (BOOLEAN) - Visibility toggle
- `display_order` (INTEGER) - Display order
- `updated_at` (TIMESTAMP)
- `updated_by` (VARCHAR(100))
- `created_at` (TIMESTAMP)

**Indexes:**
- `idx_analytics_modules_enabled` on `enabled`
- `idx_analytics_modules_order` on `display_order`

**Default Modules Inserted:**
1. Event Type Analysis (इवेंट प्रकार विश्लेषण)
2. Geo-Mapping (भौगोलिक मैपिंग)
3. Tour Coverage (दौरा कवरेज)
4. Development Works (विकास कार्य)
5. Community Outreach (सामुदायिक आउटरीच)
6. Schemes (योजनाएं)
7. Beneficiary Groups (लाभार्थी समूह)
8. Thematic Analysis (विषयगत विश्लेषण)
9. Raigarh Constituency (रायगढ़ विधानसभा)

### 3. `system_config`
Stores general system configuration as JSONB.

**Columns:**
- `id` (SERIAL PRIMARY KEY)
- `config_key` (VARCHAR(255) UNIQUE) - Configuration key
- `config_value` (JSONB) - Configuration value
- `description` (TEXT) - Optional description
- `updated_at` (TIMESTAMP)
- `updated_by` (VARCHAR(100))
- `created_at` (TIMESTAMP)

**Indexes:**
- `idx_system_config_key` on `config_key`

## Default Data

### Default Titles Inserted:
- `dashboard.main_title`: "सोशल मीडिया एनालिटिक्स डैशबोर्ड" / "Social Media Analytics Dashboard"
- `analytics.section_title`: "एनालिटिक्स" / "Analytics"
- `review.section_title`: "समीक्षा" / "Review"
- `commandview.section_title`: "कमांड व्यू" / "Command View"

## Running the Migration

### Option 1: Using psql (Recommended)
```bash
psql $DATABASE_URL -f infra/migrations/005_create_cms_tables.sql
```

### Option 2: Using Database Client
1. Connect to your PostgreSQL database
2. Open `infra/migrations/005_create_cms_tables.sql`
3. Execute the SQL script

### Option 3: Using Migration Tool
If you're using a migration tool (like `node-pg-migrate` or `knex`), add this migration to your migration queue.

## Verification

After running the migration, verify the tables were created:

```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('cms_titles', 'analytics_modules', 'system_config');

-- Check default data
SELECT * FROM cms_titles;
SELECT * FROM analytics_modules;
SELECT * FROM system_config;
```

## Rollback (if needed)

If you need to rollback this migration:

```sql
DROP TABLE IF EXISTS system_config;
DROP TABLE IF EXISTS analytics_modules;
DROP TABLE IF EXISTS cms_titles;
```

## API Endpoints Using These Tables

- `GET /api/cms/config` - Fetch all CMS configuration
- `POST /api/cms/config` - Update CMS configuration (titles or modules)
- `GET /api/cms/export` - Export all CMS configuration
- `POST /api/cms/import` - Import CMS configuration

## Notes

- All tables use `ON CONFLICT DO NOTHING` for default inserts to prevent errors on re-runs
- The migration is idempotent (safe to run multiple times)
- All text fields support Hindi (Devanagari) characters
- Admin authentication is required for all CMS API endpoints


