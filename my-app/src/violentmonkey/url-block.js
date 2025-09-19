// ==UserScript==
// @name         URL Blacklist Redirect (Cats Hand Diagonal Slide)
// @namespace    Violentmonkey Scripts
// @version      3.2.0
// @description  Redirects with a cat's hand animation sliding in from the bottom-right. Settings are saved and editable via menu.
// @author       -
// @match        *://*/*
// @run-at       document-start
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.registerMenuCommand
// ==/UserScript==

(async function() {
    'use strict';

    // ----- 設定のキー -----
    const STORAGE_KEYS = {
        BLACKLIST: 'simple_redirect_blacklist',
        REDIRECT_URL: 'simple_redirect_redirect_url'
    };

    // ----- デフォルト設定 -----
    const DEFAULTS = {
        BLACKLIST: [
            "example.com/blocked-page",
            "another-website.org/undesirable",
            "specific-domain.net"
        ],
        REDIRECT_URL: "https://www.google.com"
    };

    // ----- 猫の手画像とアニメーション設定 -----
    const CAT_HAND_IMAGE_URL = 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjwVlRGK0fm-gMro8ZEQsgkMlKNYC9X-XDYoPdFgxkdDF7ndZpTELr-s1Vc2RSu4gfnmZMfaB4s03lq9BaPZvKV6glPoEL19idLS3M_7B0WELCAKy5r4mH0Pw0w4McgYdt4ByAAJtOKknZO/s484/cat_hand_mike.png';
    const ANIMATION_SLIDE_IN_MS = 800;  // 猫の手がスライドしてくる時間 (0.8秒)
    const REDIRECT_DELAY_MS = 1800;     // 猫の手表示からリダイレクトまでの総時間 (1.8秒)

    // ----- 設定を読み込む -----
    const blacklist = await GM.getValue(STORAGE_KEYS.BLACKLIST, DEFAULTS.BLACKLIST);
    const redirectUrl = await GM.getValue(STORAGE_KEYS.REDIRECT_URL, DEFAULTS.REDIRECT_URL);

    // ----- メインの処理 -----
    const currentUrl = window.location.href;

    if (currentUrl.includes(redirectUrl)) {
        return;
    }

    for (const blockedUrl of blacklist) {
        if (!blockedUrl) continue;

        if (currentUrl.includes(blockedUrl)) {
            showCatHandAnimationAndRedirect(redirectUrl);
            return;
        }
    }

    // ----- 猫の手アニメーション関数 (修正版) -----
    function showCatHandAnimationAndRedirect(targetUrl) {
        // 背景オーバーレイの作成
        const container = document.createElement('div');
        Object.assign(container.style, {
            position: 'fixed',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            zIndex: '2147483647', // 最前面に表示
            opacity: '0',
            transition: 'opacity 0.3s ease-in-out'
        });

        // 猫の手画像の作成
        const catHand = document.createElement('img');
        catHand.src = CAT_HAND_IMAGE_URL;
        Object.assign(catHand.style, {
            position: 'fixed',
            right: '0px',
            bottom: '0px',
            width: '480px',
            maxWidth: '80vw',
            // ★ 初期位置: 画面の右下に隠れ、45度回転した状態
            transform: 'translate(80%, 80%) rotate(-45deg)',
            // ★ アニメーションの設定: transformプロパティが変化する時に適用
            transition: `transform ${ANIMATION_SLIDE_IN_MS}ms cubic-bezier(0.25, 1, 0.5, 1)` // 少しバウンドするような動き
        });

        document.body.appendChild(container);
        container.appendChild(catHand);

        // アニメーションを開始
        setTimeout(() => {
            container.style.opacity = '1';
            // ★ 最終位置: 右下から少しだけ画面内に表示される
            catHand.style.transform = 'translate(15%, 15%) rotate(-45deg)';
        }, 50); // 描画のためのごく短い遅延

        // 指定時間後にリダイレクト
        setTimeout(() => {
            window.location.href = targetUrl;
        }, REDIRECT_DELAY_MS);
    }


    // ----- 以下、メニュー機能 (変更なし) -----

    GM.registerMenuCommand('現在のドメインをブロック', async () => {
        const domain = window.location.hostname;
        if (blacklist.includes(domain)) {
            alert(`ドメイン "${domain}" は既にブラックリストに登録されています。`);
            return;
        }
        const updatedBlacklist = [...blacklist, domain];
        await GM.setValue(STORAGE_KEYS.BLACKLIST, updatedBlacklist);
        alert(`ドメイン "${domain}" をブラックリストに追加しました。\nページをリロードするとリダイレクトが有効になります。`);
    });

    GM.registerMenuCommand('ブラックリストを編集...', async () => {
        const input = prompt(
            "ブロックしたいURLの文字列を改行で区切って入力してください。",
            blacklist.join('\n')
        );

        if (input !== null) {
            const newBlacklist = input.split('\n').map(item => item.trim()).filter(Boolean);
            await GM.setValue(STORAGE_KEYS.BLACKLIST, newBlacklist);
            alert("ブラックリストを更新しました。");
        }
    });

    GM.registerMenuCommand('リダイレクト先を設定...', async () => {
        const newRedirectUrl = prompt("リダイレクト先のURLを入力してください。", redirectUrl);

        if (newRedirectUrl) {
            await GM.setValue(STORAGE_KEYS.REDIRECT_URL, newRedirectUrl);
            alert(`リダイレクト先を "${newRedirectUrl}" に設定しました。`);
        }
    });

})();