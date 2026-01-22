/**
 * Batch Import Queue Utilities
 *
 * Handles enqueueing batch import jobs and tracking batch status
 */

import { createAdminClient } from '@/lib/supabase/admin'
import type { StandardCaseRow, ImportOptions } from '@/types/onboarding'

// Types
export interface BatchImportJobInput {
  tenantId: string
  batchId: string
  rowIndex: number
  payload: Partial<StandardCaseRow>
  priority?: number
  requestedBy?: string
}

export interface BatchImportJob {
  id: string
  tenant_id: string
  batch_id: string
  row_index: number
  status: 'queued' | 'running' | 'success' | 'failed' | 'skipped'
  priority: number
  payload: Partial<StandardCaseRow>
  result: BatchImportJobResult | null
  last_error: string | null
  attempts: number
  backoff_until: string | null
  lock_token: string | null
  created_at: string
  started_at: string | null
  finished_at: string | null
  requested_by: string | null
}

export interface BatchImportJobResult {
  caseId?: string
  caseName?: string
  clientId?: string
  clientName?: string
  isNewClient?: boolean
  scourtLinked?: boolean
  encCsNo?: string
  warnings?: Array<{ field: string; message: string }>
}

export interface BatchImportSummary {
  id: string
  tenant_id: string
  batch_id: string
  total_rows: number
  processed_rows: number
  success_count: number
  failed_count: number
  skipped_count: number
  status: 'pending' | 'processing' | 'completed' | 'failed'
  options: Partial<ImportOptions> | null
  created_at: string
  started_at: string | null
  completed_at: string | null
  requested_by: string | null
}

/**
 * Enqueue batch import jobs
 * Creates a summary record and individual job records
 */
export async function enqueueBatchImportJobs(
  jobs: BatchImportJobInput[],
  options?: Partial<ImportOptions>
): Promise<{ inserted: number; batchId: string }> {
  if (jobs.length === 0) {
    throw new Error('No jobs to enqueue')
  }

  const supabase = createAdminClient()
  const batchId = jobs[0].batchId
  const tenantId = jobs[0].tenantId
  const requestedBy = jobs[0].requestedBy

  // 1. Create summary record
  const { error: summaryError } = await supabase
    .from('batch_import_summaries')
    .insert({
      tenant_id: tenantId,
      batch_id: batchId,
      total_rows: jobs.length,
      options: options || null,
      requested_by: requestedBy,
    })

  if (summaryError) {
    throw new Error(`Failed to create batch summary: ${summaryError.message}`)
  }

  // 2. Create individual job records in batches (Supabase has limits)
  const BATCH_SIZE = 100
  let totalInserted = 0

  for (let i = 0; i < jobs.length; i += BATCH_SIZE) {
    const batch = jobs.slice(i, i + BATCH_SIZE)
    const payload = batch.map(job => ({
      tenant_id: job.tenantId,
      batch_id: job.batchId,
      row_index: job.rowIndex,
      payload: job.payload,
      priority: job.priority ?? 0,
      requested_by: job.requestedBy,
    }))

    const { data, error } = await supabase
      .from('batch_import_jobs')
      .insert(payload)
      .select('id')

    if (error) {
      // Try to clean up the summary
      await supabase
        .from('batch_import_summaries')
        .delete()
        .eq('batch_id', batchId)

      throw new Error(`Failed to enqueue jobs: ${error.message}`)
    }

    totalInserted += data?.length || 0
  }

  return { inserted: totalInserted, batchId }
}

/**
 * Get batch import status
 */
export async function getBatchImportStatus(batchId: string): Promise<BatchImportSummary | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('batch_import_summaries')
    .select('*')
    .eq('batch_id', batchId)
    .single()

  if (error || !data) {
    return null
  }

  return data as BatchImportSummary
}

/**
 * Get detailed job results for a batch
 */
export async function getBatchImportJobResults(
  batchId: string,
  options?: {
    status?: 'success' | 'failed' | 'skipped'
    limit?: number
    offset?: number
  }
): Promise<{ jobs: BatchImportJob[]; total: number }> {
  const supabase = createAdminClient()

  let query = supabase
    .from('batch_import_jobs')
    .select('*', { count: 'exact' })
    .eq('batch_id', batchId)
    .order('row_index', { ascending: true })

  if (options?.status) {
    query = query.eq('status', options.status)
  }

  if (options?.limit) {
    query = query.limit(options.limit)
  }

  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 50) - 1)
  }

  const { data, error, count } = await query

  if (error) {
    throw new Error(`Failed to get job results: ${error.message}`)
  }

  return {
    jobs: (data || []) as BatchImportJob[],
    total: count || 0,
  }
}

/**
 * Cancel pending jobs in a batch (only queued jobs can be cancelled)
 */
export async function cancelBatchImportJobs(batchId: string): Promise<{ cancelled: number }> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('batch_import_jobs')
    .update({
      status: 'skipped',
      last_error: 'Cancelled by user',
      finished_at: new Date().toISOString(),
    })
    .eq('batch_id', batchId)
    .eq('status', 'queued')
    .select('id')

  if (error) {
    throw new Error(`Failed to cancel jobs: ${error.message}`)
  }

  // Update summary counts
  await updateBatchSummaryCounts(batchId)

  return { cancelled: data?.length || 0 }
}

/**
 * Update batch summary counts (called by worker after processing)
 */
export async function updateBatchSummaryCounts(batchId: string): Promise<void> {
  const supabase = createAdminClient()

  // Call the database function
  const { error } = await supabase.rpc('update_batch_import_summary_counts_manual', {
    p_batch_id: batchId,
  })

  if (error) {
    console.error('[BatchImport] Failed to update summary counts:', error)
  }
}

/**
 * Mark a job as successful
 */
export async function markJobSuccess(
  jobId: string,
  result: BatchImportJobResult
): Promise<void> {
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('batch_import_jobs')
    .update({
      status: 'success',
      result,
      finished_at: new Date().toISOString(),
      last_error: null,
      backoff_until: null,
    })
    .eq('id', jobId)

  if (error) {
    console.error('[BatchImport] Failed to mark job success:', error)
  }
}

/**
 * Mark a job as failed with backoff
 */
export async function markJobFailed(
  jobId: string,
  error: string,
  attempts: number,
  maxRetries: number = 3
): Promise<boolean> {
  const supabase = createAdminClient()

  const shouldRetry = attempts < maxRetries
  const status = shouldRetry ? 'queued' : 'failed'

  // Exponential backoff: 1min, 2min, 4min, ...
  const backoffMs = shouldRetry
    ? Math.min(60000 * Math.pow(2, attempts - 1), 30 * 60000) // Cap at 30 minutes
    : null

  const { error: updateError } = await supabase
    .from('batch_import_jobs')
    .update({
      status,
      last_error: error,
      finished_at: shouldRetry ? null : new Date().toISOString(),
      backoff_until: backoffMs
        ? new Date(Date.now() + backoffMs).toISOString()
        : null,
    })
    .eq('id', jobId)

  if (updateError) {
    console.error('[BatchImport] Failed to mark job failed:', updateError)
  }

  return shouldRetry
}

/**
 * Mark a job as skipped
 */
export async function markJobSkipped(
  jobId: string,
  reason: string,
  result?: Partial<BatchImportJobResult>
): Promise<void> {
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('batch_import_jobs')
    .update({
      status: 'skipped',
      result: result || null,
      last_error: reason,
      finished_at: new Date().toISOString(),
    })
    .eq('id', jobId)

  if (error) {
    console.error('[BatchImport] Failed to mark job skipped:', error)
  }
}

/**
 * Get batches for a tenant (recent imports)
 */
export async function getTenantBatchImports(
  tenantId: string,
  limit: number = 10
): Promise<BatchImportSummary[]> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('batch_import_summaries')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw new Error(`Failed to get batch imports: ${error.message}`)
  }

  return (data || []) as BatchImportSummary[]
}

/**
 * Send completion notification
 */
export async function sendBatchCompletionNotification(
  batchId: string,
  tenantId: string,
  userId: string
): Promise<void> {
  const supabase = createAdminClient()
  const status = await getBatchImportStatus(batchId)

  if (!status) return

  const message = status.failed_count > 0
    ? `대량 등록 완료: ${status.success_count}건 성공, ${status.failed_count}건 실패, ${status.skipped_count}건 스킵`
    : `대량 등록 완료: ${status.success_count}건 성공${status.skipped_count > 0 ? `, ${status.skipped_count}건 스킵` : ''}`

  await supabase.from('notifications').insert({
    tenant_id: tenantId,
    user_id: userId,
    type: 'batch_import',
    title: '대량 등록 완료',
    message,
    metadata: {
      batch_id: batchId,
      total: status.total_rows,
      success: status.success_count,
      failed: status.failed_count,
      skipped: status.skipped_count,
    },
  })
}
