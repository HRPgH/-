alter table public.members
  add column if not exists withdrawn_at timestamptz;
