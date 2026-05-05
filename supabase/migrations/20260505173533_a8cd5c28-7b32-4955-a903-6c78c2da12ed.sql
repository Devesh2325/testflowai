
-- Enums
create type public.app_role as enum ('admin', 'tester', 'viewer');
create type public.test_priority as enum ('low', 'medium', 'high', 'critical');
create type public.test_type as enum ('functional', 'regression', 'smoke', 'integration', 'performance', 'security', 'usability');
create type public.test_status as enum ('draft', 'active', 'deprecated');
create type public.execution_status as enum ('not_run', 'pass', 'fail', 'blocked', 'skipped');
create type public.bug_severity as enum ('low', 'medium', 'high', 'critical');
create type public.bug_priority as enum ('low', 'medium', 'high', 'urgent');
create type public.bug_status as enum ('open', 'in_progress', 'resolved', 'closed', 'reopened');

-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles self select" on public.profiles for select using (auth.uid() = id);
create policy "profiles self update" on public.profiles for update using (auth.uid() = id);

-- Roles
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique(user_id, role)
);
alter table public.user_roles enable row level security;
create policy "roles self select" on public.user_roles for select using (auth.uid() = user_id);

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.user_roles where user_id=_user_id and role=_role)
$$;

-- Profile + role auto-create
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email));
  insert into public.user_roles (user_id, role) values (new.id, 'tester');
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Updated_at helper
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

-- Projects
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  type text default 'web',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.projects enable row level security;
create policy "projects owner all" on public.projects for all using (auth.uid()=owner_id) with check (auth.uid()=owner_id);
create trigger projects_updated before update on public.projects for each row execute function public.set_updated_at();

-- Modules
create table public.modules (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);
alter table public.modules enable row level security;
create policy "modules owner all" on public.modules for all using (auth.uid()=owner_id) with check (auth.uid()=owner_id);

-- Test cases
create table public.test_cases (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  module_id uuid references public.modules(id) on delete set null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  preconditions text,
  steps text,
  expected_result text,
  priority test_priority not null default 'medium',
  type test_type not null default 'functional',
  status test_status not null default 'active',
  tags text[] default '{}',
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.test_cases enable row level security;
create policy "tc owner all" on public.test_cases for all using (auth.uid()=owner_id) with check (auth.uid()=owner_id);
create trigger tc_updated before update on public.test_cases for each row execute function public.set_updated_at();

-- Test runs
create table public.test_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  status text not null default 'in_progress',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.test_runs enable row level security;
create policy "runs owner all" on public.test_runs for all using (auth.uid()=owner_id) with check (auth.uid()=owner_id);
create trigger runs_updated before update on public.test_runs for each row execute function public.set_updated_at();

-- Executions
create table public.test_executions (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.test_runs(id) on delete cascade,
  test_case_id uuid not null references public.test_cases(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  status execution_status not null default 'not_run',
  device text,
  browser text,
  notes text,
  screenshot_url text,
  executed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.test_executions enable row level security;
create policy "exec owner all" on public.test_executions for all using (auth.uid()=owner_id) with check (auth.uid()=owner_id);

-- Bugs
create table public.bugs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  severity bug_severity not null default 'medium',
  priority bug_priority not null default 'medium',
  status bug_status not null default 'open',
  linked_test_case uuid references public.test_cases(id) on delete set null,
  run_id uuid references public.test_runs(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.bugs enable row level security;
create policy "bugs owner all" on public.bugs for all using (auth.uid()=owner_id) with check (auth.uid()=owner_id);
create trigger bugs_updated before update on public.bugs for each row execute function public.set_updated_at();

-- Documents
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  type text not null default 'plan',
  title text not null,
  content text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.documents enable row level security;
create policy "docs owner all" on public.documents for all using (auth.uid()=owner_id) with check (auth.uid()=owner_id);
create trigger docs_updated before update on public.documents for each row execute function public.set_updated_at();

-- AI history
create table public.ai_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  prompt text not null,
  response text,
  kind text default 'generate_testcases',
  created_at timestamptz not null default now()
);
alter table public.ai_history enable row level security;
create policy "ai owner all" on public.ai_history for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
