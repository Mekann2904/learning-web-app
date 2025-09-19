// ==UserScript==
// @name         URL Blacklist Redirect (Cats Hand Diagonal Slide)
// @namespace    Violentmonkey Scripts
// @version      4.2.0
// @description  Redirects with a cat's hand animation sliding in from the bottom-right. Settings are saved and editable via menu.
// @author       -
// @match        *://*/*
// @run-at       document-start
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.registerMenuCommand
// @grant        GM_registerMenuCommand
// @grant        GM.xmlHttpRequest
// @connect      *
// @noframes
// ==/UserScript==

(async function() {
    'use strict';

    // フレーム内では動かさない
    if (window.top !== window.self) return;

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
        BLOCKING_WINDOWS: [],
        API_BASE: "https://my-app.yinyoo2904.workers.dev",
        API_TOKEN: "",
        CACHE_TTL_MS: 5 * 60 * 1000,
        FOCUS_ONLY: false
    };

    // ----- 猫の手画像とアニメーション設定 -----
    const CAT_HAND_IMAGE_URL = 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjwVlRGK0fm-gMro8ZEQsgkMlKNYC9X-XDYoPdFgxkdDF7ndZpTELr-s1Vc2RSu4gfnmZMfaB4s03lq9BaPZvKV6glPoEL19idLS3M_7B0WELCAKy5r4mH0Pw0w4McgYdt4ByAAJtOKknZO/s484/cat_hand_mike.png';
    const ANIMATION_SLIDE_IN_MS = 800;  // 猫の手がスライドしてくる時間 (0.8秒)
    const REDIRECT_DELAY_MS = 1800;     // 猫の手表示からリダイレクトまでの総時間 (1.8秒)

    // ----- 汎用関数群 -----
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
        const container = document.createElement('div');
        Object.assign(container.style, {
            position: 'fixed',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            zIndex: '2147483647',
            opacity: '0',
            transition: 'opacity 0.3s ease-in-out'
        });

        const catHand = document.createElement('img');
        catHand.src = CAT_HAND_IMAGE_URL;
        Object.assign(catHand.style, {
            position: 'fixed',
            right: '0px',
            bottom: '0px',
            width: '480px',
            maxWidth: '80vw',
            transform: 'translate(80%, 80%) rotate(-45deg)',
            transition: `transform ${ANIMATION_SLIDE_IN_MS}ms cubic-bezier(0.25, 1, 0.5, 1)`
        });

        document.body.appendChild(container);
        container.appendChild(catHand);

        setTimeout(() => {
            container.style.opacity = '1';
            catHand.style.transform = 'translate(15%, 15%) rotate(-45deg)';
        }, 50);

        setTimeout(() => {
            window.location.href = targetUrl;
        }, REDIRECT_DELAY_MS);
    }

    // ----- TaskWorks API -----
    function buildWindowsEndpoint(base) {
        const normalized = base.replace(/\/+$/, '');
        if (/\/v1\/blocks\/windows$/i.test(normalized)) {
            return normalized;
        }
        if (/\/api$/i.test(normalized)) {
            return `${normalized}/v1/blocks/windows`;
        }
        if (/\/api\/v1$/i.test(normalized)) {
            return `${normalized}/blocks/windows`;
        }
        return `${normalized}/api/v1/blocks/windows`;
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

    function fetchWindowsFromApi(config) {
        const base = (config.apiBase || '').replace(/\/+$/, '');
        if (!base) {
            return Promise.resolve([]);
        }
        const endpoint = buildWindowsEndpoint(base);
        const today = new Date();
        const dateParam = formatDateForApi(today);
        const tzParam = getTimeZone();
        const focusOnlyParam = config.focusOnly ? '&focus_only=true' : '&focus_only=false';
        const url = `${endpoint}?date=${encodeURIComponent(dateParam)}&tz=${encodeURIComponent(tzParam)}${focusOnlyParam}&merge=false`;
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

    const MIN_REFRESH_INTERVAL_MS = 60 * 1000;
    let refreshTimerId = null;
    let refreshConfig = null;
    let refreshInFlight = false;
    let lastRefreshAt = 0;
    let listenersAttached = false;

    function scheduleWindowRefresh(config) {
        if (!config.apiBase) {
            return;
        }
        refreshConfig = {
            apiBase: config.apiBase,
            apiToken: config.apiToken,
            focusOnly: config.focusOnly,
        };
        const interval = Math.max(Number(config.cacheTtlMs) || 0, MIN_REFRESH_INTERVAL_MS);
        if (refreshTimerId) {
            clearInterval(refreshTimerId);
        }
        refreshTimerId = setInterval(() => {
            triggerBackgroundRefresh('interval');
        }, interval);

        if (!listenersAttached) {
            listenersAttached = true;
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible') {
                    triggerBackgroundRefresh('visibility');
                }
            });
            window.addEventListener('focus', () => {
                triggerBackgroundRefresh('focus');
            });
            window.addEventListener('taskworks:task-executed', () => {
                triggerBackgroundRefresh('task-update');
            });
        }

        triggerBackgroundRefresh('initial');
    }

    async function triggerBackgroundRefresh(reason) {
        if (!refreshConfig || refreshInFlight) {
            return;
        }
        const now = Date.now();
        if (reason !== 'initial' && now - lastRefreshAt < MIN_REFRESH_INTERVAL_MS) {
            return;
        }
        refreshInFlight = true;
        try {
            const windows = await fetchWindowsFromApi(refreshConfig);
            await GM.setValue(STORAGE_KEYS.WINDOW_CACHE, { windows, fetchedAt: Date.now() });
            lastRefreshAt = Date.now();
            console.debug(`[URL Blacklist Redirect] 背景更新 (${reason}): ${windows.length} window(s)`);
        } catch (error) {
            console.warn('[URL Blacklist Redirect] 背景更新に失敗しました:', error);
        } finally {
            refreshInFlight = false;
        }
    }

    // ----- メニュー登録ラッパ -----
    const registerMenu = (typeof GM !== 'undefined' && typeof GM.registerMenuCommand === 'function')
        ? GM.registerMenuCommand.bind(GM)
        : (typeof GM_registerMenuCommand === 'function' ? GM_registerMenuCommand : null);

    // ----- 設定読み込み -----
    const blacklist = await GM.getValue(STORAGE_KEYS.BLACKLIST, DEFAULTS.BLACKLIST);
    const redirectUrlDefault = await GM.getValue(STORAGE_KEYS.REDIRECT_URL, DEFAULTS.REDIRECT_URL);
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

    scheduleWindowRefresh({ apiBase, apiToken, cacheTtlMs, focusOnly: !!focusOnly });

    // ----- メニュー登録 -----
    if (!registerMenu) {
        console.warn('registerMenuCommand 未対応環境');
    } else {
        // 一回だけ無効化
        registerMenu('このタブは1回だけ無効化', () => {
            sessionStorage.setItem('tw_skip_once', '1');
            alert('このタブでは次回読み込み時にブロックをスキップします。ページを再読み込みしてください。');
        });

        registerMenu('現在のドメインをブロック', async () => {
            const domain = window.location.hostname;
            if (blacklist.includes(domain)) {
                alert(`ドメイン "${domain}" は既にブラックリストに登録されています。`);
                return;
            }
            const updatedBlacklist = [...blacklist, domain];
            await GM.setValue(STORAGE_KEYS.BLACKLIST, updatedBlacklist);
            alert(`ドメイン "${domain}" をブラックリストに追加しました。\nページをリロードするとリダイレクトが有効になります。`);
        });

        registerMenu('ブラックリストを編集...', async () => {
            const current = await GM.getValue(STORAGE_KEYS.BLACKLIST, blacklist);
            const input = prompt(
                "ブロックしたいURLの文字列を改行で区切って入力してください。",
                (current || []).join('\n')
            );
            if (input !== null) {
                const newBlacklist = input.split('\n').map(item => item.trim()).filter(Boolean);
                await GM.setValue(STORAGE_KEYS.BLACKLIST, newBlacklist);
                alert("ブラックリストを更新しました。");
            }
        });

        registerMenu('リダイレクト先を設定...', async () => {
            const current = await GM.getValue(STORAGE_KEYS.REDIRECT_URL, redirectUrlDefault);
            const newRedirectUrl = prompt("リダイレクト先のURLを入力してください。", current);
            if (newRedirectUrl) {
                await GM.setValue(STORAGE_KEYS.REDIRECT_URL, newRedirectUrl);
                alert(`リダイレクト先を "${newRedirectUrl}" に設定しました。`);
            }
        });

        registerMenu('ブロック時間帯を編集...', async () => {
            const currentArr = await GM.getValue(STORAGE_KEYS.BLOCKING_WINDOWS, blockingWindowStrings);
            const currentValue = Array.isArray(currentArr) ? currentArr.join('\n') : '';
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
                const newStrings = parsedEntries.map(item => item.raw);
                await GM.setValue(STORAGE_KEYS.BLOCKING_WINDOWS, newStrings);
                alert("ブロック時間帯を更新しました。変更を反映するにはページをリロードしてください。");
            }
        });

        registerMenu('TaskWorks APIベースURLを設定...', async () => {
            const current = await GM.getValue(STORAGE_KEYS.API_BASE, apiBase || '');
            const input = prompt(
                "TaskWorks APIのベースURLを入力してください。\n例: https://taskworks.example/api",
                current || ''
            );
            if (input !== null) {
                const next = input.trim();
                await GM.setValue(STORAGE_KEYS.API_BASE, next);
                await GM.setValue(STORAGE_KEYS.WINDOW_CACHE, null);
                alert('APIベースURLを更新しました。次回アクセス時にウィンドウを再取得します。');
            }
        });

        registerMenu('TaskWorks APIトークンを設定...', async () => {
            const current = await GM.getValue(STORAGE_KEYS.API_TOKEN, apiToken || '');
            const input = prompt(
                "TaskWorks APIのBearerトークンを入力してください。",
                current || ''
            );
            if (input !== null) {
                const next = input.trim();
                await GM.setValue(STORAGE_KEYS.API_TOKEN, next);
                await GM.setValue(STORAGE_KEYS.WINDOW_CACHE, null);
                alert('APIトークンを更新しました。');
            }
        });

        registerMenu('TaskWorks キャッシュTTL(分)を設定...', async () => {
            const currentMs = await GM.getValue(STORAGE_KEYS.CACHE_TTL_MS, cacheTtlMs);
            const currentMinutes = Math.round((Number(currentMs) || DEFAULTS.CACHE_TTL_MS) / 60000);
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
                const nextMs = numeric * 60 * 1000;
                await GM.setValue(STORAGE_KEYS.CACHE_TTL_MS, nextMs);
                alert('キャッシュTTLを更新しました。');
            }
        });

        registerMenu('TaskWorks スケジュールキャッシュをクリア', async () => {
            await GM.setValue(STORAGE_KEYS.WINDOW_CACHE, null);
            alert('TaskWorks スケジュールキャッシュをクリアしました。');
        });

        registerMenu('TaskWorks フォーカスタグのみ制限を切替', async () => {
            const current = await GM.getValue(STORAGE_KEYS.FOCUS_ONLY, DEFAULTS.FOCUS_ONLY);
            const next = !current;
            await GM.setValue(STORAGE_KEYS.FOCUS_ONLY, next);
            await GM.setValue(STORAGE_KEYS.WINDOW_CACHE, null);
            alert(`フォーカスタグのみ制限を${next ? '有効' : '無効'}にしました。ページをリロードしてください。`);
        });
    }

    // ----- メインの処理 -----
    const currentUrl = window.location.href;

    // このタブだけ一時無効をチェック
    const skipOnce = sessionStorage.getItem('tw_skip_once') === '1';
    if (skipOnce) {
        sessionStorage.removeItem('tw_skip_once');
    }

    const redirectUrl = await GM.getValue(STORAGE_KEYS.REDIRECT_URL, redirectUrlDefault);
    const windowRedirectUrl = (activeWindow && typeof activeWindow.redirectUrl === 'string' && activeWindow.redirectUrl)
        ? activeWindow.redirectUrl
        : redirectUrl;

    if (!skipOnce && activeWindow && !currentUrl.includes(windowRedirectUrl)) {
        for (const blockedUrl of blacklist) {
            if (!blockedUrl) continue;
            if (currentUrl.includes(blockedUrl)) {
                // ここで return しない。メニュー登録まで到達させる
                showCatHandAnimationAndRedirect(windowRedirectUrl);
                break;
            }
        }
    }
})();
