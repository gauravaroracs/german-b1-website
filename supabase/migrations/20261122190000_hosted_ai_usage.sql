create table if not exists public.deutsch_meister_ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  month_start date not null,
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, month_start)
);

alter table public.deutsch_meister_ai_usage enable row level security;

drop policy if exists "Users can read their own Deutsch Meister AI usage" on public.deutsch_meister_ai_usage;
create policy "Users can read their own Deutsch Meister AI usage"
on public.deutsch_meister_ai_usage
for select
to authenticated
using (auth.uid() = user_id);

create or replace function public.reserve_deutsch_meister_ai_request(
  p_user_id uuid,
  p_month_start date,
  p_monthly_limit integer
) returns table(request_count integer, remaining integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if p_monthly_limit < 1 or p_monthly_limit > 10000 then
    raise exception 'Invalid monthly limit';
  end if;

  insert into public.deutsch_meister_ai_usage as current_usage
    (user_id, month_start, request_count, updated_at)
  values (p_user_id, p_month_start, 1, now())
  on conflict (user_id, month_start) do update
    set request_count = current_usage.request_count + 1,
        updated_at = now()
    where current_usage.request_count < p_monthly_limit
  returning current_usage.request_count into v_count;

  if v_count is null then
    return;
  end if;

  return query select v_count, greatest(0, p_monthly_limit - v_count);
end;
$$;

revoke all on function public.reserve_deutsch_meister_ai_request(uuid, date, integer) from public, anon, authenticated;
grant execute on function public.reserve_deutsch_meister_ai_request(uuid, date, integer) to service_role;
grant select on public.deutsch_meister_ai_usage to authenticated;
