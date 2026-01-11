import { NextRequest, NextResponse } from 'next/server'
import { withSuperAdmin } from '@/lib/api/with-tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { getScourtSyncSettings } from '@/lib/scourt/sync-settings'

const JOB_STATUSES = ['queued', 'running', 'success', 'failed', 'skipped'] as const
const JOB_TYPES = ['progress', 'general', 'full', 'wmonid_renewal'] as const
const WMONID_STATUSES = ['active', 'expiring', 'migrating', 'expired'] as const

async function countJobsByStatus(supabase: ReturnType<typeof createAdminClient>) {
  const entries = await Promise.all(
    JOB_STATUSES.map(async (status) => {
      const { count } = await supabase
        .from('scourt_sync_jobs')
        .select('id', { count: 'exact', head: true })
        .eq('status', status)

      return [status, count || 0] as const
    })
  )

  return Object.fromEntries(entries)
}

async function countQueuedByType(supabase: ReturnType<typeof createAdminClient>) {
  const entries = await Promise.all(
    JOB_TYPES.map(async (syncType) => {
      const { count } = await supabase
        .from('scourt_sync_jobs')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'queued')
        .eq('sync_type', syncType)

      return [syncType, count || 0] as const
    })
  )

  return Object.fromEntries(entries)
}

async function countWmonidsByStatus(supabase: ReturnType<typeof createAdminClient>) {
  const entries = await Promise.all(
    WMONID_STATUSES.map(async (status) => {
      const { count } = await supabase
        .from('scourt_user_wmonid')
        .select('id', { count: 'exact', head: true })
        .eq('status', status)

      return [status, count || 0] as const
    })
  )

  return Object.fromEntries(entries)
}

export const GET = withSuperAdmin(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url)
  const limit = Number(searchParams.get('limit') || 20)

  try {
    const supabase = createAdminClient()
    const settings = await getScourtSyncSettings()

    const [statusCounts, queuedByType, wmonidCounts] = await Promise.all([
      countJobsByStatus(supabase),
      countQueuedByType(supabase),
      countWmonidsByStatus(supabase),
    ])

    const { data: oldestQueued } = await supabase
      .from('scourt_sync_jobs')
      .select('scheduled_at')
      .eq('status', 'queued')
      .order('scheduled_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    const { data: recentJobs } = await supabase
      .from('scourt_sync_jobs')
      .select(
        'id, legal_case_id, sync_type, status, attempts, scheduled_at, started_at, finished_at, last_error, legal_case:legal_cases(case_name, court_case_number)'
      )
      .order('scheduled_at', { ascending: false })
      .limit(limit)

    const { data: recentLogs } = await supabase
      .from('scourt_sync_logs')
      .select('id, action, status, duration_ms, cases_synced, cases_failed, created_at, details')
      .order('created_at', { ascending: false })
      .limit(limit)

    return NextResponse.json({
      success: true,
      data: {
        settings,
        statusCounts,
        queuedByType,
        wmonidCounts,
        oldestQueuedAt: oldestQueued?.scheduled_at || null,
        recentJobs: recentJobs || [],
        recentLogs: recentLogs || [],
      },
    })
  } catch (error) {
    console.error('SCOURT queue status error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Status fetch failed' },
      { status: 500 }
    )
  }
})
