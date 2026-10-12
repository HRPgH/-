alter table public.members
  add column if not exists is_no_show boolean not null default false;
