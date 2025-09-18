// ==UserScript==
// @name         URL Blacklist Redirect
// @namespace    https://taskworks.example
// @version      3.2.0
// @description  Show a short cat-paw animation before redirecting away from blacklisted URLs.
// @author       TaskWorks
// @match        *://*/*
// @run-at       document-start
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.registerMenuCommand
// ==/UserScript==

(async () => {
  const DEFAULT_REDIRECT = "https://taskworks.example/safe";
  const DEFAULT_BLACKLIST = ["example.com/bored", "social.example"].join("\n");

  async function loadSettings() {
    const [rawList, redirectTo] = await Promise.all([
      GM.getValue("blacklist", DEFAULT_BLACKLIST),
      GM.getValue("redirect", DEFAULT_REDIRECT),
    ]);

    const blacklist = rawList
      .split(/\r?\n/)
      .map((entry) => entry.trim())
      .filter(Boolean);

    return { blacklist, redirectTo: redirectTo || DEFAULT_REDIRECT, rawList };
  }

  async function saveBlacklist(raw) {
    await GM.setValue("blacklist", raw);
  }

  async function saveRedirect(url) {
    await GM.setValue("redirect", url);
  }

  function shouldRedirect(blacklist, url) {
    return blacklist.some((needle) => url.includes(needle));
  }

  function injectCatAnimation() {
    const style = document.createElement("style");
    style.textContent = `
      @keyframes catpaw-slide {
        0% { transform: translate(120%, 120%) rotate(-12deg); opacity: 0; }
        20% { opacity: 1; }
        60% { transform: translate(0, 0) rotate(0deg); }
        80% { transform: translate(0, 0) rotate(0deg); }
        100% { transform: translate(120%, 120%) rotate(15deg); opacity: 0; }
      }
      .url-blacklist-redirect__catpaw {
        position: fixed;
        bottom: 18px;
        right: 18px;
        width: 96px;
        height: 96px;
        background: radial-gradient(circle at 30% 30%, #f8d7da 0%, #f8d7da 35%, #feca9b 36%, #feca9b 100%);
        border-radius: 50% 50% 45% 45%;
        box-shadow: 0 12px 24px rgba(0,0,0,0.2);
        display: flex;
        align-items: center;
        justify-content: center;
        transform: translate(120%, 120%);
        animation: catpaw-slide 1400ms ease-in-out forwards;
        z-index: 2147483647;
      }
      .url-blacklist-redirect__catpaw::before,
      .url-blacklist-redirect__catpaw::after {
        content: "";
        position: absolute;
        background: #f8d7da;
        border-radius: 50%;
      }
      .url-blacklist-redirect__catpaw::before {
        width: 24px;
        height: 28px;
        top: 14px;
        left: 14px;
        box-shadow: 32px 4px 0 #f8d7da, 18px 30px 0 #f8d7da, 46px 30px 0 #f8d7da;
      }
      .url-blacklist-redirect__catpaw::after {
        width: 32px;
        height: 20px;
        bottom: 12px;
        right: 18px;
        transform: rotate(12deg);
      }
    `;
    document.head.appendChild(style);

    const paw = document.createElement("div");
    paw.className = "url-blacklist-redirect__catpaw";
    paw.setAttribute("aria-hidden", "true");
    document.body.appendChild(paw);

    window.setTimeout(() => {
      paw.remove();
      style.remove();
    }, 1600);
  }

  function registerMenu({ blacklist, redirectTo, rawList }) {
    GM.registerMenuCommand("現在のドメインをブロック", async () => {
      const hostname = window.location.hostname;
      if (blacklist.includes(hostname)) {
        alert(`${hostname} はすでにブラックリストに含まれています。`);
        return;
      }
      const updated = `${rawList}\n${hostname}`.trim();
      await saveBlacklist(updated);
      alert(`${hostname} をブラックリストに追加しました。`);
    });

    GM.registerMenuCommand("ブラックリストを編集", async () => {
      const next = prompt("ブラックリストを改行区切りで入力してください", rawList);
      if (next === null) return;
      await saveBlacklist(next);
      alert("ブラックリストを更新しました。");
    });

    GM.registerMenuCommand("リダイレクト先を変更", async () => {
      const next = prompt("リダイレクト先 URL", redirectTo);
      if (!next) return;
      try {
        const url = new URL(next, window.location.href).toString();
        await saveRedirect(url);
        alert(`リダイレクト先を ${url} に変更しました。`);
      } catch (error) {
        alert("有効な URL を入力してください。");
      }
    });
  }

  const settings = await loadSettings();
  registerMenu(settings);

  const currentUrl = window.location.href;
  if (!shouldRedirect(settings.blacklist, currentUrl)) {
    return;
  }

  const redirectTarget = settings.redirectTo;

  const ready = () => {
    injectCatAnimation();
    window.setTimeout(() => {
      window.location.replace(redirectTarget);
    }, 1200);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ready, { once: true });
  } else {
    ready();
  }
})();
