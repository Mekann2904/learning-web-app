-- Add scheduling columns to tasks table
alter table public.tasks
  add column if not exists start_date date,
  add column if not exists end_date date,
  add column if not exists start_time time,
  add column if not exists end_time time;

-- Ensure end_date defaults to start_date for existing rows
update public.tasks
set end_date = coalesce(end_date, start_date)
where start_date is not null;
