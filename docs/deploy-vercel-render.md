## Deploy Frontend (Vercel) and API (Render)

### 1) API on Render

1. Push `render.yaml` to the default branch.
2. In Render, create a new Blueprint from your Git repo. It will detect `render.yaml`.
3. Confirm the `project-dhruv-api` and `project-dhruv-db` resources.
4. After deploy, note the API base URL (e.g., `https://project-dhruv-api.onrender.com`).

Environment variables (Render Web Service):
- DATABASE_URL: auto-provisioned from the Render Postgres resource.
- PORT: 10000 (set in blueprint).

Health check: `/health`

### 2) Frontend on Vercel

1. Import the repo in Vercel.
2. Set Project Environment Variables:
   - `NEXT_PUBLIC_API_BASE` = `https://project-dhruv-api.onrender.com`
3. Deploy.

Verification
- Visit the dashboard. Review flows (Save/Approve/Skip) should call the Flask API.
- Home should update immediately via local overlay and on next fetch from API.


