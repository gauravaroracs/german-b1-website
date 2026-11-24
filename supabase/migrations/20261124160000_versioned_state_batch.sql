-- This migration disables legacy direct writes. Release only together with a
-- client that uses apply_deutsch_meister_state_batch and handles conflicts.
alter table public.deutsch_meister_state
  add column if not exists revision bigint not null default 1,
  add column if not exists deleted boolean not null default false;

create table if not exists public.deutsch_meister_state_requests (
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  payload jsonb not null,
  response jsonb not null,
  primary key (user_id, request_id)
);
alter table public.deutsch_meister_state_requests enable row level security;
revoke all on public.deutsch_meister_state_requests from public, anon, authenticated;

-- Versions and timestamps are controlled by the server, not supplied by clients.
create or replace function public.deutsch_meister_state_version_trigger()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.revision := 1;
  else
    new.revision := old.revision + 1;
  end if;
  new.updated_at := clock_timestamp();
  return new;
end;
$$;
drop trigger if exists deutsch_meister_state_version on public.deutsch_meister_state;
create trigger deutsch_meister_state_version before insert or update on public.deutsch_meister_state
for each row execute function public.deutsch_meister_state_version_trigger();

revoke insert, update, delete, truncate, references, trigger on public.deutsch_meister_state from public, anon, authenticated;

-- An explicit owner guard distinguishes an absent record from an account switch.
create or replace function public.read_deutsch_meister_state(p_expected_user uuid, p_key text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_record record;
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_expected_user is distinct from v_user then raise exception 'Account changed' using errcode = '42501'; end if;
  if p_key is null or not (p_key = any(array[
    'active-tab','streak-data','daily-blocks','anki-log','grammar-progress','vocab-words',
    'frequency-adventure-progress','frequency-adventure-session','speaking-log','story-progress',
    'chat-history','practice-messages','practice-scenario','practice-draft','saved-sentences',
    'sentence-explanations','kept-examples','grammar-lessons','grammar-session','daily-timers',
    'think-state','stories-list','story-session','mission-progress','danger-list','freq-known',
    'freq-review-progress','vocab-review-preferences'
  ])) then raise exception 'Invalid state key'; end if;
  select state_value, revision, deleted into v_record from public.deutsch_meister_state where user_id = v_user and state_key = p_key;
  if not found then return jsonb_build_object('found', false); end if;
  return jsonb_build_object('found', true, 'state_value', v_record.state_value, 'revision', v_record.revision, 'deleted', v_record.deleted);
end;
$$;
revoke all on function public.read_deutsch_meister_state(uuid, text) from public, anon;
grant execute on function public.read_deutsch_meister_state(uuid, text) to authenticated;

-- Every key is checked before any mutation; a per-user advisory lock also
-- serializes absent-row checks and idempotency records for concurrent requests.
drop function if exists public.apply_deutsch_meister_state_batch(uuid, jsonb);
create or replace function public.apply_deutsch_meister_state_batch(p_expected_user uuid, p_request_id uuid, p_changes jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_item jsonb;
  v_key text;
  v_expected bigint;
  v_actual bigint;
  v_revision bigint;
  v_old_payload jsonb;
  v_old_response jsonb;
  v_result jsonb := '[]'::jsonb;
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_expected_user is distinct from v_user then raise exception 'Account changed' using errcode = '42501'; end if;
  if p_request_id is null or jsonb_typeof(p_changes) is distinct from 'array' then
    raise exception 'Invalid state batch';
  end if;
  if jsonb_array_length(p_changes) not between 1 and 64 or octet_length(p_changes::text) > 1048576 then
    raise exception 'Invalid state batch';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text, 448523));
  select payload, response into v_old_payload, v_old_response from public.deutsch_meister_state_requests where user_id = v_user and request_id = p_request_id;
  if found then
    if v_old_payload <> p_changes then raise exception 'Request ID already used with a different batch'; end if;
    return v_old_response;
  end if;
  if (select count(distinct x->>'key') from jsonb_array_elements(p_changes) as x) <> jsonb_array_length(p_changes) then
    raise exception 'Duplicate or missing state key';
  end if;
  for v_item in select value from jsonb_array_elements(p_changes) order by value->>'key' loop
    v_key := v_item->>'key';
    if jsonb_typeof(v_item) is distinct from 'object' or v_key is null or not (v_key = any(array[
      'active-tab','streak-data','daily-blocks','anki-log','grammar-progress','vocab-words',
      'frequency-adventure-progress','frequency-adventure-session','speaking-log','story-progress',
      'chat-history','practice-messages','practice-scenario','practice-draft','saved-sentences',
      'sentence-explanations','kept-examples','grammar-lessons','grammar-session','daily-timers',
      'think-state','stories-list','story-session','mission-progress','danger-list','freq-known',
      'freq-review-progress','vocab-review-preferences'
    ])) or jsonb_typeof(v_item->'expectedRevision') is distinct from 'number' or (v_item->>'expectedRevision') !~ '^(0|[1-9][0-9]{0,17})$' or jsonb_typeof(v_item->'deleted') is distinct from 'boolean' or (not (v_item->>'deleted')::boolean and not (v_item ? 'value')) then
      raise exception 'Invalid state change';
    end if;
    v_expected := (v_item->>'expectedRevision')::bigint;
    select revision into v_actual from public.deutsch_meister_state where user_id = v_user and state_key = v_key;
    if not found then v_actual := 0; end if;
    if v_actual <> v_expected then
      return jsonb_build_object('ok', false, 'key', v_key, 'expectedRevision', v_expected, 'actualRevision', v_actual);
    end if;
  end loop;
  for v_item in select value from jsonb_array_elements(p_changes) order by value->>'key' loop
    v_key := v_item->>'key';
    insert into public.deutsch_meister_state (user_id, state_key, state_value, deleted)
    values (v_user, v_key, case when (v_item->>'deleted')::boolean then 'null'::jsonb else v_item->'value' end, (v_item->>'deleted')::boolean)
    on conflict (user_id, state_key) do update set state_value = excluded.state_value, deleted = excluded.deleted
    returning revision into v_revision;
    v_result := v_result || jsonb_build_array(jsonb_build_object('key', v_key, 'revision', v_revision));
  end loop;
  v_old_response := jsonb_build_object('ok', true, 'revisions', v_result);
  insert into public.deutsch_meister_state_requests (user_id, request_id, payload, response) values (v_user, p_request_id, p_changes, v_old_response);
  return v_old_response;
end;
$$;
revoke all on function public.apply_deutsch_meister_state_batch(uuid, uuid, jsonb) from public, anon;
grant execute on function public.apply_deutsch_meister_state_batch(uuid, uuid, jsonb) to authenticated;
