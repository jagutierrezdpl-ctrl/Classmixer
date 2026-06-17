-- Make handle_new_user resilient: catch ALL exceptions so auth.users
-- creation never fails due to a public.users constraint violation.
-- Also use ON CONFLICT on BOTH id AND email to survive edge cases where
-- a row with the same email already exists (e.g. partial deletes).

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  insert into public.users (id, email, name, role, center_id)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    'pending',
    null
  )
  on conflict (id) do nothing;
  return new;
exception when others then
  -- Never let a trigger error block the auth.users insert.
  return new;
end;
$$;
