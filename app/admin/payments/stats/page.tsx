'use client'

import { useState, useEffect } from 'react'
import type { PaymentDashboardStats } from '@/types/payment'
import { formatCurrency } from '@/types/payment'

export default function PaymentStatsPage() {
  const [stats, setStats] = useState<PaymentDashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [])

  async function fetchStats() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/payments/stats')
      const json = await res.json()
      if (json.data) {
        setStats(json.data)
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)]">
        <div className="flex items-center justify-center pt-32">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-[var(--border-default)] border-t-[var(--text-secondary)]"></div>
        </div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)]">
        <div className="max-w-5xl mx-auto pt-6 pb-8 px-4">
          <div className="text-center py-12 text-[var(--text-tertiary)] text-sm">통계 데이터를 불러올 수 없습니다.</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <div className="max-w-5xl mx-auto pt-6 pb-8 px-4">
        {/* Summary */}
        <div className="flex flex-wrap items-center gap-4 mb-5 text-sm">
          <div>
            <span className="text-[var(--text-tertiary)]">총 입금액</span>
            <span className="ml-2 text-lg font-medium text-[var(--text-primary)]">{formatCurrency(stats.total_amount)}</span>
          </div>
          <div className="text-[var(--border-default)]">|</div>
          <div className="text-[var(--text-tertiary)]">
            {stats.total_count.toLocaleString()}건
          </div>
          <div className="text-[var(--border-default)]">|</div>
          <div>
            <span className="text-[var(--text-tertiary)]">이번 달</span>
            <span className="ml-2 font-medium text-[var(--text-primary)]">{formatCurrency(stats.this_month_amount)}</span>
            {stats.month_growth_rate !== 0 && (
              <span className={`ml-1 text-xs ${stats.month_growth_rate > 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
                {stats.month_growth_rate > 0 ? '+' : ''}{stats.month_growth_rate}%
              </span>
            )}
          </div>
        </div>

        {/* Category Stats */}
        <div className="card mb-4">
          <div className="px-4 py-3 border-b border-[var(--border-subtle)]">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">명목별 통계</h2>
          </div>
          {!stats.by_category?.length ? (
            <div className="py-8 text-center text-[var(--text-muted)] text-sm">데이터 없음</div>
          ) : (
            <div className="divide-y divide-[var(--border-subtle)]">
              {stats.by_category.map((cat) => (
                <div key={cat.payment_category} className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium text-[var(--text-primary)]">{cat.payment_category}</span>
                      <span className="ml-2 text-xs text-[var(--text-muted)]">{cat.payment_count}건</span>
                    </div>
                    <span className="text-sm font-medium text-[var(--text-primary)]">{formatCurrency(cat.total_amount)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Monthly Trend */}
        <div className="card mb-4">
          <div className="px-4 py-3 border-b border-[var(--border-subtle)]">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">월별 추세 (최근 12개월)</h2>
          </div>
          {!stats.by_month?.length ? (
            <div className="py-8 text-center text-[var(--text-muted)] text-sm">월별 데이터 없음</div>
          ) : (
            <div className="p-4">
              <div className="space-y-2">
                {Object.entries(
                  stats.by_month.reduce((acc, item) => {
                    if (!acc[item.month]) {
                      acc[item.month] = { total: 0, count: 0, items: [] }
                    }
                    acc[item.month].total += parseInt(item.total_amount.toString())
                    acc[item.month].count += item.payment_count
                    acc[item.month].items.push(item)
                    return acc
                  }, {} as Record<string, { total: number; count: number; items: typeof stats.by_month }>)
                )
                  .sort((a, b) => b[0].localeCompare(a[0]))
                  .slice(0, 12)
                  .map(([month, data]) => {
                    const maxTotal = Math.max(
                      ...Object.values(
                        stats.by_month!.reduce((acc, item) => {
                          acc[item.month] = (acc[item.month] || 0) + parseInt(item.total_amount.toString())
                          return acc
                        }, {} as Record<string, number>)
                      )
                    )
                    return (
                      <div key={month} className="flex items-center gap-3">
                        <div className="w-20 text-xs text-[var(--text-tertiary)]">
                          {(() => {
                            const d = new Date(month)
                            return `${String(d.getFullYear()).slice(2)}.${String(d.getMonth() + 1).padStart(2, '0')}`
                          })()}
                        </div>
                        <div className="flex-1">
                          <div className="w-full bg-[var(--bg-tertiary)] rounded-full h-4">
                            <div
                              className="bg-[var(--sage-primary)] h-4 rounded-full"
                              style={{ width: `${(data.total / maxTotal) * 100}%` }}
                            />
                          </div>
                        </div>
                        <div className="w-28 text-right">
                          <span className="text-xs font-medium text-[var(--text-primary)]">{formatCurrency(data.total)}</span>
                          <span className="text-[10px] text-[var(--text-muted)] ml-1">({data.count}건)</span>
                        </div>
                      </div>
                    )
                  })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
