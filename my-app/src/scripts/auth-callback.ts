// Handle Supabase OAuth callback in the browser
import { supabaseBrowser } from "~/lib/supabase";

const supabase = supabaseBrowser();
const url = new URL(location.href);
const code = url.searchParams.get("code");

if (code) {
  supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
    if (error) {
      console.error(error);
    }
    const redirectUrl = sessionStorage.getItem("redirect_url") || "/";
    sessionStorage.removeItem("redirect_url");
    location.href = redirectUrl;
  });
} else {
  location.href = "/";
}
