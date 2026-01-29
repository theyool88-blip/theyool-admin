'use client'

import { useEffect, useState } from 'react'
import {
  HardDrive,
  AlertTriangle,
  TrendingUp,
  FileText,
  Image as ImageIcon,
  File,
  Sparkles,
  ArrowRight,
  Database,
  Zap,
} from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'

interface StorageDashboardProps {
  tenantId: string
  compact?: boolean
}

interface StorageUsage {
  usedBytes: number
  quotaBytes: number
  extraQuotaBytes: number
  totalQuotaBytes: number
  fileCount: number
  percentUsed: number
  byType: {
    documents: number
    images: number
    other: number
  }
}

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}

const formatBytesCompact = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

const getStorageColor = (percentUsed: number) => {
  if (percentUsed >= 95) return { main: '#DC2626', muted: '#FEE2E2', glow: 'rgba(220, 38, 38, 0.2)' }
  if (percentUsed >= 90) return { main: '#F59E0B', muted: '#FEF3C7', glow: 'rgba(245, 158, 11, 0.2)' }
  if (percentUsed >= 80) return { main: '#FBBF24', muted: '#FDE68A', glow: 'rgba(251, 191, 36, 0.2)' }
  return { main: '#6DB5A4', muted: '#E8F5F2', glow: 'rgba(109, 181, 164, 0.2)' }
}

export default function StorageDashboard({ tenantId, compact = false }: StorageDashboardProps) {
  const [storage, setStorage] = useState<StorageUsage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchStorage = async () => {
      try {
        const response = await fetch(`/api/storage/usage?tenantId=${tenantId}`)
        const result = await response.json()

        if (result.success) {
          setStorage(result.data)
        } else {
          setError(result.error || 'Failed to load storage data')
        }
      } catch (err) {
        console.error('Storage fetch error:', err)
        setError('Server error occurred')
      } finally {
        setLoading(false)
      }
    }

    fetchStorage()
  }, [tenantId])

  if (loading) {
    return (
      <div className={`${compact ? 'p-4' : 'p-6'} animate-pulse`}>
        <div className="h-4 bg-slate-200 rounded w-1/2 mb-3" />
        <div className="h-8 bg-slate-200 rounded" />
      </div>
    )
  }

  if (error || !storage) {
    return (
      <div className={`${compact ? 'p-4' : 'p-6'} border border-danger-200 bg-danger-50 rounded-lg`}>
        <p className="text-sm text-danger-700">{error || 'No data available'}</p>
      </div>
    )
  }

  const colors = getStorageColor(storage.percentUsed)
  const isWarning = storage.percentUsed >= 80
  const isCritical = storage.percentUsed >= 90

  // Prepare chart data
  const chartData = [
    { name: 'Documents', value: storage.byType.documents, color: '#3B82F6' },
    { name: 'Images', value: storage.byType.images, color: '#8B5CF6' },
    { name: 'Other', value: storage.byType.other, color: '#EC4899' },
  ].filter(item => item.value > 0)

  // COMPACT MODE
  if (compact) {
    return (
      <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-all duration-300">
        {/* Ambient glow effect */}
        <div
          className="absolute -top-20 -right-20 w-40 h-40 rounded-full blur-3xl opacity-30 pointer-events-none"
          style={{ backgroundColor: colors.main }}
        />

        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: colors.muted }}
              >
                <Database className="w-5 h-5" style={{ color: colors.main }} />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-900 uppercase tracking-wide">Storage</p>
                <p className="text-[10px] text-slate-500">{storage.fileCount.toLocaleString()} files</p>
              </div>
            </div>

            {isCritical && (
              <div className="animate-pulse">
                <AlertTriangle className="w-5 h-5 text-danger-500" />
              </div>
            )}
          </div>

          {/* Progress bar */}
          <div className="relative h-3 bg-slate-100 rounded-full overflow-hidden mb-3">
            <div
              className="absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${Math.min(storage.percentUsed, 100)}%`,
                background: `linear-gradient(90deg, ${colors.main}, ${colors.main}dd)`,
                boxShadow: `0 0 12px ${colors.glow}`,
              }}
            />
            {/* Shimmer effect */}
            <div
              className="absolute inset-y-0 left-0 w-full opacity-40 animate-pulse"
              style={{
                width: `${Math.min(storage.percentUsed, 100)}%`,
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)',
              }}
            />
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-slate-900">
              {formatBytesCompact(storage.usedBytes)}
              <span className="text-xs font-normal text-slate-500 ml-1">
                of {formatBytesCompact(storage.totalQuotaBytes)}
              </span>
            </p>
            <p
              className="text-xs font-bold tabular-nums"
              style={{ color: colors.main }}
            >
              {storage.percentUsed.toFixed(1)}%
            </p>
          </div>

          {isWarning && (
            <a
              href="#upgrade"
              className="mt-3 flex items-center gap-1.5 text-xs font-medium hover:gap-2 transition-all duration-200"
              style={{ color: colors.main }}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Upgrade storage
              <ArrowRight className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>
    )
  }

  // FULL MODE
  return (
    <div className="space-y-6">
      {/* Warning Banner */}
      {isCritical && (
        <div
          className="relative overflow-hidden rounded-2xl p-6 border-2 animate-fade-in"
          style={{
            borderColor: colors.main,
            backgroundColor: colors.muted,
          }}
        >
          <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl opacity-20 pointer-events-none"
               style={{ backgroundColor: colors.main }} />

          <div className="relative z-10 flex items-start gap-4">
            <div className="p-3 rounded-xl bg-white/80 backdrop-blur-sm animate-pulse">
              <AlertTriangle className="w-7 h-7" style={{ color: colors.main }} />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-slate-900 mb-1">
                Storage {storage.percentUsed >= 95 ? 'Almost Full' : 'Running Low'}
              </h3>
              <p className="text-sm text-slate-700 mb-4">
                You&apos;re using {storage.percentUsed.toFixed(1)}% of your storage quota.
                {storage.percentUsed >= 95
                  ? ' Consider upgrading to avoid service disruption.'
                  : ' Upgrade now to add more space.'}
              </p>
              <button
                className="px-5 py-2.5 rounded-xl font-semibold text-white text-sm shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 flex items-center gap-2"
                style={{
                  backgroundColor: colors.main,
                  boxShadow: `0 4px 20px ${colors.glow}`,
                }}
              >
                <Zap className="w-4 h-4" />
                Upgrade Plan
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Storage Card */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
        {/* Background decoration */}
        <div className="absolute inset-0 opacity-30 pointer-events-none">
          <div
            className="absolute -top-32 -right-32 w-64 h-64 rounded-full blur-3xl"
            style={{ backgroundColor: colors.main }}
          />
          <div className="absolute -bottom-20 -left-20 w-48 h-48 rounded-full bg-slate-200 blur-2xl" />
        </div>

        <div className="relative z-10 p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-md"
                style={{
                  backgroundColor: colors.muted,
                  boxShadow: `0 4px 20px ${colors.glow}`,
                }}
              >
                <HardDrive className="w-7 h-7" style={{ color: colors.main }} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Storage Usage</h2>
                <p className="text-sm text-slate-600 mt-0.5">
                  {storage.fileCount.toLocaleString()} files across all types
                </p>
              </div>
            </div>
          </div>

          {/* Main Progress */}
          <div className="mb-8">
            <div className="flex items-baseline justify-between mb-3">
              <div>
                <span className="text-4xl font-bold text-slate-900 tabular-nums">
                  {formatBytes(storage.usedBytes).split(' ')[0]}
                </span>
                <span className="text-xl font-semibold text-slate-500 ml-2">
                  {formatBytes(storage.usedBytes).split(' ')[1]}
                </span>
                <span className="text-sm text-slate-500 mx-3">of</span>
                <span className="text-2xl font-semibold text-slate-700">
                  {formatBytes(storage.totalQuotaBytes)}
                </span>
              </div>
              <div
                className="text-3xl font-bold tabular-nums"
                style={{ color: colors.main }}
              >
                {storage.percentUsed.toFixed(1)}%
              </div>
            </div>

            {/* Enhanced Progress Bar */}
            <div className="relative h-6 bg-slate-100 rounded-full overflow-hidden shadow-inner">
              {/* Main fill */}
              <div
                className="absolute inset-y-0 left-0 rounded-full transition-all duration-1000 ease-out"
                style={{
                  width: `${Math.min(storage.percentUsed, 100)}%`,
                  background: `linear-gradient(90deg, ${colors.main}, ${colors.main}dd)`,
                  boxShadow: `0 0 20px ${colors.glow}`,
                }}
              />

              {/* Animated shimmer */}
              <div
                className="absolute inset-y-0 left-0 rounded-full opacity-50"
                style={{
                  width: `${Math.min(storage.percentUsed, 100)}%`,
                  background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
                  animation: 'shimmer 2s infinite',
                }}
              />

              {/* Milestone markers */}
              {[25, 50, 75].map(milestone => (
                <div
                  key={milestone}
                  className="absolute top-0 bottom-0 w-px bg-white/30"
                  style={{ left: `${milestone}%` }}
                />
              ))}
            </div>

            {storage.extraQuotaBytes > 0 && (
              <p className="text-xs text-slate-600 mt-2 flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5 text-success-500" />
                Includes {formatBytes(storage.extraQuotaBytes)} additional storage
              </p>
            )}
          </div>

          {/* Breakdown Section */}
          <div className="grid grid-cols-2 gap-6">
            {/* File Type Distribution - Pie Chart */}
            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-4">
                Storage by Type
              </h3>

              {chartData.length > 0 ? (
                <div className="relative">
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={75}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {chartData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.color}
                            stroke="white"
                            strokeWidth={2}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => formatBytes(value)}
                        contentStyle={{
                          backgroundColor: 'rgba(255, 255, 255, 0.95)',
                          border: 'none',
                          borderRadius: '12px',
                          boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                          padding: '8px 12px',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>

                  {/* Legend */}
                  <div className="space-y-2 mt-4">
                    {chartData.map((item, index) => (
                      <div key={index} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="text-slate-700 font-medium">{item.name}</span>
                        </div>
                        <span className="text-slate-900 font-semibold tabular-nums">
                          {formatBytesCompact(item.value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="h-40 flex items-center justify-center text-slate-400">
                  <p className="text-sm">No files yet</p>
                </div>
              )}
            </div>

            {/* File Type Cards */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-4">
                File Details
              </h3>

              {/* Documents */}
              <div className="group bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-xl p-4 border border-blue-200/50 hover:border-blue-300 hover:shadow-md transition-all duration-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-200">
                      <FileText className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-blue-900 uppercase tracking-wide">
                        Documents
                      </p>
                      <p className="text-lg font-bold text-blue-700 tabular-nums">
                        {formatBytesCompact(storage.byType.documents)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Images */}
              <div className="group bg-gradient-to-br from-purple-50 to-purple-100/50 rounded-xl p-4 border border-purple-200/50 hover:border-purple-300 hover:shadow-md transition-all duration-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-500 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-200">
                      <ImageIcon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-purple-900 uppercase tracking-wide">
                        Images
                      </p>
                      <p className="text-lg font-bold text-purple-700 tabular-nums">
                        {formatBytesCompact(storage.byType.images)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Other */}
              <div className="group bg-gradient-to-br from-pink-50 to-pink-100/50 rounded-xl p-4 border border-pink-200/50 hover:border-pink-300 hover:shadow-md transition-all duration-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-pink-500 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-200">
                      <File className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-pink-900 uppercase tracking-wide">
                        Other Files
                      </p>
                      <p className="text-lg font-bold text-pink-700 tabular-nums">
                        {formatBytesCompact(storage.byType.other)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* CTA Section */}
          {!isCritical && (
            <div className="mt-8 p-6 rounded-2xl bg-gradient-to-br from-sage-50 to-sage-100/50 border border-sage-200">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-sage-900 mb-1 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-sage-600" />
                    Need More Space?
                  </h3>
                  <p className="text-sm text-sage-700 mb-4">
                    Upgrade your storage plan to get more space for your documents and files.
                    Starting from just $5/month for 50GB.
                  </p>
                  <button className="px-6 py-3 bg-sage-600 hover:bg-sage-700 text-white font-semibold rounded-xl shadow-md hover:shadow-lg hover:scale-105 transition-all duration-200 flex items-center gap-2">
                    View Plans
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
      `}</style>
    </div>
  )
}
