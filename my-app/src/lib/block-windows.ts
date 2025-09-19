import type { Database } from './database.types'

type TaskDefsRow = Database['public']['Tables']['task_defs']['Row']
type PeriodRulesRow = Database['public']['Tables']['period_rules']['Row']
type TimeRulesRow = Database['public']['Tables']['time_rules']['Row']
type TaskTagsRow = Database['public']['Tables']['task_tags']['Row'] & {
  tags?: Database['public']['Tables']['tags']['Row'] | null
}

const MINUTES_IN_DAY = 24 * 60
const DEFAULT_FOCUS_TAGS = ['focus']

type TaskRow = TaskDefsRow & {
  period_rules?: PeriodRulesRow[] | null
  time_rules?: TimeRulesRow[] | null
  task_tags?: (TaskTagsRow | null)[] | null
}

export type BlockingWindowPayload = {
  start_at: string
  end_at: string
  reason: string
  policy: {
    mode: 'blocklist'
    redirect_url: string
    severity: 'strict' | 'lenient'
  }
}

export type BuildWindowOptions = {
  dateIso: string
  timeZone: string
  preGraceMinutes?: number
  postGraceMinutes?: number
  durationDefaultMinutes?: number
  focusTagNames?: string[]
  focusOnly?: boolean
  redirectUrlDefault: string
}

type TaskEntity = {
  id: string
  title: string
  description?: string
  kind: 'single' | 'habit'
  active: boolean
  startDate?: string
  endDate?: string
  periodRules: PeriodRuleEntity[]
  timeRules: TimeRuleEntity[]
  tags: string[]
}

type PeriodRuleEntity = {
  id: string
  cadence: 'daily' | 'weekly' | 'monthly' | 'interval'
  timesPerPeriod: number | null
  period: string
  daysOfWeek: number[] | null
  weekStart: number | null
  timezone: string
}

type TimeRuleEntity = {
  id: string
  startTime: string | null
  endTime: string | null
  anytime: boolean
}

type IntermediateWindow = {
  startUtc: number
  endUtc: number
  startIso: string
  endIso: string
  startDate: Date
  endDate: Date
  redirectUrl: string
  severity: 'strict' | 'lenient'
  reasons: Set<string>
  timeZone: string
}

export function buildBlockingWindowsFromRows(rows: TaskRow[], options: BuildWindowOptions): BlockingWindowPayload[] {
  const tasks = rows.map(mapTaskRow)
  return buildBlockingWindows(tasks, options)
}

export function buildBlockingWindows(tasks: TaskEntity[], options: BuildWindowOptions): BlockingWindowPayload[] {
  const {
    dateIso,
    timeZone,
    preGraceMinutes = 3,
    postGraceMinutes = 3,
    durationDefaultMinutes = 60,
    focusTagNames = DEFAULT_FOCUS_TAGS,
    focusOnly = true,
    redirectUrlDefault,
  } = options

  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(dateIso)) {
    throw new Error('Invalid date format. Expected YYYY-MM-DD')
  }

  const dayOfWeek = isoDayOfWeek(dateIso)
  const focusNames = focusTagNames.length ? focusTagNames.map((tag) => sanitizeTag(tag)) : DEFAULT_FOCUS_TAGS

  const windows: IntermediateWindow[] = []

  for (const task of tasks) {
    if (!taskActiveOnDate(task, dateIso)) continue

    const targetCount = determineTargetForDate(task, dateIso, dayOfWeek)
    if (targetCount <= 0) continue

    const normalizedTags = task.tags.map((tag) => sanitizeTag(tag))
    const hasFocusTag = normalizedTags.some((tag) => focusNames.includes(tag))
    if (focusOnly && !hasFocusTag) continue

    const taskTimeZone = resolveTaskTimeZone(task, timeZone)
    const severity: 'strict' | 'lenient' = hasFocusTag ? 'strict' : 'lenient'
    const reasonBase = buildReason(task)
    const redirectUrl = redirectUrlDefault

    const rules = task.timeRules.length
      ? task.timeRules
      : [
          {
            id: `${task.id}-anytime`,
            startTime: null,
            endTime: null,
            anytime: true,
          },
        ]

    for (const rule of rules) {
      const { startMinutes, endMinutes } = resolveMinutesForRule(rule, {
        durationDefaultMinutes,
        preGraceMinutes,
        postGraceMinutes,
      })

      if (startMinutes === null || endMinutes === null) continue
      if (endMinutes <= startMinutes) continue

      const startDate = convertMinutesToDate(dateIso, startMinutes, taskTimeZone)
      const endDate = convertMinutesToDate(dateIso, endMinutes, taskTimeZone)

      if (!startDate || !endDate) continue

      const windowReason = reasonBase
      const startUtc = startDate.date.getTime()
      const endUtc = endDate.date.getTime()
      if (endUtc <= startUtc) continue

      windows.push({
        startUtc,
        endUtc,
        startIso: startDate.iso,
        endIso: endDate.iso,
        startDate: startDate.date,
        endDate: endDate.date,
        redirectUrl,
        severity,
        reasons: new Set([windowReason]),
        timeZone: taskTimeZone,
      })
    }
  }

  if (!windows.length) return []

  const merged = mergeWindows(windows)

  return merged.map((window) => ({
    start_at: window.startIso,
    end_at: window.endIso,
    reason: Array.from(window.reasons).join(' / '),
    policy: {
      mode: 'blocklist',
      redirect_url: window.redirectUrl,
      severity: window.severity,
    },
  }))
}

function mapTaskRow(row: TaskRow): TaskEntity {
  const periodRules: PeriodRuleEntity[] = (row.period_rules ?? []).map((rule) => ({
    id: rule.id,
    cadence: rule.cadence,
    timesPerPeriod: rule.times_per_period,
    period: rule.period,
    daysOfWeek: rule.days_of_week ?? null,
    weekStart: rule.week_start ?? null,
    timezone: rule.timezone,
  }))

  const timeRules: TimeRuleEntity[] = (row.time_rules ?? []).map((rule) => ({
    id: rule.id,
    startTime: rule.start_time,
    endTime: rule.end_time,
    anytime: rule.anytime,
  }))

  const tags: string[] = (row.task_tags ?? [])
    .map((record) => record?.tags?.name)
    .filter((name): name is string => typeof name === 'string' && name.length > 0)

  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    kind: row.kind,
    active: row.active,
    startDate: row.start_date ?? undefined,
    endDate: row.end_date ?? undefined,
    periodRules,
    timeRules,
    tags,
  }
}

function buildReason(task: TaskEntity): string {
  const tagSuffix = task.tags.length ? ` ${task.tags.map((tag) => `#${tag}`).join(' ')}` : ''
  return `タスク: ${task.title}${tagSuffix}`.trim()
}

function resolveTaskTimeZone(task: TaskEntity, fallback: string): string {
  const explicit = task.periodRules.find((rule) => rule.timezone)?.timezone
  return explicit || fallback
}

function createDefaultDailyRule(task: TaskEntity): PeriodRuleEntity {
  return {
    id: `${task.id}-default-period`,
    cadence: 'daily',
    timesPerPeriod: 1,
    period: 'day',
    daysOfWeek: null,
    weekStart: null,
    timezone: resolveTaskTimeZone(task, 'UTC'),
  }
}

function sanitizeTag(tag: string): string {
  const lowered = tag.toLowerCase()
  return lowered.startsWith('#') ? lowered.slice(1) : lowered
}

function resolveMinutesForRule(
  rule: TimeRuleEntity,
  options: { durationDefaultMinutes: number; preGraceMinutes: number; postGraceMinutes: number }
): { startMinutes: number | null; endMinutes: number | null } {
  if (rule.anytime || !rule.startTime) {
    const start = clampMinute(0 - options.preGraceMinutes)
    const end = clampMinute(MINUTES_IN_DAY + options.postGraceMinutes)
    return { startMinutes: start, endMinutes: end }
  }

  const startMinutes = clampMinute(toMinutes(rule.startTime) - options.preGraceMinutes)
  let endMinutes: number
  if (rule.endTime) {
    endMinutes = clampMinute(toMinutes(rule.endTime) + options.postGraceMinutes)
  } else {
    endMinutes = clampMinute(toMinutes(rule.startTime) + options.durationDefaultMinutes + options.postGraceMinutes)
  }

  return { startMinutes, endMinutes }
}

function clampMinute(value: number): number {
  if (value < 0) return 0
  if (value > MINUTES_IN_DAY) return MINUTES_IN_DAY
  return value
}

function toMinutes(value: string): number {
  if (!value) return 0
  const [hourPart, minutePart] = value.split(':')
  const hours = Number.parseInt(hourPart ?? '0', 10)
  const minutes = Number.parseInt(minutePart ?? '0', 10)
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 0
  return hours * 60 + minutes
}

function determineTargetForDate(task: TaskEntity, isoDate: string, dayOfWeek: number): number {
  if (!taskActiveOnDate(task, isoDate)) return 0
  const rules: PeriodRuleEntity[] = task.periodRules.length
    ? task.periodRules
    : [createDefaultDailyRule(task)]

  let total = 0
  for (const rule of rules) {
    if (ruleMatchesDate(rule, isoDate, dayOfWeek)) {
      const count = rule.timesPerPeriod ?? 1
      total += Number.isFinite(count) ? count : 1
    }
  }
  return total
}

function ruleMatchesDate(rule: PeriodRuleEntity, isoDate: string, dayOfWeek: number): boolean {
  switch (rule.cadence) {
    case 'daily':
      return true
    case 'weekly': {
      const days = rule.daysOfWeek ?? []
      if (!days.length) return true
      return days.includes(dayOfWeek)
    }
    case 'monthly': {
      const { day } = parseIsoDateParts(isoDate)
      const days = rule.daysOfWeek ?? []
      if (!days.length) return day === 1
      return days.includes(day)
    }
    default:
      return true
  }
}

function taskActiveOnDate(task: TaskEntity, isoDate: string): boolean {
  if (!task.active) return false
  if (task.startDate && task.startDate > isoDate) return false
  if (task.endDate && task.endDate < isoDate) return false
  return true
}

function parseIsoDateParts(iso: string) {
  const [yearStr, monthStr, dayStr] = iso.split('-')
  return {
    year: Number.parseInt(yearStr, 10),
    month: Number.parseInt(monthStr, 10),
    day: Number.parseInt(dayStr, 10),
  }
}

function isoDayOfWeek(iso: string): number {
  const { year, month, day } = parseIsoDateParts(iso)
  const d = new Date(Date.UTC(year, month - 1, day))
  return d.getUTCDay()
}

type ZonedDate = {
  date: Date
  iso: string
  offsetMinutes: number
}

const formatterCache = new Map<string, Intl.DateTimeFormat>()

function getFormatter(timeZone: string) {
  if (!formatterCache.has(timeZone)) {
    formatterCache.set(
      timeZone,
      new Intl.DateTimeFormat('en-US', {
        timeZone,
        hour12: false,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZoneName: 'shortOffset',
      })
    )
  }
  return formatterCache.get(timeZone)!
}

type FormatterParts = {
  year: string
  month: string
  day: string
  hour: string
  minute: string
  second: string
  offsetMinutes: number
}

function extractParts(date: Date, timeZone: string): FormatterParts {
  const formatter = getFormatter(timeZone)
  const parts = formatter.formatToParts(date)
  const result: Partial<FormatterParts> = {}
  let offset = 'GMT+00'
  for (const part of parts) {
    if (part.type === 'literal') continue
    if (part.type === 'timeZoneName') {
      offset = part.value
      continue
    }
    ;(result as Record<string, string>)[part.type] = part.value
  }
  if (!result.second) {
    result.second = '00'
  }
  return {
    year: result.year!,
    month: result.month!,
    day: result.day!,
    hour: result.hour!,
    minute: result.minute!,
    second: result.second!,
    offsetMinutes: parseOffsetMinutes(offset),
  }
}

function parseOffsetMinutes(value: string): number {
  const match = value.match(/([+-])(\d{1,2})(?::?(\d{2}))?$/)
  if (!match) return 0
  const sign = match[1] === '-' ? -1 : 1
  const hours = Number.parseInt(match[2], 10)
  const minutes = match[3] ? Number.parseInt(match[3], 10) : 0
  return sign * (hours * 60 + minutes)
}

function formatOffset(offsetMinutes: number): string {
  const sign = offsetMinutes >= 0 ? '+' : '-'
  const absolute = Math.abs(offsetMinutes)
  const hours = Math.floor(absolute / 60)
  const minutes = absolute % 60
  return `${sign}${pad(hours)}:${pad(minutes)}`
}

function pad(value: number): string {
  return value.toString().padStart(2, '0')
}

function convertMinutesToDate(dateIso: string, minutes: number, timeZone: string): ZonedDate | null {
  const { year, month, day } = parseIsoDateParts(dateIso)
  const base = Date.UTC(year, month - 1, day, 0, 0, 0, 0)
  const guess = new Date(base + minutes * 60_000)

  let initialParts = extractParts(guess, timeZone)
  let adjustedUtc = guess.getTime() - initialParts.offsetMinutes * 60_000
  let adjustedDate = new Date(adjustedUtc)
  let finalParts = extractParts(adjustedDate, timeZone)

  if (finalParts.offsetMinutes !== initialParts.offsetMinutes) {
    adjustedUtc = guess.getTime() - finalParts.offsetMinutes * 60_000
    adjustedDate = new Date(adjustedUtc)
    finalParts = extractParts(adjustedDate, timeZone)
  }

  if (!finalParts.year || !finalParts.month || !finalParts.day) {
    return null
  }

  const iso = `${finalParts.year}-${finalParts.month}-${finalParts.day}T${finalParts.hour}:${finalParts.minute}:${finalParts.second}${formatOffset(finalParts.offsetMinutes)}`

  return {
    date: adjustedDate,
    iso,
    offsetMinutes: finalParts.offsetMinutes,
  }
}

function mergeWindows(windows: IntermediateWindow[]): IntermediateWindow[] {
  const sorted = [...windows].sort((a, b) => a.startUtc - b.startUtc)
  const merged: IntermediateWindow[] = []

  for (const window of sorted) {
    const last = merged[merged.length - 1]
    if (
      last &&
      last.timeZone === window.timeZone &&
      last.redirectUrl === window.redirectUrl &&
      last.severity === window.severity &&
      window.startUtc <= last.endUtc
    ) {
      last.endUtc = Math.max(last.endUtc, window.endUtc)
      last.endDate = new Date(last.endUtc)
      const parts = extractParts(last.endDate, last.timeZone)
      last.endIso = `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}${formatOffset(parts.offsetMinutes)}`
      for (const reason of window.reasons) {
        last.reasons.add(reason)
      }
    } else {
      merged.push({ ...window })
    }
  }

  return merged
}
