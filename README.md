# Public Seva

A production-oriented public infrastructure and hazard reporting platform. It includes public report submission, GPS capture, photo evidence, ticket tracking, role-based authentication, authority dashboards, workflows, real-time activity recording, and required Supabase/AI integrations.

## Run locally

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env`. Configure a strong `JWT_SECRET`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD`; these three settings are required in production. Google OAuth and AI credentials are optional integrations.
3. Start the application: `npm run dev`
4. Open `http://localhost:5173` and sign in with the public account or configured administrator account.

The app uses a local JSON data store by default. A Supabase schema is included, but the current backend is not yet wired to use Supabase for persistence. The backend validates authentication and applies role-based authorization in every API route. Never expose the administrator password in client code or public signup forms.

## Roles

- Public user: submit reports and track tickets; can upload evidence.
- Administrator: monitor reports, assign departments, update status, and manage users.

## Security

- Passwords use bcrypt hashing.
- JWTs expire after 12 hours.
- Public users cannot call admin-only endpoints.
- Report evidence is stored in an application-controlled directory with uploaded filename normalization.
- Supabase RLS policies are included in `supabase/schema.sql`.

## Production integration

1. Run `supabase/schema.sql` against the Supabase project.
2. Configure `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and optionally `SUPABASE_SERVICE_ROLE_KEY`.
3. Configure `GOOGLE_CLIENT_ID`, `AI_API_URL`, `AI_API_KEY`, and `AI_MODEL`. The AI endpoint must return a `classification` object with `category` and `priority`; otherwise requests fail instead of receiving simulated data.
