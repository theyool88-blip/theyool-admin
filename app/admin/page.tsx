'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { PriorityCasesWidget, UpcomingEventsWidget, RiskAlertsWidget } from '@/components/planning'

interface DashboardStats {
  consultations: {
    total: number
    thisMonth: number
    pending: number
    contacted: number
    confirmed: number
    retained: number
    conversionRate: string
  }
  revenue: {
    total: number
    thisMonth: number
    lastMonth: number
    changePercent: string
  }
  cases: {
    total: number
    active: number
    completed: number
    thisMonth: number
  }
  expenses?: {
    thisMonth: number
    lastMonth: number
  }
  actionItems: {
    pendingConsultations: number
    upcomingHearings: number
    upcomingDeadlines: number
  }
}

interface FinancialSummary {
  revenue: {
    confirmed: number
    pending: number
    total: number
  }
  expenses: {
    total: number
  }
  netProfit: number
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
    maximumFractionDigits: 0
  }).format(amount)
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [financial, setFinancial] = useState<FinancialSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7))

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [dashRes, finRes] = await Promise.all([
        fetch('/api/admin/dashboard'),
        fetch(`/api/admin/financial/dashboard?month=${selectedMonth}`)
      ])
      const [dashData, finData] = await Promise.all([
        dashRes.json(),
        finRes.json()
      ])
      if (dashData.success) setStats(dashData.data)
      if (finData.success) {
        setFinancial({
          revenue: {
            confirmed: finData.data.revenue.confirmed,
            pending: finData.data.revenue.pending,
            total: finData.data.revenue.total
          },
          expenses: { total: finData.data.summary.totalExpenses },
          netProfit: finData.data.summary.netProfit
        })
      }
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err)
    } finally {
      setLoading(false)
    }
  }, [selectedMonth])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const shiftMonth = (delta: number) => {
    const [y, m] = selectedMonth.split('-').map(Number)
    const total = y * 12 + (m - 1) + delta
    const newYear = Math.floor(total / 12)
    const newMonth = (total % 12) + 1
    setSelectedMonth(`${newYear}-${newMonth.toString().padStart(2, '0')}`)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)]">
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-[var(--border-default)] border-t-[var(--sage-primary)]"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <div className="max-w-5xl mx-auto pt-6 pb-8 px-4">
        {/* Month Selector */}
        <div className="flex items-center gap-3 mb-5">
          <button
            onClick={() => shiftMonth(-1)}
            className="btn btn-secondary"
          >
            이전
          </button>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="form-input"
            style={{ colorScheme: 'light' }}
          />
          <button
            onClick={() => shiftMonth(1)}
            className="btn btn-secondary"
          >
            다음
          </button>
        </div>

        {/* Summary Cards */}
        {stats && financial && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            {/* Revenue Card */}
            <div className="card p-4">
              <p className="text-caption mb-1">매출</p>
              <p className="text-base font-medium text-[var(--text-primary)]">{formatCurrency(financial.revenue.total)}</p>
              <div className="mt-2 space-y-0.5">
                <p className="text-caption">
                  확인 <span className="font-medium text-[var(--text-primary)]">{formatCurrency(financial.revenue.confirmed)}</span>
                </p>
                <p className="text-caption">
                  미확인 <span className="font-medium text-[var(--text-primary)]">{formatCurrency(financial.revenue.pending)}</span>
                </p>
              </div>
            </div>

            {/* Expenses Card */}
            <div className="card p-4">
              <p className="text-caption mb-1">지출</p>
              <p className="text-base font-medium text-[var(--text-primary)]">{formatCurrency(financial.expenses.total)}</p>
              {stats.expenses && (
                <p className="text-caption mt-2">
                  전월 <span className="font-medium text-[var(--text-primary)]">{formatCurrency(stats.expenses.lastMonth)}</span>
                </p>
              )}
            </div>

            {/* Net Profit Card */}
            <div className="card p-4">
              <p className="text-caption mb-1">순이익</p>
              <p className={`text-base font-semibold ${financial.netProfit >= 0 ? 'text-[var(--color-info)]' : 'text-[var(--color-danger)]'}`}>
                {formatCurrency(financial.netProfit)}
              </p>
              <p className="text-caption mt-2">
                마진 <span className="font-medium text-[var(--text-primary)]">
                  {financial.revenue.total > 0 ? Math.round((financial.netProfit / financial.revenue.total) * 100) : 0}%
                </span>
              </p>
            </div>

            {/* Conversion Card */}
            <div className="card p-4">
              <p className="text-caption mb-1">전환율</p>
              <p className="text-base font-semibold text-[var(--sage-primary)]">{stats.consultations.conversionRate}%</p>
              <p className="text-caption mt-2">
                상담 {stats.consultations.total}건 중 {stats.consultations.retained}건 수임
              </p>
            </div>
          </div>
        )}

        {/* Action Items */}
        {stats && (
          <div className="card mb-6 overflow-hidden p-0">
            <div className="px-4 py-3 border-b border-[var(--border-subtle)]">
              <p className="text-body font-medium text-[var(--text-primary)]">즉시 조치 필요</p>
            </div>
            <div className="divide-y divide-[var(--border-subtle)]">
              <Link
                href="/admin/consultations?status=pending"
                className="flex items-center justify-between px-4 py-3 hover:bg-[var(--bg-hover)] min-h-[44px]"
              >
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-[var(--color-warning-muted)] text-[var(--color-warning)] flex items-center justify-center text-xs font-medium">
                    {stats.actionItems.pendingConsultations}
                  </span>
                  <span className="text-body text-[var(--text-secondary)]">대기 중인 상담</span>
                </div>
                <svg className="w-4 h-4 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>

              <Link
                href="/schedules"
                className="flex items-center justify-between px-4 py-3 hover:bg-[var(--bg-hover)] min-h-[44px]"
              >
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-[var(--color-danger-muted)] text-[var(--color-danger)] flex items-center justify-center text-xs font-medium">
                    {stats.actionItems.upcomingHearings}
                  </span>
                  <span className="text-body text-[var(--text-secondary)]">7일 내 기일</span>
                </div>
                <svg className="w-4 h-4 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>

              <Link
                href="/schedules"
                className="flex items-center justify-between px-4 py-3 hover:bg-[var(--bg-hover)] min-h-[44px]"
              >
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-[var(--color-warning-muted)] text-[var(--color-warning)] flex items-center justify-center text-xs font-medium">
                    {stats.actionItems.upcomingDeadlines}
                  </span>
                  <span className="text-body text-[var(--text-secondary)]">7일 내 마감</span>
                </div>
                <svg className="w-4 h-4 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>
        )}

        {/* AI Planning Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-body font-medium text-[var(--text-secondary)]">SeeD Planning</p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <PriorityCasesWidget limit={5} />
            <UpcomingEventsWidget limit={7} />
          </div>
          <div className="mt-4">
            <RiskAlertsWidget limit={5} />
          </div>
        </div>

        {/* Consultation Funnel */}
        {stats && (
          <div className="card mb-6 overflow-hidden p-0">
            <div className="px-4 py-3 border-b border-[var(--border-subtle)] flex items-center justify-between">
              <p className="text-body font-medium text-[var(--text-primary)]">상담 현황</p>
              <Link href="/admin/consultations" className="text-caption text-[var(--sage-primary)] hover:text-[var(--sage-primary-hover)]">
                전체보기
              </Link>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-4 gap-2">
                <div className="text-center p-3 rounded-lg bg-[var(--bg-tertiary)]">
                  <p className="text-caption mb-1">대기</p>
                  <p className="text-base font-semibold text-[var(--text-primary)]">{stats.consultations.pending}</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-[var(--bg-tertiary)]">
                  <p className="text-caption mb-1">연락완료</p>
                  <p className="text-base font-semibold text-[var(--text-primary)]">{stats.consultations.contacted}</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-[var(--bg-tertiary)]">
                  <p className="text-caption mb-1">확정</p>
                  <p className="text-base font-semibold text-[var(--text-primary)]">{stats.consultations.confirmed}</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-[var(--sage-muted)]">
                  <p className="text-caption text-[var(--sage-primary)] mb-1">수임</p>
                  <p className="text-base font-semibold text-[var(--sage-primary)]">{stats.consultations.retained}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Cases Summary */}
        {stats && (
          <div className="card mb-6 overflow-hidden p-0">
            <div className="px-4 py-3 border-b border-[var(--border-subtle)] flex items-center justify-between">
              <p className="text-body font-medium text-[var(--text-primary)]">사건 현황</p>
              <Link href="/cases" className="text-caption text-[var(--sage-primary)] hover:text-[var(--sage-primary-hover)]">
                전체보기
              </Link>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center p-3 rounded-lg bg-[var(--bg-tertiary)]">
                  <p className="text-caption mb-1">전체</p>
                  <p className="text-base font-semibold text-[var(--text-primary)]">{stats.cases.total}</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-[var(--color-info-muted)]">
                  <p className="text-caption text-[var(--color-info)] mb-1">진행중</p>
                  <p className="text-base font-semibold text-[var(--color-info)]">{stats.cases.active}</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-[var(--color-success-muted)]">
                  <p className="text-caption text-[var(--color-success)] mb-1">완료</p>
                  <p className="text-base font-semibold text-[var(--color-success)]">{stats.cases.completed}</p>
                </div>
              </div>
              <p className="text-caption mt-3 text-center">
                이번 달 신규 수임 <span className="font-medium text-[var(--text-primary)]">{stats.cases.thisMonth}건</span>
              </p>
            </div>
          </div>
        )}

        {/* Quick Links */}
        <div className="card overflow-hidden p-0">
          <div className="px-4 py-3 border-b border-[var(--border-subtle)]">
            <p className="text-body font-medium text-[var(--text-primary)]">바로가기</p>
          </div>
          <div className="grid grid-cols-2 gap-px bg-[var(--border-subtle)]">
            <Link
              href="/admin/consultations"
              className="flex items-center gap-3 px-4 py-3 bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] min-h-[44px]"
            >
              <span className="text-body text-[var(--text-secondary)]">상담 관리</span>
            </Link>
            <Link
              href="/admin/payments"
              className="flex items-center gap-3 px-4 py-3 bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] min-h-[44px]"
            >
              <span className="text-body text-[var(--text-secondary)]">입금 관리</span>
            </Link>
            <Link
              href="/admin/expenses"
              className="flex items-center gap-3 px-4 py-3 bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] min-h-[44px]"
            >
              <span className="text-body text-[var(--text-secondary)]">지출 관리</span>
            </Link>
            <Link
              href="/admin/receivables"
              className="flex items-center gap-3 px-4 py-3 bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] min-h-[44px]"
            >
              <span className="text-body text-[var(--text-secondary)]">미수금 관리</span>
            </Link>
            <Link
              href="/cases"
              className="flex items-center gap-3 px-4 py-3 bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] min-h-[44px]"
            >
              <span className="text-body text-[var(--text-secondary)]">사건 관리</span>
            </Link>
            <Link
              href="/schedules"
              className="flex items-center gap-3 px-4 py-3 bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] min-h-[44px]"
            >
              <span className="text-body text-[var(--text-secondary)]">일정 관리</span>
            </Link>
            <Link
              href="/admin/settings"
              className="flex items-center gap-3 px-4 py-3 bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] min-h-[44px]"
            >
              <span className="text-body text-[var(--text-secondary)]">설정</span>
            </Link>
            <Link
              href="/clients"
              className="flex items-center gap-3 px-4 py-3 bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] min-h-[44px]"
            >
              <span className="text-body text-[var(--text-secondary)]">의뢰인 관리</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
