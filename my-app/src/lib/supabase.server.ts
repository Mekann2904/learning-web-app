import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import type { AstroCookies } from 'astro'
import type { Database } from './database.types'

const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Supabase URL or anon key missing in environment variables')
}

function ensureBearerToken(value?: string | null): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.startsWith('Bearer ') ? trimmed : `Bearer ${trimmed}`
}

function readCookieFromHeader(header: string | null, name: string): string | undefined {
  if (!header) return undefined
  const exactName = name.trim()
  const prefix = `${exactName}.`
  const segments = new Map<number, string>()
  const pairs = header.split(/;\s*/)

  for (const pair of pairs) {
    if (!pair) continue
    const [cookieNameRaw, ...rest] = pair.split('=')
    if (!cookieNameRaw) continue
    const cookieName = cookieNameRaw.trim()
    if (!cookieName) continue
    const value = rest.join('=')

    if (cookieName === exactName) {
      return value
    }

    if (cookieName.startsWith(prefix)) {
      const indexStr = cookieName.slice(prefix.length)
      const index = Number.parseInt(indexStr, 10)
      if (Number.isFinite(index)) {
        segments.set(index, value)
      }
    }
  }

  if (segments.size > 0) {
    return Array.from(segments.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([, segmentValue]) => segmentValue)
      .join('')
  }

  return undefined
}

export function createSupabaseServerClient(request: Request, cookies: AstroCookies, authHeader?: string | null) {
  const bearer = ensureBearerToken(authHeader)

  if (bearer) {
    return createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        headers: {
          Authorization: bearer,
        },
      },
    })
  }

  return createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      get(name) {
        return cookies.get(name)?.value ?? readCookieFromHeader(request.headers.get('cookie'), name)
      },
      set(_name, _value, _options) {
        // no-op: API route currently does not need to set cookies
      },
      remove(_name, _options) {
        // no-op
      },
    },
  })
}
