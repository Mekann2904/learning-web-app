import { useEffect, useState } from "react";
import type { ComponentType, ReactNode, SVGProps } from "react";
import type { User } from "@supabase/supabase-js";
import {
  LayoutDashboard,
  ListTodo,
  PlusCircle,
  Settings,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { signInWithGoogle, signOut } from "@/lib/auth";
import { supabaseBrowser } from "@/lib/supabase";

type NavItem = {
  title: string;
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  description?: string;
  isActive?: (pathname: string) => boolean;
};

type SidebarLayoutProps = {
  title?: string;
  pathname: string;
  children: ReactNode;
};

const navMain: NavItem[] = [
  {
    title: "ダッシュボード",
    href: "/",
    icon: LayoutDashboard,
    description: "現在のタスク状況を確認",
  },
  {
    title: "タスク一覧",
    href: "#tasks",
    icon: ListTodo,
    description: "すべてのタスクを一覧表示",
    isActive: (pathname) => pathname === "/",
  },
  {
    title: "新規タスク",
    href: "/tasks/new",
    icon: PlusCircle,
    description: "タスクを追加",
  },
];

const navWorkspace: NavItem[] = [
  {
    title: "メンバー",
    href: "/auth/callback",
    icon: Users,
    description: "メンバーの認証と管理",
  },
  {
    title: "設定",
    href: "#",
    icon: Settings,
    description: "ワークスペースの調整",
  },
];

export default function SidebarLayout({ title, pathname, children }: SidebarLayoutProps) {
  return (
    <SidebarProvider className="flex min-h-svh w-full bg-background">
      <Sidebar collapsible="icon" variant="inset" className="border-r border-sidebar-border">
        <SidebarHeader className="px-3 py-4 group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-semibold">
              TW
            </div>
            <div className="flex flex-col truncate group-data-[collapsible=icon]:hidden">
              <span className="text-sm font-semibold">TaskWorks</span>
              <span className="text-xs text-muted-foreground">あなたの作業をスマートに</span>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent className="group-data-[collapsible=icon]:px-1 group-data-[collapsible=icon]:py-2">
          <SidebarGroup>
            <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden">メイン</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navMain.map((item) => {
                  const active = item.isActive ? item.isActive(pathname) : pathname === item.href;
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                        <a
                          href={item.href}
                          className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center"
                          aria-label={item.description}
                        >
                          <item.icon className="size-4" />
                          <span className="group-data-[collapsible=icon]:hidden">{item.title}</span>
                        </a>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarSeparator className="mx-2" />
          <SidebarGroup>
            <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden">ワークスペース</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navWorkspace.map((item) => {
                  const active = item.isActive ? item.isActive(pathname) : pathname === item.href;
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                        <a
                          href={item.href}
                          className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center"
                          aria-label={item.description}
                        >
                          <item.icon className="size-4" />
                          <span className="group-data-[collapsible=icon]:hidden">{item.title}</span>
                        </a>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="border-t border-sidebar-border group-data-[collapsible=icon]:hidden">
          <AccountSection />
        </SidebarFooter>
      </Sidebar>
      <SidebarInset
        className="md:peer-data-[variant=inset]:m-0 md:peer-data-[variant=inset]:rounded-none md:peer-data-[variant=inset]:shadow-none md:pl-[calc(var(--sidebar-width)+theme(spacing.4))] md:peer-data-[state=collapsed]:pl-[calc(var(--sidebar-width-icon)+theme(spacing.6))] md:peer-data-[collapsible=offcanvas]:pl-4 md:transition-[padding] md:duration-200 md:ease-linear"
      >
        <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur">
          <SidebarTrigger />
          <div className="flex flex-1 items-center justify-between gap-4">
            <div className="flex flex-col">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">Overview</span>
              <h1 className="text-lg font-semibold text-foreground">{title}</h1>
            </div>
            <div className="hidden items-center gap-2 md:flex">
              <Input placeholder="タスクを検索" className="max-w-xs" />
              <Button asChild className="whitespace-nowrap">
                <a href="/tasks/new">新規タスク</a>
              </Button>
            </div>
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-6 bg-muted/30 p-4 md:p-8">
          {children}
        </div>
      </SidebarInset>
      <SidebarRail />
    </SidebarProvider>
  );
}

function AccountSection() {
  const [user, setUser] = useState<User | null>(null)
  const [status, setStatus] = useState<"loading" | "ready">("loading")
  const [error, setError] = useState<string | null>(null)

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
          setStatus("ready")
        }
      } catch (err) {
        console.error("Failed to load auth state", err)
        if (!ignore) {
          setError("認証状態の取得に失敗しました")
          setStatus("ready")
        }
      }
    }

    loadUser()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (ignore) return
      setUser(session?.user ?? null)
      setStatus("ready")
      setError(null)
    })

    return () => {
      ignore = true
      subscription.unsubscribe()
    }
  }, [])

  return (
    <div className="rounded-md border border-dashed border-sidebar-border/70 bg-sidebar-accent/20 p-3 text-xs">
      {status === "loading" ? (
        <div className="space-y-3">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      ) : user ? (
        <div className="space-y-3">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">ログイン中</p>
            <p className="mt-1 text-sm font-semibold text-sidebar-foreground">{user.email}</p>
          </div>
          <p className="text-muted-foreground">
            タスクはすべてクラウドに保存され、どこからでも同期されます。
          </p>
          <Button
            variant="outline"
            className="w-full justify-center text-sm"
            onClick={() => {
              void signOut()
            }}
          >
            ログアウト
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <p className="text-sm font-semibold text-sidebar-foreground">アカウント</p>
            <p className="text-muted-foreground">
              ログインすると、タスクの保存やデバイス間での同期が利用できます。
            </p>
          </div>
          {error ? (
            <p className="text-destructive">{error}</p>
          ) : null}
          <Button
            className="w-full justify-center text-sm"
            onClick={() => {
              void signInWithGoogle()
            }}
          >
            Googleでログイン
          </Button>
        </div>
      )}
    </div>
  )
}
