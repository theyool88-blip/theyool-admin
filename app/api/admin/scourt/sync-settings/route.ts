/**
 * SCOURT sync settings (super admin)
 *
 * GET /api/admin/scourt/sync-settings
 * PUT /api/admin/scourt/sync-settings
 */

import { NextRequest, NextResponse } from 'next/server'
import { withSuperAdmin } from '@/lib/api/with-tenant'
import { getScourtSyncSettings, updateScourtSyncSettings } from '@/lib/scourt/sync-settings'

export const GET = withSuperAdmin(async () => {
  const settings = await getScourtSyncSettings()
  return NextResponse.json({ success: true, settings })
})

export const PUT = withSuperAdmin(async (request: NextRequest) => {
  const body = await request.json()
  const updates = body?.settings || body || {}

  if (!updates || typeof updates !== 'object') {
    return NextResponse.json(
      { success: false, error: 'settings object is required' },
      { status: 400 }
    )
  }

  const settings = await updateScourtSyncSettings(updates)
  return NextResponse.json({ success: true, settings })
})
