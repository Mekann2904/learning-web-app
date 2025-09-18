import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react"
import { ChevronDown } from "lucide-react"

import { Calendar, type DateRange } from "@/components/ui/calendar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import TaskTitleDetailFields from "@/components/TaskTitleDetailFields"
import { supabaseBrowser } from "@/lib/supabase"
import * as store from "@/lib/storage.supabase"
import type { Task } from "@/lib/storage.supabase"

const DEFAULT_START_TIME = "09:00"
const DEFAULT_END_TIME = ""
const DEFAULT_TIMES_PER_PERIOD = "1"

const WEEKDAY_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: "日" },
  { value: 1, label: "月" },
  { value: 2, label: "火" },
  { value: 3, label: "水" },
  { value: 4, label: "木" },
  { value: 5, label: "金" },
  { value: 6, label: "土" },
]

const dateDisplayFormatter = new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium" })

function resolvedTimeZone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (tz) return tz
  } catch (err) {
    console.warn("Failed to resolve timezone", err)
  }
  return "Asia/Tokyo"
}

type TaskFormMode = "create" | "edit"

type TaskEditorFormProps = {
  mode: TaskFormMode
  taskId?: string
}

type FormSnapshot = {
  title: string
  detail: string
  kind: "single" | "habit"
  active: boolean
  startDate: string
  endDate: string
  cadence: "daily" | "weekly" | "monthly"
  timesPerPeriod: string
  weekDays: number[]
  monthlyDays: string
  anytime: boolean
  startTime: string
  endTime: string
  tags: string
  timezone: string
}

function equalNumberArrays(a: number[], b: number[]) {
  if (a.length !== b.length) return false
  const sortedA = [...a].sort()
  const sortedB = [...b].sort()
  return sortedA.every((value, index) => value === sortedB[index])
}

function normalizeTags(value: string) {
  return value
    .split(/[,\n]/)
    .map((token) => token.trim())
    .filter(Boolean)
}

function parseMonthlyDays(input: string): number[] | null {
  if (!input.trim()) return []
  const values = input
    .split(/[\s,、]+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => Number.parseInt(token, 10))
  if (values.some((value) => Number.isNaN(value) || value < 1 || value > 31)) {
    return null
  }
  return Array.from(new Set(values)).sort((a, b) => a - b)
}

function minutesFromTimeString(value: string): number | null {
  if (!value) return null
  const [hours, minutes] = value.split(":").map((token) => Number.parseInt(token, 10))
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null
  return hours * 60 + minutes
}

function formatDateToISO(date: Date | undefined): string {
  if (!date) return ""
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function parseISODate(value: string | null | undefined): Date | undefined {
  if (!value) return undefined
  const [year, month, day] = value.split("-").map((token) => Number.parseInt(token, 10))
  if ([year, month, day].some((part) => Number.isNaN(part))) return undefined
  return new Date(year, month - 1, day)
}

function createRangeFromISO(start: string, end: string): DateRange | undefined {
  const from = parseISODate(start)
  const to = parseISODate(end || start)
  if (!from && !to) return undefined
  return { from: from ?? undefined, to: to ?? from ?? undefined }
}

function createSnapshot(state: {
  title: string
  detail: string
  kind: "single" | "habit"
  active: boolean
  startDate: string
  endDate: string
  cadence: "daily" | "weekly" | "monthly"
  timesPerPeriod: string
  weekDays: number[]
  monthlyDays: string
  anytime: boolean
  startTime: string
  endTime: string
  tags: string
  timezone: string
}): FormSnapshot {
  return {
    title: state.title.trim(),
    detail: state.detail.trim(),
    kind: state.kind,
    active: state.active,
    startDate: state.startDate,
    endDate: state.endDate,
    cadence: state.cadence,
    timesPerPeriod: state.timesPerPeriod.trim(),
    weekDays: [...state.weekDays],
    monthlyDays: state.monthlyDays.trim(),
    anytime: state.anytime,
    startTime: state.startTime,
    endTime: state.endTime,
    tags: state.tags.trim(),
    timezone: state.timezone.trim(),
  }
}

function snapshotsEqual(a: FormSnapshot | null, b: FormSnapshot | null) {
  if (!a && !b) return true
  if (!a || !b) return false
  return (
    a.title === b.title &&
    a.detail === b.detail &&
    a.kind === b.kind &&
    a.active === b.active &&
    a.startDate === b.startDate &&
    a.endDate === b.endDate &&
    a.cadence === b.cadence &&
    a.timesPerPeriod === b.timesPerPeriod &&
    equalNumberArrays(a.weekDays, b.weekDays) &&
    a.monthlyDays === b.monthlyDays &&
    a.anytime === b.anytime &&
    a.startTime === b.startTime &&
    a.endTime === b.endTime &&
    a.tags === b.tags &&
    a.timezone === b.timezone
  )
}

export default function TaskEditorForm({ mode, taskId }: TaskEditorFormProps) {
  const isEdit = mode === "edit"

  if (isEdit && !taskId) {
    throw new Error("taskId is required when mode is edit")
  }

  const [title, setTitle] = useState("")
  const [detail, setDetail] = useState("")
  const [kind, setKind] = useState<"single" | "habit">("habit")
  const [active, setActive] = useState(true)
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined)
  const [cadence, setCadence] = useState<"daily" | "weekly" | "monthly">("daily")
  const [timesPerPeriod, setTimesPerPeriod] = useState(DEFAULT_TIMES_PER_PERIOD)
  const [weekDays, setWeekDays] = useState<number[]>([])
  const [monthlyDays, setMonthlyDays] = useState("1")
  const [anytime, setAnytime] = useState(true)
  const [startTime, setStartTime] = useState(DEFAULT_START_TIME)
  const [endTime, setEndTime] = useState(DEFAULT_END_TIME)
  const [tagsInput, setTagsInput] = useState("")
  const [timezone, setTimezone] = useState(() => resolvedTimeZone())

  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(isEdit)
  const [notFound, setNotFound] = useState(false)
  const [authChecking, setAuthChecking] = useState(true)
  const [snapshot, setSnapshot] = useState<FormSnapshot | null>(null)
  const titleInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    let cancelled = false
    const supabase = supabaseBrowser()

    const checkAuth = async () => {
      try {
        const { data } = await supabase.auth.getSession()
        if (cancelled) return
        if (!data.session?.user) {
          setError("ログインしてからタスクを作成してください。")
        }
        setAuthChecking(false)
      } catch (err) {
        console.error("Failed to check auth", err)
        if (!cancelled) {
          setError("認証状態の確認に失敗しました")
          setAuthChecking(false)
        }
      }
    }

    void checkAuth()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!isEdit || !taskId) return

    let mounted = true
    const loadTask = async () => {
      try {
        const data = await store.get(taskId)
        if (!mounted) return
        if (!data) {
          setNotFound(true)
          setLoading(false)
          return
        }
        applyTaskToState(data)
      } catch (err) {
        console.error("Failed to load task", err)
        if (mounted) {
          setError("タスクの読み込みに失敗しました")
          setLoading(false)
        }
      }
    }

    const applyTaskToState = (task: Task) => {
      setTitle(task.title)
      setDetail(task.detail ?? "")
      setKind(task.kind ?? "habit")
      setActive(task.active)
      const startIso = task.startDate ?? ""
      const endIso = task.endDate ?? ""
      setStartDate(startIso)
      setEndDate(endIso)
      setDateRange(createRangeFromISO(startIso, endIso))

      const primaryPeriod = task.periodRules[0]
      if (primaryPeriod) {
        setCadence(primaryPeriod.cadence === "interval" ? "daily" : primaryPeriod.cadence)
        setTimesPerPeriod(
          primaryPeriod.timesPerPeriod !== null && primaryPeriod.timesPerPeriod !== undefined
            ? String(primaryPeriod.timesPerPeriod)
            : ""
        )
        setWeekDays(primaryPeriod.daysOfWeek ?? [])
        if (primaryPeriod.cadence === "monthly" && primaryPeriod.daysOfWeek?.length) {
          setMonthlyDays(primaryPeriod.daysOfWeek.join(","))
        }
        setTimezone(primaryPeriod.timezone ?? resolvedTimeZone())
      } else {
        setCadence("daily")
        setTimesPerPeriod(DEFAULT_TIMES_PER_PERIOD)
        setWeekDays([])
        setMonthlyDays("1")
      }

      const primaryTime = task.timeRules[0]
      if (primaryTime) {
        const resolvedAnytime = primaryTime.anytime || !primaryTime.startTime
        setAnytime(resolvedAnytime)
        setStartTime(
          primaryTime.startTime ? primaryTime.startTime.slice(0, 5) : DEFAULT_START_TIME
        )
        setEndTime(primaryTime.endTime ? primaryTime.endTime.slice(0, 5) : DEFAULT_END_TIME)
      } else {
        setAnytime(true)
        setStartTime(DEFAULT_START_TIME)
        setEndTime(DEFAULT_END_TIME)
      }

      setTagsInput(task.tags.map((tag) => tag.name).join(", "))

      const nextSnapshot = createSnapshot({
        title: task.title,
        detail: task.detail ?? "",
        kind: task.kind ?? "habit",
        active: task.active,
        startDate: startIso,
        endDate: endIso,
        cadence: primaryPeriod?.cadence === "interval" ? "daily" : primaryPeriod?.cadence ?? "daily",
        timesPerPeriod:
          primaryPeriod?.timesPerPeriod !== null && primaryPeriod?.timesPerPeriod !== undefined
            ? String(primaryPeriod.timesPerPeriod)
            : "",
        weekDays: primaryPeriod?.daysOfWeek ?? [],
        monthlyDays: primaryPeriod?.cadence === "monthly" && primaryPeriod.daysOfWeek?.length
          ? primaryPeriod.daysOfWeek.join(",")
          : "1",
        anytime: primaryTime?.anytime ?? true,
        startTime:
          primaryTime?.startTime
            ? primaryTime.startTime.slice(0, 5)
            : DEFAULT_START_TIME,
        endTime: primaryTime?.endTime ? primaryTime.endTime.slice(0, 5) : DEFAULT_END_TIME,
        tags: task.tags.map((tag) => tag.name).join(", "),
        timezone: primaryPeriod?.timezone ?? resolvedTimeZone(),
      })

      setSnapshot(nextSnapshot)
      setAdvancedOpen(false)
      setLoading(false)
      window.setTimeout(() => {
        titleInputRef.current?.focus()
      }, 0)
    }

    void loadTask()

    return () => {
      mounted = false
    }
  }, [isEdit, taskId])

  const handleDateRangeChange = useCallback((range: DateRange | undefined) => {
    setDateRange(range)
    if (!range || !range.from) {
      setStartDate("")
      setEndDate("")
      return
    }
    const startIso = formatDateToISO(range.from)
    const endIso = range.to ? formatDateToISO(range.to) : startIso
    setStartDate(startIso)
    setEndDate(endIso)
  }, [])

  const currentSnapshot = useMemo(
    () =>
      createSnapshot({
        title,
        detail,
        kind,
        active,
        startDate,
        endDate,
        cadence,
        timesPerPeriod,
        weekDays,
        monthlyDays,
        anytime,
        startTime,
        endTime,
        tags: tagsInput,
        timezone,
      }),
    [
      title,
      detail,
      kind,
      active,
      startDate,
      endDate,
      cadence,
      timesPerPeriod,
      weekDays,
      monthlyDays,
      anytime,
      startTime,
      endTime,
      tagsInput,
      timezone,
    ]
  )

  const hasChanges = useMemo(() => !snapshotsEqual(snapshot, currentSnapshot), [snapshot, currentSnapshot])

  const handleWeekdayToggle = (value: number) => {
    setWeekDays((prev) =>
      prev.includes(value) ? prev.filter((day) => day !== value) : [...prev, value]
    )
  }

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      if (busy || authChecking) return

      if (!title.trim()) {
        setError("タイトルを入力してください")
        return
      }
      if (!anytime && !startTime) {
        setError("時間指定ありの場合は開始時刻を設定してください")
        return
      }
      if (!anytime && startTime && endTime) {
        const startMinutes = minutesFromTimeString(startTime)
        const endMinutes = minutesFromTimeString(endTime)
        if (
          startMinutes !== null &&
          endMinutes !== null &&
          endMinutes <= startMinutes
        ) {
          setError("終了時刻は開始時刻より後に設定してください")
          return
        }
      }

      setBusy(true)
      setError(null)
      setFeedback(null)

      const trimmedTitle = title.trim()
      const trimmedDetail = detail.trim()
      const parsedTimes = timesPerPeriod.trim() ? Number.parseInt(timesPerPeriod, 10) : null
      const timesValue = parsedTimes !== null && !Number.isNaN(parsedTimes) ? parsedTimes : null

      let monthlyDayList: number[] | null = null
      if (cadence === "monthly") {
        monthlyDayList = parseMonthlyDays(monthlyDays)
        if (monthlyDayList === null) {
          setError("月次の指定日は1〜31の半角数字で入力してください")
          setBusy(false)
          return
        }
      }

      const periodRule = {
        cadence,
        timesPerPeriod: timesValue,
        period: cadence === "daily" ? "day" : cadence === "weekly" ? "week" : "month",
        daysOfWeek:
          cadence === "weekly"
            ? weekDays
            : cadence === "monthly"
            ? monthlyDayList ?? []
            : null,
        timezone,
      }

      const startTimeValue = startTime.trim()
      const endTimeValue = endTime.trim() ? endTime.trim() : null

      const timeRule = anytime
        ? { anytime: true }
        : { anytime: false, startTime: startTimeValue || null, endTime: endTimeValue }

      const tags = normalizeTags(tagsInput)

      try {
        if (!isEdit) {
          await store.create({
            title: trimmedTitle,
            detail: trimmedDetail,
            kind,
            active,
            startDate: startDate || undefined,
            endDate: endDate || undefined,
            periodRules: [periodRule],
            timeRules: [timeRule],
            tags,
            timezone,
          })
          window.location.href = "/tasks"
          return
        }

        await store.update(taskId as string, {
          title: trimmedTitle,
          detail: trimmedDetail,
          kind,
          active,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          periodRules: [periodRule],
          timeRules: [timeRule],
          tags,
          timezone,
        })

        setFeedback("更新しました。")
        setSnapshot(currentSnapshot)
      } catch (submitError) {
        console.error("Failed to submit task", submitError)
        const message = submitError instanceof Error ? submitError.message : String(submitError)
        setError(`タスクの保存に失敗しました: ${message}`)
      } finally {
        setBusy(false)
      }
    },
    [
      active,
      anytime,
      authChecking,
      busy,
      cadence,
      currentSnapshot,
      detail,
      endDate,
      isEdit,
      kind,
      monthlyDays,
      startDate,
      startTime,
      endTime,
      tagsInput,
      taskId,
      timesPerPeriod,
      timezone,
      title,
      weekDays,
    ]
  )

  if (authChecking || (isEdit && loading)) {
    return (
      <div className="space-y-3">
        <div className="h-6 w-24 animate-pulse rounded bg-muted" />
        <div className="h-64 w-full animate-pulse rounded-2xl bg-muted" />
      </div>
    )
  }

  if (isEdit && notFound) {
    return (
      <div className="space-y-4 rounded-2xl border border-border bg-card/60 p-6 text-sm">
        <p className="font-medium text-foreground">タスクが見つかりませんでした。</p>
        <p className="text-muted-foreground">既に削除されたか、URLが間違っている可能性があります。</p>
        <Button asChild>
          <a href="/tasks">一覧へ戻る</a>
        </Button>
      </div>
    )
  }

  const formatDisplayDate = (value: string) => {
    const parsed = parseISODate(value)
    return parsed ? dateDisplayFormatter.format(parsed) : "未設定"
  }

  const startDateLabel = formatDisplayDate(startDate)
  const endDateLabel = formatDisplayDate(endDate)

  return (
    <div className="w-full px-3 py-3 sm:px-5">
      <div className="mx-auto w-full space-y-3">
        <header className="space-y-1">
          <h1 className="text-base font-semibold text-foreground sm:text-lg">
            {isEdit ? "タスク詳細" : "新規タスク"}
          </h1>
          <p className="text-xs text-muted-foreground sm:text-sm">
            {isEdit
              ? "リズムや時間帯を調整して、今日の表示順を整えましょう。"
              : "タイトルやスケジュール、時間帯を設定して今日のタスクリストに反映させましょう。"}
          </p>
        </header>

        {error ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2.5 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {feedback ? (
          <div className="rounded-md border border-border/60 bg-muted/30 p-2.5 text-sm text-foreground">
            {feedback}
          </div>
        ) : null}

        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)]">
            <div className="space-y-6">
              <Card className="border-border/60 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">基本情報</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
                    <TaskTitleDetailFields
                      title={title}
                      onTitleChange={setTitle}
                      detail={detail}
                      onDetailChange={setDetail}
                      titleInputRef={(node) => {
                        titleInputRef.current = node
                      }}
                      detailMinHeightClass="min-h-[200px]"
                    />
                    <div className="space-y-5">
                      <div className="space-y-2">
                        <Label>種別</Label>
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            type="button"
                            variant={kind === "habit" ? "default" : "outline"}
                            onClick={() => setKind("habit")}
                            className="justify-center"
                          >
                            習慣
                          </Button>
                          <Button
                            type="button"
                            variant={kind === "single" ? "default" : "outline"}
                            onClick={() => setKind("single")}
                            className="justify-center"
                          >
                            単発
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          種別によって Today での扱い方が変わります。
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label>表示状態</Label>
                        <Button
                          type="button"
                          variant={active ? "default" : "outline"}
                          onClick={() => setActive((prev) => !prev)}
                          className="w-full justify-center"
                        >
                          {active ? "有効（Todayに表示）" : "無効（非表示）"}
                        </Button>
                        <p className="text-xs text-muted-foreground">
                          一時的に非表示にしたい場合は無効に切り替えましょう。
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/60 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">繰り返しと回数</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="task-cadence">頻度</Label>
                      <select
                        id="task-cadence"
                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        value={cadence}
                        onChange={(event) =>
                          setCadence(event.target.value as "daily" | "weekly" | "monthly")
                        }
                      >
                        <option value="daily">毎日</option>
                        <option value="weekly">週次</option>
                        <option value="monthly">月次</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="task-times">1期間あたりの目標回数</Label>
                      <Input
                        id="task-times"
                        type="number"
                        min={0}
                        step={1}
                        value={timesPerPeriod}
                        onChange={(event) => setTimesPerPeriod(event.target.value)}
                        placeholder="1"
                      />
                      <p className="text-xs text-muted-foreground">空欄または0で回数制限なし</p>
                    </div>
                  </div>

                  {cadence === "weekly" ? (
                    <div className="space-y-2">
                      <Label>実施曜日</Label>
                      <div className="grid grid-cols-7 gap-2 text-sm">
                        {WEEKDAY_OPTIONS.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => handleWeekdayToggle(option.value)}
                            className={`rounded-md border px-0.5 py-1 text-center transition ${
                              weekDays.includes(option.value)
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border bg-muted/40 text-foreground hover:border-primary/60"
                            }`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        未選択の場合は全曜日が対象になります。
                      </p>
                    </div>
                  ) : null}

                  {cadence === "monthly" ? (
                    <div className="space-y-2">
                      <Label htmlFor="task-monthly-days">実施日 (例: 1,15,31)</Label>
                      <Input
                        id="task-monthly-days"
                        value={monthlyDays}
                        onChange={(event) => setMonthlyDays(event.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        カンマ区切りで1〜31の数字を入力。空欄なら毎月1日。
                      </p>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="border-border/60 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">日付と時間帯</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>開始日と終了日</Label>
                    <div className="rounded-2xl border border-border bg-card/80 p-3">
                      <Calendar
                        mode="range"
                        numberOfMonths={1}
                        selected={dateRange}
                        onSelect={handleDateRangeChange}
                        defaultMonth={dateRange?.from ?? undefined}
                      />
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">開始:</span> {startDateLabel}
                      <span className="mx-2">/</span>
                      <span className="font-medium text-foreground">終了:</span> {endDateLabel}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>時間帯</Label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={anytime}
                        onChange={(event) => setAnytime(event.target.checked)}
                      />
                      時間を指定しない（いつでも）
                    </label>
                    {!anytime ? (
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="task-start-time">開始時刻</Label>
                          <Input
                            id="task-start-time"
                            type="time"
                            step={300}
                            value={startTime}
                            onChange={(event) => setStartTime(event.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="task-end-time">終了時刻 (任意)</Label>
                          <Input
                            id="task-end-time"
                            type="time"
                            step={300}
                            value={endTime}
                            onChange={(event) => setEndTime(event.target.value)}
                          />
                          <p className="text-xs text-muted-foreground">
                            未入力の場合は開始時刻のみ表示されます。
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        時刻を設定しないタスクは Today で「いつでも」にまとまります。
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/60 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">詳細設定</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setAdvancedOpen((prev) => !prev)}
                    className="flex w-full items-center justify-between px-0 text-sm"
                  >
                    {advancedOpen ? "詳細設定を閉じる" : "詳細設定を表示"}
                    <ChevronDown
                      className={`size-4 transition-transform ${advancedOpen ? "rotate-180" : "rotate-0"}`}
                    />
                  </Button>

                  {advancedOpen ? (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="task-tags">タグ (任意)</Label>
                        <Input
                          id="task-tags"
                          value={tagsInput}
                          onChange={(event) => setTagsInput(event.target.value)}
                          placeholder="健康, 朝ルーティン"
                        />
                        <p className="text-xs text-muted-foreground">カンマ区切りで入力できます。</p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="task-timezone">タイムゾーン</Label>
                        <Input
                          id="task-timezone"
                          value={timezone}
                          onChange={(event) => setTimezone(event.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">例: Asia/Tokyo</p>
                      </div>

                      <div className="space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
                        <p>
                          開始日と終了日が空の場合、タスクは常に対象として扱われます。
                        </p>
                        <p>
                          目標回数を0または空欄にすると、その期間内で何度達成してもOKになります。
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      タグやタイムゾーンなどを設定したい場合は詳細設定を開いてください。
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          <CardFooter className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-muted-foreground">
              {isEdit ? "変更後はToday画面にすぐ反映されます。" : "保存するとTodayの並びに反映されます。"}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                disabled={busy || !hasChanges}
                onClick={() => {
                  if (snapshot) {
                    setTitle(snapshot.title)
                    setDetail(snapshot.detail)
                    setKind(snapshot.kind)
                    setActive(snapshot.active)
                    setStartDate(snapshot.startDate)
                    setEndDate(snapshot.endDate)
                    setDateRange(createRangeFromISO(snapshot.startDate, snapshot.endDate))
                    setCadence(snapshot.cadence)
                    setTimesPerPeriod(snapshot.timesPerPeriod)
                    setWeekDays(snapshot.weekDays)
                    setMonthlyDays(snapshot.monthlyDays)
                    setAnytime(snapshot.anytime)
                    setStartTime(snapshot.startTime)
                    setEndTime(snapshot.endTime)
                    setTagsInput(snapshot.tags)
                    setTimezone(snapshot.timezone || resolvedTimeZone())
                    setAdvancedOpen(false)
                    setFeedback(null)
                    setError(null)
                  } else {
                    setTitle("")
                    setDetail("")
                    setKind("habit")
                    setActive(true)
                    setStartDate("")
                    setEndDate("")
                    setDateRange(undefined)
                    setCadence("daily")
                    setTimesPerPeriod(DEFAULT_TIMES_PER_PERIOD)
                    setWeekDays([])
                    setMonthlyDays("1")
                    setAnytime(true)
                    setStartTime(DEFAULT_START_TIME)
                    setEndTime(DEFAULT_END_TIME)
                    setTagsInput("")
                    setTimezone(resolvedTimeZone())
                    setAdvancedOpen(false)
                    setFeedback(null)
                    setError(null)
                  }
                }}
              >
                リセット
              </Button>
              <Button type="submit" disabled={busy}>
                {isEdit ? "更新する" : "保存して一覧へ"}
              </Button>
            </div>
          </CardFooter>
        </form>
      </div>
    </div>
  )
}
