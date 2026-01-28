/**
 * SCOURT sync scheduler
 *
 * - active cases: queue progress sync jobs
 * - expiring WMONIDs: queue renewal jobs
 *
 * GET /api/cron/scourt-sync-scheduler?secret=xxx
 */

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { getScourtSyncSettings } from '@/lib/scourt/sync-settings'
import { buildScourtDedupKey, enqueueScourtSyncJobs, type ScourtSyncJobInput } from '@/lib/scourt/sync-queue'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _supabase: any = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getSupabase(): any {
  if (!_supabase) {
    _supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }
  return _supabase
}

function getCronSecret() {
  return process.env.CRON_SECRET || 'scourt-batch-sync-secret'
}

function hashToOffset(value: string, range: number): number {
  const hash = crypto.createHash('sha256').update(value).digest('hex')
  const slice = parseInt(hash.slice(0, 8), 16)
  return range > 0 ? slice % range : 0
}

function calculateInitialNextProgressAt(
  caseId: string,
  now: Date,
  intervalMinutes: number
): Date {
  const offset = hashToOffset(caseId, intervalMinutes)
  const base = new Date(now)
  const baseMinutes = Math.floor(base.getUTCMinutes() / intervalMinutes) * intervalMinutes

  base.setUTCMinutes(baseMinutes, 0, 0)

  const candidate = new Date(base.getTime() + offset * 60 * 1000)
  if (candidate <= now) {
    candidate.setTime(candidate.getTime() + intervalMinutes * 60 * 1000)
  }

  return candidate
}

function calculateNextProgressAt(
  now: Date,
  intervalHours: number,
  jitterMinutes: number
): Date {
  const nextAt = new Date(now.getTime() + intervalHours * 60 * 60 * 1000)
  if (jitterMinutes > 0) {
    const jitter = Math.floor(Math.random() * jitterMinutes)
    nextAt.setMinutes(nextAt.getMinutes() + jitter)
  }
  return nextAt
}

function isExpiredFinalResult(caseItem: {
  case_result?: string | null
  case_result_date?: string | null
}): boolean {
  return Boolean(caseItem.case_result || caseItem.case_result_date)
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const secret = searchParams.get('secret')

  if (secret !== getCronSecret()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startTime = Date.now()

  try {
    const settings = await getScourtSyncSettings()
    if (!settings.autoSyncEnabled) {
      return NextResponse.json({
        success: true,
        message: 'Auto sync disabled',
        scheduledJobs: 0,
        durationMs: Date.now() - startTime,
      })
    }

    const now = new Date()
    const intervalMinutes = Math.max(1, Math.round(settings.progressIntervalHours * 60))
    const fetchLimit = Math.max(settings.schedulerBatchSize * 2, settings.schedulerBatchSize)

    let query = getSupabase()
      .from('legal_cases')
      .select(
        'id, tenant_id, court_case_number, status, scourt_enc_cs_no, scourt_wmonid, scourt_next_progress_sync_at, scourt_sync_cooldown_until, case_result, case_result_date'
      )
      .eq('scourt_sync_enabled', true)
      .not('court_case_number', 'is', null)
      .or(`scourt_next_progress_sync_at.is.null,scourt_next_progress_sync_at.lte.${now.toISOString()}`)
      .limit(fetchLimit)

    if (settings.activeCaseRule.statusAllowList.length > 0) {
      query = query.in('status', settings.activeCaseRule.statusAllowList)
    }

    if (settings.activeCaseRule.requireLinked) {
      query = query.not('scourt_enc_cs_no', 'is', null).not('scourt_wmonid', 'is', null)
    }

    const { data: candidates, error: candidateError } = await query

    if (candidateError) {
      throw new Error(`Candidate query failed: ${candidateError.message}`)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filtered = (candidates || []).filter((item: any) => {
      if (settings.activeCaseRule.excludeFinalResult && isExpiredFinalResult(item)) {
        return false
      }

      if (settings.activeCaseRule.statusAllowList.length === 0 && settings.activeCaseRule.statusBlockList.length > 0) {
        if (settings.activeCaseRule.statusBlockList.includes(item.status || '')) {
          return false
        }
      }

      if (item.scourt_sync_cooldown_until) {
        const cooldown = new Date(item.scourt_sync_cooldown_until)
        if (cooldown > now) {
          return false
        }
      }

      return true
    })

    const selected = filtered.slice(0, settings.schedulerBatchSize)
    const jobs: ScourtSyncJobInput[] = []
    const updates: Array<{ id: string; nextProgressAt: string }> = []
    const initialUpdates: Array<{ id: string; nextProgressAt: string }> = []

    for (const item of selected) {
      if (!item.id) continue

      if (!item.scourt_next_progress_sync_at) {
        const initialNextAt = calculateInitialNextProgressAt(item.id, now, intervalMinutes)
        initialUpdates.push({ id: item.id, nextProgressAt: initialNextAt.toISOString() })
        continue
      }

      const dueAt = new Date(item.scourt_next_progress_sync_at)
      if (dueAt > now) {
        continue
      }

      const scheduledAt = now
      const dedupKey = buildScourtDedupKey({
        syncType: 'progress',
        caseId: item.id,
        scheduledAt,
      })

      jobs.push({
        legalCaseId: item.id,
        tenantId: item.tenant_id,
        syncType: 'progress',
        priority: 0,
        scheduledAt: scheduledAt.toISOString(),
        payload: {
          triggerSource: 'auto',
        },
        dedupKey,
      })

      const nextProgressAt = calculateNextProgressAt(
        now,
        settings.progressIntervalHours,
        settings.progressJitterMinutes
      )

      updates.push({ id: item.id, nextProgressAt: nextProgressAt.toISOString() })
    }

    if (initialUpdates.length > 0) {
      for (const update of initialUpdates) {
        await getSupabase()
          .from('legal_cases')
          .update({ scourt_next_progress_sync_at: update.nextProgressAt })
          .eq('id', update.id)
      }
    }

    if (updates.length > 0) {
      for (const update of updates) {
        await getSupabase()
          .from('legal_cases')
          .update({ scourt_next_progress_sync_at: update.nextProgressAt })
          .eq('id', update.id)
      }
    }

    const jobInsertResult = await enqueueScourtSyncJobs(jobs)

    let wmonidJobsInserted = 0
    if (settings.wmonid.autoRotateEnabled) {
      const renewalDate = new Date()
      renewalDate.setDate(renewalDate.getDate() + settings.wmonid.renewalBeforeDays)

      const { data: wmonids, error: wmonidError } = await getSupabase()
        .from('scourt_user_wmonid')
        .select('id, user_id, expires_at, status')
        .lte('expires_at', renewalDate.toISOString())
        .in('status', ['active', 'expiring'])

      if (wmonidError) {
        console.warn('WMONID renewal query failed:', wmonidError.message)
      } else if (wmonids && wmonids.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const wmonidJobs: ScourtSyncJobInput[] = wmonids.map((wmonid: any) => ({
          legalCaseId: null,
          tenantId: null,
          syncType: 'wmonid_renewal',
          priority: 5,
          scheduledAt: now.toISOString(),
          payload: {
            wmonidId: wmonid.id,
            userId: wmonid.user_id,
          },
          dedupKey: buildScourtDedupKey({
            syncType: 'wmonid_renewal',
            caseId: wmonid.id,
            scheduledAt: now,
          }),
        }))

        const inserted = await enqueueScourtSyncJobs(wmonidJobs)
        wmonidJobsInserted = inserted.inserted
      }
    }

    await getSupabase().from('scourt_sync_logs').insert({
      action: 'scheduler',
      status: 'success',
      cases_synced: jobInsertResult.inserted,
      cases_failed: 0,
      duration_ms: Date.now() - startTime,
      details: {
        candidates: candidates?.length || 0,
        queued: jobInsertResult.inserted,
        wmonidQueued: wmonidJobsInserted,
      },
    })

    return NextResponse.json({
      success: true,
      scheduledJobs: jobInsertResult.inserted,
      wmonidJobs: wmonidJobsInserted,
      durationMs: Date.now() - startTime,
    })
  } catch (error) {
    console.error('[SCOURT Scheduler] error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Scheduler failed',
      },
      { status: 500 }
    )
  }
}
