create extension if not exists "pgcrypto";

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.task_defs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  title text not null,
  description text,
  kind text not null default 'single',
  active boolean not null default true,
  start_date date,
  end_date date,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint task_defs_kind_check check (kind in ('single', 'habit')),
  constraint task_defs_active_dates check (end_date is null or start_date is null or end_date >= start_date)
);

create trigger task_defs_set_updated_at
before update on public.task_defs
for each row
execute function public.handle_updated_at();

create table if not exists public.period_rules (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.task_defs(id) on delete cascade,
  cadence text not null,
  times_per_period integer,
  period text not null default 'day',
  days_of_week smallint[],
  week_start smallint,
  timezone text not null default 'UTC',
  created_at timestamptz not null default timezone('utc', now()),
  constraint period_rules_cadence_check check (cadence in ('daily', 'weekly', 'monthly', 'interval')),
  constraint period_rules_times_check check (times_per_period is null or times_per_period >= 0),
  constraint period_rules_week_start_check check (week_start is null or (week_start between 0 and 6))
);

create table if not exists public.time_rules (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.task_defs(id) on delete cascade,
  start_time time,
  end_time time,
  anytime boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  constraint time_rules_time_presence check (anytime = true or start_time is not null),
  constraint time_rules_end_after_start check (end_time is null or start_time is null or end_time > start_time)
);

create table if not exists public.exec_logs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.task_defs(id) on delete cascade,
  happened_at timestamptz not null default timezone('utc', now()),
  qty numeric,
  note text,
  source text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists exec_logs_task_happened_idx on public.exec_logs (task_id, happened_at desc);

create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint tags_unique_name_per_user unique (user_id, name)
);

create table if not exists public.task_tags (
  task_id uuid not null references public.task_defs(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (task_id, tag_id)
);

create index if not exists period_rules_task_idx on public.period_rules (task_id);
create index if not exists time_rules_task_idx on public.time_rules (task_id, start_time);
create index if not exists task_tags_tag_idx on public.task_tags (tag_id);

alter table public.task_defs enable row level security;
alter table public.period_rules enable row level security;
alter table public.time_rules enable row level security;
alter table public.exec_logs enable row level security;
alter table public.tags enable row level security;
alter table public.task_tags enable row level security;

create policy "task_defs_select_own" on public.task_defs
  for select
  using (auth.uid() = user_id);

create policy "task_defs_insert_own" on public.task_defs
  for insert
  with check (auth.uid() = user_id);

create policy "task_defs_update_own" on public.task_defs
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "task_defs_delete_own" on public.task_defs
  for delete
  using (auth.uid() = user_id);

create policy "period_rules_select_own" on public.period_rules
  for select
  using (
    exists (
      select 1 from public.task_defs td
      where td.id = period_rules.task_id and td.user_id = auth.uid()
    )
  );

create policy "period_rules_insert_own" on public.period_rules
  for insert
  with check (
    exists (
      select 1 from public.task_defs td
      where td.id = period_rules.task_id and td.user_id = auth.uid()
    )
  );

create policy "period_rules_modify_own" on public.period_rules
  for update using (
    exists (
      select 1 from public.task_defs td
      where td.id = period_rules.task_id and td.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.task_defs td
      where td.id = period_rules.task_id and td.user_id = auth.uid()
    )
  );

create policy "period_rules_delete_own" on public.period_rules
  for delete
  using (
    exists (
      select 1 from public.task_defs td
      where td.id = period_rules.task_id and td.user_id = auth.uid()
    )
  );

create policy "time_rules_select_own" on public.time_rules
  for select
  using (
    exists (
      select 1 from public.task_defs td
      where td.id = time_rules.task_id and td.user_id = auth.uid()
    )
  );

create policy "time_rules_insert_own" on public.time_rules
  for insert
  with check (
    exists (
      select 1 from public.task_defs td
      where td.id = time_rules.task_id and td.user_id = auth.uid()
    )
  );

create policy "time_rules_modify_own" on public.time_rules
  for update using (
    exists (
      select 1 from public.task_defs td
      where td.id = time_rules.task_id and td.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.task_defs td
      where td.id = time_rules.task_id and td.user_id = auth.uid()
    )
  );

create policy "time_rules_delete_own" on public.time_rules
  for delete
  using (
    exists (
      select 1 from public.task_defs td
      where td.id = time_rules.task_id and td.user_id = auth.uid()
    )
  );

create policy "exec_logs_select_own" on public.exec_logs
  for select
  using (
    exists (
      select 1 from public.task_defs td
      where td.id = exec_logs.task_id and td.user_id = auth.uid()
    )
  );

create policy "exec_logs_insert_own" on public.exec_logs
  for insert
  with check (
    exists (
      select 1 from public.task_defs td
      where td.id = exec_logs.task_id and td.user_id = auth.uid()
    )
  );

create policy "exec_logs_modify_own" on public.exec_logs
  for update using (
    exists (
      select 1 from public.task_defs td
      where td.id = exec_logs.task_id and td.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.task_defs td
      where td.id = exec_logs.task_id and td.user_id = auth.uid()
    )
  );

create policy "exec_logs_delete_own" on public.exec_logs
  for delete
  using (
    exists (
      select 1 from public.task_defs td
      where td.id = exec_logs.task_id and td.user_id = auth.uid()
    )
  );

create policy "tags_select_own" on public.tags
  for select using (auth.uid() = user_id);

create policy "tags_insert_own" on public.tags
  for insert with check (auth.uid() = user_id);

create policy "tags_modify_own" on public.tags
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "tags_delete_own" on public.tags
  for delete using (auth.uid() = user_id);

create policy "task_tags_select_own" on public.task_tags
  for select
  using (
    exists (
      select 1 from public.task_defs td
      where td.id = task_tags.task_id and td.user_id = auth.uid()
    )
  );

create policy "task_tags_insert_own" on public.task_tags
  for insert
  with check (
    exists (
      select 1 from public.task_defs td
      where td.id = task_tags.task_id and td.user_id = auth.uid()
    )
  );

create policy "task_tags_modify_own" on public.task_tags
  for update using (
    exists (
      select 1 from public.task_defs td
      where td.id = task_tags.task_id and td.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.task_defs td
      where td.id = task_tags.task_id and td.user_id = auth.uid()
    )
  );

create policy "task_tags_delete_own" on public.task_tags
  for delete
  using (
    exists (
      select 1 from public.task_defs td
      where td.id = task_tags.task_id and td.user_id = auth.uid()
    )
  );
