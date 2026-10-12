alter table public.members
  add column if not exists resigned_at timestamptz;
