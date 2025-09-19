export type DayRecord = { date: string; done: boolean }
export type MonthSummary = {
  year: number
  month: number
  days: DayRecord[]
}

export type StreakStats = {
  current: number
  longest: number
  breakDate: string | null
}

const MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "long",
})

const pad = (value: number) => value.toString().padStart(2, "0")

export const toDateKey = (date: Date): string => {
  const year = date.getFullYear()
  const month = pad(date.getMonth() + 1)
  const day = pad(date.getDate())
  return `${year}-${month}-${day}`
}

export const getDaysInMonth = (year: number, month: number): number => {
  return new Date(year, month, 0).getDate()
}

export const parseDateKey = (key: string): Date => {
  const [year, month, day] = key.split("-").map(Number)
  return new Date(year, month - 1, day)
}

export const getMonthIdentifier = (year: number, month: number) => `${year}-${pad(month)}`

export function createMonthSkeleton(year: number, month: number): DayRecord[] {
  const totalDays = getDaysInMonth(year, month)
  const days: DayRecord[] = []
  for (let day = 1; day <= totalDays; day += 1) {
    days.push({ date: `${year}-${pad(month)}-${pad(day)}`, done: false })
  }
  return days
}

export function seedMonth(year: number, month: number, referenceDate = new Date()): MonthSummary {
  const skeleton = createMonthSkeleton(year, month)
  const seededDays = skeleton.map((day) => {
    const dayDate = parseDateKey(day.date)
    const isFuture = dayDate > referenceDate
    if (isFuture) return { ...day, done: false }
    const randomDone = Math.random() < 0.7
    return { ...day, done: randomDone }
  })
  return { year, month, days: seededDays }
}

export function calculateCompletionRate(summary: MonthSummary): number {
  if (!summary.days.length) return 0
  const completed = summary.days.filter((day) => day.done).length
  return Math.round((completed / summary.days.length) * 100)
}

export function calculateStreaks(summary: MonthSummary, referenceDate = new Date()): StreakStats {
  if (!summary.days.length) {
    return { current: 0, longest: 0, breakDate: null }
  }

  const sortedDays = [...summary.days].sort((a, b) => (a.date < b.date ? -1 : 1))
  const todayKey = toDateKey(referenceDate)

  let current = 0
  let breakDate: string | null = null

  for (let i = sortedDays.length - 1; i >= 0; i -= 1) {
    const day = sortedDays[i]
    const dayDate = parseDateKey(day.date)
    if (dayDate > referenceDate) continue
    if (!day.done) {
      breakDate = day.date
      break
    }
    current += 1
  }

  const todayRecord = sortedDays.find((day) => day.date === todayKey)
  if (todayRecord && !todayRecord.done) {
    breakDate = todayRecord.date
  }

  let longest = 0
  let streak = 0
  for (const day of sortedDays) {
    const dayDate = parseDateKey(day.date)
    if (dayDate > referenceDate) continue
    if (day.done) {
      streak += 1
      longest = Math.max(longest, streak)
    } else {
      streak = 0
    }
  }

  return { current, longest, breakDate }
}

export function getMonthLabel(year: number, month: number) {
  const sampleDate = new Date(year, month - 1, 1)
  return MONTH_LABEL_FORMATTER.format(sampleDate)
}

export function getAdjacentMonth(year: number, month: number, offset: number) {
  const date = new Date(year, month - 1 + offset, 1)
  return { year: date.getFullYear(), month: date.getMonth() + 1 }
}

export function clampToMonth(date: Date, year: number, month: number): Date {
  const lastDay = getDaysInMonth(year, month)
  const day = Math.min(date.getDate(), lastDay)
  return new Date(year, month - 1, day)
}

export function isSameMonth(date: Date, year: number, month: number) {
  return date.getFullYear() === year && date.getMonth() + 1 === month
}

export function isSameDayKey(target: string, reference: Date) {
  return target === toDateKey(reference)
}

export function isBeforeToday(target: string, referenceDate = new Date()) {
  const dayDate = parseDateKey(target)
  return dayDate < new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate())
}

export function isAfterToday(target: string, referenceDate = new Date()) {
  const dayDate = parseDateKey(target)
  return dayDate > new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate())
}

export function sortMonthDays(days: DayRecord[]): DayRecord[] {
  return [...days].sort((a, b) => (a.date < b.date ? -1 : 1))
}
