import { createAdminClient } from '@/lib/supabase/admin'

export type ScourtSyncSettings = {
  autoSyncEnabled: boolean
  progressIntervalHours: number
  progressJitterMinutes: number
  generalBackoffHours: number
  schedulerBatchSize: number
  workerBatchSize: number
  workerConcurrency: number
  requestJitterMs: {
    min: number
    max: number
  }
  rateLimitPerMinute: number | null
  autoCooldownMinutes: number
  manualCooldownMinutes: number
  activeCaseRule: {
    statusAllowList: string[]
    statusBlockList: string[]
    excludeFinalResult: boolean
    requireLinked: boolean
  }
  wmonid: {
    autoRotateEnabled: boolean
    renewalBeforeDays: number
    earlyRotateEnabled: boolean
  }
}

export const DEFAULT_SCOURT_SYNC_SETTINGS: ScourtSyncSettings = {
  autoSyncEnabled: true,
  progressIntervalHours: 6,
  progressJitterMinutes: 15,
  generalBackoffHours: 24,
  schedulerBatchSize: 300,
  workerBatchSize: 20,
  workerConcurrency: 4,
  requestJitterMs: {
    min: 600,
    max: 1800,
  },
  rateLimitPerMinute: 40,
  autoCooldownMinutes: 10,
  manualCooldownMinutes: 30,
  activeCaseRule: {
    statusAllowList: ['진행중', '진행', 'active'],
    statusBlockList: ['종결', '종국', '확정', '종료', '완료'],
    excludeFinalResult: true,
    requireLinked: true,
  },
  wmonid: {
    autoRotateEnabled: true,
    renewalBeforeDays: 45,
    earlyRotateEnabled: true,
  },
}

const SETTINGS_KEY = 'scourt_sync_settings'

function mergeSettings(
  base: ScourtSyncSettings,
  override: Partial<ScourtSyncSettings>
): ScourtSyncSettings {
  return {
    ...base,
    ...override,
    requestJitterMs: {
      ...base.requestJitterMs,
      ...override.requestJitterMs,
    },
    activeCaseRule: {
      ...base.activeCaseRule,
      ...override.activeCaseRule,
    },
    wmonid: {
      ...base.wmonid,
      ...override.wmonid,
    },
  }
}

export async function getScourtSyncSettings(): Promise<ScourtSyncSettings> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', SETTINGS_KEY)
    .single()

  if (error || !data?.value) {
    return DEFAULT_SCOURT_SYNC_SETTINGS
  }

  try {
    const parsed = JSON.parse(data.value) as Partial<ScourtSyncSettings>
    return mergeSettings(DEFAULT_SCOURT_SYNC_SETTINGS, parsed)
  } catch (parseError) {
    console.warn('SCOURT sync settings parse error:', parseError)
    return DEFAULT_SCOURT_SYNC_SETTINGS
  }
}

export async function updateScourtSyncSettings(
  updates: Partial<ScourtSyncSettings>
): Promise<ScourtSyncSettings> {
  const supabase = createAdminClient()
  const current = await getScourtSyncSettings()
  const merged = mergeSettings(current, updates)

  const { error } = await supabase
    .from('app_settings')
    .upsert(
      {
        key: SETTINGS_KEY,
        value: JSON.stringify(merged),
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'key',
      }
    )

  if (error) {
    throw new Error(`SCOURT sync settings update failed: ${error.message}`)
  }

  return merged
}
