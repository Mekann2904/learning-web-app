// src/lib/auth.ts
import { supabaseBrowser } from "./supabase";

export async function signInWithGoogle() {
  // ログイン後のリダイレクト先を保存
  sessionStorage.setItem('redirect_url', location.pathname);

  const supabase = supabaseBrowser();
  const redirectTo = `${location.origin}/auth/callback`;
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo }
  });
  if (error) throw error;
  // The browser will be redirected to Google. Nothing to do here.
}

export async function signOut() {
  const supabase = supabaseBrowser();
  await supabase.auth.signOut();
  location.href = "/";
}