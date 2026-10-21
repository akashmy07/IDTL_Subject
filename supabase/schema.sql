create extension if not exists "pgcrypto";

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  password_hash text,
  google_id text,
  role text not null default 'public' check (role in ('public', 'admin')),
  display_name text not null,
  created_at timestamptz not null default now()
);

alter table public.users drop constraint if exists users_id_fkey;
alter table public.users alter column id set default gen_random_uuid();
alter table public.users add column if not exists email text;
alter table public.users add column if not exists password_hash text;
alter table public.users add column if not exists google_id text;
alter table public.users add column if not exists display_name text;
create unique index if not exists users_email_unique on public.users (email);

create table if not exists public.hazards (
  id uuid primary key default gen_random_uuid(),
  ticket_number text unique not null,
  title text not null,
  description text not null,
  category text not null,
  priority text not null check (priority in ('low', 'medium', 'high', 'critical')),
  status text not null default 'received' check (status in ('received', 'reviewing', 'assigned', 'in_progress', 'resolved', 'closed')),
  latitude numeric(9,6) not null,
  longitude numeric(9,6) not null,
  location_text text not null,
  photo_url text,
  created_by uuid references public.users(id) on delete set null,
  reporter_email text,
  assigned_department text,
  department_route jsonb,
  delivery jsonb,
  delivery_status text,
  resolution_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.hazards add column if not exists reporter_email text;
alter table public.hazards add column if not exists department_route jsonb;
alter table public.hazards add column if not exists delivery jsonb;
alter table public.hazards add column if not exists delivery_status text;
create index if not exists hazards_created_by_created_at_idx on public.hazards (created_by, created_at desc);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.users(id) on delete set null,
  hazard_id uuid references public.hazards(id) on delete cascade,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.users enable row level security;
alter table public.hazards enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists "Users can read their own profile" on public.users;
drop policy if exists "Users can update their own profile" on public.users;
drop policy if exists "Public users can create their own reports" on public.hazards;
drop policy if exists "Users can read their own reports" on public.hazards;
drop policy if exists "Admins can update reports" on public.hazards;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('report-evidence', 'report-evidence', true, 4194304, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can view report evidence" on storage.objects;
create policy "Public can view report evidence"
  on storage.objects for select
  using (bucket_id = 'report-evidence');
