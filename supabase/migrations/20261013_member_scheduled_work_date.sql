alter table public.members
  add column if not exists scheduled_work_date date;
