# Public Seva

A production-oriented public infrastructure and hazard reporting platform. It includes public report submission, GPS capture, photo evidence, ticket tracking, role-based authentication, authority dashboards, workflows, real-time activity recording, and required Supabase/AI integrations.

## Run locally

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env`. Configure a strong `JWT_SECRET`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD`; these three settings are required in production. Google OAuth and AI credentials are optional integrations.
3. Start the application: `npm run dev`
4. Open `http://localhost:5173` and sign in with the public account or configured administrator account.

Local development uses the JSON store unless both `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set. With those server-only settings, user accounts, reports, and audit activity are stored in Supabase, and report photos are uploaded to Supabase Storage. Run `supabase/schema.sql` before connecting the API. Never expose the service-role key or administrator password in client code or public signup forms.

## Roles

- Public user: submit reports and track tickets; can upload evidence.
- Administrator: monitor reports, assign departments, update status, and manage users.

## Security

- Passwords use bcrypt hashing.
- JWTs expire after 12 hours.
- Public users cannot call admin-only endpoints.
- Report evidence is stored in an application-controlled directory with uploaded filename normalization.
- Supabase RLS policies are included in `supabase/schema.sql`.

## Deploy to Vercel with Supabase

The repository is deployed as two Vercel projects: the frontend and the Express API. Both projects can connect to the same GitHub repository, but use different root directories.

### 1. Prepare Supabase

1. Create a Supabase project and open **SQL Editor**.
2. Run the complete contents of `supabase/schema.sql`.
3. From **Project Settings → API**, copy the project URL and the `service_role` key. Keep the service-role key private; it belongs only in the API project's server-side environment variables.
4. The schema creates a public-read `report-evidence` Storage bucket with a 4 MB image limit. Only the server service-role client uploads files.

The application retains its existing server-issued JWT authentication. Supabase stores the application user records; Supabase Auth is not used by this implementation.

### 2. Deploy the API project

1. In Vercel, import `akashmy07/IDTL_Subject` as a new project named, for example, `public-seva-api`.
2. Set **Root Directory** to `server`.
3. Add these Vercel environment variables for Production and Preview:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_STORAGE_BUCKET` = `report-evidence`
   - `JWT_SECRET` = a long, random secret
   - `ADMIN_EMAIL`
   - `ADMIN_PASSWORD` = a strong, unique password
   - `CLIENT_ORIGIN` = the exact frontend Vercel origin, for example `https://public-seva.vercel.app`
4. Add optional integrations only if configured: `GOOGLE_CLIENT_ID`, `AI_API_KEY`, `AI_MODEL`, `SMTP_CONFIG`, or department webhook settings.
5. Deploy the API and confirm `https://YOUR-API-DOMAIN/api/health` returns a healthy JSON response.

### 3. Point the frontend to the API

1. Open `client/vercel.json` and replace `REPLACE-WITH-YOUR-API-VERCEL-DOMAIN` in both rewrite destinations with the API project's Vercel host, without a trailing slash.
2. Commit and push that edit to GitHub. Vercel will redeploy the frontend project automatically.

The rewrites make the browser call the frontend domain while Vercel forwards `/api/*` requests to the Express API. Photo URLs point directly to the public Supabase Storage bucket.

### 4. Deploy the frontend project

1. In Vercel, import the same GitHub repository as a second project, for example `public-seva`.
2. Set **Root Directory** to `client`; use the Vite framework preset, build command `npm run build`, and output directory `dist`.
3. If Google sign-in is enabled, set `VITE_GOOGLE_CLIENT_ID` in the frontend project's environment variables and add the Vercel frontend domain to the Google OAuth authorized JavaScript origins.
4. Set the API project's `CLIENT_ORIGIN` to the final frontend domain and redeploy the API if you changed it.
5. Test account signup/login, report submission, image upload, status updates, and data persistence after a new deployment.

Never put `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`, or `ADMIN_PASSWORD` in the frontend project's variables. The browser must not receive the service-role key.

The backend supports local JSON storage when running outside Vercel and Supabase is not configured. On Vercel it requires Supabase settings and fails startup rather than silently using ephemeral local files. The Vercel upload limit is 4 MB per image.

## Optional AI integration

Configure `AI_API_KEY` and `AI_MODEL` on the API deployment to enable Gemini classification. If Gemini is unavailable, classification falls back to deterministic local rules.
