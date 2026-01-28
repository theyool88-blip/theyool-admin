'use client'

/**
 * Storage Settings Page
 *
 * Manage tenant storage quota, usage, and purchase additional capacity.
 *
 * Design Philosophy:
 * - Industrial dashboard aesthetic with clear data visualization
 * - Monospaced numbers for technical precision
 * - Bold borders and stark contrasts
 * - Functional color coding: green (safe), amber (warning), red (critical)
 */

import { useState, useEffect } from 'react'
import { formatBytes } from '@/lib/formatBytes'
import {
  Database,
  TrendingUp,
  AlertTriangle,
  ShoppingCart,
  Info,
  Loader2,
  CheckCircle2,
  XCircle,
} from 'lucide-react'

// Note: Metadata should be in layout.tsx for Server Components
// Client components cannot export metadata

interface StorageData {
  quota_bytes: number
  extra_quota_bytes: number
  used_bytes: number
  file_count: number
  extra_quota_started_at: string | null
  extra_quota_expires_at: string | null
}

const EXTRA_QUOTA_UNIT = 30 * 1024 * 1024 * 1024 // 30GB
const EXTRA_QUOTA_PRICE = 30000 // 30,000원

export default function StorageSettingsPage() {
  const [storage, setStorage] = useState<StorageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [purchasing, setPurchasing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchStorage()
  }, [])

  async function fetchStorage() {
    try {
      const response = await fetch('/api/storage/quota')
      if (!response.ok) throw new Error('Failed to fetch storage data')
      const data = await response.json()
      setStorage(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  async function purchaseAdditionalStorage() {
    if (!storage) return

    setPurchasing(true)
    try {
      const response = await fetch('/api/storage/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: EXTRA_QUOTA_UNIT }),
      })

      if (!response.ok) throw new Error('Purchase failed')

      await fetchStorage()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Purchase failed')
    } finally {
      setPurchasing(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-neutral-900" />
          <p className="text-sm font-mono uppercase tracking-wider text-neutral-600">
            Loading Storage Data
          </p>
        </div>
      </div>
    )
  }

  if (error || !storage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 p-4">
        <div className="max-w-md w-full">
          <div className="bg-white border-4 border-red-600 p-8">
            <div className="flex items-start gap-4">
              <XCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-1" />
              <div>
                <h1 className="text-xl font-bold uppercase tracking-tight mb-2">
                  Error
                </h1>
                <p className="text-sm text-neutral-700 font-mono">
                  {error || 'Failed to load storage data'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const totalQuota = storage.quota_bytes + storage.extra_quota_bytes
  const usedPercent = (storage.used_bytes / totalQuota) * 100
  const isWarning = usedPercent > 80
  const isCritical = usedPercent > 95

  return (
    <div className="min-h-screen bg-neutral-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-neutral-900 text-white border-4 border-neutral-800 p-6">
          <div className="flex items-center gap-4">
            <Database className="w-8 h-8" />
            <div>
              <h1 className="text-3xl font-bold uppercase tracking-tight">
                Storage Management
              </h1>
              <p className="text-sm text-neutral-400 font-mono mt-1">
                Quota allocation and usage monitoring
              </p>
            </div>
          </div>
        </div>

        {/* Storage Dashboard - Full mode */}
        <div className="bg-white border-4 border-neutral-900 p-8">
          <div className="space-y-8">
            {/* Usage Overview */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold uppercase tracking-tight">
                  Usage Overview
                </h2>
                <div className="flex items-center gap-2">
                  {isCritical && (
                    <span className="inline-flex items-center gap-2 bg-red-600 text-white px-3 py-1 text-xs font-bold uppercase">
                      <AlertTriangle className="w-4 h-4" />
                      Critical
                    </span>
                  )}
                  {isWarning && !isCritical && (
                    <span className="inline-flex items-center gap-2 bg-amber-500 text-white px-3 py-1 text-xs font-bold uppercase">
                      <AlertTriangle className="w-4 h-4" />
                      Warning
                    </span>
                  )}
                </div>
              </div>

              {/* Progress bar */}
              <div className="relative h-16 bg-neutral-100 border-2 border-neutral-900">
                <div
                  className={`h-full transition-all duration-500 ${
                    isCritical
                      ? 'bg-red-600'
                      : isWarning
                      ? 'bg-amber-500'
                      : 'bg-green-600'
                  }`}
                  style={{ width: `${Math.min(usedPercent, 100)}%` }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl font-bold font-mono mix-blend-difference text-white">
                    {usedPercent.toFixed(1)}%
                  </span>
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-3 gap-4 mt-6">
                <div className="bg-neutral-900 text-white p-6">
                  <div className="text-xs uppercase tracking-wider text-neutral-400 mb-2">
                    Used
                  </div>
                  <div className="text-3xl font-bold font-mono">
                    {formatBytes(storage.used_bytes)}
                  </div>
                </div>

                <div className="bg-neutral-900 text-white p-6">
                  <div className="text-xs uppercase tracking-wider text-neutral-400 mb-2">
                    Total Quota
                  </div>
                  <div className="text-3xl font-bold font-mono">
                    {formatBytes(totalQuota)}
                  </div>
                </div>

                <div className="bg-neutral-900 text-white p-6">
                  <div className="text-xs uppercase tracking-wider text-neutral-400 mb-2">
                    Files
                  </div>
                  <div className="text-3xl font-bold font-mono">
                    {storage.file_count.toLocaleString()}
                  </div>
                </div>
              </div>
            </div>

            {/* Quota Breakdown */}
            <div className="border-t-4 border-neutral-900 pt-8">
              <h3 className="text-lg font-bold uppercase tracking-tight mb-4">
                Quota Breakdown
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-4 bg-neutral-50">
                  <div>
                    <div className="font-bold">Base Quota</div>
                    <div className="text-sm text-neutral-600 font-mono">
                      Default allocation for your plan
                    </div>
                  </div>
                  <div className="text-xl font-bold font-mono">
                    {formatBytes(storage.quota_bytes)}
                  </div>
                </div>

                {storage.extra_quota_bytes > 0 && (
                  <div className="flex items-center justify-between p-4 bg-green-50 border-2 border-green-600">
                    <div>
                      <div className="font-bold flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                        Additional Quota
                      </div>
                      <div className="text-sm text-neutral-600 font-mono">
                        {storage.extra_quota_expires_at &&
                          `Expires: ${new Date(
                            storage.extra_quota_expires_at
                          ).toLocaleDateString()}`}
                      </div>
                    </div>
                    <div className="text-xl font-bold font-mono text-green-600">
                      +{formatBytes(storage.extra_quota_bytes)}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Purchase Section */}
            <div className="border-t-4 border-neutral-900 pt-8">
              <div className="flex items-start gap-6">
                <div className="flex-1">
                  <h3 className="text-lg font-bold uppercase tracking-tight mb-2">
                    Purchase Additional Storage
                  </h3>
                  <p className="text-sm text-neutral-600 mb-4">
                    Expand your storage capacity with additional quota units.
                    Each unit provides 30GB of extra space.
                  </p>

                  <div className="bg-neutral-100 border-2 border-neutral-900 p-6 mb-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm uppercase tracking-wider text-neutral-600 mb-1">
                          Price per unit
                        </div>
                        <div className="text-3xl font-bold font-mono">
                          ₩{EXTRA_QUOTA_PRICE.toLocaleString()}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm uppercase tracking-wider text-neutral-600 mb-1">
                          Capacity
                        </div>
                        <div className="text-3xl font-bold font-mono">
                          30GB
                        </div>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={purchaseAdditionalStorage}
                    disabled={purchasing}
                    className="w-full bg-neutral-900 hover:bg-neutral-700 disabled:bg-neutral-400 text-white font-bold uppercase tracking-wider py-4 border-2 border-neutral-900 transition-colors flex items-center justify-center gap-3"
                  >
                    {purchasing ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Processing
                      </>
                    ) : (
                      <>
                        <ShoppingCart className="w-5 h-5" />
                        Purchase 30GB
                      </>
                    )}
                  </button>
                </div>

                <div className="w-80 bg-blue-50 border-2 border-blue-600 p-6">
                  <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm space-y-2">
                      <p className="font-bold text-blue-900">
                        Additional Quota Details
                      </p>
                      <ul className="space-y-1 text-blue-800">
                        <li>• Valid for 12 months from purchase</li>
                        <li>• Instant activation</li>
                        <li>• Stackable with existing quota</li>
                        <li>• Auto-renewal available</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* System Info */}
        <div className="bg-neutral-100 border-2 border-neutral-900 p-6">
          <div className="flex items-start gap-3">
            <TrendingUp className="w-5 h-5 text-neutral-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm font-mono text-neutral-700">
              <p className="font-bold mb-2">Storage System Information</p>
              <p>
                Files are stored in Cloudflare R2 with automatic redundancy and
                edge caching. Usage statistics are updated every 15 minutes.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
