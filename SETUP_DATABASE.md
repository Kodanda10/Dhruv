# Setup Database for Tweet Fetching

## Issue
The PostgreSQL database is not running. You need to start Docker first.

## Quick Start

### Step 1: Start Docker Desktop
1. Open **Docker Desktop** application
2. Wait for it to fully start (Docker icon in menu bar should be green)

### Step 2: Start PostgreSQL

Once Docker is running, execute:

```bash
cd /Users/abhijita/Projects/Project_Dhruv/infra
docker-compose up -d
```

### Step 3: Verify Database is Running

```bash
docker ps
```

You should see:
```
CONTAINER ID   IMAGE         COMMAND                  STATUS
xxxxx          postgres:15   "docker-entrypoint..."   Up X seconds
```

### Step 4: Test Database Connection

```bash
psql postgresql://dhruv_user:dhruv_pass@localhost:5432/dhruv_db -c "SELECT version();"
```

### Step 5: Start Tweet Fetch

Now you can start fetching tweets:

```bash
cd /Users/abhijita/Projects/Project_Dhruv
source .venv/bin/activate
python scripts/fetch_tweets.py --handle OPChoudhary_Ind --since 2023-12-01 --until 2025-10-31
```

## Alternative: Use Vercel Postgres (Cloud)

If you prefer not to use Docker, you can use Vercel Postgres:

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Create a new Postgres database
3. Copy the connection string
4. Update `.env.local`:
   ```bash
   DATABASE_URL=postgres://user:pass@host:port/dbname
   ```

Then start the tweet fetch.

## Troubleshooting

### Error: "Cannot connect to Docker daemon"
**Solution:** Start Docker Desktop application

### Error: "Connection refused" on port 5432
**Solution:** 
```bash
cd infra
docker-compose up -d
```

### Error: "Database does not exist"
**Solution:** The database is created automatically on first connection

## Next Steps

Once the database is running and tweets are fetching, I'll proceed with:
- **Task 3**: Create parsed_events table schema
- **Task 4**: Build parsing pipeline
- **Task 5**: Create review UI

