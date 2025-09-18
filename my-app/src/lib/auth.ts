// src/lib/auth.ts
import { supabaseBrowser } from "./supabase";

export const REDIRECT_URL_STORAGE_KEY = "redirect_url";
export const AUTH_RESULT_STORAGE_KEY = "auth_last_result";

function resolveSiteBase() {
  const configured = import.meta.env.PUBLIC_SITE_URL?.trim();

  if (configured) {
    try {
      const url = new URL(configured);
      const pathname = url.pathname.endsWith("/") ? url.pathname : `${url.pathname}/`;
      return { href: `${url.origin}${pathname}`, origin: url.origin };
    } catch (error) {
      console.warn("Invalid PUBLIC_SITE_URL, falling back to window.location.origin.", error);
    }
  }

  if (typeof window !== "undefined") {
    const origin = window.location.origin;
    return { href: `${origin}/`, origin };
  }

  throw new Error("Unable to resolve site URL. Set PUBLIC_SITE_URL to a fully qualified URL.");
}

function resolveCallbackUrl(siteBase: { href: string; origin: string }) {
  const configured = import.meta.env.PUBLIC_AUTH_CALLBACK_URL?.trim();
  if (configured) {
    try {
      const url = new URL(configured, siteBase.href);
      if (url.origin === siteBase.origin) {
        return url.toString();
      }
      console.warn(
        `PUBLIC_AUTH_CALLBACK_URL origin (${url.origin}) does not match the site origin (${siteBase.origin}). Falling back to same-origin callback path.`,
      );
    } catch (error) {
      console.warn("Invalid PUBLIC_AUTH_CALLBACK_URL, falling back to default /auth/callback.", error);
    }
  }

  return new URL("/auth/callback", siteBase.href).toString();
}

function rememberCurrentLocation() {
  if (typeof window === "undefined") return;

  try {
    const { pathname, search, hash } = window.location;
    const value = `${pathname || "/"}${search}${hash}`;
    window.sessionStorage.setItem(REDIRECT_URL_STORAGE_KEY, value || "/");
  } catch (error) {
    console.warn("Failed to persist redirect path in sessionStorage.", error);
  }
}

export async function signInWithGoogle(): Promise<void> {
  if (typeof window === "undefined") {
    throw new Error("signInWithGoogle can only be called in the browser.");
  }

  rememberCurrentLocation();

  try {
    window.sessionStorage.removeItem(AUTH_RESULT_STORAGE_KEY);
  } catch (error) {
    console.warn("Failed to clear previous auth result state.", error);
  }

  const supabase = supabaseBrowser();
  const siteBase = resolveSiteBase();
  const redirectTo = resolveCallbackUrl(siteBase);
  console.info("signInWithGoogle initiating", { redirectTo, siteBase });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      queryParams: {
        prompt: "select_account",
      },
    },
  });
  if (error) throw error;

  console.info("signInWithGoogle result", { data });

  if (data?.url) {
    console.info("Redirecting browser to Google OAuth URL", { url: data.url });
    window.location.assign(data.url);
  }
}

export async function signOut(): Promise<void> {
  const supabase = supabaseBrowser();
  await supabase.auth.signOut();
  if (typeof window !== "undefined") {
    window.location.replace("/");
  }
}
