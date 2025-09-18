import { useEffect } from "react";

import { AUTH_RESULT_STORAGE_KEY, REDIRECT_URL_STORAGE_KEY } from "~/lib/auth";
import { supabaseBrowser } from "~/lib/supabase";

const PROVIDER_ERROR_MESSAGE = "Google ログインに失敗しました。もう一度お試しください。";
const EXCHANGE_ERROR_MESSAGE = "セッションの確立に失敗しました。時間をおいて再試行してください。";

type AuthResultStatus = "success" | "provider_error" | "exchange_error" | "session_missing";

function recordAuthResult(status: AuthResultStatus) {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(AUTH_RESULT_STORAGE_KEY, status);
  } catch (error) {
    console.warn("Failed to persist auth result state.", error);
  }
}

function scheduleRedirect(callback: () => void) {
  if (typeof window === "undefined") return;

  window.setTimeout(() => {
    try {
      callback();
    } catch (error) {
      console.error("Failed to execute scheduled redirect", error);
    }
  }, 0);
}

function consumeStoredRedirect(): string | null {
  if (typeof window === "undefined") return null;

  try {
    const value = window.sessionStorage.getItem(REDIRECT_URL_STORAGE_KEY);
    window.sessionStorage.removeItem(REDIRECT_URL_STORAGE_KEY);
    return value;
  } catch (error) {
    console.warn("Failed to access sessionStorage for redirect path.", error);
    return null;
  }
}

function replaceWith(url: URL) {
  const relative = `${url.pathname}${url.search}${url.hash}`;
  scheduleRedirect(() => {
    window.location.replace(relative);
  });
}

function listLocalStorageKeys(): string[] {
  if (typeof window === "undefined") return [];
  const { localStorage } = window;
  if (!localStorage) return [];
  const keys: string[] = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key) keys.push(key);
  }
  return keys;
}

function redirectToPath(path: string | null | undefined) {
  if (typeof window === "undefined") return;

  if (path) {
    try {
      const target = new URL(path, window.location.origin);
      if (target.origin === window.location.origin) {
        replaceWith(target);
        return;
      }
      console.warn("Ignoring cross-origin redirect target.", target.toString());
    } catch (error) {
      console.warn("Invalid redirect target, falling back to root.", error);
    }
  }

  scheduleRedirect(() => {
    window.location.replace("/");
  });
}

function redirectWithError(message: string, storedPath: string | null, status: AuthResultStatus) {
  if (typeof window === "undefined") return;

  const fallback = storedPath ?? "/";

  recordAuthResult(status);

  try {
    const target = new URL(fallback, window.location.origin);
    target.searchParams.set("auth_error", message);
    if (target.origin === window.location.origin) {
      replaceWith(target);
      return;
    }
    console.warn("Error redirect target changed origin; using site root instead.");
  } catch (error) {
    console.warn("Failed to build error redirect URL, using site root.", error);
  }

  const root = new URL("/", window.location.origin);
  root.searchParams.set("auth_error", message);
  replaceWith(root);
}

export default function AuthCallback() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const supabase = supabaseBrowser();
    const url = new URL(window.location.href);
    const providerError = url.searchParams.get("error");
    const providerDescription = url.searchParams.get("error_description");
    const code = url.searchParams.get("code");
    const storedRedirect = consumeStoredRedirect();

    console.info("AuthCallback mounted", {
      href: window.location.href,
      providerError,
      hasCode: Boolean(code),
      storedRedirect,
      localStorageKeys: listLocalStorageKeys(),
    });

    if (providerError) {
      console.error("OAuth provider returned an error", {
        providerError,
        providerDescription,
      });
      redirectWithError(PROVIDER_ERROR_MESSAGE, storedRedirect, "provider_error");
      return;
    }

    if (!code) {
      recordAuthResult("session_missing");
      redirectToPath(storedRedirect);
      return;
    }

    let cancelled = false;

    const exchange = async () => {
      try {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (cancelled) return;

        if (error) {
          console.error("exchangeCodeForSession failed", error);
          redirectWithError(EXCHANGE_ERROR_MESSAGE, storedRedirect, "exchange_error");
          return;
        }

        const { data, error: sessionError } = await supabase.auth.getSession();
        if (cancelled) return;

        console.info("AuthCallback getSession result", {
          hasSession: Boolean(data.session),
          sessionUserId: data.session?.user.id,
          sessionError,
          localStorageKeys: listLocalStorageKeys(),
        });

        if (sessionError) {
          console.warn("getSession after exchange returned an error", sessionError);
          recordAuthResult("session_missing");
        } else if (!data.session) {
          console.warn("Session was not available after exchange.");
          recordAuthResult("session_missing");
        } else {
          recordAuthResult("success");
        }

        redirectToPath(storedRedirect);
      } catch (error) {
        if (cancelled) return;
        console.error("exchangeCodeForSession threw", error);
        try {
          console.info("AuthCallback exchange failure storage snapshot", {
            localStorageKeys: listLocalStorageKeys(),
            sessionStorageKeys: Object.keys(window.sessionStorage ?? {}),
          });
        } catch (snapshotError) {
          console.warn("Failed to snapshot storage state", snapshotError);
        }
        redirectWithError(EXCHANGE_ERROR_MESSAGE, storedRedirect, "exchange_error");
      }
    };

    void exchange();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
