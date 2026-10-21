create extension if not exists "pgcrypto";

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'public' check (role in ('public', 'admin')),
  display_name text,
  created_at timestamptz not null default now()
);

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
  assigned_department text,
  resolution_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

create policy "Users can read their own profile" on public.users for select using (id = auth.uid());
create policy "Users can update their own profile" on public.users for update using (id = auth.uid());
create policy "Public users can create their own reports" on public.hazards for insert with check (created_by = auth.uid() and role_from_auth() = 'public');
create policy "Users can read their own reports" on public.hazards for select using (created_by = auth.uid() or role_from_auth() = 'admin');
create policy "Admins can update reports" on public.hazards for update using (role_from_auth() = 'admin') with check (role_from_auth() = 'admin');

create or replace function public.role_from_auth() returns text
language sql stable security definer set search_path = public
as $$
select coalesce((select role from public.users where id = auth.uid()), 'public');
$$;
