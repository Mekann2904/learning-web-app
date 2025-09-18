import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar, type DateRange } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { supabaseBrowser } from "@/lib/supabase"
import * as store from "@/lib/storage.supabase"

function toMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number)
  return hours * 60 + minutes
}

function startOfDay(date: Date) {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

function formatISODate(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function initialRange(): DateRange {
  const today = startOfDay(new Date())
  return { from: today, to: today }
}

export default function TaskCreateForm() {
  const [title, setTitle] = useState("")
  const [detail, setDetail] = useState("")
  const [plannedRange, setPlannedRange] = useState<DateRange | undefined>(initialRange())
  const [startTime, setStartTime] = useState("10:00")
  const [endTime, setEndTime] = useState("11:00")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [authChecking, setAuthChecking] = useState(true)
  const titleInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    let ignore = false
    const supabase = supabaseBrowser()
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (ignore) return
        if (error) {
          console.error("Failed to check auth state", error)
          setError("認証状態の確認に失敗しました。時間をおいて再度お試しください。")
        } else if (!data.session?.user) {
          window.location.href = "/"
        }
      })
      .finally(() => {
        if (!ignore) setAuthChecking(false)
      })

    return () => {
      ignore = true
    }
  }, [])

  const timeInvalid = useMemo(() => {
    return toMinutes(endTime) <= toMinutes(startTime)
  }, [startTime, endTime])

  const resetForm = useCallback(() => {
    setTitle("")
    setDetail("")
    setPlannedRange(initialRange())
    setStartTime("10:00")
    setEndTime("11:00")
    setError(null)
    titleInputRef.current?.focus()
  }, [])

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      if (busy || authChecking) return

      const trimmedTitle = title.trim()
      const trimmedDetail = detail.trim()

      if (!trimmedTitle) {
        setError("タイトルを入力してください。")
        titleInputRef.current?.focus()
        return
      }

      const fromDate = plannedRange?.from ? startOfDay(plannedRange.from) : null
      const toDate = plannedRange?.to
        ? startOfDay(plannedRange.to)
        : plannedRange?.from
          ? startOfDay(plannedRange.from)
          : null

      if (!fromDate) {
        setError("予定日を選択してください。")
        return
      }

      if (timeInvalid) {
        setError("終了時刻は開始時刻より後に設定してください。")
        return
      }

      setBusy(true)
      setError(null)
      try {
        const scheduleLabel = toDate && toDate.getTime() !== fromDate.getTime()
          ? `${formatISODate(fromDate)}〜${formatISODate(toDate)} ${startTime}〜${endTime}`
          : `${formatISODate(fromDate)} ${startTime}〜${endTime}`
        const detailWithSchedule = trimmedDetail
          ? `${trimmedDetail}\n\n[予定]\n${scheduleLabel}`
          : `[予定]\n${scheduleLabel}`

        const toDbTime = (value: string | undefined) => {
          if (!value) return null
          return value.length === 5 ? `${value}:00` : value
        }

        await store.create({
          title: trimmedTitle,
          detail: detailWithSchedule,
          done: false,
          startDate: formatISODate(fromDate),
          endDate: toDate ? formatISODate(toDate) : formatISODate(fromDate),
          startTime: toDbTime(startTime) ?? undefined,
          endTime: toDbTime(endTime) ?? undefined,
        })

        resetForm()
        window.location.href = "/"
      } catch (err) {
        console.error("Failed to create task", err)
        const message = err instanceof Error ? err.message : String(err)
        setError(`タスクの作成に失敗しました: ${message}`)
      } finally {
        setBusy(false)
      }
    },
    [authChecking, busy, detail, endTime, plannedRange, startTime, timeInvalid, title]
  )

  if (authChecking) {
    return (
      <div className="space-y-3">
        <div className="h-6 w-24 animate-pulse rounded bg-muted" />
        <div className="h-64 w-full animate-pulse rounded-2xl bg-muted" />
      </div>
    )
  }

  return (
    <div className="w-full px-3 py-3 sm:px-5">
      <div className="mx-auto w-full space-y-2.5">
        <header className="space-y-1">
          <h1 className="text-base font-semibold text-foreground sm:text-lg">新規タスク</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            タイトル・詳細を入力し、予定期間と時刻を設定してください。
          </p>
        </header>

        {error ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2.5 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <form className="space-y-2.5" onSubmit={handleSubmit}>
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-2.5">
              <CardTitle className="text-sm">タスク情報</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-4 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                <div className="space-y-2.5">
                  <div className="space-y-2">
                    <Label htmlFor="task-title">タイトル</Label>
                    <Input
                      id="task-title"
                      placeholder="例: 週次ミーティングの準備"
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      ref={(node) => {
                        titleInputRef.current = node
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="task-detail">詳細</Label>
                    <Textarea
                      id="task-detail"
                      placeholder="議題やメモを記載してください"
                      value={detail}
                      onChange={(event) => setDetail(event.target.value)}
                      className="min-h-[160px]"
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>日付</Label>
                    <Calendar
                      mode="range"
                      numberOfMonths={1}
                      selected={plannedRange}
                      onSelect={setPlannedRange}
                      defaultMonth={plannedRange?.from ?? undefined}
                      initialFocus
                      className="rounded-2xl border border-border bg-card p-4 md:p-6 shadow-sm"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5 sm:flex-row sm:items-end">
                    <div className="flex-1 space-y-2">
                      <Label htmlFor="task-start">開始時刻</Label>
                      <Input
                        id="task-start"
                        type="time"
                        value={startTime}
                        step={300}
                        onChange={(event) => setStartTime(event.target.value)}
                      />
                    </div>
                    <div className="hidden pb-3 text-sm text-muted-foreground sm:block">〜</div>
                    <div className="flex-1 space-y-2">
                      <Label htmlFor="task-end">終了時刻</Label>
                      <Input
                        id="task-end"
                        type="time"
                        value={endTime}
                        step={300}
                        onChange={(event) => setEndTime(event.target.value)}
                      />
                    </div>
                  </div>
                  {timeInvalid ? (
                    <p className="text-xs text-destructive sm:text-sm">
                      終了時刻は開始時刻より後に設定してください。
                    </p>
                  ) : null}
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
              <Button
                type="button"
                variant="secondary"
                className="w-full sm:w-auto"
                onClick={resetForm}
                disabled={busy}
              >
                リセット
              </Button>
              <Button type="submit" disabled={busy || authChecking} className="w-full sm:w-auto">
                {busy ? "作成中..." : "作成"}
              </Button>
            </CardFooter>
          </Card>
        </form>
      </div>
    </div>
  )
}
