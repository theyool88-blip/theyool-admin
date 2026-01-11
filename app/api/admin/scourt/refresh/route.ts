/**
 * SCOURT manual refresh (super admin)
 *
 * POST /api/admin/scourt/refresh
 */

import { NextRequest, NextResponse } from 'next/server'
import { withSuperAdmin } from '@/lib/api/with-tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildScourtDedupKey, enqueueScourtSyncJobs, type ScourtSyncType } from '@/lib/scourt/sync-queue'

const VALID_SYNC_TYPES: ScourtSyncType[] = ['progress', 'general', 'full']

export const POST = withSuperAdmin(async (request: NextRequest) => {
  const body = await request.json()
  const caseIds: string[] = body?.caseIds || (body?.caseId ? [body.caseId] : [])
  const syncType = VALID_SYNC_TYPES.includes(body?.syncType)
    ? (body.syncType as ScourtSyncType)
    : 'full'

  if (!caseIds || caseIds.length === 0) {
    return NextResponse.json(
      { success: false, error: 'caseIds or caseId is required' },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()
  const { data: cases, error } = await supabase
    .from('legal_cases')
    .select('id, tenant_id')
    .in('id', caseIds)

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }

  const now = new Date()
  const jobs = (cases || []).map((item) => ({
    legalCaseId: item.id,
    tenantId: item.tenant_id,
    syncType,
    priority: 10,
    scheduledAt: now.toISOString(),
    payload: {
      triggerSource: 'manual',
      allowFullFallback: true,
      partyName: body?.partyName || null,
    },
    dedupKey: buildScourtDedupKey({
      syncType,
      caseId: item.id,
      scheduledAt: now,
    }),
  }))

  const result = await enqueueScourtSyncJobs(jobs)

  return NextResponse.json({
    success: true,
    inserted: result.inserted,
  })
})
