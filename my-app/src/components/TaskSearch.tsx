import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import type { User } from "@supabase/supabase-js";
import { Loader2, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { signInWithGoogle } from "@/lib/auth";
import type { Task } from "@/lib/storage.supabase";
import * as store from "@/lib/storage.supabase";
import { supabaseBrowser } from "@/lib/supabase";

const SEARCH_LIMIT = 8;
const DEBOUNCE_MS = 200;

export default function TaskSearch() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const latestQueryRef = useRef<string>("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Task[]>([]);

  const trimmedQuery = useMemo(() => query.trim(), [query]);

  useEffect(() => {
    let ignore = false;
    const supabase = supabaseBrowser();

    const fetchSession = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (ignore) return;
        setUser(data.session?.user ?? null);
        setAuthReady(true);
        setAuthError(null);
      } catch (err) {
        console.error("Failed to load auth session", err);
        if (ignore) return;
        setAuthError("認証状態の取得に失敗しました");
        setAuthReady(true);
      }
    };

    void fetchSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (ignore) return;
      setUser(session?.user ?? null);
      setAuthError(null);
      setAuthReady(true);
    });

    return () => {
      ignore = true;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!authReady || !user) {
      latestQueryRef.current = "";
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }

    const activeQuery = trimmedQuery;
    latestQueryRef.current = activeQuery;

    if (!activeQuery) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const handle = window.setTimeout(() => {
      void store
        .search(activeQuery, SEARCH_LIMIT)
        .then((data) => {
          if (latestQueryRef.current !== activeQuery) return;
          setResults(data);
          setError(null);
        })
        .catch((err) => {
          if (latestQueryRef.current !== activeQuery) return;
          console.error("Failed to search tasks", err);
          setResults([]);
          setError("検索結果の取得に失敗しました");
        })
        .finally(() => {
          if (latestQueryRef.current !== activeQuery) return;
          setLoading(false);
        });
    }, DEBOUNCE_MS);

    return () => {
      window.clearTimeout(handle);
    };
  }, [authReady, trimmedQuery, user]);

  useEffect(() => {
    if (!open) return;

    const focusTimer = window.setTimeout(() => {
      inputRef.current?.focus();
      if (selected) {
        inputRef.current?.select();
      }
    }, 0);

    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, selected]);

  useEffect(() => {
    if (!user) {
      setResults([]);
    }
  }, [user]);

  const handleCommandKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
      }
    },
    []
  );

  const handleSelect = useCallback((task: Task) => {
    setSelected(task.id);
    setQuery(task.title);
    setOpen(false);
  }, []);

  const renderResults = () => {
    if (!authReady) {
      return (
        <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          認証状態を確認しています…
        </div>
      );
    }

    if (authError) {
      return (
        <CommandEmpty className="text-destructive">{authError}</CommandEmpty>
      );
    }

    if (!user) {
      return (
        <div className="space-y-3 px-4 py-3 text-sm">
          <p className="text-muted-foreground">タスク検索を利用するにはログインしてください。</p>
          <Button
            variant="outline"
            className="w-full justify-center"
            onClick={() => {
              setOpen(false);
              void signInWithGoogle().catch((err) => {
                console.error("Failed to start sign in", err);
              });
            }}
          >
            Googleでログイン
          </Button>
        </div>
      );
    }

    if (!trimmedQuery) {
      return <CommandEmpty>検索キーワードを入力してください。</CommandEmpty>;
    }

    if (loading) {
      return (
        <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          検索中です…
        </div>
      );
    }

    if (error) {
      return <CommandEmpty className="text-destructive">{error}</CommandEmpty>;
    }

    if (results.length === 0) {
      return <CommandEmpty>「{trimmedQuery}」に一致するタスクはありませんでした。</CommandEmpty>;
    }

    return results.map((task) => (
      <CommandItem
        key={task.id}
        value={task.id}
        onSelect={() => handleSelect(task)}
        className="flex flex-col items-start"
      >
        <a className="block w-full" href={`/tasks/${task.id}`}>
          <span className="text-sm font-medium text-foreground">{task.title}</span>
          {task.detail ? (
            <span className="text-xs text-muted-foreground">
              {task.detail.length > 100 ? `${task.detail.slice(0, 100)}…` : task.detail}
            </span>
          ) : null}
        </a>
      </CommandItem>
    ));
  };

  return (
    <div className="hidden md:block">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        className="flex h-9 w-full max-w-xs items-center gap-2 rounded-md border border-input bg-transparent px-3 text-sm text-muted-foreground shadow-xs transition-colors hover:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => {
          setOpen(true);
          setError(null);
        }}
      >
        <Search className="size-4 text-muted-foreground" />
        <span className={query ? "truncate text-foreground" : "truncate text-muted-foreground"}>
          {query || "タスクを検索"}
        </span>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-background/80 px-4 py-24 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-xl"
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            <Command
              shouldFilter={false}
              value={selected ?? undefined}
              className="w-full overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-xl"
              onKeyDown={handleCommandKeyDown}
            >
              <CommandInput
                ref={inputRef}
                value={query}
                placeholder="タスクを検索"
                onValueChange={(value) => {
                  setQuery(value);
                  if (selected) {
                    setSelected(null);
                  }
                }}
                autoComplete="off"
              />
              <CommandList>{renderResults()}</CommandList>
            </Command>
          </div>
        </div>
      ) : null}
    </div>
  );
}
