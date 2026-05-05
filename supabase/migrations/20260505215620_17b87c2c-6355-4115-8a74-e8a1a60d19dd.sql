
create table if not exists public.document_shares (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  shared_with_email text not null,
  shared_with_user_id uuid,
  permission text not null default 'view' check (permission in ('view','edit')),
  owner_id uuid not null,
  created_at timestamptz not null default now(),
  unique (document_id, shared_with_email)
);

alter table public.document_shares enable row level security;

create policy "shares owner all" on public.document_shares
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "shares recipient view" on public.document_shares
  for select using (
    shared_with_user_id = auth.uid()
    or shared_with_email = (select email from public.profiles where id = auth.uid())
  );

-- expand documents access: allow shared users to view; edit if permission='edit'
drop policy if exists "docs shared view" on public.documents;
create policy "docs shared view" on public.documents
  for select using (
    exists (
      select 1 from public.document_shares s
      where s.document_id = documents.id
        and (s.shared_with_user_id = auth.uid()
             or s.shared_with_email = (select email from public.profiles where id = auth.uid()))
    )
  );

drop policy if exists "docs shared edit" on public.documents;
create policy "docs shared edit" on public.documents
  for update using (
    exists (
      select 1 from public.document_shares s
      where s.document_id = documents.id
        and s.permission = 'edit'
        and (s.shared_with_user_id = auth.uid()
             or s.shared_with_email = (select email from public.profiles where id = auth.uid()))
    )
  );
