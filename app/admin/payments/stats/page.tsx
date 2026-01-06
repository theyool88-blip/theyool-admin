'use client'

import { useState, useEffect } from 'react'
import AdminHeader from '@/components/AdminHeader'
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
      <div className="min-h-screen bg-gray-50">
        <AdminHeader title="입금 통계" />
        <div className="flex items-center justify-center pt-32">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-gray-600"></div>
        </div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AdminHeader title="입금 통계" />
        <div className="max-w-5xl mx-auto pt-20 pb-8 px-4">
          <div className="text-center py-12 text-gray-500 text-sm">통계 데이터를 불러올 수 없습니다.</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader title="입금 통계" />

      <div className="max-w-5xl mx-auto pt-20 pb-8 px-4">
        {/* Summary */}
        <div className="flex flex-wrap items-center gap-4 mb-5 text-sm">
          <div>
            <span className="text-gray-500">총 입금액</span>
            <span className="ml-2 text-lg font-bold text-sage-600">{formatCurrency(stats.total_amount)}</span>
          </div>
          <div className="text-gray-300">|</div>
          <div className="text-gray-500">
            {stats.total_count.toLocaleString()}건
          </div>
          <div className="text-gray-300">|</div>
          <div>
            <span className="text-gray-500">이번 달</span>
            <span className="ml-2 font-semibold text-gray-900">{formatCurrency(stats.this_month_amount)}</span>
            {stats.month_growth_rate !== 0 && (
              <span className={`ml-1 text-xs ${stats.month_growth_rate > 0 ? 'text-green-600' : 'text-red-500'}`}>
                {stats.month_growth_rate > 0 ? '+' : ''}{stats.month_growth_rate}%
              </span>
            )}
          </div>
        </div>

        {/* Category Stats */}
        <div className="bg-white rounded-lg border border-gray-200 mb-4">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">명목별 통계</h2>
          </div>
          {!stats.by_category?.length ? (
            <div className="py-8 text-center text-gray-400 text-sm">데이터 없음</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {stats.by_category.map((cat) => (
                <div key={cat.payment_category} className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium text-gray-900">{cat.payment_category}</span>
                      <span className="ml-2 text-xs text-gray-400">{cat.payment_count}건</span>
                    </div>
                    <span className="text-sm font-bold text-gray-900">{formatCurrency(cat.total_amount)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Monthly Trend */}
        <div className="bg-white rounded-lg border border-gray-200 mb-4">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">월별 추세 (최근 12개월)</h2>
          </div>
          {!stats.by_month?.length ? (
            <div className="py-8 text-center text-gray-400 text-sm">월별 데이터 없음</div>
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
                        <div className="w-20 text-xs text-gray-500">
                          {(() => {
                            const d = new Date(month)
                            return `${String(d.getFullYear()).slice(2)}.${String(d.getMonth() + 1).padStart(2, '0')}`
                          })()}
                        </div>
                        <div className="flex-1">
                          <div className="w-full bg-gray-100 rounded-full h-4">
                            <div
                              className="bg-sage-500 h-4 rounded-full"
                              style={{ width: `${(data.total / maxTotal) * 100}%` }}
                            />
                          </div>
                        </div>
                        <div className="w-28 text-right">
                          <span className="text-xs font-medium text-gray-900">{formatCurrency(data.total)}</span>
                          <span className="text-[10px] text-gray-400 ml-1">({data.count}건)</span>
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
