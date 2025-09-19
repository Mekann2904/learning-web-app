"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import type { User } from "@supabase/supabase-js"
import { motion } from "framer-motion"
import { CalendarDays, ChevronLeft, ChevronRight, RefreshCcw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import CatRingProgress from "@/components/cat-ring-progress"
import HabitCalendar from "@/components/habit-calendar"
import RewardCard from "@/components/reward-card"
import StreakBoard from "@/components/streak-board"
import { getAdjacentMonth, getMonthLabel, isSameMonth, toDateKey } from "@/lib/date"
import { fetchHabitDashboardMonth, type HabitDashboardResult } from "@/lib/habit-dashboard"
import { getCelebrated, setCelebrated } from "@/lib/storage"
import { supabaseBrowser } from "@/lib/supabase"
import { cn } from "@/lib/utils"
import { signInWithGoogle } from "@/lib/auth"

type DashboardShellProps = {
  initialData?: HabitDashboardResult | null
  initialUser?: User | null
}

export default function DashboardShell({ initialData = null, initialUser = null }: DashboardShellProps = {}) {
  const today = useMemo(() => {
    const base = new Date()
    return new Date(base.getFullYear(), base.getMonth(), base.getDate())
  }, [])
  const todayKey = useMemo(() => toDateKey(today), [today])

  const initialView = initialData
    ? { year: initialData.summary.year, month: initialData.summary.month }
    : { year: today.getFullYear(), month: today.getMonth() + 1 }

  const [view, setView] = useState(initialView)
  const { year, month } = view

  const [user, setUser] = useState<User | null>(initialUser)
  const [authReady, setAuthReady] = useState(Boolean(initialUser))
  const [authError, setAuthError] = useState<string | null>(null)

  const [data, setData] = useState<HabitDashboardResult | null>(initialData)
  const [loading, setLoading] = useState(!initialData && Boolean(initialUser))
  const [error, setError] = useState<string | null>(null)
  const [celebrated, setCelebratedState] = useState(() => getCelebrated(initialView.year, initialView.month))

  const monthLabel = useMemo(() => getMonthLabel(year, month), [year, month])
  const isCurrentMonth = useMemo(() => isSameMonth(today, year, month), [month, today, year])

  useEffect(() => {
    let cancelled = false
    const supabase = supabaseBrowser()

    const loadSession = async () => {
      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
        if (cancelled) return
        if (sessionError) throw sessionError
        setUser(sessionData.session?.user ?? null)
        setAuthError(null)
      } catch (err) {
        console.error("[habit-dashboard] failed to load session", err)
        if (cancelled) return
        setAuthError("認証状態の取得に失敗しました")
        setUser(null)
      } finally {
        if (!cancelled) setAuthReady(true)
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
      if (cancelled) return
      setUser(session?.user ?? null)
      setAuthError(null)
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [initialUser])

  const refreshData = useCallback(async () => {
    if (!user) {
      setData(null)
      setError(null)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const result = await fetchHabitDashboardMonth(year, month, { today })
      setData(result)
      setCelebratedState(getCelebrated(year, month))
      setError(null)
    } catch (err) {
      console.error("[habit-dashboard] failed to load data", err)
      setError("習慣データの取得に失敗しました")
    } finally {
      setLoading(false)
    }
  }, [month, today, user, year])

  useEffect(() => {
    if (!authReady || !user) return
    void refreshData()
  }, [authReady, refreshData, user])

  useEffect(() => {
    if (!user) {
      setData(null)
      setError(null)
    }
  }, [user])

  const handleMonthChange = (direction: "prev" | "next") => {
    if (user) setLoading(true)
    setView((current) => {
      const next = getAdjacentMonth(current.year, current.month, direction === "prev" ? -1 : 1)
      setCelebratedState(getCelebrated(next.year, next.month))
      return next
    })
  }

  const handleRefreshClick = () => {
    void refreshData()
  }

  const handleCelebrate = () => {
    setCelebrated(year, month, true)
    setCelebratedState(true)
  }

  const ringLabel = data?.isCurrentMonth ? "今日の割合" : "月間達成率"
  const ringPercentage = data?.isCurrentMonth ? data?.today.percentage ?? 0 : data?.completionRate ?? 0
  const ringMeta = data
    ? data.isCurrentMonth
      ? data.today.required > 0
        ? `${data.today.completed}/${data.today.required} タスク`
        : "対象タスクなし"
      : data.totals.trackedDays > 0
      ? `${data.totals.doneDays}/${data.totals.trackedDays} 日`
      : "対象日なし"
    : "—"

  const accomplishedDays = data?.totals.doneDays ?? 0
  const remainingDays = data?.totals.remainingDays ?? 0
  const trackedDays = data?.totals.trackedDays ?? 0
  const completionRate = data?.completionRate ?? 0
  const rewardUnlocked = data ? data.totals.trackedDays > 0 && data.completionRate === 100 : false

  const renderContent = () => {
    if (!authReady) {
      return (
        <Card className="rounded-2xl border border-dashed border-border/60 bg-muted/20 p-8 text-center text-sm text-muted-foreground">
          認証状態を確認しています...
        </Card>
      )
    }

    if (authError) {
      return (
        <Card className="rounded-2xl border border-destructive/40 bg-destructive/10 p-6 text-sm text-destructive">
          {authError}
        </Card>
      )
    }

    if (!user) {
      return (
        <Card className="rounded-2xl border border-dashed border-border/60 bg-muted/20 p-8 text-center text-sm text-muted-foreground">
          <p className="mb-4">猫のダッシュボードを見るにはログインが必要です。</p>
          <Button onClick={() => void signInWithGoogle()}>Googleでログイン</Button>
        </Card>
      )
    }

    if (loading && !data) {
      return (
        <Card className="rounded-2xl border border-dashed border-border/60 bg-muted/20 p-8 text-center text-sm text-muted-foreground">
          連続記録を読み込み中...
        </Card>
      )
    }

    if (error) {
      return (
        <Card className="rounded-2xl border border-destructive/40 bg-destructive/10 p-6 text-sm text-destructive">
          {error}
        </Card>
      )
    }

    if (!data) {
      return (
        <Card className="rounded-2xl border border-dashed border-border/60 bg-muted/20 p-8 text-center text-sm text-muted-foreground">
          データがありません。
        </Card>
      )
    }

    return (
      <div className="grid gap-6 xl:grid-cols-[minmax(0,2.5fr)_minmax(0,1fr)]">
        <motion.div layout transition={{ type: "spring", stiffness: 90, damping: 16 }} className="grid gap-4 md:grid-cols-2">
          <StreakBoard currentStreak={data.streak.current} longestStreak={data.streak.longest} />
          <CatRingProgress percentage={ringPercentage} label={ringLabel} meta={ringMeta} />
          <motion.div layout transition={{ type: "spring", stiffness: 90, damping: 16 }} className="md:col-span-2">
            <HabitCalendar
              summary={data.summary}
              breakDate={data.streak.breakDate}
              todayKey={todayKey}
              monthLabel={monthLabel}
              isCurrentMonth={isCurrentMonth}
              allowToggle={false}
              dayStats={data.dayStats}
            />
          </motion.div>
        </motion.div>
        <div className="flex flex-col gap-4">
          <RewardCard
            visible={rewardUnlocked}
            alreadyCelebrated={celebrated}
            monthLabel={monthLabel}
            onCelebrate={handleCelebrate}
          />
          <Card className="rounded-2xl border border-border/60 bg-card/80">
            <CardContent className="space-y-3 p-6">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">今月の達成済み</span>
                <span className="font-semibold text-foreground">{accomplishedDays}日</span>
              </div>
              <Separator className="bg-border/60" />
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">残り</span>
                <span className="font-semibold text-foreground">{remainingDays}日</span>
              </div>
              <Separator className="bg-border/60" />
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">対象日数</span>
                <span className="font-semibold text-foreground">{trackedDays}日</span>
              </div>
              <Separator className="bg-border/60" />
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">達成率</span>
                <span className="font-semibold text-primary">{completionRate}%</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-card/60 p-6 shadow-sm backdrop-blur md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <CalendarDays className="size-5 text-primary" aria-hidden />
            猫の習慣ダッシュボード
          </h2>
          <p className="text-sm text-muted-foreground">
            今日全完了の連続記録を猫が見張っています。日々の達成状況をカレンダーで管理しましょう。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="rounded-full"
            onClick={() => handleMonthChange("prev")}
            aria-label="前の月へ"
            disabled={loading}
          >
            <ChevronLeft className="size-4" aria-hidden />
          </Button>
          <div className="rounded-full border border-border/80 px-4 py-1 text-sm font-medium text-foreground">
            {monthLabel}
          </div>
          <Button
            variant="outline"
            size="icon"
            className="rounded-full"
            onClick={() => handleMonthChange("next")}
            aria-label="次の月へ"
            disabled={loading}
          >
            <ChevronRight className="size-4" aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={handleRefreshClick}
            aria-label="データを再読み込み"
            disabled={loading || !user}
          >
            <RefreshCcw className={cn("size-4", loading ? "animate-spin" : "")} aria-hidden="true" />
          </Button>
        </div>
      </header>
      {renderContent()}
    </section>
  )
}
