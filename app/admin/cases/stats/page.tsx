'use client'

import { useEffect, useState } from 'react'
import { formatCurrency } from '@/types/payment'

interface CasesStats {
  total: number
  byStatus: {
    active: number
    completed: number
    suspended: number
  }
  byOffice: {
    pyeongtaek: number
    cheonan: number
  }
  byCategory: Array<{
    category: string
    count: number
  }>
  monthlyTrend: Array<{
    month: string
    total: number
    completed: number
  }>
  averageDuration: string
  totalRevenue: number
  averageRevenuePerCase: number
  byLawyer: Array<{
    lawyer: string
    active: number
    completed: number
    suspended: number
    totalRevenue: number
    avgRevenue: number
    avgDuration: string
  }>
}

export default function CasesStatsPage() {
  const [stats, setStats] = useState<CasesStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [])

  async function fetchStats() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/cases/stats')
      const json = await res.json()
      if (json.success) {
        setStats(json.data)
      }
    } catch (error) {
      console.error('Failed to fetch cases stats:', error)
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
            <span className="text-[var(--text-tertiary)]">총 사건</span>
            <span className="ml-2 text-lg font-bold text-[var(--text-primary)]">{stats.total}건</span>
          </div>
          <div className="text-[var(--border-default)]">|</div>
          <div>
            <span className="text-[var(--text-tertiary)]">진행중</span>
            <span className="ml-2 font-semibold text-purple-600">{stats.byStatus.active}건</span>
          </div>
          <div className="text-[var(--border-default)]">|</div>
          <div>
            <span className="text-[var(--text-tertiary)]">평균 소요</span>
            <span className="ml-2 font-medium text-[var(--text-secondary)]">{stats.averageDuration}</span>
          </div>
          <div className="text-[var(--border-default)]">|</div>
          <div>
            <span className="text-[var(--text-tertiary)]">총 매출</span>
            <span className="ml-2 font-medium text-[var(--text-primary)]">{formatCurrency(stats.totalRevenue)}</span>
          </div>
        </div>

        {/* Status & Office Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          {/* Status */}
          <div className="card p-4">
            <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3">사건 현황</h2>
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-[var(--text-secondary)]">진행중</span>
                  <span className="text-sm font-semibold text-purple-600">{stats.byStatus.active}건</span>
                </div>
                <div className="w-full bg-[var(--bg-tertiary)] rounded-full h-2.5">
                  <div
                    className="bg-purple-500 h-2.5 rounded-full"
                    style={{ width: `${(stats.byStatus.active / stats.total) * 100}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-[var(--text-secondary)]">완료</span>
                  <span className="text-sm font-semibold text-[var(--color-success)]">{stats.byStatus.completed}건</span>
                </div>
                <div className="w-full bg-[var(--bg-tertiary)] rounded-full h-2.5">
                  <div
                    className="bg-[var(--color-success)] h-2.5 rounded-full"
                    style={{ width: `${(stats.byStatus.completed / stats.total) * 100}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-[var(--text-secondary)]">중단</span>
                  <span className="text-sm font-semibold text-[var(--text-tertiary)]">{stats.byStatus.suspended}건</span>
                </div>
                <div className="w-full bg-[var(--bg-tertiary)] rounded-full h-2.5">
                  <div
                    className="bg-[var(--text-muted)] h-2.5 rounded-full"
                    style={{ width: `${(stats.byStatus.suspended / stats.total) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Office */}
          <div className="card p-4">
            <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3">사무소별 분포</h2>
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-[var(--text-secondary)]">평택</span>
                  <div className="text-right">
                    <span className="text-sm font-semibold text-[var(--sage-primary)]">{stats.byOffice.pyeongtaek}건</span>
                    <span className="text-xs text-[var(--text-muted)] ml-1">
                      ({((stats.byOffice.pyeongtaek / stats.total) * 100).toFixed(0)}%)
                    </span>
                  </div>
                </div>
                <div className="w-full bg-[var(--bg-tertiary)] rounded-full h-3">
                  <div
                    className="bg-[var(--sage-primary)] h-3 rounded-full"
                    style={{ width: `${(stats.byOffice.pyeongtaek / stats.total) * 100}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-[var(--text-secondary)]">천안</span>
                  <div className="text-right">
                    <span className="text-sm font-semibold text-indigo-600">{stats.byOffice.cheonan}건</span>
                    <span className="text-xs text-[var(--text-muted)] ml-1">
                      ({((stats.byOffice.cheonan / stats.total) * 100).toFixed(0)}%)
                    </span>
                  </div>
                </div>
                <div className="w-full bg-[var(--bg-tertiary)] rounded-full h-3">
                  <div
                    className="bg-indigo-500 h-3 rounded-full"
                    style={{ width: `${(stats.byOffice.cheonan / stats.total) * 100}%` }}
                  />
                </div>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-[var(--border-subtle)]">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--text-tertiary)]">사건당 평균 매출</span>
                <span className="font-medium text-[var(--text-primary)]">{formatCurrency(stats.averageRevenuePerCase)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Lawyer Performance */}
        <div className="card mb-4">
          <div className="px-4 py-3 border-b border-[var(--border-subtle)]">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">변호사별 성과</h2>
          </div>
          {!stats.byLawyer?.length ? (
            <div className="py-8 text-center text-[var(--text-muted)] text-sm">데이터 없음</div>
          ) : (
            <div className="divide-y divide-[var(--border-subtle)]">
              {stats.byLawyer.map((lawyer, index) => {
                const totalCases = lawyer.active + lawyer.completed + lawyer.suspended
                const maxActiveCases = Math.max(...stats.byLawyer.map(l => l.active))
                const isOverloaded = lawyer.active >= 15

                return (
                  <div key={index} className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-[var(--text-primary)]">{lawyer.lawyer} 변호사</span>
                        <span className="text-xs text-[var(--text-muted)]">총 {totalCases}건</span>
                        {isOverloaded && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-[var(--color-danger-muted)] text-[var(--color-danger)] rounded">과부하</span>
                        )}
                      </div>
                      <span className="text-sm font-medium text-[var(--text-primary)]">{formatCurrency(lawyer.totalRevenue)}</span>
                    </div>

                    <div className="grid grid-cols-4 gap-3 mb-3">
                      <div className="text-center">
                        <div className="text-[10px] text-[var(--text-tertiary)]">진행중</div>
                        <div className={`text-sm font-semibold ${lawyer.active === maxActiveCases ? 'text-purple-600' : 'text-purple-400'}`}>
                          {lawyer.active}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-[10px] text-[var(--text-tertiary)]">완료</div>
                        <div className="text-sm font-semibold text-[var(--color-success)]">{lawyer.completed}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-[10px] text-[var(--text-tertiary)]">평균 처리</div>
                        <div className="text-sm font-semibold text-[var(--text-secondary)]">{lawyer.avgDuration}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-[10px] text-[var(--text-tertiary)]">건당 매출</div>
                        <div className="text-sm font-medium text-[var(--text-primary)]">{formatCurrency(lawyer.avgRevenue)}</div>
                      </div>
                    </div>

                    <div className="flex gap-1">
                      <div
                        className="bg-purple-500 h-1.5 rounded-full"
                        style={{ width: `${(lawyer.active / totalCases) * 100}%` }}
                        title={`진행중 ${lawyer.active}건`}
                      />
                      <div
                        className="bg-[var(--color-success)] h-1.5 rounded-full"
                        style={{ width: `${(lawyer.completed / totalCases) * 100}%` }}
                        title={`완료 ${lawyer.completed}건`}
                      />
                      <div
                        className="bg-[var(--border-default)] h-1.5 rounded-full"
                        style={{ width: `${(lawyer.suspended / totalCases) * 100}%` }}
                        title={`중단 ${lawyer.suspended}건`}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Case Categories */}
        <div className="card mb-4">
          <div className="px-4 py-3 border-b border-[var(--border-subtle)]">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">사건 유형별 분포</h2>
          </div>
          {!stats.byCategory?.length ? (
            <div className="py-8 text-center text-[var(--text-muted)] text-sm">데이터 없음</div>
          ) : (
            <div className="p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {stats.byCategory.map((cat, index) => (
                  <div key={index} className="bg-[var(--bg-primary)] rounded-lg p-3 text-center">
                    <div className="text-xs text-[var(--text-tertiary)] mb-1">{cat.category}</div>
                    <div className="text-lg font-bold text-[var(--text-primary)]">{cat.count}</div>
                    <div className="text-[10px] text-[var(--text-muted)]">
                      {((cat.count / stats.total) * 100).toFixed(1)}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Monthly Trend */}
        <div className="card">
          <div className="px-4 py-3 border-b border-[var(--border-subtle)]">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">월별 추이 (최근 6개월)</h2>
          </div>
          {!stats.monthlyTrend?.length ? (
            <div className="py-8 text-center text-[var(--text-muted)] text-sm">데이터 없음</div>
          ) : (
            <div className="p-4">
              <div className="space-y-2">
                {stats.monthlyTrend.map((month, index) => {
                  const maxTotal = Math.max(...stats.monthlyTrend.map(m => m.total))
                  return (
                    <div key={index} className="flex items-center gap-3">
                      <div className="w-16 text-xs text-[var(--text-tertiary)]">{month.month}</div>
                      <div className="flex-1">
                        <div className="w-full bg-[var(--bg-tertiary)] rounded-full h-4 relative overflow-hidden">
                          <div
                            className="bg-purple-200 h-4 rounded-full absolute"
                            style={{ width: `${(month.total / maxTotal) * 100}%` }}
                          />
                          <div
                            className="bg-[var(--color-success)] h-4 rounded-full absolute"
                            style={{ width: `${(month.completed / maxTotal) * 100}%` }}
                          />
                        </div>
                      </div>
                      <div className="w-28 text-right">
                        <span className="text-xs text-[var(--text-tertiary)]">{month.total}건</span>
                        <span className="text-xs text-[var(--color-success)] ml-1">({month.completed} 완료)</span>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="mt-3 flex items-center justify-end gap-3 text-xs text-[var(--text-tertiary)]">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-purple-200 rounded"></div>
                  <span>전체</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-[var(--color-success)] rounded"></div>
                  <span>완료</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
