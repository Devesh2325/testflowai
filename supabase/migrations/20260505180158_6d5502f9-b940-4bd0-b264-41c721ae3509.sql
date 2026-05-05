
create table public.integrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  provider text not null,
  enabled boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, provider)
);
alter table public.integrations enable row level security;
create policy "integrations owner all" on public.integrations for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
create trigger integrations_updated before update on public.integrations for each row execute function public.set_updated_at();

create table public.learning_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  topic text not null,
  completed boolean not null default true,
  created_at timestamptz not null default now(),
  unique(user_id, topic)
);
alter table public.learning_progress enable row level security;
create policy "learning owner all" on public.learning_progress for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
