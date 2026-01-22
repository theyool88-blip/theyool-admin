/**
 * GET /api/admin/onboarding/batch-status/[batchId]
 *
 * Get batch import status and progress
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentTenantContext } from '@/lib/auth/tenant-context'
import {
  getBatchImportStatus,
  getBatchImportJobResults,
  cancelBatchImportJobs,
} from '@/lib/batch-import/import-queue'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const tenant = await getCurrentTenantContext()

  if (!tenant || !tenant.tenantId) {
    return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
  }

  try {
    const { batchId } = await params
    const { searchParams } = new URL(request.url)

    // Get query parameters
    const includeJobs = searchParams.get('includeJobs') === 'true'
    const jobStatus = searchParams.get('jobStatus') as 'success' | 'failed' | 'skipped' | null
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    // Get batch summary
    const status = await getBatchImportStatus(batchId)

    if (!status) {
      return NextResponse.json({ error: '배치를 찾을 수 없습니다' }, { status: 404 })
    }

    // Verify tenant access
    if (status.tenant_id !== tenant.tenantId && !tenant.isSuperAdmin) {
      return NextResponse.json({ error: '접근 권한이 없습니다' }, { status: 403 })
    }

    // Build response
    const response: {
      batchId: string
      status: string
      progress: {
        total: number
        processed: number
        success: number
        failed: number
        skipped: number
        percentage: number
      }
      createdAt: string
      startedAt: string | null
      completedAt: string | null
      jobs?: {
        data: unknown[]
        total: number
        limit: number
        offset: number
      }
    } = {
      batchId,
      status: status.status,
      progress: {
        total: status.total_rows,
        processed: status.processed_rows,
        success: status.success_count,
        failed: status.failed_count,
        skipped: status.skipped_count,
        percentage: status.total_rows > 0
          ? Math.round((status.processed_rows / status.total_rows) * 100)
          : 0,
      },
      createdAt: status.created_at,
      startedAt: status.started_at,
      completedAt: status.completed_at,
    }

    // Include job details if requested
    if (includeJobs) {
      const jobResults = await getBatchImportJobResults(batchId, {
        status: jobStatus || undefined,
        limit,
        offset,
      })

      response.jobs = {
        data: jobResults.jobs,
        total: jobResults.total,
        limit,
        offset,
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('[Batch Status] Error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : '상태 조회 실패',
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/onboarding/batch-status/[batchId]
 *
 * Cancel pending jobs in a batch
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const tenant = await getCurrentTenantContext()

  if (!tenant || !tenant.tenantId) {
    return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
  }

  try {
    const { batchId } = await params

    // Get batch summary to verify access
    const status = await getBatchImportStatus(batchId)

    if (!status) {
      return NextResponse.json({ error: '배치를 찾을 수 없습니다' }, { status: 404 })
    }

    // Verify tenant access
    if (status.tenant_id !== tenant.tenantId && !tenant.isSuperAdmin) {
      return NextResponse.json({ error: '접근 권한이 없습니다' }, { status: 403 })
    }

    // Cancel pending jobs
    const { cancelled } = await cancelBatchImportJobs(batchId)

    return NextResponse.json({
      success: true,
      cancelled,
      message: `${cancelled}건의 대기 중인 작업이 취소되었습니다.`,
    })

  } catch (error) {
    console.error('[Batch Cancel] Error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : '취소 실패',
      },
      { status: 500 }
    )
  }
}
