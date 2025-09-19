import { useCallback, useEffect, useMemo, useState } from "react"
import type { User } from "@supabase/supabase-js"
import { CalendarClock, RefreshCcw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { AUTH_RESULT_STORAGE_KEY, signInWithGoogle } from "@/lib/auth"
import { supabaseBrowser } from "@/lib/supabase"
import * as store from "@/lib/storage.supabase"
import type { TodayTaskRow } from "@/lib/storage.supabase"

function formatCount(value: number) {
  if (Number.isInteger(value)) return value.toString()
  return value.toFixed(1)
}

type OverviewState = {
  dateIso: string
  timeZone: string
}

type GroupedToday = {
  timed: TodayTaskRow[]
  anytime: TodayTaskRow[]
}

function groupRows(rows: TodayTaskRow[]): GroupedToday {
  return rows.reduce<GroupedToday>(
    (acc, row) => {
      if (row.anytime) {
        acc.anytime.push(row)
      } else {
        acc.timed.push(row)
      }
      return acc
    },
    { timed: [], anytime: [] }
  )
}

export default function TodayTaskList() {
  const [user, setUser] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<TodayTaskRow[]>([])
  const [overview, setOverview] = useState<OverviewState | null>(null)
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === "undefined") return

    const url = new URL(window.location.href)
    const authErrorParam = url.searchParams.get("auth_error")
    if (authErrorParam) {
      setAuthError(authErrorParam)
      url.searchParams.delete("auth_error")
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`)
    }

    try {
      const result = window.sessionStorage.getItem(AUTH_RESULT_STORAGE_KEY)
      window.sessionStorage.removeItem(AUTH_RESULT_STORAGE_KEY)
      if (!authErrorParam && result === "session_missing") {
        setAuthError("ブラウザがログイン情報を保存できませんでした。別のブラウザやストレージ設定をお確かめください。")
      }
    } catch (err) {
      console.warn("Failed to read auth result state.", err)
    }
  }, [])

  useEffect(() => {
    let ignore = false
    const supabase = supabaseBrowser()

    const loadUser = async () => {
      try {
        const { data } = await supabase.auth.getSession()
        if (ignore) return
        setUser(data.session?.user ?? null)
        setAuthReady(true)
      } catch (err) {
        console.error("Failed to load auth session", err)
        if (!ignore) {
          setAuthError("認証状態の取得に失敗しました")
          setAuthReady(true)
        }
      }
    }

    void loadUser()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (ignore) return
      setUser(session?.user ?? null)
      setAuthError(null)
      setAuthReady(true)
    })

    return () => {
      ignore = true
      subscription.unsubscribe()
    }
  }, [])

  const refreshRows = useCallback(async () => {
    if (!user) {
      setRows([])
      setOverview(null)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const data = await store.fetchTaskOverview()
      setRows(data.today)
      setOverview({ dateIso: data.dateIso, timeZone: data.timeZone })
      setError(null)
    } catch (err) {
      console.error("Failed to load today tasks", err)
      setError("今日のタスク取得に失敗しました")
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    void refreshRows()
  }, [refreshRows])

  const handleComplete = useCallback(
    async (row: TodayTaskRow) => {
      if (row.status === "done") return
      setBusyTaskId(row.taskId)
      try {
        const qty = row.remaining > 1 ? 1 : row.remaining > 0 ? row.remaining : 1
        await store.logExecution(row.taskId, qty)
        setError(null)
        await refreshRows()
      } catch (err) {
        console.error("Failed to log execution", err)
        setError("タスクの進捗更新に失敗しました")
      } finally {
        setBusyTaskId(null)
      }
    },
    [refreshRows]
  )

  const grouped = useMemo(() => groupRows(rows), [rows])

  if (!authReady) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-2/3" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="mt-6 space-y-4 rounded-xl border border-border bg-muted/50 p-6 text-sm">
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-foreground">今日のタスクを確認するにはログイン</h3>
          <p className="text-muted-foreground">Google アカウントでログインすると、タスクが自動的に同期されます。</p>
        </div>
        {authError ? <p className="text-destructive">{authError}</p> : null}
        <Button
          className="w-full justify-center"
          onClick={() => {
            setAuthError(null)
            void signInWithGoogle().catch((err) => {
              console.error("Failed to initiate sign-in", err)
              setAuthError("ログインの開始に失敗しました。時間をおいて再試行してください。")
            })
          }}
        >
          Googleでログイン
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/30 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="font-medium text-foreground">今日の基準日: {overview ? overview.dateIso : "--"}</p>
          <p className="text-xs text-muted-foreground">基準タイムゾーン: {overview ? overview.timeZone : "--"}</p>
        </div>
        <div className="flex items-center gap-2">
          {error ? <span className="text-sm text-destructive">{error}</span> : null}
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refreshRows()}
            disabled={loading}
          >
            <RefreshCcw className={`mr-2 size-4 ${loading ? "animate-spin" : ""}`} />
            再読み込み
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-3/4" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-border bg-muted/40 p-6 text-sm text-muted-foreground">
          今日予定されているタスクはありません。
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.timed.length ? (
            <section className="space-y-3">
              <header className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <CalendarClock className="size-4" />
                時間指定タスク
              </header>
              <div className="space-y-3">
                {grouped.timed.map((task) => (
                  <TodayTaskCard
                    key={`${task.taskId}-${task.slotId}`}
                    row={task}
                    busy={busyTaskId === task.taskId}
                    onComplete={handleComplete}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {grouped.anytime.length ? (
            <section className="space-y-3">
              <header className="text-sm font-semibold text-foreground">いつでもタスク</header>
              <div className="space-y-3">
                {grouped.anytime.map((task) => (
                  <TodayTaskCard
                    key={`${task.taskId}-${task.slotId}`}
                    row={task}
                    busy={busyTaskId === task.taskId}
                    onComplete={handleComplete}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </div>
  )
}
type TodayTaskCardProps = {
  row: TodayTaskRow
  busy: boolean
  onComplete: (row: TodayTaskRow) => void
}

function TodayTaskCard({ row, busy, onComplete }: TodayTaskCardProps) {
  const isDone = row.status === "done"
  const timeBadgeClass = row.anytime
    ? "rounded-md bg-slate-200/60 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-700/60 dark:text-slate-200"
    : "rounded-md bg-primary/10 px-2 py-0.5 text-xs text-primary"

  const statusBadgeClass = isDone
    ? "rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600"
    : "rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600"

  const handleComplete = () => {
    if (isDone || busy) return
    onComplete(row)
  }

  return (
    <Card className="border-border/70 bg-card shadow-sm transition hover:border-primary/40">
      <CardHeader className="flex flex-col gap-3 pb-2 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className={timeBadgeClass}>{row.anytime ? "いつでも" : row.timeLabel}</span>
          <span className="text-sm font-semibold text-foreground">{row.title}</span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
            {row.kind === "habit" ? "習慣" : "単発"}
          </span>
          {row.startTime && !row.anytime ? (
            <span className="rounded-full bg-muted/60 px-2 py-0.5 text-[11px] text-muted-foreground">
              {row.endTime ? `${row.startTime.slice(0, 5)} – ${row.endTime.slice(0, 5)}` : `${row.startTime.slice(0, 5)} 予定`}
            </span>
          ) : null}
          <span className={statusBadgeClass}>{isDone ? "完了" : "未完了"}</span>
        </div>
        <Button
          size="sm"
          variant={isDone ? "outline" : "default"}
          disabled={isDone || busy}
          onClick={handleComplete}
          className="min-w-[96px]"
        >
          {isDone ? "完了済" : busy ? "記録中..." : row.remaining <= 1 ? "完了" : `残り ${formatCount(row.remaining)}`}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {row.tags.length ? (
          <div className="flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
            {row.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                #{tag}
              </span>
            ))}
          </div>
        ) : null}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>目標 {formatCount(row.target)}</span>
          <span>実績 {formatCount(row.completed)}</span>
        </div>
      </CardContent>
    </Card>
  )
}
