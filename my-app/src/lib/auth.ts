// src/lib/auth.ts
import { supabaseBrowser } from "./supabase";

export const REDIRECT_URL_STORAGE_KEY = "auth:redirect_url";
export const AUTH_RESULT_STORAGE_KEY = "auth:result";

function persistRedirectPath(pathname: string) {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(REDIRECT_URL_STORAGE_KEY, pathname);
  } catch (error) {
    console.warn("Failed to persist redirect target", error);
  }
}

export async function signInWithGoogle() {
  if (typeof window !== "undefined") {
    persistRedirectPath(window.location.pathname);
  }

  const supabase = supabaseBrowser();
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const redirectTo = `${origin}/auth/callback`;
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  });
  if (error) throw error;
  // The browser will be redirected to Google. Nothing to do here.
}

export async function signOut() {
  const supabase = supabaseBrowser();
  await supabase.auth.signOut();
  if (typeof window !== "undefined") {
    window.location.href = "/";
  }
}
