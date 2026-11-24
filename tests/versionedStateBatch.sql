-- Run only against an isolated database with a mock auth.uid() and the migration applied.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
do $$
declare r jsonb; retry jsonb; failed boolean;
begin
  r := public.read_deutsch_meister_state('00000000-0000-0000-0000-000000000001', 'practice-draft');
  if r <> '{"found":false}'::jsonb then raise exception 'absent read incorrect'; end if;
  r := public.apply_deutsch_meister_state_batch('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '[{"key":"practice-draft","expectedRevision":0,"deleted":false,"value":"first"},{"key":"saved-sentences","expectedRevision":0,"deleted":false,"value":[]}]');
  if r->>'ok' <> 'true' or jsonb_array_length(r->'revisions') <> 2 then raise exception 'initial batch failed'; end if;
  retry := public.read_deutsch_meister_state('00000000-0000-0000-0000-000000000001', 'practice-draft');
  if retry <> '{"found":true,"state_value":"first","revision":1,"deleted":false}'::jsonb then raise exception 'present read incorrect'; end if;
  retry := public.apply_deutsch_meister_state_batch('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '[{"key":"practice-draft","expectedRevision":0,"deleted":false,"value":"first"},{"key":"saved-sentences","expectedRevision":0,"deleted":false,"value":[]}]');
  if retry <> r then raise exception 'idempotent retry differed'; end if;
  r := public.apply_deutsch_meister_state_batch('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', '[{"key":"practice-draft","expectedRevision":1,"deleted":false,"value":"changed"},{"key":"saved-sentences","expectedRevision":0,"deleted":false,"value":[1]}]');
  if r->>'ok' <> 'false' or (select state_value from public.deutsch_meister_state where state_key = 'practice-draft') <> '"first"'::jsonb then raise exception 'conflict partially wrote'; end if;
  r := public.apply_deutsch_meister_state_batch('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', '[{"key":"practice-draft","expectedRevision":1,"deleted":true}]');
  if r->>'ok' <> 'true' or not (select deleted and revision=2 from public.deutsch_meister_state where state_key='practice-draft') then raise exception 'tombstone missing'; end if;
  r := public.read_deutsch_meister_state('00000000-0000-0000-0000-000000000001', 'practice-draft');
  if r <> '{"found":true,"state_value":null,"revision":2,"deleted":true}'::jsonb then raise exception 'tombstone read incorrect'; end if;
  r := public.apply_deutsch_meister_state_batch('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004', '[{"key":"practice-draft","expectedRevision":0,"deleted":false,"value":"stale"}]');
  if r->>'ok' <> 'false' then raise exception 'delete/recreate ABA accepted'; end if;
  failed := false;
  begin perform public.apply_deutsch_meister_state_batch('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000005', '[{"key":"practice-draft","deleted":false,"value":"bad"}]'); exception when others then failed := true; end;
  if not failed then raise exception 'missing revision accepted'; end if;
  failed := false;
  begin update public.deutsch_meister_state set state_value='"unsafe"' where state_key='practice-draft'; exception when insufficient_privilege then failed := true; end;
  if not failed then raise exception 'legacy direct write permitted'; end if;
  failed := false;
  begin perform public.apply_deutsch_meister_state_batch('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '[{"key":"practice-draft","expectedRevision":2,"deleted":false,"value":"changed request"}]'); exception when others then failed := true; end;
  if not failed then raise exception 'request ID reused with different body'; end if;
end;
$$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
do $$
declare failed boolean;
begin
  if exists(select 1 from public.deutsch_meister_state) then raise exception 'other user data visible'; end if;
  failed := false;
  begin perform public.apply_deutsch_meister_state_batch('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '[{"key":"practice-draft","expectedRevision":0,"deleted":false,"value":"wrong account"}]'); exception when insufficient_privilege then failed := true; end;
  if not failed then raise exception 'mismatched expected owner accepted'; end if;
  if exists(select 1 from public.deutsch_meister_state) then raise exception 'mismatched owner mutated data'; end if;
  failed := false;
  begin perform public.apply_deutsch_meister_state_batch(null, '10000000-0000-0000-0000-000000000001', '[{"key":"practice-draft","expectedRevision":0,"deleted":false,"value":"wrong account"}]'); exception when insufficient_privilege then failed := true; end;
  if not failed then raise exception 'missing expected owner accepted'; end if;
  failed := false;
  begin perform public.read_deutsch_meister_state('00000000-0000-0000-0000-000000000001', 'practice-draft'); exception when insufficient_privilege then failed := true; end;
  if not failed then raise exception 'read accepted mismatched expected owner'; end if;
  failed := false;
  begin perform public.read_deutsch_meister_state(null, 'practice-draft'); exception when insufficient_privilege then failed := true; end;
  if not failed then raise exception 'read accepted missing expected owner'; end if;
  failed := false;
  begin perform public.read_deutsch_meister_state('00000000-0000-0000-0000-000000000002', 'openai-api-key'); exception when others then failed := true; end;
  if not failed then raise exception 'read accepted disallowed key'; end if;
  if (public.apply_deutsch_meister_state_batch('00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '[{"key":"practice-draft","expectedRevision":0,"deleted":false,"value":"private"}]')->>'ok') <> 'true' then raise exception 'other user batch failed'; end if;
end;
$$;
rollback;
