/**
 * POST /api/admin/onboarding/batch-create
 *
 * Queue-based batch import API (non-streaming)
 *
 * Accepts rows and enqueues them for background processing by the worker.
 * Returns immediately with a batchId for status tracking.
 *
 * Flow:
 * 1. User uploads file → Frontend calls this API
 * 2. API enqueues jobs → Returns batchId immediately
 * 3. Worker (cron) processes jobs in background
 * 4. User polls /batch-status/[batchId] for progress
 * 5. Notification sent on completion
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentTenantContext } from '@/lib/auth/tenant-context'
import { createClient } from '@/lib/supabase/server'
import type { StandardCaseRow, ImportOptions } from '@/types/onboarding'
import { convertToStandardRow } from '@/lib/onboarding/csv-schema'
import { enqueueBatchImportJobs } from '@/lib/batch-import/import-queue'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  const tenant = await getCurrentTenantContext()

  if (!tenant || !tenant.tenantId) {
    return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
  }

  try {
    const body = await request.json() as {
      rows: Record<string, string>[]
      columnMapping?: Record<string, string>
      options?: Partial<ImportOptions>
    }

    const { rows, columnMapping, options: inputOptions } = body

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: '데이터가 필요합니다' }, { status: 400 })
    }

    // Build import options
    const options: Partial<ImportOptions> = {
      duplicateHandling: inputOptions?.duplicateHandling || 'skip',
      createNewClients: inputOptions?.createNewClients ?? true,
      linkScourt: true, // Always true for batch import
      dryRun: inputOptions?.dryRun ?? false,
    }

    // Dry run mode - just validate and return
    if (options.dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        message: '테스트 모드: 실제 등록은 수행되지 않았습니다.',
        totalRows: rows.length,
      })
    }

    // Convert to standard format
    const mapping = columnMapping
      ? new Map(Object.entries(columnMapping))
      : undefined

    const standardRows: Partial<StandardCaseRow>[] = rows.map(row =>
      convertToStandardRow(row, mapping as Map<string, keyof StandardCaseRow> | undefined)
    )

    // Get user ID for requested_by
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const userId = user?.id || null

    // Generate batch ID
    const batchId = crypto.randomUUID()

    // Enqueue jobs
    const jobs = standardRows.map((row, index) => ({
      tenantId: tenant.tenantId,
      batchId,
      rowIndex: index,
      payload: row,
      priority: 0,
      requestedBy: userId || undefined,
    }))

    const { inserted } = await enqueueBatchImportJobs(jobs, options)

    return NextResponse.json({
      success: true,
      batchId,
      totalJobs: inserted,
      message: `${inserted}건의 등록이 대기열에 추가되었습니다. 완료 시 알림을 받게 됩니다.`,
    })

  } catch (error) {
    console.error('[Batch Create] Error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : '요청 처리 실패',
      },
      { status: 500 }
    )
  }
}
