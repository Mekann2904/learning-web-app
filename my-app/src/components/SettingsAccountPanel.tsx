import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { signOut } from "@/lib/auth";
import { supabaseBrowser } from "@/lib/supabase";

type ProfileState = {
  name: string;
  email: string;
  lastSignIn: string;
  canSignOut: boolean;
};

const loadingState: ProfileState = {
  name: "読み込み中…",
  email: "読み込み中…",
  lastSignIn: "最終ログイン: 読み込み中…",
  canSignOut: false,
};

const errorState: ProfileState = {
  name: "未取得",
  email: "未取得",
  lastSignIn: "最終ログイン: 不明",
  canSignOut: false,
};

export default function SettingsAccountPanel() {
  const [profile, setProfile] = useState<ProfileState>(loadingState);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function fetchProfile() {
      const supabase = supabaseBrowser();
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (!active) return;

        if (error || !user) {
          console.error("Failed to fetch user info", error);
          setProfile(errorState);
          return;
        }

        const fullName =
          (user.user_metadata?.full_name as string | undefined) ||
          (user.user_metadata?.name as string | undefined) ||
          user.email ||
          "名称未設定";
        const email = user.email ?? "未登録";
        const lastSignInDate = user.last_sign_in_at ? new Date(user.last_sign_in_at) : null;
        const formattedLastSignIn = lastSignInDate
          ? new Intl.DateTimeFormat("ja-JP", {
              year: "numeric",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            }).format(lastSignInDate)
          : "不明";

        setProfile({
          name: fullName,
          email,
          lastSignIn: `最終ログイン: ${formattedLastSignIn}`,
          canSignOut: true,
        });
      } catch (err) {
        console.error("Unexpected error fetching profile", err);
        if (!active) return;
        setProfile(errorState);
      }
    }

    fetchProfile();

    return () => {
      active = false;
    };
  }, []);

  const handleSignOut = async () => {
    if (signingOut || !profile.canSignOut) return;
    setSignOutError(null);
    setSigningOut(true);
    try {
      await signOut();
    } catch (error) {
      console.error("Sign out failed", error);
      setSignOutError("ログアウトに失敗しました。時間をおいて再度お試しください。");
      setSigningOut(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>アカウント情報</CardTitle>
          <CardDescription>
            プロフィール情報は連携中の認証プロバイダーから同期されます。
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">表示名</p>
              <p className="text-base text-foreground">{profile.name}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">メールアドレス</p>
              <p className="text-base text-foreground break-all">{profile.email}</p>
            </div>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            表示名やメールアドレスを変更する場合は、Googleアカウント設定から更新してください。
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>セッション</CardTitle>
          <CardDescription>共有デバイスでは作業後にログアウトしてください。</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1 text-sm">
            <p className="font-medium text-foreground">現在ログイン中</p>
            <p className="text-muted-foreground">{profile.lastSignIn}</p>
          </div>
          <div className="flex flex-col items-stretch gap-2 sm:items-end">
            <Button
              variant="outline"
              className="border-destructive/40 text-destructive hover:bg-destructive/10"
              onClick={handleSignOut}
              disabled={!profile.canSignOut || signingOut}
            >
              {signingOut ? "ログアウト中…" : "ログアウト"}
            </Button>
            {signOutError ? (
              <p className="text-xs text-destructive">{signOutError}</p>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
