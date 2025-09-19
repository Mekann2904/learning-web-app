import type { SupabaseClient } from "@supabase/supabase-js"

import { createMonthSkeleton, type DayRecord, type MonthSummary, type StreakStats } from "@/lib/date"
import type { Database } from "@/lib/database.types"
import { supabaseBrowser } from "@/lib/supabase"

const DEFAULT_TIMEZONE = "Asia/Tokyo"
const LOOKBACK_DAYS = 60
const LOG_BUFFER_DAYS = 2

type HabitTaskRow = {
  id: string
  title: string
  active: boolean
  kind: string
  start_date: string | null
  end_date: string | null
  period_rules: {
    id: string
    cadence: "daily" | "weekly" | "monthly" | "interval"
    times_per_period: number | null
    period: string
    days_of_week: number[] | null
    week_start: number | null
    timezone: string | null
  }[] | null
}

type HabitTask = {
  id: string
  title: string
  active: boolean
  startDate?: string
  endDate?: string
  periodRules: Array<{
    id: string
    cadence: "daily" | "weekly" | "monthly" | "interval"
    timesPerPeriod: number | null
    period: string
    daysOfWeek: number[] | null
    weekStart: number | null
    timezone: string
  }>
}

type DayStat = {
  required: number
  completedTasks: number
  done: boolean
}

export type HabitDashboardDayStats = Record<string, DayStat>

export type HabitDashboardResult = {
  summary: MonthSummary
  dayStats: HabitDashboardDayStats
  completionRate: number
  totals: {
    trackedDays: number
    doneDays: number
    remainingDays: number
  }
  today: {
    required: number
    completed: number
    percentage: number
  }
  streak: StreakStats
  timezone: string
  taskCount: number
  isCurrentMonth: boolean
}

export async function fetchHabitDashboardMonth(
  year: number,
  month: number,
  options: { today?: Date; supabase?: SupabaseClient<Database> } = {}
): Promise<HabitDashboardResult> {
  const today = normalizeDate(options.today ?? new Date())
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === month

  const timeZone = resolveTimeZone()
  const todayIso = formatLocalDateISO(today, timeZone)

  const monthStart = new Date(year, month - 1, 1)
  const monthEnd = new Date(year, month, 0)
  const monthEndIso = formatLocalDateISO(monthEnd, timeZone)
  const referenceDate = isCurrentMonth ? today : monthEnd
  const referenceIso = isCurrentMonth ? todayIso : monthEndIso

  const lookbackStart = new Date(monthStart)
  lookbackStart.setDate(lookbackStart.getDate() - LOOKBACK_DAYS)

  const logsStart = new Date(lookbackStart)
  logsStart.setDate(logsStart.getDate() - LOG_BUFFER_DAYS)
  logsStart.setHours(0, 0, 0, 0)

  const logsEnd = new Date(monthEnd)
  logsEnd.setDate(logsEnd.getDate() + LOG_BUFFER_DAYS)
  logsEnd.setHours(23, 59, 59, 999)

  const supabase = options.supabase ?? supabaseBrowser()
  const { data: taskRows, error: taskError } = await supabase
    .from("task_defs")
    .select(
      "id, title, active, kind, start_date, end_date, period_rules ( id, cadence, times_per_period, period, days_of_week, week_start, timezone )"
    )
    .eq("kind", "habit")

  if (taskError) {
    throw taskError
  }

  const tasks = (taskRows ?? []).map(mapHabitTask)
  const activeTasks = tasks.filter((task) => task.active)
  const taskIds = activeTasks.map((task) => task.id)

  const { data: logRows, error: logError } = taskIds.length
    ? await supabase
        .from("exec_logs")
        .select("task_id, happened_at, qty")
        .gte("happened_at", logsStart.toISOString())
        .lt("happened_at", logsEnd.toISOString())
        .in("task_id", taskIds)
    : { data: [], error: null }

  if (logError) {
    throw logError
  }

  const dayTotals = buildDayTotals(logRows ?? [], timeZone)
  const dayStats = computeDayStats({
    tasks: activeTasks,
    dayTotals,
    timeZone,
    monthEnd,
    lookbackStart,
    referenceDate,
  })

  const monthSkeleton = createMonthSkeleton(year, month)
  const monthSummaryDays: DayRecord[] = monthSkeleton.map((day) => {
    const stat = dayStats[day.date]
    return {
      date: day.date,
      done: stat ? stat.done && stat.required > 0 : false,
    }
  })

  const trackedDays = monthSummaryDays.filter((day) => {
    const stat = dayStats[day.date]
    return stat ? stat.required > 0 : false
  }).length

  const doneDays = monthSummaryDays.filter((day) => {
    const stat = dayStats[day.date]
    return stat ? stat.required > 0 && stat.done : false
  }).length

  const completionRate = trackedDays === 0 ? 0 : Math.round((doneDays / trackedDays) * 100)
  const remainingDays = Math.max(trackedDays - doneDays, 0)

  const todayStat = dayStats[todayIso] ?? { required: 0, completedTasks: 0, done: false }
  const todayPercentage = todayStat.required === 0
    ? 100
    : Math.round((todayStat.completedTasks / todayStat.required) * 100)

  const streak = computeStreakStats(dayStats, referenceIso)

  return {
    summary: {
      year,
      month,
      days: monthSummaryDays,
    },
    dayStats,
    completionRate,
    totals: {
      trackedDays,
      doneDays,
      remainingDays,
    },
    today: {
      required: todayStat.required,
      completed: todayStat.completedTasks,
      percentage: todayPercentage,
    },
    streak,
    timezone: timeZone,
    taskCount: activeTasks.length,
    isCurrentMonth,
  }
}

function mapHabitTask(row: HabitTaskRow): HabitTask {
  return {
    id: row.id,
    title: row.title,
    active: row.active,
    startDate: row.start_date ?? undefined,
    endDate: row.end_date ?? undefined,
    periodRules: (row.period_rules ?? []).map((rule) => ({
      id: rule.id,
      cadence: rule.cadence,
      timesPerPeriod: rule.times_per_period,
      period: rule.period,
      daysOfWeek: rule.days_of_week ?? null,
      weekStart: rule.week_start ?? null,
      timezone: rule.timezone ?? DEFAULT_TIMEZONE,
    })),
  }
}

type DayTotals = Map<string, Map<string, number>>

type ComputeStatsArgs = {
  tasks: HabitTask[]
  dayTotals: DayTotals
  timeZone: string
  lookbackStart: Date
  monthEnd: Date
  referenceDate: Date
}

function computeDayStats({
  tasks,
  dayTotals,
  timeZone,
  monthEnd,
  lookbackStart,
  referenceDate,
}: ComputeStatsArgs): HabitDashboardDayStats {
  const stats: HabitDashboardDayStats = {}

  const endDate = new Date(monthEnd)
  const refDate = new Date(referenceDate)
  if (refDate > endDate) {
    endDate.setTime(refDate.getTime())
  }

  for (const date of iterateDates(lookbackStart, endDate)) {
    const iso = formatLocalDateISO(date, timeZone)
    const stat = computeDayStat(iso, tasks, dayTotals)
    stats[iso] = stat
  }

  return stats
}

function computeDayStat(
  isoDate: string,
  tasks: HabitTask[],
  dayTotals: DayTotals
): DayStat {
  const dayOfWeek = isoDayOfWeek(isoDate)
  const totals = dayTotals.get(isoDate)

  let required = 0
  let completedTasks = 0

  for (const task of tasks) {
    const target = determineTargetForDate(task, isoDate, dayOfWeek)
    if (target <= 0) continue

    required += 1
    const finished = totals?.get(task.id) ?? 0
    if (finished >= target) {
      completedTasks += 1
    }
  }

  const done = required === 0 ? true : completedTasks === required
  return { required, completedTasks, done }
}

function buildDayTotals(rows: Array<{ task_id: string; happened_at: string; qty: number | null }>, timeZone: string): DayTotals {
  const totals: DayTotals = new Map()
  for (const row of rows) {
    const iso = formatLocalDateISO(new Date(row.happened_at), timeZone)
    const qty = row.qty === null || row.qty === undefined ? 1 : Number(row.qty)
    if (!Number.isFinite(qty)) continue

    if (!totals.has(iso)) {
      totals.set(iso, new Map())
    }
    const taskTotals = totals.get(iso)!
    const current = taskTotals.get(row.task_id) ?? 0
    taskTotals.set(row.task_id, current + qty)
  }
  return totals
}

function computeStreakStats(dayStats: HabitDashboardDayStats, referenceIso: string): StreakStats {
  const entries = Object.entries(dayStats)
    .filter(([date]) => date <= referenceIso)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))

  let current = 0
  let breakDate: string | null = null

  for (let idx = entries.length - 1; idx >= 0; idx -= 1) {
    const [date, stat] = entries[idx]
    if (stat.required === 0) continue
    if (!stat.done) {
      breakDate = date
      break
    }
    current += 1
  }

  let longest = 0
  let streak = 0
  for (const [, stat] of entries) {
    if (stat.required === 0) continue
    if (stat.done) {
      streak += 1
      if (streak > longest) longest = streak
    } else {
      streak = 0
    }
  }

  return { current, longest, breakDate }
}

function iterateDates(start: Date, end: Date): Date[] {
  const dates: Date[] = []
  const current = new Date(start)
  current.setHours(0, 0, 0, 0)
  const limit = new Date(end)
  limit.setHours(0, 0, 0, 0)

  while (current <= limit) {
    dates.push(new Date(current))
    current.setDate(current.getDate() + 1)
  }
  return dates
}

function normalizeDate(date: Date): Date {
  const normalized = new Date(date)
  normalized.setHours(0, 0, 0, 0)
  return normalized
}

function resolveTimeZone(): string {
  if (typeof Intl !== "undefined") {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
      if (tz) return tz
    } catch (_error) {
      // ignore
    }
  }
  return DEFAULT_TIMEZONE
}

function formatLocalDateISO(date: Date, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
  return formatter.format(date)
}

function isoDayOfWeek(iso: string): number {
  const [y, m, d] = iso.split("-").map((value) => Number.parseInt(value, 10))
  const utcDate = new Date(Date.UTC(y, m - 1, d))
  return utcDate.getUTCDay()
}

function determineTargetForDate(task: HabitTask, isoDate: string, dayOfWeek: number): number {
  if (!taskActiveOnDate(task, isoDate)) return 0
  const rules = task.periodRules.length
    ? task.periodRules
    : [
        {
          id: `${task.id}-default`,
          cadence: "daily" as const,
          timesPerPeriod: 1,
          period: "day",
          daysOfWeek: null,
          weekStart: null,
          timezone: DEFAULT_TIMEZONE,
        },
      ]

  let total = 0
  for (const rule of rules) {
    if (ruleMatchesDate(rule, isoDate, dayOfWeek)) {
      total += rule.timesPerPeriod ?? 1
    }
  }
  return total
}

function taskActiveOnDate(task: HabitTask, isoDate: string): boolean {
  if (!task.active) return false
  if (task.startDate && task.startDate > isoDate) return false
  if (task.endDate && task.endDate < isoDate) return false
  return true
}

function ruleMatchesDate(
  rule: HabitTask["periodRules"][number],
  isoDate: string,
  dayOfWeek: number
): boolean {
  switch (rule.cadence) {
    case "daily":
      return true
    case "weekly": {
      const candidates = rule.daysOfWeek ?? []
      if (!candidates.length) return true
      return candidates.includes(dayOfWeek)
    }
    case "monthly": {
      const day = Number.parseInt(isoDate.slice(-2), 10)
      const days = rule.daysOfWeek ?? []
      if (!days.length) return day === 1
      return days.includes(day)
    }
    case "interval":
    default:
      return false
  }
}
