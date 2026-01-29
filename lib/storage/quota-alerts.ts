/**
 * Storage Quota Alert System
 *
 * Checks storage usage and creates alerts at 80%, 90%, and 100% thresholds.
 * Uses dedicated storage_alerts table (not notification_logs).
 */

import { createClient } from '@/lib/supabase/server'

const THRESHOLDS = [100, 90, 80] as const

/**
 * Check storage usage and create alert if threshold is reached
 *
 * @param tenantId - Tenant ID
 * @param usedBytes - Current used bytes after update
 * @param quotaBytes - Total quota bytes
 */
export async function checkAndCreateQuotaAlert(
  tenantId: string,
  usedBytes: number,
  quotaBytes: number
): Promise<void> {
  if (quotaBytes <= 0) return

  const usagePercent = (usedBytes / quotaBytes) * 100

  for (const threshold of THRESHOLDS) {
    if (usagePercent >= threshold) {
      const supabase = await createClient()
      const today = new Date().toISOString().split('T')[0]

      // Check if alert already exists for today (using date range)
      const { data: existingAlert } = await supabase
        .from('storage_alerts')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('threshold_percent', threshold)
        .gte('created_at', `${today}T00:00:00.000Z`)
        .lt('created_at', `${today}T23:59:59.999Z`)
        .single()

      if (!existingAlert) {
        // Insert new alert - unique constraint prevents duplicates
        const { error } = await supabase.from('storage_alerts').insert({
          tenant_id: tenantId,
          threshold_percent: threshold,
          used_bytes: usedBytes,
          quota_bytes: quotaBytes,
        })

        if (error && !error.message.includes('duplicate')) {
          console.error('Failed to create storage alert:', error)
        }
      }

      // Only create highest threshold alert
      break
    }
  }
}

/**
 * Get unacknowledged storage alerts for a tenant
 */
export async function getUnacknowledgedAlerts(tenantId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('storage_alerts')
    .select('*')
    .eq('tenant_id', tenantId)
    .is('acknowledged_at', null)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Failed to fetch storage alerts:', error)
    return []
  }

  return data
}

/**
 * Acknowledge a storage alert
 */
export async function acknowledgeAlert(alertId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('storage_alerts')
    .update({ acknowledged_at: new Date().toISOString() })
    .eq('id', alertId)

  if (error) {
    throw new Error(`Failed to acknowledge alert: ${error.message}`)
  }
}
