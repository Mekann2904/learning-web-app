// src/lib/env.ts
// Centralized accessors for public environment variables used across the app.
// Keeping the parsing logic in one place prevents subtle mismatches between
// server and browser builds and makes it easier to reason about callback URLs.

const DEFAULT_AUTH_CALLBACK_PATH = "/auth/callback" as const;

type SiteInfo = {
  origin: string;
  href: string;
};

type ResolveSiteOptions = {
  fallback?: string;
};

function normalizeSiteUrl(value: string): SiteInfo {
  const url = new URL(value);
  const pathname = url.pathname.endsWith("/") ? url.pathname : `${url.pathname}/`;
  return {
    origin: url.origin,
    href: `${url.origin}${pathname}`,
  };
}

/**
 * Resolve the site URL that Supabase should redirect back to.
 * Priority: configured value -> provided fallback -> browser location.
 */
export function resolveSiteUrl(options: ResolveSiteOptions = {}): SiteInfo {
  const configured = import.meta.env.PUBLIC_SITE_URL?.trim();

  if (configured) {
    try {
      return normalizeSiteUrl(configured);
    } catch (error) {
      console.warn("Invalid PUBLIC_SITE_URL value. Falling back to alternative.", error);
    }
  }

  if (options.fallback) {
    try {
      return normalizeSiteUrl(options.fallback.trim());
    } catch (error) {
      console.warn("Fallback site URL value was invalid.", error);
    }
  }

  if (typeof window !== "undefined") {
    return normalizeSiteUrl(window.location.origin);
  }

  throw new Error(
    "Unable to resolve site URL. Set PUBLIC_SITE_URL or provide a fallback origin.",
  );
}

type ResolveCallbackOptions = {
  fallbackPath?: string;
};

/**
 * Resolve the fully qualified callback URL used for OAuth redirects.
 */
export function resolveAuthCallbackUrl(
  site: SiteInfo,
  options: ResolveCallbackOptions = {},
): string {
  const configured = import.meta.env.PUBLIC_AUTH_CALLBACK_URL?.trim();
  const fallbackPath = options.fallbackPath ?? DEFAULT_AUTH_CALLBACK_PATH;

  if (configured) {
    try {
      const resolved = new URL(configured, site.href);
      if (resolved.origin === site.origin) {
        return resolved.toString();
      }
      console.warn(
        `Configured auth callback origin (${resolved.origin}) did not match site origin (${site.origin}). Falling back to same-origin callback.`,
      );
    } catch (error) {
      console.warn(
        "Invalid PUBLIC_AUTH_CALLBACK_URL value. Falling back to default callback path.",
        error,
      );
    }
  }

  return new URL(fallbackPath, site.href).toString();
}

/**
 * Return the normalized callback pathname (without trailing slash).
 */
export function resolveAuthCallbackPath(site?: SiteInfo): string {
  const contextSite = site ?? resolveSiteUrl();
  const url = new URL(
    resolveAuthCallbackUrl(contextSite, { fallbackPath: DEFAULT_AUTH_CALLBACK_PATH }),
  );
  const pathname = url.pathname.replace(/\/$/, "");
  return pathname.length > 0 ? pathname : DEFAULT_AUTH_CALLBACK_PATH;
}

type SupabaseConfig = {
  url: string;
  anonKey: string;
  storageKey: string;
};

function deriveStorageKey(url: URL): string {
  const host = url.hostname.toLowerCase();
  const sanitized = host.replace(/[^a-z0-9.-]/g, "-");
  return `sb-${sanitized}-auth-token`;
}

/**
 * Resolve the Supabase public credentials and a deterministic storage key.
 */
export function getSupabaseBrowserConfig(): SupabaseConfig {
  const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL?.trim();
  const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!supabaseUrl) {
    throw new Error("PUBLIC_SUPABASE_URL must be set.");
  }
  if (!supabaseAnonKey) {
    throw new Error("PUBLIC_SUPABASE_ANON_KEY must be set.");
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(supabaseUrl);
  } catch (error) {
    throw new Error(`PUBLIC_SUPABASE_URL is not a valid URL: ${supabaseUrl}`);
  }

  return {
    url: parsedUrl.toString(),
    anonKey: supabaseAnonKey,
    storageKey: deriveStorageKey(parsedUrl),
  };
}

export const __TESTING__ = {
  DEFAULT_AUTH_CALLBACK_PATH,
};
