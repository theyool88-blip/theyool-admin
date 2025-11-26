'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import AdminHeader from '@/components/AdminHeader'

interface ExpenseSummary {
  total_expenses: number
  monthly_expenses: number
  recurring_count: number
  pending_settlements: number
}

export default function ExpensesPage() {
  const [summary, setSummary] = useState<ExpenseSummary | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchSummary = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/expenses/summary')
      if (response.ok) {
        const data = await response.json()
        setSummary(data)
      }
    } catch (error) {
      console.error('Failed to fetch summary:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSummary()
  }, [fetchSummary])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
      maximumFractionDigits: 0
    }).format(amount)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AdminHeader title="지출 관리" />
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-sage-600"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader title="지출 관리" />

      <div className="max-w-5xl mx-auto pt-20 pb-8 px-4">
        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            {/* 총 지출 */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-xs text-gray-500 mb-1">총 지출</p>
              <p className="text-lg font-bold text-red-600">{formatCurrency(summary.total_expenses || 0)}</p>
            </div>

            {/* 이번 달 */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-xs text-gray-500 mb-1">이번 달</p>
              <p className="text-lg font-bold text-gray-900">{formatCurrency(summary.monthly_expenses || 0)}</p>
            </div>

            {/* 고정 지출 */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-xs text-gray-500 mb-1">고정 지출</p>
              <p className="text-lg font-bold text-gray-900">{summary.recurring_count || 0}개</p>
            </div>

            {/* 미정산 */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-xs text-gray-500 mb-1">미정산</p>
              <p className={`text-lg font-bold ${(summary.pending_settlements || 0) > 0 ? 'text-amber-600' : 'text-gray-900'}`}>
                {summary.pending_settlements || 0}건
              </p>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/admin/expenses/list?action=create"
            className="px-4 py-2.5 bg-sage-600 text-white text-sm font-medium rounded-lg hover:bg-sage-700 transition-colors min-h-[44px]"
          >
            + 새 지출 등록
          </Link>
          <Link
            href="/admin/expenses/recurring?action=generate"
            className="px-4 py-2.5 bg-white text-gray-700 text-sm font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors min-h-[44px]"
          >
            고정지출 생성
          </Link>
        </div>

        {/* Menu List */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-medium text-gray-900">지출 메뉴</p>
          </div>
          <div className="divide-y divide-gray-100">
            <Link
              href="/admin/expenses/list"
              className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 min-h-[44px]"
            >
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </span>
                <div>
                  <span className="text-sm text-gray-700">지출 내역 관리</span>
                  {summary?.total_expenses ? (
                    <p className="text-xs text-gray-500">누적 {formatCurrency(summary.total_expenses)}</p>
                  ) : null}
                </div>
              </div>
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>

            <Link
              href="/admin/expenses/recurring"
              className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 min-h-[44px]"
            >
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </span>
                <div>
                  <span className="text-sm text-gray-700">고정 지출 템플릿</span>
                  {summary?.recurring_count ? (
                    <p className="text-xs text-gray-500">{summary.recurring_count}개 활성</p>
                  ) : null}
                </div>
              </div>
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>

            <Link
              href="/admin/expenses/withdrawals"
              className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 min-h-[44px]"
            >
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </span>
                <span className="text-sm text-gray-700">변호사 인출 관리</span>
              </div>
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
