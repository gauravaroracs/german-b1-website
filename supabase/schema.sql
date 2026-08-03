create table if not exists public.deutsch_meister_state (
  user_id uuid not null references auth.users(id) on delete cascade,
  state_key text not null,
  state_value jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, state_key)
);

alter table public.deutsch_meister_state enable row level security;

drop policy if exists "Users can read their own Deutsch Meister state" on public.deutsch_meister_state;
create policy "Users can read their own Deutsch Meister state"
on public.deutsch_meister_state
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own Deutsch Meister state" on public.deutsch_meister_state;
create policy "Users can insert their own Deutsch Meister state"
on public.deutsch_meister_state
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own Deutsch Meister state" on public.deutsch_meister_state;
create policy "Users can update their own Deutsch Meister state"
on public.deutsch_meister_state
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own Deutsch Meister state" on public.deutsch_meister_state;
create policy "Users can delete their own Deutsch Meister state"
on public.deutsch_meister_state
for delete
to authenticated
using (auth.uid() = user_id);
