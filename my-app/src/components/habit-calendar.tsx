"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Info } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import type { HabitDashboardDayStats } from "@/lib/habit-dashboard"
import { cn } from "@/lib/utils"
import { isAfterToday, sortMonthDays, type MonthSummary } from "@/lib/date"

interface HabitCalendarProps {
  summary: MonthSummary
  breakDate: string | null
  todayKey: string
  onToggleDay?: (date: string) => void
  monthLabel: string
  isCurrentMonth: boolean
  allowToggle?: boolean
  dayStats?: HabitDashboardDayStats
}

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"]

export default function HabitCalendar({
  summary,
  breakDate,
  todayKey,
  onToggleDay,
  monthLabel,
  isCurrentMonth,
  allowToggle = true,
  dayStats,
}: HabitCalendarProps) {
  const days = useMemo(() => sortMonthDays(summary.days), [summary.days])
  const dayRefs = useRef<Array<HTMLButtonElement | null>>([])
  const [focusedIndex, setFocusedIndex] = useState(0)

  useEffect(() => {
    const todayIndex = days.findIndex((day) => day.date === todayKey)
    if (todayIndex !== -1) {
      setFocusedIndex(todayIndex)
    } else {
      setFocusedIndex(0)
    }
  }, [days, todayKey])

  const monthStartsOn = new Date(summary.year, summary.month - 1, 1).getDay()
  const blanks = Array.from({ length: monthStartsOn }, (_, index) => index)

  const handleDayKey = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null
    const columns = 7
    if (event.key === "ArrowRight") {
      nextIndex = Math.min(days.length - 1, index + 1)
    } else if (event.key === "ArrowLeft") {
      nextIndex = Math.max(0, index - 1)
    } else if (event.key === "ArrowDown") {
      nextIndex = Math.min(days.length - 1, index + columns)
    } else if (event.key === "ArrowUp") {
      nextIndex = Math.max(0, index - columns)
    } else if (event.key === "Home") {
      nextIndex = 0
    } else if (event.key === "End") {
      nextIndex = days.length - 1
    } else if (event.key === " ") {
      event.preventDefault()
      attemptToggle(index)
    } else if (event.key === "Enter") {
      event.preventDefault()
      attemptToggle(index)
    }

    if (nextIndex !== null) {
      event.preventDefault()
      setFocusedIndex(nextIndex)
      dayRefs.current[nextIndex]?.focus()
    }
  }

  const attemptToggle = (index: number) => {
    if (!allowToggle || !onToggleDay) return
    const day = days[index]
    if (!day) return
    if (isAfterToday(day.date)) return
    const stats = dayStats?.[day.date]
    const isTracked = (stats?.required ?? 0) > 0
    if (!isTracked) return
    onToggleDay(day.date)
  }

  return (
    <Card className="rounded-2xl border border-border/60 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="flex items-baseline gap-2 text-base font-semibold text-foreground">
          <span>{monthLabel}</span>
          {isCurrentMonth ? <BadgeIndicator /> : null}
        </CardTitle>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full" aria-label="凡例を表示">
              <Info className="size-4" aria-hidden />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="rounded-2xl border border-border/60 bg-background shadow-lg">
            <div className="space-y-3 text-sm">
              <div className="font-semibold">凡例</div>
              <Separator className="bg-border/60" />
              <LegendRow color="bg-primary" label="完了" description="今日までに全タスクを完了" />
              <LegendRow color="bg-muted" label="未達" description="まだ完了していない日" />
              <LegendRow
                color="border border-destructive border-dashed bg-transparent"
                label="連続切断"
                description="連続が途切れた日"
              />
              <LegendRow color="border border-foreground bg-transparent" label="今日" description="本日" />
              <LegendRow
                color="border border-dashed border-border/60 bg-background"
                label="対象なし"
                description="習慣の予定がない日"
              />
            </div>
          </PopoverContent>
        </Popover>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-7 text-center text-xs font-medium uppercase text-muted-foreground">
          {WEEKDAYS.map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {blanks.map((blank) => (
            <div key={`blank-${blank}`} aria-hidden />
          ))}

          {days.map((day, index) => {
            const displayDay = parseInt(day.date.slice(-2), 10)
            const isToday = todayKey === day.date
            const isFuture = isAfterToday(day.date)
            const isBreak = breakDate === day.date
            const stats = dayStats?.[day.date]
            const requiredCount = stats?.required ?? 0
            const completedTasks = stats?.completedTasks ?? 0
            const isTracked = requiredCount > 0
            const isDone = isTracked ? day.done : false
            const statusLabel = !isTracked
              ? "対象タスクなし"
              : isDone
              ? "完了"
              : "未達"
            const disabled = isFuture || !allowToggle || !onToggleDay || !isTracked

            return (
              <button
                key={day.date}
                ref={(node) => {
                  dayRefs.current[index] = node
                }}
                type="button"
                className={cn(
                  "relative flex h-10 w-full items-center justify-center rounded-xl text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  isDone
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : isTracked
                    ? "bg-muted/40 text-muted-foreground hover:bg-muted"
                    : "bg-background text-muted-foreground border border-dashed border-border/60",
                  disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
                  isToday ? "ring-2 ring-foreground ring-offset-2" : null,
                  isBreak ? "border border-destructive border-dashed" : null
                )}
                aria-pressed={isTracked ? isDone : undefined}
                aria-label={`${summary.month}月${displayDay}日 ${statusLabel}`}
                disabled={disabled}
                tabIndex={focusedIndex === index && !disabled ? 0 : -1}
                onKeyDown={(event) => handleDayKey(event, index)}
                onFocus={() => setFocusedIndex(index)}
                onClick={() => attemptToggle(index)}
              >
                <span>{displayDay}</span>
                {isTracked ? (
                  <span className="sr-only">{`${completedTasks}/${requiredCount}タスク`}</span>
                ) : null}
              </button>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

const BadgeIndicator = () => (
  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">今月</span>
)

const LegendRow = ({ color, label, description }: { color: string; label: string; description: string }) => (
  <div className="flex items-start gap-3">
    <span className={cn("mt-0.5 h-4 w-4 rounded-lg", color)} aria-hidden />
    <div>
      <p className="text-sm font-medium text-foreground">{label}</p>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  </div>
)
