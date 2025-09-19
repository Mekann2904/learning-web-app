import { useMemo, useState } from "react";

export type UrlBlockApiTesterProps = {
  defaultBaseUrl?: string;
  defaultFocusOnly?: boolean;
};

type BlockingWindowPayload = {
  start_at: string;
  end_at: string;
  reason?: string | null;
  policy?: {
    mode?: string;
    redirect_url?: string | null;
    severity?: string | null;
  } | null;
};

type LogEntry = {
  id: number;
  level: "info" | "error";
  message: string;
  timestamp: Date;
};

const DATE_FORMATTER = new Intl.DateTimeFormat("sv-SE", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function formatIso(iso?: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return `${date.toLocaleString()} (${iso})`;
}

function ensureBearer(token: string) {
  const trimmed = token.trim();
  if (!trimmed) return "";
  if (/^bearer\s+/i.test(trimmed)) return trimmed;
  return `Bearer ${trimmed}`;
}

function buildWindowsEndpoint(baseUrl: string) {
  const normalized = baseUrl.replace(/\s+/g, "").replace(/\/+$/, "");
  if (!normalized) return "";
  if (/\/v1\/blocks\/windows$/i.test(normalized)) return normalized;
  if (/\/api\/v1$/i.test(normalized)) return `${normalized}/blocks/windows`;
  if (/\/api$/i.test(normalized)) return `${normalized}/v1/blocks/windows`;
  return `${normalized}/api/v1/blocks/windows`;
}

function formatDateInput(date: Date) {
  return DATE_FORMATTER.format(date);
}

let logId = 0;

export default function UrlBlockApiTester({
  defaultBaseUrl,
  defaultFocusOnly = false,
}: UrlBlockApiTesterProps) {
  const initialDate = useMemo(() => formatDateInput(new Date()), []);
  const initialTz = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";
    } catch (_error) {
      return "UTC";
    }
  }, []);

  const [baseUrl, setBaseUrl] = useState<string>(() => defaultBaseUrl?.trim() || "");
  const [token, setToken] = useState<string>("");
  const [dateIso, setDateIso] = useState<string>(initialDate);
  const [timeZone, setTimeZone] = useState<string>(initialTz);
  const [focusOnly, setFocusOnly] = useState<boolean>(defaultFocusOnly);
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<BlockingWindowPayload[] | null>(null);
  const [rawBody, setRawBody] = useState<string>("");
  const [requestUrl, setRequestUrl] = useState<string>("");
  const [endpoint, setEndpoint] = useState<string>("");
  const [statusText, setStatusText] = useState<string>("");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [debugMode, setDebugMode] = useState<boolean>(false);
  const [mergeOverlaps, setMergeOverlaps] = useState<boolean>(false);

  function appendLog(level: LogEntry["level"], message: string) {
    setLogs((prev) => [
      { id: ++logId, level, message, timestamp: new Date() },
      ...prev,
    ]);
  }

  async function handleTest() {
    const trimmedBase = baseUrl.trim();
    if (!trimmedBase) {
      appendLog("error", "API ベース URL を入力してください。");
      setStatusText("未入力");
      return;
    }

    const endpointUrl = buildWindowsEndpoint(trimmedBase);
    if (!endpointUrl) {
      appendLog("error", "API エンドポイントを組み立てられませんでした。入力を確認してください。");
      setStatusText("URL エラー");
      return;
    }

    const params = new URLSearchParams();
    params.set("date", dateIso);
    params.set("tz", timeZone);
    params.set("focus_only", String(focusOnly));
    if (debugMode) {
      params.set("debug", "true");
    }
    params.set("merge", String(mergeOverlaps));
    const finalUrl = `${endpointUrl}?${params.toString()}`;

    setEndpoint(endpointUrl);
    setRequestUrl(finalUrl);
    setLoading(true);
    setRawBody("");
    setStatusText("リクエスト送信中...");
    appendLog("info", `GET ${finalUrl}`);

    try {
      const headers: Record<string, string> = { Accept: "application/json" };
      const bearer = ensureBearer(token);
      if (bearer) {
        headers.Authorization = bearer;
      }

      const response = await fetch(finalUrl, {
        method: "GET",
        headers,
        credentials: "include",
      });

      const bodyText = await response.text();
      setRawBody(bodyText);

      if (!response.ok) {
        appendLog("error", `HTTP ${response.status} ${response.statusText}: ${bodyText}`);
        setResult(null);
        setStatusText(`HTTP ${response.status}`);
        return;
      }

      let payload: unknown;
      try {
        payload = bodyText ? JSON.parse(bodyText) : [];
      } catch (error) {
        appendLog("error", `JSON 解析エラー: ${(error as Error).message}`);
        setResult(null);
        setStatusText("JSON 解析エラー");
        return;
      }

      if (Array.isArray(payload)) {
        setResult(payload as BlockingWindowPayload[]);
        appendLog("info", `ウィンドウを ${payload.length} 件取得しました。`);
        setStatusText(`${payload.length} 件`);
      } else if (payload && typeof payload === "object" && Array.isArray((payload as any).windows)) {
        const windows = (payload as any).windows as BlockingWindowPayload[];
        setResult(windows);
        appendLog("info", `ウィンドウを ${windows.length} 件取得しました (meta 付き)。`);
        setStatusText(`${windows.length} 件`);
      } else {
        appendLog("error", "期待した配列形式ではありませんでした。レスポンス形式を確認してください。");
        setResult(null);
        setStatusText("形式エラー");
      }
    } catch (error) {
      appendLog("error", `フェッチ失敗: ${(error as Error).message}`);
      setStatusText("通信エラー");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  const curlSnippet = useMemo(() => {
    if (!requestUrl) return "";
    const header = ensureBearer(token);
    const pieces = ["curl", "-H", "Accept: application/json"];
    if (header) {
      pieces.push("-H", `Authorization: ${header}`);
    }
    pieces.push(`\"${requestUrl}\"`);
    return pieces.join(" ");
  }, [requestUrl, token]);

  return (
    <div className="space-y-6 rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-foreground">TaskWorks API テスター</h2>
        <p className="text-sm text-muted-foreground">
          Userscript と同じパラメータで <code>/api/v1/blocks/windows</code> にアクセスし、取得結果やログを確認できます。
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-foreground">API ベース URL</span>
          <input
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
            placeholder="https://your-app.example"
            value={baseUrl}
            onChange={(event) => setBaseUrl(event.target.value)}
          />
          <span className="text-xs text-muted-foreground">末尾に <code>/api</code> や <code>/api/v1</code> を含めても自動調整されます。</span>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-foreground">Bearer トークン (任意)</span>
          <input
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
            placeholder="TaskWorks API Token"
            value={token}
            onChange={(event) => setToken(event.target.value)}
          />
          <span className="text-xs text-muted-foreground">Cookie 認証を利用する場合は空欄のままで構いません。</span>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-foreground">対象日 (YYYY-MM-DD)</span>
          <input
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
            value={dateIso}
            onChange={(event) => setDateIso(event.target.value)}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-foreground">タイムゾーン</span>
          <input
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
            value={timeZone}
            onChange={(event) => setTimeZone(event.target.value)}
          />
        </label>

      </div>

      <div className="flex flex-wrap items-center gap-4 text-sm text-foreground">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={focusOnly}
            onChange={(event) => setFocusOnly(event.target.checked)}
          />
          focus_only=true
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={mergeOverlaps}
            onChange={(event) => setMergeOverlaps(event.target.checked)}
          />
          merge=true
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={debugMode}
            onChange={(event) => setDebugMode(event.target.checked)}
          />
          debug=true
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <button
          type="button"
          onClick={handleTest}
          disabled={loading}
          className="inline-flex items-center rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? "送信中..." : "API をテスト"}
        </button>
        <span className="text-muted-foreground">結果: {statusText || "未実行"}</span>
      </div>

      {endpoint ? (
        <div className="space-y-2 rounded-xl border border-dashed border-border p-4 text-sm">
          <div className="text-muted-foreground">
            <strong className="text-foreground">解決されたエンドポイント:</strong> {endpoint}
          </div>
          <div className="text-muted-foreground">
            <strong className="text-foreground">リクエスト URL:</strong> {requestUrl}
          </div>
          {curlSnippet ? (
            <div>
              <strong className="text-foreground">cURL:</strong>
              <pre className="mt-1 overflow-x-auto rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
{curlSnippet}
              </pre>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-foreground">取得結果</h3>
        {result && result.length ? (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">開始</th>
                  <th className="px-4 py-2 font-medium">終了</th>
                  <th className="px-4 py-2 font-medium">リダイレクト先</th>
                  <th className="px-4 py-2 font-medium">理由</th>
                  <th className="px-4 py-2 font-medium">モード/厳格度</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {result.map((window, index) => (
                  <tr key={`${window.start_at}-${index}`}>
                    <td className="px-4 py-3 text-muted-foreground">{formatIso(window.start_at)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatIso(window.end_at)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{window.policy?.redirect_url || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{window.reason || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {window.policy?.mode || "blocklist"}
                      {window.policy?.severity ? ` (${window.policy.severity})` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">まだ結果はありません。API を呼び出すとここに表示されます。</p>
        )}
        {rawBody ? (
          <div>
            <strong className="text-sm text-foreground">生レスポンス</strong>
            <pre className="mt-2 max-h-64 overflow-auto rounded-xl border border-dashed border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
{rawBody}
            </pre>
          </div>
        ) : null}
      </div>

      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-foreground">ログ</h3>
        {logs.length ? (
          <ul className="space-y-2 text-sm">
            {logs.map((entry) => (
              <li
                key={entry.id}
                className={`rounded-md border px-3 py-2 ${
                  entry.level === "error"
                    ? "border-destructive/50 bg-destructive/10 text-destructive"
                    : "border-border bg-muted/40 text-muted-foreground"
                }`}
              >
                <span className="mr-2 text-xs text-muted-foreground">
                  {entry.timestamp.toLocaleTimeString()}
                </span>
                <span>{entry.message}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">ログはまだありません。</p>
        )}
      </div>
    </div>
  );
}
