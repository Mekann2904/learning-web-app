import type { ComponentType, ReactNode, SVGProps } from "react";
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
  noScroll?: boolean;
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

export default function SidebarLayout({ title, pathname, children, noScroll = false }: SidebarLayoutProps) {
  return (
    <SidebarProvider defaultOpen={false} className="group">
      {/* 追加: フレックスレイアウトのラッパー */}
      <div className="flex min-h-screen w-full">
      {/* サイドバー - 公式ドキュメントに従った構造 */}
      <Sidebar 
        collapsible="icon" 
        variant="sidebar"
      >
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
        {/* Account footer removed as requested */}
        <SidebarRail />
      </Sidebar>
      
      {/* SidebarInset - 公式ドキュメントに従った構造 */}
      <SidebarInset className={noScroll ? "flex min-h-screen w-full overflow-hidden" : "flex-1 min-h-screen w-full"}>
        {/* ヘッダー - SidebarInset内に配置 */}
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center gap-3 min-w-0">
            <SidebarTrigger className="shrink-0" />
            <div className="hidden md:block w-px h-6 bg-border mx-1"></div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">Overview</span>
              <h1 className="text-lg font-semibold text-foreground truncate">{title}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <div className="hidden items-center gap-2 md:flex">
              <Input placeholder="タスクを検索" className="max-w-xs" />
            </div>
            <Button asChild className="whitespace-nowrap">
              <a href="/tasks/new" className="flex items-center gap-2">
                <span className="hidden sm:inline">新規タスク</span>
                <span className="sm:hidden">+</span>
              </a>
            </Button>
          </div>
        </header>
        
        {/* メインコンテンツ - 公式ドキュメントに従った構造 */}
        <main className={noScroll ? "flex-1 overflow-hidden bg-background" : "flex-1 overflow-auto bg-background p-4 md:p-8"}>
          <div className="space-y-6">
            {children}
          </div>
        </main>
      </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
