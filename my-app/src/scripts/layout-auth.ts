// Handle auth button in the layout navigation
import { supabaseBrowser } from "~/lib/supabase";
import { signInWithGoogle, signOut } from "~/lib/auth";

const supabase = supabaseBrowser();
const el = document.getElementById("auth");

if (el) {
  const render = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      el.innerHTML = `<button class="py-2 px-3 rounded-lg border border-current bg-transparent cursor-pointer" id="logout">ログアウト</button>`;
      document.getElementById("logout")?.addEventListener("click", async () => {
        await signOut();
      });
    } else {
      el.innerHTML = `<button class="py-2 px-3 rounded-lg border border-current bg-transparent cursor-pointer" id="login">Googleでログイン</button>`;
      document.getElementById("login")?.addEventListener("click", async () => {
        await signInWithGoogle();
      });
    }
  };

  render();

  supabase.auth.onAuthStateChange(() => {
    render();
  });
}
