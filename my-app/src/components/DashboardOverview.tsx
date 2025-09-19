import { useCallback, useEffect, useMemo, useState } from "react"
import type { User } from "@supabase/supabase-js"
import {
  ArrowUpRight,
  CheckCircle,
  Clock,
  ListChecks,
  RefreshCcw,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { signInWithGoogle } from "@/lib/auth"
import type { TaskListRow, TodayTaskRow } from "@/lib/storage.supabase"
import * as store from "@/lib/storage.supabase"
import { supabaseBrowser } from "@/lib/supabase"

const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
  dateStyle: "medium",
  timeStyle: "short",
})

type OverviewSnapshot = {
  list: TaskListRow[]
  today: TodayTaskRow[]
  dateIso: string
  timeZone: string
}

type DashboardOverviewProps = {
  initialUser?: User | null
  initialOverview?: OverviewSnapshot | null
}

export default function DashboardOverview({ initialUser = null, initialOverview = null }: DashboardOverviewProps = {}) {
  const [user, setUser] = useState<User | null>(initialUser)
  const [authReady, setAuthReady] = useState(Boolean(initialUser))
  const [authError, setAuthError] = useState<string | null>(null)
  const [overview, setOverview] = useState<OverviewSnapshot | null>(initialOverview)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let ignore = false
    const supabase = supabaseBrowser()

    const loadSession = async () => {
      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
        if (ignore) return
        if (sessionError) throw sessionError
        setUser(sessionData.session?.user ?? null)
        setAuthError(null)
      } catch (err) {
        console.error("[overview] failed to load auth session", err)
        if (ignore) return
        setAuthError("認証状態の取得に失敗しました")
        setUser(null)
      } finally {
        if (!ignore) setAuthReady(true)
      }
    }

    if (!initialUser) {
      void loadSession()
    } else {
      setAuthReady(true)
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (ignore) return
      setUser(session?.user ?? null)
      setAuthError(null)
    })

    return () => {
      ignore = true
      subscription.unsubscribe()
    }
  }, [initialUser])

  const refreshOverview = useCallback(async () => {
    if (!user) {
      setOverview(null)
      return
    }
    setLoading(true)
    try {
      const result = await store.fetchTaskOverview()
      setOverview(result)
      setError(null)
    } catch (err) {
      console.error("[overview] failed to fetch task overview", err)
      setError("タスクの取得に失敗しました")
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (!user) return
    if (!initialOverview) {
      void refreshOverview()
    }
  }, [initialOverview, refreshOverview, user])

  const stats = useMemo(() => {
    const list = overview?.list ?? []
    if (list.length === 0) {
      return {
        total: 0,
        completed: 0,
        active: 0,
        completionRate: 0,
      }
    }
    const completed = list.filter((task) => task.statusToday === "done").length
    const active = list.filter((task) => task.statusToday === "todo").length
    const completionRate = Math.round((completed / list.length) * 100)
    return { total: list.length, completed, active, completionRate }
  }, [overview])

  const recentTasks = useMemo(() => (overview?.list ?? []).slice(0, 5), [overview])

  if (!authReady) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  if (authError) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-destructive">{authError}</CardContent>
      </Card>
    )
  }

  if (!user) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ListChecks className="size-4" />
            タスクを可視化するにはログイン
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>ダッシュボードではタスクの進捗と最近のアクティビティを確認できます。</p>
          <Button
            className="w-full justify-center"
            onClick={() => {
              void signInWithGoogle().catch((err) => {
                console.error("Failed to start sign in", err)
              })
            }}
          >
            Googleでログイン
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-8 pt-4 md:pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">今日のスナップショット</h2>
          <p className="text-sm text-muted-foreground">プロジェクト全体のタスク状況を確認できます。</p>
        </div>
        <div className="flex items-center gap-2">
          {error ? <span className="text-sm text-destructive">{error}</span> : null}
          <Button variant="outline" size="sm" onClick={() => void refreshOverview()} disabled={loading}>
            <RefreshCcw className={`mr-2 size-4 ${loading ? "animate-spin" : ""}`} />
            再読み込み
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="min-h-[120px] rounded-2xl border border-border/60 bg-card/80 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">全タスク</CardTitle>
            <ListChecks className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-3xl font-semibold tracking-tight text-foreground">{stats.total}</div>
            <p className="text-xs text-muted-foreground">保存されているタスクの総数</p>
          </CardContent>
        </Card>
        <Card className="min-h-[120px] rounded-2xl border border-border/60 bg-card/80 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">完了済み</CardTitle>
            <CheckCircle className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-3xl font-semibold tracking-tight text-foreground">{stats.completed}</div>
            <p className="text-xs text-muted-foreground">今日完了したタスク</p>
          </CardContent>
        </Card>
        <Card className="min-h-[120px] rounded-2xl border border-border/60 bg-card/80 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">進行中</CardTitle>
            <Clock className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-3xl font-semibold tracking-tight text-foreground">{stats.active}</div>
            <p className="text-xs text-muted-foreground">今日の残りタスク</p>
          </CardContent>
        </Card>
        <Card className="min-h-[120px] rounded-2xl border border-border/60 bg-card/80 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">達成率</CardTitle>
            <ArrowUpRight className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-3xl font-semibold tracking-tight text-foreground">{stats.completionRate}%</div>
            <p className="text-xs text-muted-foreground">今日のタスク達成率</p>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl border border-border/60 bg-card/80 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">最近のタスク</CardTitle>
          <ArrowUpRight className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : recentTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">最近のタスクはまだありません。</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {recentTasks.map((task) => (
                <li key={task.id} className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="font-medium text-foreground">{task.title}</span>
                    <span className="text-muted-foreground">
                      更新: {dateFormatter.format(new Date(task.updatedAt))}
                    </span>
                    <span className="text-muted-foreground">
                      今日: {task.completedToday}/{task.targetToday}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {task.statusToday === "done" ? "完了" : task.statusToday === "todo" ? "進行中" : "対象外"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
