import { useEffect } from "react";
import { REDIRECT_URL_STORAGE_KEY } from "~/lib/auth";
import { supabaseBrowser } from "~/lib/supabase";

const FALLBACK_REDIRECT = "/";

function consumeRedirectTarget(): string {
  try {
    const target = window.sessionStorage.getItem(REDIRECT_URL_STORAGE_KEY);
    window.sessionStorage.removeItem(REDIRECT_URL_STORAGE_KEY);
    return target && target.startsWith("/") ? target : FALLBACK_REDIRECT;
  } catch (error) {
    console.warn("Failed to read redirect target", error);
    return FALLBACK_REDIRECT;
  }
}

export default function AuthCallbackHandler() {
  useEffect(() => {
    let cancelled = false;

    async function handleCallback() {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      const redirectTarget = consumeRedirectTarget();

      const redirect = () => {
        if (!cancelled) {
          window.location.replace(redirectTarget);
        }
      };

      if (!code) {
        console.error("Missing authorization code in callback URL");
        redirect();
        return;
      }

      try {
        const supabase = supabaseBrowser();
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          console.error("Failed to exchange code for session", error);
        }
      } catch (error) {
        console.error("Unexpected error during Supabase OAuth exchange", error);
      }

      redirect();
    }

    handleCallback();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
