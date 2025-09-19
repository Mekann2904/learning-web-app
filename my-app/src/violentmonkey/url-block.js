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
// @grant        GM.xmlHttpRequest
// ==/UserScript==

(async function() {
    'use strict';

    // ----- 設定のキー -----
    const STORAGE_KEYS = {
        BLACKLIST: 'simple_redirect_blacklist',
        REDIRECT_URL: 'simple_redirect_redirect_url',
        BLOCKING_WINDOWS: 'simple_redirect_blocking_windows',
        API_BASE: 'tw_api_base_url',
        API_TOKEN: 'tw_api_token',
        CACHE_TTL_MS: 'tw_cache_ttl_ms',
        WINDOW_CACHE: 'tw_windows_cache',
        FOCUS_ONLY: 'tw_focus_only'
    };

    // ----- デフォルト設定 -----
    const DEFAULTS = {
        BLACKLIST: [
            "example.com/blocked-page",
            "another-website.org/undesirable",
            "specific-domain.net"
        ],
        REDIRECT_URL: "https://www.google.com",
        BLOCKING_WINDOWS: [
            "09:00-17:00"
        ],
        API_BASE: "",
        API_TOKEN: "",
        CACHE_TTL_MS: 5 * 60 * 1000,
        FOCUS_ONLY: false
    };

    // ----- 猫の手画像とアニメーション設定 -----
    const CAT_HAND_IMAGE_URL = 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjwVlRGK0fm-gMro8ZEQsgkMlKNYC9X-XDYoPdFgxkdDF7ndZpTELr-s1Vc2RSu4gfnmZMfaB4s03lq9BaPZvKV6glPoEL19idLS3M_7B0WELCAKy5r4mH0Pw0w4McgYdt4ByAAJtOKknZO/s484/cat_hand_mike.png';
    const ANIMATION_SLIDE_IN_MS = 800;  // 猫の手がスライドしてくる時間 (0.8秒)
    const REDIRECT_DELAY_MS = 1800;     // 猫の手表示からリダイレクトまでの総時間 (1.8秒)

    // ----- 設定を読み込む -----
    const blacklist = await GM.getValue(STORAGE_KEYS.BLACKLIST, DEFAULTS.BLACKLIST);
    const redirectUrl = await GM.getValue(STORAGE_KEYS.REDIRECT_URL, DEFAULTS.REDIRECT_URL);
    let blockingWindowStrings = await GM.getValue(STORAGE_KEYS.BLOCKING_WINDOWS, DEFAULTS.BLOCKING_WINDOWS);
    if (!Array.isArray(blockingWindowStrings)) {
        blockingWindowStrings = DEFAULTS.BLOCKING_WINDOWS.slice();
    }
    let manualWindows = parseBlockingWindows(blockingWindowStrings);

    let apiBase = await GM.getValue(STORAGE_KEYS.API_BASE, DEFAULTS.API_BASE);
    apiBase = typeof apiBase === 'string' ? apiBase.trim() : '';

    let apiToken = await GM.getValue(STORAGE_KEYS.API_TOKEN, DEFAULTS.API_TOKEN);
    apiToken = typeof apiToken === 'string' ? apiToken.trim() : '';

    let cacheTtlMs = await GM.getValue(STORAGE_KEYS.CACHE_TTL_MS, DEFAULTS.CACHE_TTL_MS);
    cacheTtlMs = normalizeCacheTtl(cacheTtlMs, DEFAULTS.CACHE_TTL_MS);

    const focusOnly = await GM.getValue(STORAGE_KEYS.FOCUS_ONLY, DEFAULTS.FOCUS_ONLY);
    const windowsResult = await getBlockingWindows({ apiBase, apiToken, cacheTtlMs, focusOnly: !!focusOnly });
    if (windowsResult && windowsResult.source) {
        console.debug(`[URL Blacklist Redirect] TaskWorksウィンドウ取得元: ${windowsResult.source}`);
    }
    const effectiveWindows = windowsResult.source === 'manual' ? manualWindows : (windowsResult.windows || []);
    const windowSummaryText = formatWindowsForDisplay(effectiveWindows);
    const activeWindow = findActiveWindow(new Date(), effectiveWindows);

    // ----- メインの処理 -----
    const currentUrl = window.location.href;
    const windowRedirectUrl = activeWindow && typeof activeWindow.redirectUrl === 'string' && activeWindow.redirectUrl
        ? activeWindow.redirectUrl
        : redirectUrl;

    if (activeWindow && !currentUrl.includes(windowRedirectUrl)) {
        for (const blockedUrl of blacklist) {
            if (!blockedUrl) continue;

            if (currentUrl.includes(blockedUrl)) {
                showCatHandAnimationAndRedirect(windowRedirectUrl);
                return;
            }
        }
    }

    // ----- ブロック時間帯関連の関数 -----
    function parseBlockingWindows(entries) {
        if (!Array.isArray(entries)) {
            return [];
        }
        const pattern = /^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/;
        const windows = [];
        for (const entry of entries) {
            if (typeof entry !== 'string') continue;
            const trimmed = entry.trim();
            if (!trimmed) continue;
            const match = trimmed.match(pattern);
            if (!match) continue;
            const startHour = Number(match[1]);
            const startMinute = Number(match[2]);
            const endHour = Number(match[3]);
            const endMinute = Number(match[4]);
            if (startHour > 23 || endHour > 23 || startMinute > 59 || endMinute > 59) {
                continue;
            }
            const startTotal = startHour * 60 + startMinute;
            const endTotal = endHour * 60 + endMinute;
            const fullDay = startTotal === endTotal;
            const wraps = endTotal < startTotal;
            const raw = `${padTwoDigits(startHour)}:${padTwoDigits(startMinute)}-${padTwoDigits(endHour)}:${padTwoDigits(endMinute)}`;
            windows.push({
                type: 'manual',
                startMinutes: startTotal,
                endMinutes: endTotal,
                wraps,
                fullDay,
                raw
            });
        }
        return windows;
    }

    function padTwoDigits(value) {
        return value.toString().padStart(2, '0');
    }

    function normalizeCacheTtl(value, fallback) {
        const numeric = Number(value);
        if (!Number.isFinite(numeric) || numeric <= 0) {
            return fallback;
        }
        return numeric;
    }

    function formatWindowsForDisplay(windows) {
        if (!Array.isArray(windows) || !windows.length) {
            return '';
        }
        const formatter = new Intl.DateTimeFormat(undefined, {
            hour: '2-digit',
            minute: '2-digit'
        });
        return windows
            .map(window => {
                if (window.type === 'manual') {
                    if (window.fullDay) {
                        return '終日';
                    }
                    const label = `${padTwoDigits(Math.floor(window.startMinutes / 60))}:${padTwoDigits(window.startMinutes % 60)}-${padTwoDigits(Math.floor(window.endMinutes / 60))}:${padTwoDigits(window.endMinutes % 60)}`;
                    return `手動: ${label}`;
                }
                if (window.type === 'remote') {
                    const start = new Date(window.startMs);
                    const end = new Date(window.endMs);
                    const startFormatted = formatter.format(start);
                    const endFormatted = formatter.format(end);
                    return `API: ${startFormatted}-${endFormatted}`;
                }
                return '';
            })
            .filter(Boolean)
            .join('\n');
    }

    function findActiveWindow(now, windows) {
        if (!Array.isArray(windows) || !windows.length) {
            return null;
        }
        const nowMs = now.getTime();
        const minutes = now.getHours() * 60 + now.getMinutes();
        for (const window of windows) {
            if (!window) continue;
            if (window.fullDay) {
                return window;
            }
            if (window.type === 'remote') {
                if (typeof window.startMs !== 'number' || typeof window.endMs !== 'number') {
                    continue;
                }
                if (window.startMs <= nowMs && nowMs < window.endMs) {
                    return window;
                }
            } else if (window.type === 'manual') {
                if (window.wraps) {
                    if (minutes >= window.startMinutes || minutes < window.endMinutes) {
                        return window;
                    }
                } else if (minutes >= window.startMinutes && minutes < window.endMinutes) {
                    return window;
                }
            }
        }
        return null;
    }

    async function getBlockingWindows(config) {
        const now = Date.now();
        const cache = await GM.getValue(STORAGE_KEYS.WINDOW_CACHE, null);
        let staleCache = null;
        if (cache && Array.isArray(cache.windows) && typeof cache.fetchedAt === 'number') {
            staleCache = cache;
            const age = now - cache.fetchedAt;
            if (age <= config.cacheTtlMs) {
                return { windows: cache.windows, source: 'cache' };
            }
        }

        if (!config.apiBase) {
            return { windows: staleCache ? staleCache.windows : [], source: 'manual' };
        }

        try {
            const windows = await fetchWindowsFromApi(config);
            await GM.setValue(STORAGE_KEYS.WINDOW_CACHE, { windows, fetchedAt: Date.now() });
            return { windows, source: 'api' };
        } catch (error) {
            console.warn('[URL Blacklist Redirect] TaskWorks API fetch failed:', error);
            if (staleCache) {
                return { windows: staleCache.windows, source: 'stale-cache' };
            }
            return { windows: [], source: 'manual' };
        }
    }

    function fetchWindowsFromApi(config) {
        const base = config.apiBase.replace(/\/+$/, '');
        if (!base) {
            return Promise.resolve([]);
        }
        const today = new Date();
        const dateParam = formatDateForApi(today);
        const tzParam = getTimeZone();
        const focusOnlyParam = config.focusOnly ? '&focus_only=true' : '&focus_only=false';
        const url = `${base}/v1/blocks/windows?date=${encodeURIComponent(dateParam)}&tz=${encodeURIComponent(tzParam)}${focusOnlyParam}`;
        const authHeader = buildAuthorizationHeader(config.apiToken);

        return new Promise((resolve, reject) => {
            GM.xmlHttpRequest({
                method: 'GET',
                url,
                timeout: 8000,
                withCredentials: true,
                headers: {
                    Accept: 'application/json',
                    ...(authHeader ? { Authorization: authHeader } : {})
                },
                onload: response => {
                    if (response.status >= 200 && response.status < 300) {
                        try {
                            const payload = JSON.parse(response.responseText);
                            resolve(transformApiWindows(payload));
                        } catch (parseError) {
                            reject(new Error('TaskWorks応答の解析に失敗しました。'));
                        }
                    } else {
                        reject(new Error(`TaskWorks APIからステータス${response.status}が返されました。`));
                    }
                },
                onerror: () => reject(new Error('TaskWorks APIへの接続に失敗しました。')),
                ontimeout: () => reject(new Error('TaskWorks APIリクエストがタイムアウトしました。'))
            });
        });
    }

    function transformApiWindows(rawWindows) {
        if (!Array.isArray(rawWindows)) {
            return [];
        }
        const windows = [];
        for (const entry of rawWindows) {
            if (!entry || typeof entry !== 'object') continue;
            const startMs = Date.parse(entry.start_at);
            const endMs = Date.parse(entry.end_at);
            if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
                continue;
            }
            const policy = entry.policy || {};
            const mode = typeof policy.mode === 'string' ? policy.mode.toLowerCase() : 'blocklist';
            if (mode !== 'blocklist') {
                continue;
            }
            const redirectUrl = typeof policy.redirect_url === 'string' && policy.redirect_url.trim() ? policy.redirect_url.trim() : undefined;
            const fullDay = startMs === endMs;
            if (!fullDay && endMs <= startMs) {
                continue;
            }
            windows.push({
                type: 'remote',
                startMs,
                endMs,
                fullDay,
                redirectUrl,
                severity: policy.severity || undefined,
                reason: entry.reason || undefined
            });
        }
        windows.sort((a, b) => {
            if (a.startMs === b.startMs) {
                return a.endMs - b.endMs;
            }
            return a.startMs - b.startMs;
        });
        return windows;
    }

    function formatDateForApi(date) {
        const year = date.getFullYear();
        const month = padTwoDigits(date.getMonth() + 1);
        const day = padTwoDigits(date.getDate());
        return `${year}-${month}-${day}`;
    }

    function getTimeZone() {
        try {
            const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
            return tz || 'UTC';
        } catch (_) {
            return 'UTC';
        }
    }

    function buildAuthorizationHeader(token) {
        if (typeof token !== 'string') {
            return '';
        }
        const trimmed = token.trim();
        if (!trimmed) {
            return '';
        }
        if (/^bearer\s+/i.test(trimmed)) {
            return trimmed;
        }
        return `Bearer ${trimmed}`;
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

    GM.registerMenuCommand('ブロック時間帯を編集...', async () => {
        const currentValue = Array.isArray(blockingWindowStrings) ? blockingWindowStrings.join('\n') : '';
        const input = prompt(
            `ブロックを有効にする時間帯をHH:MM-HH:MM形式で1行ずつ入力してください。\n例: 09:00-12:00\n\n現在のスケジュール:\n${windowSummaryText || '登録なし'}`,
            currentValue
        );

        if (input !== null) {
            const rawEntries = input
                .split('\n')
                .map(item => item.trim())
                .filter(Boolean);
            const parsedEntries = parseBlockingWindows(rawEntries);
            if (rawEntries.length && !parsedEntries.length) {
                alert("有効な時間帯が見つかりませんでした。入力形式を確認してください。");
                return;
            }
            blockingWindowStrings = parsedEntries.map(item => item.raw);
            manualWindows = parsedEntries;
            await GM.setValue(STORAGE_KEYS.BLOCKING_WINDOWS, blockingWindowStrings);
            alert("ブロック時間帯を更新しました。変更を反映するにはページをリロードしてください。");
        }
    });

    GM.registerMenuCommand('TaskWorks APIベースURLを設定...', async () => {
        const input = prompt(
            "TaskWorks APIのベースURLを入力してください。\n例: https://taskworks.example/api",
            apiBase || ''
        );
        if (input !== null) {
            apiBase = input.trim();
            await GM.setValue(STORAGE_KEYS.API_BASE, apiBase);
            await GM.setValue(STORAGE_KEYS.WINDOW_CACHE, null);
            alert('APIベースURLを更新しました。次回アクセス時にウィンドウを再取得します。');
        }
    });

    GM.registerMenuCommand('TaskWorks APIトークンを設定...', async () => {
        const input = prompt(
            "TaskWorks APIのBearerトークンを入力してください。",
            apiToken || ''
        );
        if (input !== null) {
            apiToken = input.trim();
            await GM.setValue(STORAGE_KEYS.API_TOKEN, apiToken);
            await GM.setValue(STORAGE_KEYS.WINDOW_CACHE, null);
            alert('APIトークンを更新しました。');
        }
    });

    GM.registerMenuCommand('TaskWorks キャッシュTTL(分)を設定...', async () => {
        const currentMinutes = Math.round(cacheTtlMs / 60000);
        const input = prompt(
            "TaskWorksスケジュールのキャッシュTTL(分)を入力してください。",
            String(currentMinutes)
        );
        if (input !== null) {
            const numeric = Number(input.trim());
            if (!Number.isFinite(numeric) || numeric <= 0) {
                alert('正の数値を入力してください。');
                return;
            }
            cacheTtlMs = numeric * 60 * 1000;
            await GM.setValue(STORAGE_KEYS.CACHE_TTL_MS, cacheTtlMs);
            alert('キャッシュTTLを更新しました。');
        }
    });

    GM.registerMenuCommand('TaskWorks スケジュールキャッシュをクリア', async () => {
        await GM.setValue(STORAGE_KEYS.WINDOW_CACHE, null);
        alert('TaskWorks スケジュールキャッシュをクリアしました。');
    });

    GM.registerMenuCommand('TaskWorks フォーカスタグのみ制限を切替', async () => {
        const current = await GM.getValue(STORAGE_KEYS.FOCUS_ONLY, DEFAULTS.FOCUS_ONLY);
        const next = !current;
        await GM.setValue(STORAGE_KEYS.FOCUS_ONLY, next);
        await GM.setValue(STORAGE_KEYS.WINDOW_CACHE, null);
        alert(`フォーカスタグのみ制限を${next ? '有効' : '無効'}にしました。ページをリロードしてください。`);
    });

})();
