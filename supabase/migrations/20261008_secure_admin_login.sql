revoke select on table public.admins from public, anon, authenticated;
revoke select (password) on table public.admins from public, anon, authenticated;
grant select (name) on table public.admins to anon, authenticated;

create or replace function public.verify_admin_login(p_name text, p_password text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admins
    where name = p_name
      and password = p_password
  );
$$;

revoke all on function public.verify_admin_login(text, text) from public;
grant execute on function public.verify_admin_login(text, text) to anon, authenticated;
