import { useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  ArrowUpRight,
  CheckCircle,
  Clock,
  ListChecks,
  RefreshCcw,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { signInWithGoogle } from "@/lib/auth";
import type { Task } from "@/lib/storage.supabase";
import * as store from "@/lib/storage.supabase";
import { supabaseBrowser } from "@/lib/supabase";

const dateTimeFormatter = new Intl.DateTimeFormat("ja-JP", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatDate(timestamp: number) {
  return dateTimeFormatter.format(new Date(timestamp));
}

export default function DashboardOverview() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    const supabase = supabaseBrowser();

    const loadSession = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (ignore) return;
        setUser(data.session?.user ?? null);
        setAuthReady(true);
        setAuthError(null);
      } catch (err) {
        console.error("Failed to load auth session", err);
        if (ignore) return;
        setAuthError("認証状態の取得に失敗しました");
        setAuthReady(true);
      }
    };

    void loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (ignore) return;
      setUser(session?.user ?? null);
      setAuthError(null);
      setAuthReady(true);
    });

    return () => {
      ignore = true;
      subscription.unsubscribe();
    };
  }, []);

  const refreshTasks = useCallback(async () => {
    if (!user) {
      setTasks([]);
      return;
    }
    setTasksLoading(true);
    try {
      const data = await store.list();
      setTasks(data);
      setError(null);
    } catch (err) {
      console.error("Failed to fetch tasks", err);
      setError("タスクの取得に失敗しました");
    } finally {
      setTasksLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void refreshTasks();
  }, [refreshTasks]);

  const stats = useMemo(() => {
    if (tasks.length === 0) {
      return {
        total: 0,
        completed: 0,
        active: 0,
        completionRate: 0,
        lastUpdated: null as null | number,
      };
    }
    const completed = tasks.filter((task) => task.done).length;
    const active = tasks.length - completed;
    const completionRate = Math.round((completed / tasks.length) * 100);
    const lastUpdated = tasks[0]?.updatedAt ?? null;
    return { total: tasks.length, completed, active, completionRate, lastUpdated };
  }, [tasks]);

  const recentTasks = useMemo(() => tasks.slice(0, 5), [tasks]);

  if (!authReady) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (authError) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-destructive">{authError}</CardContent>
      </Card>
    );
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
                console.error("Failed to start sign in", err);
              });
            }}
          >
            Googleでログイン
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">今日のスナップショット</h2>
          <p className="text-sm text-muted-foreground">プロジェクト全体のタスク状況を確認できます。</p>
        </div>
        <div className="flex items-center gap-2">
          {error ? <span className="text-sm text-destructive">{error}</span> : null}
          <Button variant="outline" size="sm" onClick={() => void refreshTasks()} disabled={tasksLoading}>
            <RefreshCcw className={`mr-2 size-4 ${tasksLoading ? "animate-spin" : ""}`} />
            再読み込み
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">全タスク</CardTitle>
            <ListChecks className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">保存されているタスクの総数</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">完了済み</CardTitle>
            <CheckCircle className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completed}</div>
            <p className="text-xs text-muted-foreground">完了マークされたタスク</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">進行中</CardTitle>
            <Clock className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.active}</div>
            <p className="text-xs text-muted-foreground">まだ完了していないタスク</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">完了率</CardTitle>
            <ArrowUpRight className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completionRate}%</div>
            <p className="text-xs text-muted-foreground">全タスクに対する完了済みの割合</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">最新の更新</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {tasksLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : recentTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">表示できるタスクがありません。</p>
            ) : (
              <ul className="space-y-3">
                {recentTasks.map((task) => (
                  <li key={task.id} className="rounded-lg border border-border bg-card/50 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">{task.title}</p>
                        {task.detail ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {task.detail.length > 120 ? `${task.detail.slice(0, 120)}…` : task.detail}
                          </p>
                        ) : null}
                      </div>
                      <span
                        className={
                          task.done
                            ? "inline-flex rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-600"
                            : "inline-flex rounded-full bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-600"
                        }
                      >
                        {task.done ? "完了" : "進行中"}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                      <span>更新: {formatDate(task.updatedAt)}</span>
                      <a className="text-primary hover:underline" href={`/tasks/${task.id}`}>
                        詳細を見る
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">アクション</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>タスクを追加したり進捗を更新したい場合はこちらから操作できます。</p>
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <a href="/tasks/new">新しいタスクを作成</a>
              </Button>
              <Button variant="outline" asChild>
                <a href="/tasks">タスク一覧を開く</a>
              </Button>
            </div>
            {stats.lastUpdated ? (
              <p className="text-xs text-muted-foreground">最終更新: {formatDate(stats.lastUpdated)}</p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
