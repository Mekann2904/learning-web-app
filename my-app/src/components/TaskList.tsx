import { useCallback, useEffect, useState } from "react"
import type { User } from "@supabase/supabase-js"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { signInWithGoogle } from "@/lib/auth"
import { supabaseBrowser } from "@/lib/supabase"
import * as store from "@/lib/storage.supabase"
import type { Task } from "@/lib/storage.supabase"

const formatter = new Intl.DateTimeFormat("ja-JP", {
  dateStyle: "medium",
  timeStyle: "short",
})

function formatDate(timestamp: number) {
  return formatter.format(new Date(timestamp))
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

  const handleToggle = async (taskId: string, done: boolean) => {
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
  }

  const handleDelete = async (taskId: string) => {
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
  }

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

  return (
    <div className="mt-6 space-y-4">
      {error ? (
        <div className="rounded-md border border-destructive/60 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}
      {tasksLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-3/4" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="rounded-xl border border-border bg-muted/40 p-6 text-sm text-muted-foreground">
          最初のタスクを作成して、進捗を記録しましょう。
        </div>
      ) : (
        tasks.map((task) => (
          <article
            key={task.id}
            className="rounded-xl border border-border bg-card/80 p-5 shadow-sm transition hover:border-primary/50 hover:shadow-md"
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <label className="flex flex-1 items-start gap-3">
                <input
                  type="checkbox"
                  checked={task.done}
                  onChange={(event) => {
                    handleToggle(task.id, event.target.checked)
                  }}
                  className="mt-1 size-4 rounded border-border text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  disabled={busy}
                />
                <div className="space-y-2">
                  <h3 className="text-base font-semibold text-foreground">{task.title}</h3>
                  {task.detail ? (
                    <p className="text-sm text-muted-foreground">{task.detail}</p>
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    更新: {formatDate(task.updatedAt)}
                  </p>
                </div>
              </label>
              <div className="flex items-center gap-2 self-end md:self-start">
                <Button variant="ghost" size="sm" asChild>
                  <a href={`/tasks/${task.id}`}>詳細</a>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    handleDelete(task.id)
                  }}
                  disabled={busy}
                >
                  削除
                </Button>
              </div>
            </div>
            <Separator className="my-4" />
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="rounded-full bg-muted px-2 py-1 font-medium text-foreground/80">
                {task.done ? "完了" : "未完了"}
              </span>
              <span>{task.done ? "チェック済み" : "チェック可能"}</span>
            </div>
          </article>
        ))
      )}
      {tasks.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          タスクを完了済みにすると一覧が自動で最新状態に更新されます。
        </p>
      ) : null}
    </div>
  )
}
