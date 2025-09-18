begin;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'time_rules'
      and column_name = 'time_local'
  ) then
    alter table public.time_rules rename column time_local to start_time;
  end if;
end;
$$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'time_rules'
      and column_name = 'window_minutes'
  ) then
    alter table public.time_rules drop column window_minutes;
  end if;
end;
$$;

alter table public.time_rules add column if not exists end_time time;

do $$
begin
  if exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'time_rules'
      and constraint_name = 'time_rules_time_presence'
  ) then
    alter table public.time_rules drop constraint time_rules_time_presence;
  end if;
end;
$$;

do $$
begin
  if exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'time_rules'
      and constraint_name = 'time_rules_window_check'
  ) then
    alter table public.time_rules drop constraint time_rules_window_check;
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'time_rules'
      and constraint_name = 'time_rules_time_presence'
  ) then
    alter table public.time_rules add constraint time_rules_time_presence
      check (anytime = true or start_time is not null);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'time_rules'
      and constraint_name = 'time_rules_end_after_start'
  ) then
    alter table public.time_rules add constraint time_rules_end_after_start
      check (end_time is null or start_time is null or end_time > start_time);
  end if;
end;
$$;

update public.time_rules
set anytime = true
where start_time is null;

create index if not exists time_rules_task_idx on public.time_rules (task_id, start_time);

commit;
