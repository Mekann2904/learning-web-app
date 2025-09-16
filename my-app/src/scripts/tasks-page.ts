// Client script to render the task list with Supabase auth state
import { supabaseBrowser } from "../lib/supabase";
import * as store from "../lib/storage.supabase";
import { signInWithGoogle, signOut } from "../lib/auth";

const supabase = supabaseBrowser();
const root = document.getElementById("list");
const header = document.querySelector("h1");

if (!root || !header) {
  console.warn("Task list root or header element not found");
} else {
  const render = async () => {
    console.log("render function called");
    const { data: { user } } = await supabase.auth.getUser();
    console.log("user object:", user);

    if (user) {
      header.textContent = `${user.email}のタスク一覧`;

      const tasks = await store.list();
      const tasksMarkup = tasks.length
        ? tasks.map(t => `
            <div class="border border-gray-200 dark:border-gray-700 rounded-lg p-4 my-3">
              <label>
                <input type="checkbox" data-id="${t.id}" ${t.done ? "checked" : ""} />
                ${t.title}
              </label>
              <div class="text-gray-500 dark:text-gray-400">${new Date(t.updatedAt).toLocaleString()}</div>
              <div>
                <a class="py-2 px-3 rounded-lg border border-current bg-transparent cursor-pointer" href="/tasks/${t.id}">詳細</a>
                <button class="py-2 px-3 rounded-lg border border-current bg-transparent cursor-pointer" data-del="${t.id}">削除</button>
              </div>
            </div>
          `).join("")
        : `<p class="text-gray-500 dark:text-gray-400">タスクはまだない。人生は空白のままでは埋まらない。</p>`;

      root.innerHTML = `
        ${tasksMarkup}
      `;
      attach();
    } else {
      header.textContent = "タスク一覧";
      root.innerHTML = `<p class="text-gray-500 dark:text-gray-400">ログインすると、タスクを管理できます。</p>`;
      document.getElementById("login-btn")?.addEventListener("click", async () => {
        await signInWithGoogle();
      });
    }
  };

  const attach = () => {
    root.querySelectorAll("button[data-action=logout]").forEach(btn => {
      btn.addEventListener("click", async () => {
        await signOut();
      });
    });
    root.querySelectorAll("input[type=checkbox]").forEach(cb => {
      cb.addEventListener("change", async e => {
        const target = e.target as HTMLInputElement;
        const id = target.dataset.id;
        if (!id) return;
        await store.update(id, { done: target.checked });
        await render();
      });
    });
    root.querySelectorAll("[data-del]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-del");
        if (!id) return;
        await store.remove(id);
        await render();
      });
    });
  };

  render();

  supabase.auth.onAuthStateChange(() => {
    render();
  });
}
