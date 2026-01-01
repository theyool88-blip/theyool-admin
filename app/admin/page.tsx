'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import AdminHeader from '@/components/AdminHeader'
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
      <div className="min-h-screen bg-gray-50">
        <AdminHeader title="관리자 대시보드" />
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-sage-600"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader title="관리자 대시보드" />

      <div className="max-w-5xl mx-auto pt-20 pb-8 px-4">
        {/* Month Selector */}
        <div className="flex items-center gap-3 mb-5">
          <button
            onClick={() => shiftMonth(-1)}
            className="min-h-[44px] px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white hover:bg-gray-50 transition-colors"
          >
            이전
          </button>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="min-h-[44px] px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sage-500"
          />
          <button
            onClick={() => shiftMonth(1)}
            className="min-h-[44px] px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white hover:bg-gray-50 transition-colors"
          >
            다음
          </button>
        </div>

        {/* Summary Cards */}
        {stats && financial && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            {/* Revenue Card */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-xs text-gray-500 mb-1">매출</p>
              <p className="text-base font-semibold text-green-600">{formatCurrency(financial.revenue.total)}</p>
              <div className="mt-2 space-y-0.5">
                <p className="text-xs text-gray-500">
                  확인 <span className="font-medium text-gray-700">{formatCurrency(financial.revenue.confirmed)}</span>
                </p>
                <p className="text-xs text-gray-500">
                  미확인 <span className="font-medium text-orange-600">{formatCurrency(financial.revenue.pending)}</span>
                </p>
              </div>
            </div>

            {/* Expenses Card */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-xs text-gray-500 mb-1">지출</p>
              <p className="text-base font-semibold text-red-600">{formatCurrency(financial.expenses.total)}</p>
              {stats.expenses && (
                <p className="text-xs text-gray-500 mt-2">
                  전월 <span className="font-medium text-gray-700">{formatCurrency(stats.expenses.lastMonth)}</span>
                </p>
              )}
            </div>

            {/* Net Profit Card */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-xs text-gray-500 mb-1">순이익</p>
              <p className={`text-base font-semibold ${financial.netProfit >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                {formatCurrency(financial.netProfit)}
              </p>
              <p className="text-xs text-gray-500 mt-2">
                마진 <span className="font-medium text-gray-700">
                  {financial.revenue.total > 0 ? Math.round((financial.netProfit / financial.revenue.total) * 100) : 0}%
                </span>
              </p>
            </div>

            {/* Conversion Card */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-xs text-gray-500 mb-1">전환율</p>
              <p className="text-base font-semibold text-sage-700">{stats.consultations.conversionRate}%</p>
              <p className="text-xs text-gray-500 mt-2">
                상담 {stats.consultations.total}건 중 {stats.consultations.retained}건 수임
              </p>
            </div>
          </div>
        )}

        {/* Action Items */}
        {stats && (
          <div className="bg-white rounded-lg border border-gray-200 mb-6">
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-medium text-gray-900">즉시 조치 필요</p>
            </div>
            <div className="divide-y divide-gray-100">
              <Link
                href="/admin/consultations?status=pending"
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 min-h-[44px]"
              >
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-medium">
                    {stats.actionItems.pendingConsultations}
                  </span>
                  <span className="text-sm text-gray-700">대기 중인 상담</span>
                </div>
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>

              <Link
                href="/schedules"
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 min-h-[44px]"
              >
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-red-100 text-red-700 flex items-center justify-center text-xs font-medium">
                    {stats.actionItems.upcomingHearings}
                  </span>
                  <span className="text-sm text-gray-700">7일 내 기일</span>
                </div>
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>

              <Link
                href="/schedules"
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 min-h-[44px]"
              >
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center text-xs font-medium">
                    {stats.actionItems.upcomingDeadlines}
                  </span>
                  <span className="text-sm text-gray-700">7일 내 마감</span>
                </div>
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>
        )}

        {/* AI Planning Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-gray-700">SeeD Planning</p>
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
          <div className="bg-white rounded-lg border border-gray-200 mb-6">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <p className="text-sm font-medium text-gray-900">상담 현황</p>
              <Link href="/admin/consultations" className="text-xs text-sage-600 hover:text-sage-700">
                전체보기
              </Link>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-4 gap-2">
                <div className="text-center p-3 rounded-lg bg-gray-50">
                  <p className="text-xs text-gray-500 mb-1">대기</p>
                  <p className="text-base font-semibold text-gray-700">{stats.consultations.pending}</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-gray-50">
                  <p className="text-xs text-gray-500 mb-1">연락완료</p>
                  <p className="text-base font-semibold text-gray-700">{stats.consultations.contacted}</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-gray-50">
                  <p className="text-xs text-gray-500 mb-1">확정</p>
                  <p className="text-base font-semibold text-gray-700">{stats.consultations.confirmed}</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-sage-50">
                  <p className="text-xs text-sage-600 mb-1">수임</p>
                  <p className="text-base font-semibold text-sage-700">{stats.consultations.retained}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Cases Summary */}
        {stats && (
          <div className="bg-white rounded-lg border border-gray-200 mb-6">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <p className="text-sm font-medium text-gray-900">사건 현황</p>
              <Link href="/cases" className="text-xs text-sage-600 hover:text-sage-700">
                전체보기
              </Link>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center p-3 rounded-lg bg-gray-50">
                  <p className="text-xs text-gray-500 mb-1">전체</p>
                  <p className="text-base font-semibold text-gray-700">{stats.cases.total}</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-blue-50">
                  <p className="text-xs text-blue-600 mb-1">진행중</p>
                  <p className="text-base font-semibold text-blue-700">{stats.cases.active}</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-green-50">
                  <p className="text-xs text-green-600 mb-1">완료</p>
                  <p className="text-base font-semibold text-green-700">{stats.cases.completed}</p>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-3 text-center">
                이번 달 신규 수임 <span className="font-medium text-gray-700">{stats.cases.thisMonth}건</span>
              </p>
            </div>
          </div>
        )}

        {/* Quick Links */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-medium text-gray-900">바로가기</p>
          </div>
          <div className="grid grid-cols-2 gap-px bg-gray-100">
            <Link
              href="/admin/consultations"
              className="flex items-center gap-3 px-4 py-3 bg-white hover:bg-gray-50 min-h-[44px]"
            >
              <span className="text-sm text-gray-700">상담 관리</span>
            </Link>
            <Link
              href="/admin/payments"
              className="flex items-center gap-3 px-4 py-3 bg-white hover:bg-gray-50 min-h-[44px]"
            >
              <span className="text-sm text-gray-700">입금 관리</span>
            </Link>
            <Link
              href="/admin/expenses"
              className="flex items-center gap-3 px-4 py-3 bg-white hover:bg-gray-50 min-h-[44px]"
            >
              <span className="text-sm text-gray-700">지출 관리</span>
            </Link>
            <Link
              href="/admin/receivables"
              className="flex items-center gap-3 px-4 py-3 bg-white hover:bg-gray-50 min-h-[44px]"
            >
              <span className="text-sm text-gray-700">미수금 관리</span>
            </Link>
            <Link
              href="/cases"
              className="flex items-center gap-3 px-4 py-3 bg-white hover:bg-gray-50 min-h-[44px]"
            >
              <span className="text-sm text-gray-700">사건 관리</span>
            </Link>
            <Link
              href="/schedules"
              className="flex items-center gap-3 px-4 py-3 bg-white hover:bg-gray-50 min-h-[44px]"
            >
              <span className="text-sm text-gray-700">일정 관리</span>
            </Link>
            <Link
              href="/admin/settings"
              className="flex items-center gap-3 px-4 py-3 bg-white hover:bg-gray-50 min-h-[44px]"
            >
              <span className="text-sm text-gray-700">설정</span>
            </Link>
            <Link
              href="/clients"
              className="flex items-center gap-3 px-4 py-3 bg-white hover:bg-gray-50 min-h-[44px]"
            >
              <span className="text-sm text-gray-700">의뢰인 관리</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
