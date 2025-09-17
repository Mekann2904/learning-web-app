import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import type { User } from "@supabase/supabase-js"

import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import type { ColumnDef, SortingState } from "@tanstack/react-table"
import { ArrowUpDown } from "lucide-react"

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
import { signInWithGoogle } from "@/lib/auth"
import { supabaseBrowser } from "@/lib/supabase"
import * as store from "@/lib/storage.supabase"
import type { Task } from "@/lib/storage.supabase"

const dateTimeFormatter = new Intl.DateTimeFormat("ja-JP", {
  dateStyle: "medium",
  timeStyle: "short",
})

const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
  dateStyle: "medium",
})

function formatDate(timestamp: number) {
  return dateTimeFormatter.format(new Date(timestamp))
}

function formatSchedule(task: Task) {
  if (!task.startDate && !task.endDate && !task.startTime && !task.endTime) {
    return "未設定"
  }

  const { startDate, endDate, startTime, endTime } = task
  const formatTime = (value?: string | null) => {
    if (!value) return null
    return value.length >= 5 ? value.slice(0, 5) : value
  }
  let dateLabel = ""
  if (startDate) {
    const start = dateFormatter.format(new Date(startDate))
    if (endDate && endDate !== startDate) {
      const end = dateFormatter.format(new Date(endDate))
      dateLabel = `${start}〜${end}`
    } else {
      dateLabel = start
    }
  } else if (endDate) {
    dateLabel = dateFormatter.format(new Date(endDate))
  }

  const normalizedStart = formatTime(startTime)
  const normalizedEnd = formatTime(endTime)

  let timeLabel = ""
  if (normalizedStart && normalizedEnd) {
    timeLabel = `${normalizedStart}〜${normalizedEnd}`
  } else if (normalizedStart) {
    timeLabel = normalizedStart
  } else if (normalizedEnd) {
    timeLabel = normalizedEnd
  }

  return [dateLabel, timeLabel].filter(Boolean).join(" ") || "未設定"
}

export default function TaskList() {
  const [user, setUser] = useState<User | null>(null)
  const [authStatus, setAuthStatus] = useState<"loading" | "ready">("loading")
  const [tasks, setTasks] = useState<Task[]>([])
  const [tasksLoading, setTasksLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let ignore = false
    const supabase = supabaseBrowser()

    const loadUser = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!ignore) {
          setUser(user ?? null)
          setAuthStatus("ready")
        }
      } catch (err) {
        console.error("Failed to fetch auth state", err)
        if (!ignore) {
          setError("認証状態の取得に失敗しました")
          setAuthStatus("ready")
        }
      }
    }

    loadUser()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (ignore) return
      setUser(session?.user ?? null)
      setAuthStatus("ready")
      setError(null)
    })

    return () => {
      ignore = true
      subscription.unsubscribe()
    }
  }, [])

  const refreshTasks = useCallback(async () => {
    if (!user) {
      setTasks([])
      setTasksLoading(false)
      return
    }
    setTasksLoading(true)
    try {
      const data = await store.list()
      setTasks(data)
      setError(null)
    } catch (err) {
      console.error("Failed to fetch tasks", err)
      setError("タスクの取得に失敗しました")
    } finally {
      setTasksLoading(false)
    }
  }, [user])

  useEffect(() => {
    void refreshTasks()
  }, [refreshTasks])

  const handleToggle = useCallback(
    async (taskId: string, done: boolean) => {
      setBusy(true)
      setTasks((prev) =>
        prev.map((task) => (task.id === taskId ? { ...task, done } : task))
      )
      try {
        await store.update(taskId, { done })
      } catch (err) {
        console.error("Failed to update task", err)
        setError("タスクの更新に失敗しました")
      } finally {
        await refreshTasks()
        setBusy(false)
      }
    },
    [refreshTasks]
  )

  const handleDelete = useCallback(
    async (taskId: string) => {
      setBusy(true)
      setTasks((prev) => prev.filter((task) => task.id !== taskId))
      try {
        await store.remove(taskId)
      } catch (err) {
        console.error("Failed to delete task", err)
        setError("タスクの削除に失敗しました")
      } finally {
        await refreshTasks()
        setBusy(false)
      }
    },
    [refreshTasks]
  )

  if (authStatus === "loading") {
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
          <p className="text-muted-foreground">
            Google アカウントでログインすると、タスクが自動的に同期されます。
          </p>
        </div>
        {error ? (
          <p className="text-destructive">{error}</p>
        ) : null}
        <Button
          className="w-full justify-center"
          onClick={() => {
            void signInWithGoogle()
          }}
        >
          Googleでログイン
        </Button>
      </div>
    )
  }

  let content: ReactNode
  if (tasksLoading) {
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
        最初のタスクを作成して、進捗を記録しましょう。
      </div>
    )
  } else {
    content = (
      <TaskDataTable
        data={tasks}
        busy={busy}
        onDelete={handleDelete}
        onToggle={handleToggle}
      />
    )
  }

  return (
    <div className="mt-6 space-y-4">
      {error ? (
        <div className="rounded-md border border-destructive/60 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}
      {content}
      {tasks.length > 0 && !tasksLoading ? (
        <p className="text-xs text-muted-foreground">
          タスクを完了済みにすると一覧が自動で最新状態に更新されます。
        </p>
      ) : null}
    </div>
  )
}

type TaskDataTableProps = {
  data: Task[]
  busy: boolean
  onToggle: (taskId: string, done: boolean) => void | Promise<void>
  onDelete: (taskId: string) => void | Promise<void>
}

function TaskDataTable({ data, busy, onToggle, onDelete }: TaskDataTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "updatedAt", desc: true },
  ])

  const columns = useMemo<ColumnDef<Task>[]>(
    () => [
      {
        id: "done",
        header: "完了",
        enableSorting: false,
        size: 56,
        cell: ({ row }) => {
          const task = row.original
          return (
            <input
              aria-label={task.done ? "完了済み" : "未完了"}
              type="checkbox"
              checked={task.done}
              onChange={(event) => {
                void onToggle(task.id, event.target.checked)
              }}
              className="size-4 rounded border-border text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              disabled={busy}
            />
          )
        },
      },
      {
        accessorKey: "title",
        header: "タスク",
        cell: ({ row }) => {
          const task = row.original
          return (
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">{task.title}</p>
              {task.detail ? (
                <p className="text-xs text-muted-foreground">{task.detail}</p>
              ) : null}
            </div>
          )
        },
      },
      {
        id: "schedule",
        header: "予定",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {formatSchedule(row.original)}
          </span>
        ),
      },
      {
        accessorKey: "updatedAt",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8"
            onClick={() =>
              column.toggleSorting(column.getIsSorted() === "asc")
            }
          >
            更新日時
            <ArrowUpDown className="ml-1 size-4" />
          </Button>
        ),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {formatDate(row.original.updatedAt)}
          </span>
        ),
      },
      {
        id: "status",
        header: "ステータス",
        enableSorting: false,
        cell: ({ row }) => (
          <span
            className={
              row.original.done
                ? "inline-flex rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600"
                : "inline-flex rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-600"
            }
          >
            {row.original.done ? "完了" : "未完了"}
          </span>
        ),
      },
      {
        id: "actions",
        header: "操作",
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
                  void onDelete(task.id)
                }}
                disabled={busy}
              >
                削除
              </Button>
            </div>
          )
        },
      },
    ],
    [busy, onDelete, onToggle]
  )

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return (
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
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
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
        <span>全 {data.length} 件のタスク</span>
        {busy ? <span>同期中...</span> : null}
      </div>
    </div>
  )
}
