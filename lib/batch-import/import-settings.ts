/**
 * Batch Import Settings
 *
 * Configuration for the batch import worker
 */

import { createAdminClient } from '@/lib/supabase/admin'

export interface BatchImportSettings {
  // Worker settings
  workerBatchSize: number       // Jobs to dequeue per run
  workerConcurrency: number     // Parallel job processing
  maxRetries: number            // Max attempts before permanent failure

  // Rate limiting
  rateLimitPerMinute: number    // SCOURT API calls per minute
  requestDelayMs: number        // Base delay between requests
  requestJitterMs: {            // Random jitter added to delay
    min: number
    max: number
  }

  // Backoff
  backoffBaseMs: number         // Base backoff on failure
  backoffMaxMs: number          // Max backoff time
}

export const DEFAULT_BATCH_IMPORT_SETTINGS: BatchImportSettings = {
  workerBatchSize: 10,
  workerConcurrency: 2,
  maxRetries: 3,

  rateLimitPerMinute: 30,
  requestDelayMs: 300,
  requestJitterMs: {
    min: 100,
    max: 500,
  },

  backoffBaseMs: 60000,         // 1 minute
  backoffMaxMs: 1800000,        // 30 minutes
}

const SETTINGS_KEY = 'batch_import_settings'

function mergeSettings(
  base: BatchImportSettings,
  override: Partial<BatchImportSettings>
): BatchImportSettings {
  return {
    ...base,
    ...override,
    requestJitterMs: {
      ...base.requestJitterMs,
      ...override.requestJitterMs,
    },
  }
}

export async function getBatchImportSettings(): Promise<BatchImportSettings> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', SETTINGS_KEY)
    .single()

  if (error || !data?.value) {
    return DEFAULT_BATCH_IMPORT_SETTINGS
  }

  try {
    const parsed = JSON.parse(data.value) as Partial<BatchImportSettings>
    return mergeSettings(DEFAULT_BATCH_IMPORT_SETTINGS, parsed)
  } catch (parseError) {
    console.warn('[BatchImport] Settings parse error:', parseError)
    return DEFAULT_BATCH_IMPORT_SETTINGS
  }
}

export async function updateBatchImportSettings(
  updates: Partial<BatchImportSettings>
): Promise<BatchImportSettings> {
  const supabase = createAdminClient()
  const current = await getBatchImportSettings()
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
    throw new Error(`Batch import settings update failed: ${error.message}`)
  }

  return merged
}
