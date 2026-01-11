/**
 * WMONID rotation trigger (super admin)
 *
 * POST /api/admin/scourt/wmonid/rotate
 */

import { NextRequest, NextResponse } from 'next/server'
import { withSuperAdmin } from '@/lib/api/with-tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildScourtDedupKey, enqueueScourtSyncJobs } from '@/lib/scourt/sync-queue'
import { getScourtSyncSettings } from '@/lib/scourt/sync-settings'

export const POST = withSuperAdmin(async (request: NextRequest) => {
  const body = await request.json()
  const wmonidIds: string[] = body?.wmonidIds || []
  const forceAllExpiring = body?.forceAllExpiring === true

  const supabase = createAdminClient()
  let wmonids: Array<{ id: string; user_id: string }> = []

  if (wmonidIds.length > 0) {
    const { data, error } = await supabase
      .from('scourt_user_wmonid')
      .select('id, user_id')
      .in('id', wmonidIds)

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    wmonids = data || []
  } else if (forceAllExpiring) {
    const settings = await getScourtSyncSettings()
    const renewalDate = new Date()
    renewalDate.setDate(renewalDate.getDate() + settings.wmonid.renewalBeforeDays)

    const { data, error } = await supabase
      .from('scourt_user_wmonid')
      .select('id, user_id')
      .lte('expires_at', renewalDate.toISOString())
      .in('status', ['active', 'expiring'])

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    wmonids = data || []
  } else {
    return NextResponse.json(
      { success: false, error: 'wmonidIds or forceAllExpiring is required' },
      { status: 400 }
    )
  }

  if (wmonids.length === 0) {
    return NextResponse.json({ success: true, inserted: 0 })
  }

  const now = new Date()
  const jobs = wmonids.map((wmonid) => ({
    legalCaseId: null,
    tenantId: null,
    syncType: 'wmonid_renewal' as const,
    priority: 10,
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

  const result = await enqueueScourtSyncJobs(jobs)

  return NextResponse.json({
    success: true,
    inserted: result.inserted,
  })
})
