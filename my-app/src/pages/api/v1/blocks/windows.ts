import type { APIRoute } from 'astro'
import { createSupabaseServerClient } from '~/lib/supabase.server'
import { buildBlockingWindowsFromRows, getDayBounds } from '~/lib/block-windows'

const DEFAULT_PRE_GRACE_MIN = 0
const DEFAULT_POST_GRACE_MIN = 0
const DEFAULT_DURATION_MIN = 60

const DEFAULT_REDIRECT_URL = (() => {
  const siteUrl = import.meta.env.PUBLIC_SITE_URL
  if (typeof siteUrl === 'string' && siteUrl.length > 0) {
    return `${siteUrl.replace(/\/?$/, '')}/`
  }
  return 'https://taskworks.example/'
})()

export const OPTIONS: APIRoute = ({ request }) => {
  return new Response(null, {
    status: 204,
    headers: buildCorsHeaders(request),
  })
}

export const GET: APIRoute = async ({ request, cookies }) => {
  const authHeader = request.headers.get('authorization')
  const supabase = createSupabaseServerClient(request, cookies, authHeader)
  const token = extractBearerToken(authHeader)
  const { data: userResult, error: userError } = token
    ? await supabase.auth.getUser(token)
    : await supabase.auth.getUser()

  if (userError || !userResult?.user) {
    return jsonResponse({ error: 'Unauthorized' }, 401, request)
  }

  const url = new URL(request.url)
  const tzParam = sanitizeTimeZone(url.searchParams.get('tz'))
  const timeZone = tzParam || 'UTC'
  const dateIso = resolveDateIso(url.searchParams.get('date'), timeZone)
  const focusOnly = resolveBoolean(url.searchParams.get('focus_only'), false)
  const mergeOverlaps = resolveBoolean(url.searchParams.get('merge'), false)
  const debugMode = resolveBoolean(url.searchParams.get('debug'), false)
  const preGrace = resolveNumber(url.searchParams.get('pre_grace_min'), DEFAULT_PRE_GRACE_MIN)
  const postGrace = resolveNumber(url.searchParams.get('post_grace_min'), DEFAULT_POST_GRACE_MIN)
  const durationDefault = resolveNumber(url.searchParams.get('duration_default_min'), DEFAULT_DURATION_MIN)

  const { data: taskRows, error: taskError } = await supabase
    .from('task_defs')
    .select(
      `id, title, description, kind, active, start_date, end_date,
        period_rules (*), time_rules (*),
        task_tags ( tag_id, tags ( id, name ) )`
    )
    .eq('active', true)

  if (taskError) {
    console.error('[TaskWorks] Failed to fetch tasks', taskError)
    return jsonResponse({ error: 'Failed to fetch tasks' }, 500, request)
  }

  const taskList = (taskRows ?? []) as any[]
  const taskIds = taskList
    .map((row) => row?.id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0)

  let completedCounts: Record<string, number> = {}

  if (taskIds.length) {
    const bounds = getDayBounds(dateIso, timeZone)
    if (bounds) {
      const { data: execLogs, error: execError } = await supabase
        .from('exec_logs')
        .select('task_id, happened_at, qty')
        .in('task_id', taskIds)
        .gte('happened_at', bounds.start.toISOString())
        .lt('happened_at', bounds.end.toISOString())

      if (execError) {
        console.warn('[TaskWorks] Failed to fetch exec logs', execError)
      } else {
        const counts: Record<string, number> = {}
        type ExecLogRow = { task_id: string | null; qty?: number | string | null }
        for (const log of (execLogs ?? []) as ExecLogRow[]) {
          const taskId = log.task_id
          if (!taskId) continue
          const qtyRaw = (log as { qty?: number | null | string }).qty
          const qtyParsed = qtyRaw === null || qtyRaw === undefined ? 1 : Number(qtyRaw)
          const qty = Number.isFinite(qtyParsed) ? qtyParsed : 1
          counts[taskId] = (counts[taskId] ?? 0) + qty
        }
        completedCounts = counts
      }
    }
  }

  const windows = buildBlockingWindowsFromRows(taskList as any, {
    dateIso,
    timeZone,
    preGraceMinutes: preGrace,
    postGraceMinutes: postGrace,
    durationDefaultMinutes: durationDefault,
    redirectUrlDefault: DEFAULT_REDIRECT_URL,
    focusOnly,
    mergeOverlaps,
    completedCounts,
  })

  if (debugMode) {
    return jsonResponse(
      {
        windows,
        meta: {
          dateIso,
          timeZone,
          focusOnly,
          mergeOverlaps,
          taskCount: taskRows?.length ?? 0,
          completedTaskCount: Object.keys(completedCounts).length,
          completedCounts,
          windowCount: windows.length,
        },
      },
      200,
      request,
    )
  }

  return jsonResponse(windows, 200, request)
}

function jsonResponse(payload: unknown, status: number, request: Request): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...buildCorsHeaders(request),
    },
  })
}

function buildCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('origin')
  if (origin) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET,OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization,Content-Type,Accept',
      'Access-Control-Allow-Credentials': 'true',
      Vary: 'Origin',
    }
  }
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization,Content-Type,Accept',
  }
}

function resolveDateIso(dateParam: string | null, timeZone: string): string {
  if (dateParam && /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(dateParam)) {
    return dateParam
  }
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return formatter.format(new Date())
}

function resolveBoolean(value: string | null, fallback: boolean): boolean {
  if (value === null) return fallback
  const lowered = value.toLowerCase()
  if (['true', '1', 'yes', 'y'].includes(lowered)) return true
  if (['false', '0', 'no', 'n'].includes(lowered)) return false
  return fallback
}

function resolveNumber(value: string | null, fallback: number): number {
  if (value === null) return fallback
  const parsed = Number.parseFloat(value)
  if (!Number.isFinite(parsed) || parsed < 0) return fallback
  return parsed
}

function sanitizeTimeZone(value: string | null): string {
  if (!value) return ''
  const trimmed = value.trim()
  if (!trimmed) return ''
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: trimmed })
    return trimmed
  } catch (_error) {
    return ''
  }
}

function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null
  const match = authHeader.match(/^Bearer\s+(.+)$/i)
  if (match && match[1]) return match[1].trim()
  return authHeader.trim() || null
}
