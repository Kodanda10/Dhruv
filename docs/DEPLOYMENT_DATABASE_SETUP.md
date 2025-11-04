# Deployment Database Setup - Vercel

## Critical: Database Connection for Production

Your dashboard is deployed on Vercel but showing no data because the database connection is not configured.

---

## Required Environment Variables in Vercel

### 1. Go to Vercel Dashboard
1. Navigate to: https://vercel.com/dashboard
2. Select your project: **Project_Dhruv**
3. Go to **Settings** → **Environment Variables**

### 2. Add Required Variables

**DATABASE_URL** (Required)
- **Name:** `DATABASE_URL`
- **Value:** Your PostgreSQL connection string
- **Environments:** Production, Preview, Development (all)
- **Format:** `postgresql://user:password@host:port/database?sslmode=require`

**Example:**
```
postgresql://dhruv_user:your_password@your_host:5432/dhruv_db?sslmode=require
```

**For Vercel Postgres:**
- If using Vercel Postgres, get the connection string from:
  - Vercel Dashboard → Storage → Postgres → Settings → Connection String

---

## Current Database Configuration

The application now uses:
- **Primary:** `DATABASE_URL` environment variable (standard for Vercel)
- **Fallback:** Individual `DB_*` env vars (for local development only)

**Pool Helper:** `src/app/api/parsed-events/pool-helper.ts`
- Automatically detects `DATABASE_URL`
- Configures SSL for production
- Handles connection pooling

---

## Verification Steps

### 1. Check Environment Variables
```bash
# In Vercel Dashboard
Settings → Environment Variables
```

Verify:
- ✅ `DATABASE_URL` is set
- ✅ Applied to all environments (Production, Preview, Development)
- ✅ Value is correct (not empty or placeholder)

### 2. Test Database Connection
After setting environment variables:
1. **Redeploy** the application
2. Check **Vercel Logs** for database connection errors
3. Visit: `https://your-deployment.vercel.app/api/health`
4. Should show database connection status

### 3. Check API Endpoints
Test these endpoints:
- `/api/parsed-events?limit=5` - Should return real data
- `/api/parsed-events?needs_review=true&limit=5` - Should return review queue
- `/api/analytics` - Should return analytics data

---

## Troubleshooting

### Issue: "No data available"
**Cause:** `DATABASE_URL` not set or incorrect
**Fix:**
1. Add `DATABASE_URL` in Vercel environment variables
2. Redeploy the application
3. Check logs for connection errors

### Issue: "Database connection failed"
**Cause:** Wrong connection string or SSL issues
**Fix:**
1. Verify connection string format
2. Ensure `?sslmode=require` is included for cloud databases
3. Check database allows connections from Vercel IPs

### Issue: "Connection timeout"
**Cause:** Database not accessible from Vercel
**Fix:**
1. Check database firewall settings
2. Ensure database allows external connections
3. Verify network security groups/firewall rules

### Issue: "Authentication failed"
**Cause:** Wrong username/password
**Fix:**
1. Verify database credentials
2. Check if password needs URL encoding
3. Test connection string locally first

---

## Database Options

### Option 1: Vercel Postgres (Recommended)
- **Setup:** Vercel Dashboard → Storage → Create Postgres
- **Connection:** Automatically configured
- **Benefits:** 
  - Built-in integration
  - Automatic backups
  - Easy scaling

### Option 2: External PostgreSQL
- **Setup:** Use any PostgreSQL provider (AWS RDS, Supabase, Neon, etc.)
- **Connection:** Use their connection string
- **Benefits:**
  - More control
  - Can use existing database
  - More hosting options

### Option 3: Local Database (Development Only)
- **Setup:** Docker PostgreSQL
- **Connection:** `postgresql://dhruv_user:dhruv_pass@localhost:5432/dhruv_db`
- **Note:** Not for production!

---

## Current Status

After fixing:
- ✅ Database pool initialized with `DATABASE_URL`
- ✅ SSL configured for production
- ✅ All API endpoints use real database
- ✅ No static data fallbacks
- ✅ Proper error handling

---

## Next Steps

1. **Add `DATABASE_URL`** in Vercel environment variables
2. **Redeploy** the application
3. **Test** the dashboard at your deployment URL
4. **Verify** data appears in all three tabs
5. **Monitor** Vercel logs for any errors

---

## Testing Locally

Before deploying, test locally:
```bash
# Set DATABASE_URL in .env.local
echo "DATABASE_URL=postgresql://..." >> .env.local

# Start dev server
npm run dev

# Test endpoints
curl http://localhost:3000/api/parsed-events?limit=5
```

If local works, Vercel should work too (with proper env vars).

---

## Support

If issues persist:
1. Check Vercel deployment logs
2. Verify database is running and accessible
3. Test database connection string directly
4. Check network/firewall settings

