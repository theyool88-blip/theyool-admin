import { createAdminClient } from '@/lib/supabase/admin'

export type ScourtSyncType = 'progress' | 'general' | 'full' | 'wmonid_renewal'

export type ScourtSyncJobInput = {
  legalCaseId?: string | null
  tenantId?: string | null
  syncType: ScourtSyncType
  priority?: number
  scheduledAt: string
  requestedBy?: string | null
  payload?: Record<string, unknown>
  dedupKey?: string | null
}

export function buildScourtDedupKey(params: {
  syncType: ScourtSyncType
  caseId?: string | null
  scheduledAt: Date
}): string {
  const bucket = formatDedupBucket(params.syncType, params.scheduledAt)
  const base = params.caseId || 'global'
  return `${params.syncType}:${base}:${bucket}`
}

function formatDedupBucket(syncType: ScourtSyncType, scheduledAt: Date): string {
  const year = scheduledAt.getUTCFullYear()
  const month = String(scheduledAt.getUTCMonth() + 1).padStart(2, '0')
  const day = String(scheduledAt.getUTCDate()).padStart(2, '0')
  const hour = String(scheduledAt.getUTCHours()).padStart(2, '0')

  if (syncType === 'general' || syncType === 'wmonid_renewal') {
    return `${year}${month}${day}`
  }

  return `${year}${month}${day}${hour}`
}

export async function enqueueScourtSyncJobs(jobs: ScourtSyncJobInput[]) {
  if (jobs.length === 0) return { inserted: 0 }

  const supabase = createAdminClient()
  const payload = jobs.map((job) => ({
    legal_case_id: job.legalCaseId || null,
    tenant_id: job.tenantId || null,
    sync_type: job.syncType,
    priority: job.priority ?? 0,
    scheduled_at: job.scheduledAt,
    status: 'queued',
    requested_by: job.requestedBy || null,
    payload: job.payload || {},
    dedup_key: job.dedupKey || null,
  }))

  const { data, error } = await supabase
    .from('scourt_sync_jobs')
    .upsert(payload, { onConflict: 'dedup_key', ignoreDuplicates: true })
    .select('id')

  if (error) {
    throw new Error(`SCOURT sync job enqueue failed: ${error.message}`)
  }

  return { inserted: data?.length || 0 }
}
