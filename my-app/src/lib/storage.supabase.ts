// src/lib/storage.supabase.ts
import type { SupabaseClient } from "@supabase/supabase-js"

import { supabaseBrowser } from "./supabase"
import type { Database } from "./database.types"

export type PeriodRule = {
  id: string
  cadence: "daily" | "weekly" | "monthly" | "interval"
  timesPerPeriod: number | null
  period: string
  daysOfWeek: number[] | null
  weekStart: number | null
  timezone: string
}

export type TimeRule = {
  id: string
  startTime: string | null
  endTime: string | null
  anytime: boolean
}

export type Tag = {
  id: string
  name: string
}

export type Task = {
  id: string
  title: string
  detail?: string
  description?: string
  kind: "single" | "habit"
  active: boolean
  startDate?: string
  endDate?: string
  periodRules: PeriodRule[]
  timeRules: TimeRule[]
  tags: Tag[]
  createdAt: number
  updatedAt: number
  done?: boolean
}

export type TimeSlotSummary = {
  id: string
  label: string
  anytime: boolean
  sortMinutes: number
  startTime: string | null
  endTime: string | null
}

export type TaskListRow = {
  id: string
  title: string
  detail?: string
  kind: "single" | "habit"
  active: boolean
  cadenceLabel: string
  tags: string[]
  timeSlots: TimeSlotSummary[]
  targetToday: number
  completedToday: number
  remainingToday: number
  statusToday: "todo" | "done" | "inactive"
  createdAt: number
  updatedAt: number
}

export type TodayTaskRow = {
  taskId: string
  slotId: string
  title: string
  kind: "single" | "habit"
  tags: string[]
  timeLabel: string
  anytime: boolean
  startTime: string | null
  endTime: string | null
  target: number
  completed: number
  remaining: number
  status: "todo" | "done"
  sortMinutes: number
}

export type PeriodRuleInput = {
  cadence: "daily" | "weekly" | "monthly" | "interval"
  timesPerPeriod?: number | null
  period?: string | null
  daysOfWeek?: number[] | null
  weekStart?: number | null
  timezone?: string
}

export type TimeRuleInput = {
  startTime?: string | null
  endTime?: string | null
  anytime?: boolean
}

type TaskDefsRow = Database["public"]["Tables"]["task_defs"]["Row"]
type PeriodRulesRow = Database["public"]["Tables"]["period_rules"]["Row"]
type TimeRulesRow = Database["public"]["Tables"]["time_rules"]["Row"]
type TagsRow = Database["public"]["Tables"]["tags"]["Row"]
type ExecLogsRow = Database["public"]["Tables"]["exec_logs"]["Row"]

type TaskDefQueryRow = TaskDefsRow & {
  period_rules?: PeriodRulesRow[] | null
  time_rules?: TimeRulesRow[] | null
  task_tags?: ({
    tag_id: string
    tags?: TagsRow | null
  } | null)[] | null
}

type CreateTaskInput = {
  title: string
  detail?: string
  description?: string
  kind?: "single" | "habit"
  active?: boolean
  startDate?: string
  endDate?: string
  periodRules?: PeriodRuleInput[]
  timeRules?: TimeRuleInput[]
  tags?: string[]
  timezone?: string
}

type UpdateTaskInput = Partial<Omit<CreateTaskInput, "title">> & {
  title?: string
}

const DEFAULT_LOOKBACK_DAYS = 14
const ANYTIME_SORT_MINUTES = 24 * 60
const DEFAULT_TIMEZONE = "Asia/Tokyo"

function defaultPeriodForCadence(cadence: "daily" | "weekly" | "monthly" | "interval"): string {
  switch (cadence) {
    case "weekly":
      return "week"
    case "monthly":
      return "month"
    default:
      return "day"
  }
}

function getResolvedTimeZone(): string {
  if (typeof Intl !== "undefined") {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
      if (tz) return tz
    } catch (err) {
      console.warn("Failed to resolve Intl timezone", err)
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

function toMinutes(time?: string | null): number {
  if (!time) return ANYTIME_SORT_MINUTES
  const [hours, minutes] = time.split(":").map((value) => Number.parseInt(value, 10))
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return ANYTIME_SORT_MINUTES
  return hours * 60 + minutes
}

function buildTimeSlots(rules: TimeRule[], taskId: string): TimeSlotSummary[] {
  if (!rules.length) {
    return [
      {
        id: `${taskId}-anytime`,
        label: "いつでも",
        anytime: true,
        sortMinutes: ANYTIME_SORT_MINUTES,
        startTime: null,
        endTime: null,
      },
    ]
  }
  return rules.map((rule) => {
    const start = rule.startTime
    const end = rule.endTime
    const isAnytime = rule.anytime || !start
    const label = isAnytime
      ? "いつでも"
      : end
      ? `${start.slice(0, 5)} - ${end.slice(0, 5)}`
      : start.slice(0, 5)
    const sortMinutes = isAnytime ? ANYTIME_SORT_MINUTES : toMinutes(start)
    return {
      id: rule.id,
      label,
      anytime: isAnytime,
      sortMinutes,
      startTime: start ?? null,
      endTime: end ?? null,
    }
  })
}

function parseIsoDateParts(iso: string) {
  const [y, m, d] = iso.split("-").map((v) => Number.parseInt(v, 10))
  return { year: y, month: m, day: d }
}

function isoDayOfWeek(iso: string): number {
  const { year, month, day } = parseIsoDateParts(iso)
  const d = new Date(Date.UTC(year, month - 1, day))
  return d.getUTCDay()
}

function ruleMatchesDate(rule: PeriodRule, isoDate: string, dayOfWeek: number): boolean {
  switch (rule.cadence) {
    case "daily":
      return true
    case "weekly": {
      const candidates = rule.daysOfWeek ?? []
      if (!candidates.length) return true
      return candidates.includes(dayOfWeek)
    }
    case "monthly": {
      const { day } = parseIsoDateParts(isoDate)
      const days = rule.daysOfWeek ?? []
      if (!days.length) return day === 1
      return days.includes(day)
    }
    case "interval":
    default:
      return false
  }
}

function cadenceLabel(rule: PeriodRule): string {
  switch (rule.cadence) {
    case "daily":
      return rule.timesPerPeriod && rule.timesPerPeriod > 1
        ? `毎日${rule.timesPerPeriod}回`
        : "毎日"
    case "weekly": {
      const names = (rule.daysOfWeek ?? []).map((day) => "日月火水木金土"[day] ?? "?")
      const dayText = names.length ? `(${names.join("・")})` : ""
      if (rule.timesPerPeriod && rule.timesPerPeriod > 0) {
        return `週次${dayText} ${rule.timesPerPeriod}回/週`
      }
      return `週次${dayText}`
    }
    case "monthly": {
      const days = rule.daysOfWeek ?? []
      const dayText = days.length ? `(${days.join("日, ")}日)` : ""
      if (rule.timesPerPeriod && rule.timesPerPeriod > 0) {
        return `月次${dayText} ${rule.timesPerPeriod}回/月`
      }
      return `月次${dayText}`
    }
    case "interval":
    default:
      return "インターバル"
  }
}

function aggregateCadenceLabel(rules: PeriodRule[]): string {
  if (!rules.length) return "未設定"
  return rules.map(cadenceLabel).join(" / ")
}

function taskActiveOnDate(task: Task, isoDate: string): boolean {
  if (!task.active) return false
  if (task.startDate && task.startDate > isoDate) return false
  if (task.endDate && task.endDate < isoDate) return false
  return true
}

function determineTargetForDate(task: Task, isoDate: string, dayOfWeek: number): number {
  if (!taskActiveOnDate(task, isoDate)) return 0
  const rules = task.periodRules.length
    ? task.periodRules
    : [
        {
          id: `${task.id}-default`,
          cadence: "daily",
          timesPerPeriod: 1,
          period: "day",
          daysOfWeek: null,
          weekStart: null,
          timezone: DEFAULT_TIMEZONE,
        } satisfies PeriodRule,
      ]

  let total = 0
  for (const rule of rules) {
    if (ruleMatchesDate(rule, isoDate, dayOfWeek)) {
      total += rule.timesPerPeriod ?? 1
    }
  }
  return total
}

export function mapTaskRow(row: TaskDefQueryRow): Task {
  const periodRules: PeriodRule[] = (row.period_rules ?? []).map((rule) => ({
    id: rule.id,
    cadence: rule.cadence,
    timesPerPeriod: rule.times_per_period,
    period: rule.period,
    daysOfWeek: rule.days_of_week ?? null,
    weekStart: rule.week_start ?? null,
    timezone: rule.timezone,
  }))

  const timeRules: TimeRule[] = (row.time_rules ?? []).map((rule) => ({
    id: rule.id,
    startTime: rule.start_time,
    endTime: rule.end_time,
    anytime: rule.anytime,
  }))

  const tagRecords = (row.task_tags ?? [])
    .map((record) => record?.tags)
    .filter((tag): tag is TagsRow => !!tag)

  const uniqueTags = new Map<string, Tag>()
  for (const tag of tagRecords) {
    uniqueTags.set(tag.id, { id: tag.id, name: tag.name })
  }

  const description = row.description ?? undefined
  const detail = description

  return {
    id: row.id,
    title: row.title,
    description,
    detail,
    kind: row.kind,
    active: row.active,
    startDate: row.start_date ?? undefined,
    endDate: row.end_date ?? undefined,
    periodRules,
    timeRules,
    tags: Array.from(uniqueTags.values()),
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
    done: false,
  }
}

function sanitizeForIlike(value: string) {
  return value.replace(/[%,_]+/g, " ").trim()
}

export async function list(client?: SupabaseClient<Database>): Promise<Task[]> {
  const supabase = client ?? supabaseBrowser()
  const { data, error } = await supabase
    .from("task_defs")
    .select(
      `id, title, description, kind, active, start_date, end_date, created_at, updated_at,
        period_rules (*), time_rules (*), task_tags ( tag_id, tags ( id, name ) )`
    )
    .order("updated_at", { ascending: false })

  if (error) throw error
  return (data ?? []).map(mapTaskRow)
}

export async function search(query: string, limit = 8): Promise<Task[]> {
  const supabase = supabaseBrowser()
  const cleaned = sanitizeForIlike(query)
  if (!cleaned) return []

  const pattern = `%${cleaned}%`
  const { data, error } = await supabase
    .from("task_defs")
    .select(
      "id, title, description, kind, active, start_date, end_date, created_at, updated_at"
    )
    .or(`title.ilike.${pattern},description.ilike.${pattern}`)
    .order("updated_at", { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data ?? []).map((row) =>
    mapTaskRow({
      ...row,
      period_rules: [],
      time_rules: [],
      task_tags: [],
    })
  )
}

export async function get(id: string): Promise<Task | undefined> {
  const supabase = supabaseBrowser()
  const { data, error } = await supabase
    .from("task_defs")
    .select(
      `id, title, description, kind, active, start_date, end_date, created_at, updated_at,
        period_rules (*), time_rules (*), task_tags ( tag_id, tags ( id, name ) )`
    )
    .eq("id", id)
    .maybeSingle()

  if (error) throw error
  return data ? mapTaskRow(data) : undefined
}

export async function create(input: CreateTaskInput): Promise<Task> {
  const supabase = supabaseBrowser()
  const timezone = input.timezone ?? getResolvedTimeZone()
  const payload = {
    title: input.title,
    description: input.detail ?? input.description ?? null,
    kind: input.kind ?? "single",
    active: input.active ?? true,
    start_date: input.startDate ?? null,
    end_date: input.endDate ?? null,
  }

  const { data: inserted, error: insertError } = await supabase
    .from("task_defs")
    .insert(payload)
    .select(
      "id, title, description, kind, active, start_date, end_date, created_at, updated_at"
    )
    .single()

  if (insertError) throw insertError

  const taskId = inserted.id

  const periodRuleInputs = input.periodRules && input.periodRules.length > 0
    ? input.periodRules
    : [{ cadence: "daily", timesPerPeriod: 1, period: "day", timezone }]

  const periodRows = periodRuleInputs.map((rule) => {
    const cadence = rule.cadence ?? "daily"
    return {
      task_id: taskId,
      cadence,
      times_per_period:
        rule.timesPerPeriod === undefined || rule.timesPerPeriod === null ? null : rule.timesPerPeriod,
      period: rule.period ?? defaultPeriodForCadence(cadence),
      days_of_week: rule.daysOfWeek ?? null,
      week_start: rule.weekStart ?? null,
      timezone: rule.timezone ?? timezone,
    }
  })

  if (periodRows.length) {
    const { error: periodError } = await supabase.from("period_rules").insert(periodRows)
    if (periodError) throw periodError
  }

  const timeRuleInputs = input.timeRules && input.timeRules.length > 0
    ? input.timeRules
    : [{ anytime: true }]

  const timeRows = timeRuleInputs.map((rule) => {
    const start = rule.startTime ?? null
    const end = rule.endTime ?? null
    const anytimeFlag = rule.anytime ?? !start
    return {
      task_id: taskId,
      start_time: anytimeFlag ? null : start,
      end_time: anytimeFlag ? null : end,
      anytime: anytimeFlag,
    }
  })

  if (timeRows.length) {
    const { error: timeError } = await supabase.from("time_rules").insert(timeRows)
    if (timeError) throw timeError
  }

  if (input.tags && input.tags.length) {
    const existingTags = new Map<string, TagsRow>()
    const lowerNames = input.tags.map((name) => name.trim()).filter(Boolean)

    if (lowerNames.length) {
      const { data: tagRows, error: tagError } = await supabase
        .from("tags")
        .select("id, name")
        .in("name", lowerNames)

      if (tagError) throw tagError
      for (const tag of tagRows ?? []) {
        existingTags.set(tag.name, tag)
      }

      const newTags = lowerNames.filter((name) => !existingTags.has(name))
      if (newTags.length) {
        const { data: insertedTags, error: newTagError } = await supabase
          .from("tags")
          .insert(newTags.map((name) => ({ name })))
          .select("id, name")

        if (newTagError) throw newTagError
        for (const tag of insertedTags ?? []) {
          existingTags.set(tag.name, tag)
        }
      }

      const links = lowerNames
        .map((name) => existingTags.get(name))
        .filter((tag): tag is TagsRow => !!tag)
        .map((tag) => ({ task_id: taskId, tag_id: tag.id }))

      if (links.length) {
        const { error: linkError } = await supabase.from("task_tags").insert(links)
        if (linkError) throw linkError
      }
    }
  }

  const full = await get(taskId)
  if (!full) {
    return mapTaskRow({
      ...inserted,
      period_rules: [],
      time_rules: [],
      task_tags: [],
    })
  }
  return full
}

export async function update(id: string, patch: UpdateTaskInput): Promise<Task | undefined> {
  const supabase = supabaseBrowser()
  const payload: Partial<TaskDefsRow> = {}
  if (patch.title !== undefined) payload.title = patch.title
  if (patch.detail !== undefined || patch.description !== undefined) {
    payload.description = patch.detail ?? patch.description ?? null
  }
  if (patch.kind !== undefined) payload.kind = patch.kind
  if (patch.active !== undefined) payload.active = patch.active
  if (patch.startDate !== undefined) payload.start_date = patch.startDate ?? null
  if (patch.endDate !== undefined) payload.end_date = patch.endDate ?? null

  if (Object.keys(payload).length) {
    const { error } = await supabase.from("task_defs").update(payload).eq("id", id)
    if (error) throw error
  }

  const timezone = patch.timezone ?? getResolvedTimeZone()

  if (patch.periodRules !== undefined) {
    const { error: clearPeriod } = await supabase.from("period_rules").delete().eq("task_id", id)
    if (clearPeriod) throw clearPeriod

    const inputs = patch.periodRules.length
      ? patch.periodRules
      : [{ cadence: "daily", timesPerPeriod: 1, period: "day", timezone }]

    const rows = inputs.map((rule) => {
      const cadence = rule.cadence ?? "daily"
      return {
        task_id: id,
        cadence,
        times_per_period:
          rule.timesPerPeriod === undefined || rule.timesPerPeriod === null ? null : rule.timesPerPeriod,
        period: rule.period ?? defaultPeriodForCadence(cadence),
        days_of_week: rule.daysOfWeek ?? null,
        week_start: rule.weekStart ?? null,
        timezone: rule.timezone ?? timezone,
      }
    })

    if (rows.length) {
      const { error: insertPeriod } = await supabase.from("period_rules").insert(rows)
      if (insertPeriod) throw insertPeriod
    }
  }

  if (patch.timeRules !== undefined) {
    const { error: clearTime } = await supabase.from("time_rules").delete().eq("task_id", id)
    if (clearTime) throw clearTime

    const inputs = patch.timeRules.length ? patch.timeRules : [{ anytime: true }]

    const rows = inputs.map((rule) => {
      const start = rule.startTime ?? null
      const end = rule.endTime ?? null
      const anytimeFlag = rule.anytime ?? !start
      return {
        task_id: id,
        start_time: anytimeFlag ? null : start,
        end_time: anytimeFlag ? null : end,
        anytime: anytimeFlag,
      }
    })

    if (rows.length) {
      const { error: insertTime } = await supabase.from("time_rules").insert(rows)
      if (insertTime) throw insertTime
    }
  }

  if (patch.tags !== undefined) {
    const supabaseClient = supabase
    const tagNames = patch.tags.map((name) => name.trim()).filter(Boolean)

    const { error: clearError } = await supabaseClient
      .from("task_tags")
      .delete()
      .eq("task_id", id)

    if (clearError) throw clearError

    if (tagNames.length) {
      const existing = new Map<string, TagsRow>()
      const { data: tagRows, error: tagError } = await supabaseClient
        .from("tags")
        .select("id, name")
        .in("name", tagNames)

      if (tagError) throw tagError

      for (const tag of tagRows ?? []) {
        existing.set(tag.name, tag)
      }

      const missing = tagNames.filter((name) => !existing.has(name))
      if (missing.length) {
        const { data: newTags, error: addError } = await supabaseClient
          .from("tags")
          .insert(missing.map((name) => ({ name })))
          .select("id, name")

        if (addError) throw addError
        for (const tag of newTags ?? []) {
          existing.set(tag.name, tag)
        }
      }

      const links = tagNames
        .map((name) => existing.get(name))
        .filter((tag): tag is TagsRow => !!tag)
        .map((tag) => ({ task_id: id, tag_id: tag.id }))

      if (links.length) {
        const { error: relError } = await supabaseClient.from("task_tags").insert(links)
        if (relError) throw relError
      }
    }
  }

  return await get(id)
}

export async function logExecution(taskId: string, qty = 1): Promise<void> {
  const supabase = supabaseBrowser()
  const amount = Number.isFinite(qty) ? qty : 1
  const payload = {
    task_id: taskId,
    qty: amount,
    happened_at: new Date().toISOString(),
  }
  const { error } = await supabase.from("exec_logs").insert(payload)
  if (error) throw error
}

export async function remove(id: string): Promise<void> {
  const supabase = supabaseBrowser()
  const { error } = await supabase.from("task_defs").delete().eq("id", id)
  if (error) throw error
}

export async function fetchTaskOverview(options?: {
  date?: Date
  timeZone?: string
  lookbackDays?: number
  supabase?: SupabaseClient<Database>
}): Promise<{
  list: TaskListRow[]
  today: TodayTaskRow[]
  dateIso: string
  timeZone: string
}> {
  const timeZone = options?.timeZone ?? getResolvedTimeZone()
  const baseDate = options?.date ?? new Date()
  const dateIso = formatLocalDateISO(baseDate, timeZone)
  const dayOfWeek = isoDayOfWeek(dateIso)
  const lookbackDays = options?.lookbackDays ?? DEFAULT_LOOKBACK_DAYS

  const tasks = await list(options?.supabase)
  if (!tasks.length) {
    return { list: [], today: [], dateIso, timeZone }
  }

  const taskIds = tasks.map((task) => task.id)
  const since = new Date(baseDate)
  since.setDate(since.getDate() - lookbackDays)

  const supabase = options?.supabase ?? supabaseBrowser()
  let execLogs: ExecLogsRow[] = []

  if (taskIds.length) {
    const { data, error } = await supabase
      .from("exec_logs")
      .select("task_id, happened_at, qty")
      .gte("happened_at", since.toISOString())
      .in("task_id", taskIds)

    if (error) throw error
    execLogs = data ?? []
  }

  const todayTotals = new Map<string, number>()
  for (const log of execLogs) {
    const logDate = formatLocalDateISO(new Date(log.happened_at), timeZone)
    if (logDate !== dateIso) continue
    const qty = log.qty === null || log.qty === undefined ? 1 : Number(log.qty)
    const prev = todayTotals.get(log.task_id) ?? 0
    todayTotals.set(log.task_id, prev + (Number.isFinite(qty) ? qty : 0))
  }

  const listRows: TaskListRow[] = tasks.map((task) => {
    const targetToday = determineTargetForDate(task, dateIso, dayOfWeek)
    const completedToday = todayTotals.get(task.id) ?? 0
    const remainingToday = Math.max(targetToday - completedToday, 0)
    const statusToday = !taskActiveOnDate(task, dateIso)
      ? "inactive"
      : remainingToday <= 0
      ? "done"
      : "todo"
    return {
      id: task.id,
      title: task.title,
      detail: task.detail,
      kind: task.kind,
      active: task.active,
      cadenceLabel: aggregateCadenceLabel(task.periodRules),
      tags: task.tags.map((tag) => tag.name),
      timeSlots: buildTimeSlots(task.timeRules, task.id),
      targetToday,
      completedToday,
      remainingToday,
      statusToday,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    }
  })

  const todayRows: TodayTaskRow[] = listRows
    .filter((row) => row.targetToday > 0)
    .flatMap((row) => {
      const slots = row.timeSlots.length ? row.timeSlots : buildTimeSlots([], row.id)
      return slots.map((slot) => ({
        taskId: row.id,
        slotId: slot.id,
        title: row.title,
        kind: row.kind,
        tags: row.tags,
        timeLabel: slot.label,
        anytime: slot.anytime,
        startTime: slot.startTime,
        endTime: slot.endTime,
        target: row.targetToday,
        completed: row.completedToday,
        remaining: row.remainingToday,
        status: row.remainingToday <= 0 ? "done" : "todo",
        sortMinutes: slot.sortMinutes,
      }))
    })
    .sort((a, b) => {
      if (a.anytime !== b.anytime) {
        if (a.anytime) return 1
        if (b.anytime) return -1
      }
      if (a.sortMinutes !== b.sortMinutes) return a.sortMinutes - b.sortMinutes
      if (a.status !== b.status) {
        return a.status === "todo" ? -1 : 1
      }
      return a.title.localeCompare(b.title, "ja")
    })

  return { list: listRows, today: todayRows, dateIso, timeZone }
}
