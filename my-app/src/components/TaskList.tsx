import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import type { User } from "@supabase/supabase-js"

import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import type { ColumnDef, SortingState } from "@tanstack/react-table"
import { ArrowUpDown, RefreshCcw, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { AUTH_RESULT_STORAGE_KEY, signInWithGoogle } from "@/lib/auth"
import { supabaseBrowser } from "@/lib/supabase"
import * as store from "@/lib/storage.supabase"
import type { TaskListRow } from "@/lib/storage.supabase"

const dateTimeFormatter = new Intl.DateTimeFormat("ja-JP", {
  dateStyle: "medium",
  timeStyle: "short",
})

function formatDate(timestamp: number) {
  return dateTimeFormatter.format(new Date(timestamp))
}

function formatCount(value: number) {
  if (Number.isInteger(value)) return value.toString()
  return value.toFixed(1)
}

type OverviewMeta = {
  dateIso: string
  timeZone: string
}

export default function TaskList() {
  const [user, setUser] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [overviewMeta, setOverviewMeta] = useState<OverviewMeta | null>(null)
  const [tasks, setTasks] = useState<TaskListRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

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

      if (result) {
        console.info("TaskList detected auth result state", { result })
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
        console.error("Failed to fetch auth state", err)
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

  const refreshTasks = useCallback(async () => {
    if (!user) {
      setTasks([])
      setOverviewMeta(null)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const overview = await store.fetchTaskOverview()
      setTasks(overview.list)
      setOverviewMeta({ dateIso: overview.dateIso, timeZone: overview.timeZone })
      setError(null)
    } catch (err) {
      console.error("Failed to fetch tasks", err)
      setError("タスクの取得に失敗しました")
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    void refreshTasks()
  }, [refreshTasks])

  const handleDelete = useCallback(
    async (taskId: string) => {
      setBusy(true)
      try {
        await store.remove(taskId)
      } catch (err) {
        console.error("Failed to delete task", err)
        setError("タスクの削除に失敗しました")
      } finally {
        setBusy(false)
        await refreshTasks()
      }
    },
    [refreshTasks]
  )

  const [sorting, setSorting] = useState<SortingState>([
    { id: "updatedAt", desc: true },
  ])

  const columns = useMemo<ColumnDef<TaskListRow>[]>(
    () => [
      {
        accessorKey: "title",
        header: "タスク",
        cell: ({ row }) => {
          const task = row.original
          return (
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-foreground">{task.title}</p>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {task.kind === "habit" ? "習慣" : "単発"}
                </span>
                {!task.active ? (
                  <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-600">
                    無効中
                  </span>
                ) : null}
              </div>
              {task.detail ? (
                <p className="text-xs text-muted-foreground">{task.detail}</p>
              ) : null}
              {task.tags.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {task.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-slate-200/60 px-2 py-0.5 text-[11px] text-slate-600 dark:bg-slate-700/60 dark:text-slate-200"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          )
        },
      },
      {
        accessorKey: "cadenceLabel",
        header: "期間ルール",
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">{row.original.cadenceLabel}</span>
        ),
      },
      {
        id: "timeSlots",
        header: "時間",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1.5">
            {row.original.timeSlots.map((slot) => (
              <span
                key={slot.id}
                className={
                  slot.anytime
                    ? "rounded-md bg-slate-200/60 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-700/60 dark:text-slate-200"
                    : "rounded-md bg-primary/10 px-2 py-0.5 text-xs text-primary"
                }
              >
                {slot.label}
              </span>
            ))}
          </div>
        ),
      },
      {
        id: "today",
        header: "今日の進捗",
        cell: ({ row }) => {
          const task = row.original
          if (task.targetToday <= 0) {
            return <span className="text-sm text-muted-foreground">対象外</span>
          }
          return (
            <div className="space-y-1 text-sm">
              <span>{`${formatCount(task.completedToday)} / ${formatCount(task.targetToday)}`}</span>
              <span className="text-xs text-muted-foreground">残り {formatCount(task.remainingToday)}</span>
            </div>
          )
        },
      },
      {
        id: "status",
        header: "ステータス",
        enableSorting: false,
        cell: ({ row }) => {
          const status = row.original.statusToday
          const label = status === "done" ? "完了" : status === "inactive" ? "対象外" : "未完了"
          const className =
            status === "done"
              ? "inline-flex rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600"
              : status === "inactive"
              ? "inline-flex rounded-full bg-slate-400/10 px-2.5 py-1 text-xs font-medium text-slate-500"
              : "inline-flex rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-600"
          return <span className={className}>{label}</span>
        },
      },
      {
        accessorKey: "updatedAt",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            更新日時
            <ArrowUpDown className="ml-1 size-4" />
          </Button>
        ),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">{formatDate(row.original.updatedAt)}</span>
        ),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => {
          const task = row.original
          return (
            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" size="sm" asChild>
                <a href={`/tasks/${task.id}`}>詳細</a>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  void handleDelete(task.id)
                }}
                disabled={busy}
              >
                <Trash2 className="mr-1 size-4" />
                削除
              </Button>
            </div>
          )
        },
      },
    ],
    [busy, handleDelete]
  )

  const table = useReactTable({
    data: tasks,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  if (!authReady) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="mt-6 space-y-4 rounded-xl border border-border bg-muted/50 p-6 text-sm">
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-foreground">タスクを保存するにはログイン</h3>
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

  let content: ReactNode
  if (loading) {
    content = (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-3/4" />
      </div>
    )
  } else if (tasks.length === 0) {
    content = (
      <div className="rounded-xl border border-border bg-muted/40 p-6 text-sm text-muted-foreground">
        最初のタスクを作成して、Today画面にスケジュールを反映させましょう。
      </div>
    )
  } else {
    content = (
      <div className="space-y-4">
        <div className="overflow-hidden rounded-xl border border-border shadow-sm">
          <Table>
            <TableHeader className="bg-muted/50">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} className="align-middle">
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id} className="bg-card">
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center text-sm text-muted-foreground"
                  >
                    表示できるタスクがありません。
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>全 {tasks.length} 件のタスク</span>
          {busy ? <span>更新中...</span> : null}
        </div>
      </div>
    )
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/30 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="font-medium text-foreground">今日の基準日: {overviewMeta ? overviewMeta.dateIso : "--"}</p>
          <p className="text-xs text-muted-foreground">基準タイムゾーン: {overviewMeta ? overviewMeta.timeZone : "--"}</p>
        </div>
        <div className="flex items-center gap-2">
          {error ? <span className="text-sm text-destructive">{error}</span> : null}
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refreshTasks()}
            disabled={loading}
          >
            <RefreshCcw className={`mr-2 size-4 ${loading ? "animate-spin" : ""}`} />
            再読み込み
          </Button>
        </div>
      </div>
      {content}
    </div>
  )
}
