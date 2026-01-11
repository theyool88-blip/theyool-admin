/**
 * SCOURT sync worker
 *
 * GET /api/cron/scourt-sync-worker?secret=xxx
 */

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { getScourtSyncSettings } from '@/lib/scourt/sync-settings'
import { buildScourtDedupKey, enqueueScourtSyncJobs, type ScourtSyncType } from '@/lib/scourt/sync-queue'
import { getWmonidManager } from '@/lib/scourt/wmonid-manager'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

const CRON_SECRET = process.env.CRON_SECRET || 'scourt-batch-sync-secret'
const DEFAULT_MAX_ATTEMPTS = 5

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function randomBetween(min: number, max: number) {
  if (max <= min) return min
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function createRateLimiter(perMinute: number | null) {
  if (!perMinute || perMinute <= 0) {
    return {
      wait: async () => {},
    }
  }

  const windowMs = 60 * 1000
  const timestamps: number[] = []

  return {
    wait: async () => {
      while (timestamps.length >= perMinute) {
        const now = Date.now()
        const earliest = timestamps[0]
        const delta = now - earliest
        if (delta >= windowMs) {
          timestamps.shift()
          continue
        }
        await sleep(windowMs - delta + 25)
      }

      const now = Date.now()
      timestamps.push(now)
    },
  }
}

async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  handler: (item: T) => Promise<void>
) {
  let index = 0
  const workers = Array.from({ length: Math.max(1, limit) }, async () => {
    while (index < items.length) {
      const current = items[index]
      index += 1
      await handler(current)
    }
  })

  await Promise.all(workers)
}

function calculateBackoffMs(attempts: number) {
  const baseMs = 5 * 60 * 1000
  const exponent = Math.min(attempts, 6)
  const jitter = randomBetween(5000, 15000)
  return baseMs * Math.pow(2, exponent - 1) + jitter
}

async function updateJobStatus(
  jobId: string,
  status: string,
  fields: Record<string, unknown>
) {
  await supabase
    .from('scourt_sync_jobs')
    .update({
      status,
      ...fields,
    })
    .eq('id', jobId)
}

async function logSync(action: string, status: string, details: Record<string, unknown>) {
  await supabase.from('scourt_sync_logs').insert({
    action,
    status,
    cases_synced: status === 'success' ? 1 : 0,
    cases_failed: status === 'success' ? 0 : 1,
    duration_ms: details.durationMs,
    details,
  })
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const secret = searchParams.get('secret')

  if (secret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startTime = Date.now()

  try {
    const settings = await getScourtSyncSettings()
    if (!settings.autoSyncEnabled) {
      return NextResponse.json({
        success: true,
        message: 'Auto sync disabled',
        processed: 0,
        durationMs: Date.now() - startTime,
      })
    }

    const workerId = crypto.randomUUID()
    const { data: jobs, error } = await supabase.rpc('dequeue_scourt_sync_jobs', {
      p_limit: settings.workerBatchSize,
      p_worker_id: workerId,
    })

    if (error) {
      throw new Error(`Job dequeue failed: ${error.message}`)
    }

    if (!jobs || jobs.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No jobs',
        processed: 0,
        durationMs: Date.now() - startTime,
      })
    }

    const rateLimiter = createRateLimiter(settings.rateLimitPerMinute)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin

    interface ScourtSyncJob {
      id: string;
      legal_case_id: string | null;
      sync_type: string;
      priority: number;
      attempts: number;
      payload?: {
        triggerSource?: string;
        wmonidId?: string;
        partyName?: string;
        allowFullFallback?: boolean;
      };
    }

    await runWithConcurrency(jobs as ScourtSyncJob[], settings.workerConcurrency, async (job) => {
      const jobStart = Date.now()
      const syncType = job.sync_type as ScourtSyncType
      const triggerSource = job.payload?.triggerSource || (job.priority >= 10 ? 'manual' : 'auto')
      const isManual = triggerSource === 'manual'

      if (syncType === 'wmonid_renewal') {
        const wmonidId = job.payload?.wmonidId as string | undefined
        if (!wmonidId) {
          await updateJobStatus(job.id, 'failed', {
            finished_at: new Date().toISOString(),
            last_error: 'Missing wmonidId',
          })
          return
        }

        try {
          const manager = getWmonidManager()
          const renewed = await manager.renewWmonid(wmonidId)

          if (!renewed) {
            throw new Error('WMONID renewal failed')
          }

          await updateJobStatus(job.id, 'success', {
            finished_at: new Date().toISOString(),
            last_error: null,
            backoff_until: null,
          })

          await logSync('wmonid_renewal', 'success', {
            jobId: job.id,
            wmonidId,
            durationMs: Date.now() - jobStart,
          })
        } catch (renewError) {
          const errorMessage = renewError instanceof Error ? renewError.message : String(renewError)
          const attempts = job.attempts || 1
          const shouldRetry = attempts < DEFAULT_MAX_ATTEMPTS

          if (shouldRetry) {
            const backoffMs = calculateBackoffMs(attempts)
            const backoffAt = new Date(Date.now() + backoffMs)
            await updateJobStatus(job.id, 'queued', {
              backoff_until: backoffAt.toISOString(),
              scheduled_at: backoffAt.toISOString(),
              last_error: errorMessage,
            })
          } else {
            await updateJobStatus(job.id, 'failed', {
              finished_at: new Date().toISOString(),
              last_error: errorMessage,
            })
          }

          await logSync('wmonid_renewal', 'failed', {
            jobId: job.id,
            wmonidId,
            durationMs: Date.now() - jobStart,
            error: errorMessage,
          })
        }

        return
      }

      if (!job.legal_case_id) {
        await updateJobStatus(job.id, 'failed', {
          finished_at: new Date().toISOString(),
          last_error: 'Missing legal_case_id',
        })
        return
      }

      const { data: legalCase, error: caseError } = await supabase
        .from('legal_cases')
        .select(
          'id, tenant_id, court_case_number, court_name, enc_cs_no, scourt_wmonid, scourt_sync_enabled, scourt_sync_cooldown_until, scourt_last_general_sync_at'
        )
        .eq('id', job.legal_case_id)
        .single()

      if (caseError || !legalCase) {
        await updateJobStatus(job.id, 'failed', {
          finished_at: new Date().toISOString(),
          last_error: caseError?.message || 'Case not found',
        })
        return
      }

      if (!legalCase.scourt_sync_enabled) {
        await updateJobStatus(job.id, 'skipped', {
          finished_at: new Date().toISOString(),
          last_error: 'Sync disabled',
        })
        return
      }

      const applyCooldown = !isManual && syncType === 'progress'
      if (applyCooldown && legalCase.scourt_sync_cooldown_until) {
        const cooldown = new Date(legalCase.scourt_sync_cooldown_until)
        if (cooldown > new Date()) {
          await updateJobStatus(job.id, 'skipped', {
            finished_at: new Date().toISOString(),
            last_error: 'In cooldown',
          })
          return
        }
      }

      let effectiveSyncType: ScourtSyncType = syncType
      const hasLink = Boolean(legalCase.enc_cs_no && legalCase.scourt_wmonid)
      if (effectiveSyncType !== 'full' && !hasLink) {
        if (job.payload?.allowFullFallback) {
          effectiveSyncType = 'full'
        } else {
          await updateJobStatus(job.id, 'failed', {
            finished_at: new Date().toISOString(),
            last_error: 'Missing encCsNo/WMONID',
          })
          return
        }
      }

      await rateLimiter.wait()
      await sleep(randomBetween(settings.requestJitterMs.min, settings.requestJitterMs.max))

      let responseJson: { success?: boolean; skipped?: boolean; error?: string; progressChanged?: boolean } | null = null
      try {
        const syncResponse = await fetch(`${baseUrl}/api/admin/scourt/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            legalCaseId: legalCase.id,
            caseNumber: legalCase.court_case_number,
            courtName: legalCase.court_name,
            forceRefresh: isManual,
            syncType: effectiveSyncType,
            triggerSource,
            partyName: job.payload?.partyName,
          }),
        })

        responseJson = await syncResponse.json()

        if (!syncResponse.ok || (!responseJson?.success && !responseJson?.skipped)) {
          throw new Error(responseJson?.error || 'Sync failed')
        }
      } catch (syncError) {
        const errorMessage = syncError instanceof Error ? syncError.message : String(syncError)
        const attempts = job.attempts || 1
        const shouldRetry = attempts < DEFAULT_MAX_ATTEMPTS

        if (shouldRetry) {
          const backoffMs = calculateBackoffMs(attempts)
          const backoffAt = new Date(Date.now() + backoffMs)
          await updateJobStatus(job.id, 'queued', {
            backoff_until: backoffAt.toISOString(),
            scheduled_at: backoffAt.toISOString(),
            last_error: errorMessage,
          })
        } else {
          await updateJobStatus(job.id, 'failed', {
            finished_at: new Date().toISOString(),
            last_error: errorMessage,
          })
        }

        await logSync(`sync_${syncType}`, 'failed', {
          jobId: job.id,
          legalCaseId: legalCase.id,
          durationMs: Date.now() - jobStart,
          error: errorMessage,
        })
        return
      }

      await updateJobStatus(job.id, 'success', {
        finished_at: new Date().toISOString(),
        last_error: null,
        backoff_until: null,
      })

      await logSync(`sync_${syncType}`, 'success', {
        jobId: job.id,
        legalCaseId: legalCase.id,
        durationMs: Date.now() - jobStart,
        progressChanged: responseJson?.progressChanged || false,
      })

      if (
        effectiveSyncType === 'progress' &&
        responseJson?.progressChanged &&
        !isManual
      ) {
        const lastGeneral = legalCase.scourt_last_general_sync_at
          ? new Date(legalCase.scourt_last_general_sync_at)
          : null
        const generalDue =
          !lastGeneral ||
          Date.now() - lastGeneral.getTime() >= settings.generalBackoffHours * 60 * 60 * 1000

        if (generalDue) {
          const scheduledAt = new Date()
          const dedupKey = buildScourtDedupKey({
            syncType: 'general',
            caseId: legalCase.id,
            scheduledAt,
          })

          await enqueueScourtSyncJobs([
            {
              legalCaseId: legalCase.id,
              tenantId: legalCase.tenant_id,
              syncType: 'general',
              priority: 1,
              scheduledAt: scheduledAt.toISOString(),
              payload: {
                triggerSource: 'auto',
              },
              dedupKey,
            },
          ])

          const nextGeneralAt = new Date(
            Date.now() + settings.generalBackoffHours * 60 * 60 * 1000
          )
          await supabase
            .from('legal_cases')
            .update({ scourt_next_general_sync_at: nextGeneralAt.toISOString() })
            .eq('id', legalCase.id)
        }
      }
    })

    return NextResponse.json({
      success: true,
      processed: jobs.length,
      durationMs: Date.now() - startTime,
    })
  } catch (error) {
    console.error('[SCOURT Worker] error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Worker failed',
      },
      { status: 500 }
    )
  }
}
