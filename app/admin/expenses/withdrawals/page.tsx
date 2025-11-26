'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Users, Download, ChevronLeft, Wallet } from 'lucide-react'
import type { PartnerWithdrawal } from '@/types/expense'
import WithdrawalFormModal, { type WithdrawalFormData } from '@/components/admin/WithdrawalFormModal'
import { exportWithdrawalsToExcel } from '@/lib/excel-export'

type PartnerFinancial = {
  share: number
  withdrawals: number
  balance: number
  accumulatedDebt: number
}

export default function WithdrawalsPage() {
  const [withdrawals, setWithdrawals] = useState<PartnerWithdrawal[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPartner, setSelectedPartner] = useState('')
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7))
  const [financial, setFinancial] = useState<{
    kim: PartnerFinancial
    lim: PartnerFinancial
  } | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)

  const fetchWithdrawals = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (selectedPartner) params.append('partner', selectedPartner)
      if (selectedMonth) params.append('month', selectedMonth)

      const response = await fetch(`/api/admin/expenses/withdrawals?${params}`)
      if (response.ok) {
        const data = await response.json()
        setWithdrawals(data.withdrawals || [])
      }
    } catch (error) {
      console.error('Failed to fetch withdrawals:', error)
    } finally {
      setLoading(false)
    }
  }, [selectedMonth, selectedPartner])

  const fetchFinancial = useCallback(async () => {
    try {
      if (!selectedMonth) {
        setFinancial(null)
        return
      }
      const res = await fetch(`/api/admin/financial/dashboard?month=${selectedMonth}`)
      if (!res.ok) return
      const data = await res.json()
      if (data.success && data.data?.partners) {
        setFinancial({
          kim: data.data.partners.kim,
          lim: data.data.partners.lim
        })
      }
    } catch (error) {
      console.error('Failed to fetch financial summary:', error)
    }
  }, [selectedMonth])

  useEffect(() => {
    fetchWithdrawals()
    fetchFinancial()
  }, [fetchWithdrawals, fetchFinancial])

  const handleCreateWithdrawal = async (data: WithdrawalFormData) => {
    const response = await fetch('/api/admin/expenses/withdrawals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (!response.ok) throw new Error('Failed to create withdrawal')
    fetchWithdrawals()
  }

  const parseAmount = (val: unknown) => {
    if (typeof val === 'number') return val
    if (typeof val === 'string') {
      const num = Number(val.replace(/[^0-9.-]/g, ''))
      return Number.isFinite(num) ? num : 0
    }
    return 0
  }

  const groupedByPartner = withdrawals.reduce((acc, w) => {
    if (!acc[w.partner_name]) acc[w.partner_name] = []
    acc[w.partner_name].push(w)
    return acc
  }, {} as Record<string, PartnerWithdrawal[]>)

  const partnerTotals = Object.entries(groupedByPartner).map(([name, items]) => ({
    name,
    total: items.reduce((sum, w) => sum + parseAmount(w.amount), 0),
    count: items.length
  }))

  const partnerLookup = (name: string) => partnerTotals.find(p => p.name === name) || { total: 0, count: 0 }
  const kimTotals = partnerLookup('김현성')
  const limTotals = partnerLookup('임은지')
  const kimMonthlyWithdrawals = (() => {
    const apiVal = financial?.kim.withdrawals ?? 0
    if (apiVal > 0) return apiVal
    return kimTotals.total
  })()
  const limMonthlyWithdrawals = (() => {
    const apiVal = financial?.lim.withdrawals ?? 0
    if (apiVal > 0) return apiVal
    return limTotals.total
  })()
  const withdrawalDiff = kimMonthlyWithdrawals - limMonthlyWithdrawals
  const kimDeficit = withdrawalDiff < 0 ? Math.abs(withdrawalDiff) : 0
  const limDeficit = withdrawalDiff > 0 ? withdrawalDiff : 0

  const handleExport = () => {
    const filename = `변호사인출_${new Date().toISOString().slice(0, 10)}.xlsx`
    exportWithdrawalsToExcel(withdrawals, filename)
  }

  return (
    <div className="min-h-screen bg-sage-50 pt-16">
      {/* Header */}
      <div className="bg-white border-b border-sage-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5 sm:py-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <Link
                href="/admin/expenses"
                className="w-11 h-11 flex items-center justify-center rounded-xl bg-sage-100 hover:bg-sage-200 active:bg-sage-300 transition-colors focus:outline-none focus:ring-2 focus:ring-sage-500 focus:ring-offset-2"
                aria-label="뒤로 가기"
              >
                <ChevronLeft className="w-5 h-5 text-sage-700" />
              </Link>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-sage-800">변호사 인출 관리</h1>
                <p className="text-sm text-sage-600 mt-0.5">변호사별 인출 및 지급 내역</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 sm:gap-3">
              <button
                onClick={handleExport}
                className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm text-sage-700 bg-white border border-sage-300 rounded-xl hover:bg-sage-50 active:bg-sage-100 transition-colors min-h-[48px] shadow-sm focus:outline-none focus:ring-2 focus:ring-sage-500 focus:ring-offset-2"
              >
                <Download className="w-5 h-5 flex-shrink-0" />
                <span className="hidden sm:inline">Excel 다운로드</span>
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm text-white bg-sage-600 rounded-xl hover:bg-sage-700 active:bg-sage-800 transition-colors min-h-[48px] shadow-sm font-medium focus:outline-none focus:ring-2 focus:ring-sage-500 focus:ring-offset-2"
              >
                <Plus className="w-5 h-5 flex-shrink-0" />
                <span>인출 등록</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {[
            {
              name: '김현성',
              total: kimMonthlyWithdrawals,
              deficit: kimDeficit,
              count: kimTotals.count,
              bgColor: 'bg-sage-100',
              iconColor: 'text-sage-600'
            },
            {
              name: '임은지',
              total: limMonthlyWithdrawals,
              deficit: limDeficit,
              count: limTotals.count,
              bgColor: 'bg-coral-100',
              iconColor: 'text-coral-600'
            }
          ].map((partner) => (
            <div key={partner.name} className="bg-white rounded-xl shadow-sm border border-sage-200 p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl ${partner.bgColor} flex items-center justify-center flex-shrink-0`}>
                    <Users className={`w-6 h-6 ${partner.iconColor}`} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-sage-800">
                      {partner.name} 변호사
                    </h3>
                    <span className="text-sm text-sage-500">{partner.count}건 인출</span>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-sage-600">총 인출액</span>
                  <div className="flex items-baseline gap-0.5">
                    <span className="text-2xl font-bold text-sage-800">
                      {partner.total.toLocaleString()}
                    </span>
                    <span className="text-base text-sage-600">원</span>
                  </div>
                </div>
                <div className="flex items-baseline justify-between pt-2 border-t border-sage-100">
                  <span className="text-sm text-sage-500">채권액(부족분)</span>
                  <span className={`text-base font-semibold ${partner.deficit > 0 ? 'text-coral-600' : 'text-sage-600'}`}>
                    {(partner.deficit || 0).toLocaleString()}원
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Info & Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-sage-200 p-4 sm:p-5 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-4">
            <div className="flex items-center gap-2 text-sm text-sage-600">
              <span className="font-medium">선택 월:</span>
              <span className="px-3 py-1.5 rounded-lg bg-sage-50 border border-sage-200 text-sage-800 font-semibold">
                {selectedMonth || '전체'}
              </span>
            </div>
            <p className="text-xs text-sage-500 sm:ml-auto">
              분배/부족분은 해당 월 재무 정산과 연동됩니다.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-sage-600 mb-1.5">변호사</label>
              <select
                value={selectedPartner}
                onChange={(e) => setSelectedPartner(e.target.value)}
                className="w-full px-4 py-2.5 text-base border border-sage-300 rounded-xl focus:ring-2 focus:ring-sage-500 focus:border-transparent bg-white min-h-[44px] text-sage-800"
              >
                <option value="">전체</option>
                <option value="김현성">김현성</option>
                <option value="임은지">임은지</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-sage-600 mb-1.5">월</label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full px-4 py-2.5 text-base border border-sage-300 rounded-xl focus:ring-2 focus:ring-sage-500 focus:border-transparent bg-white min-h-[44px] text-sage-800"
              />
            </div>
          </div>
        </div>

        {/* Table / List */}
        {loading ? (
          <div className="bg-white rounded-xl shadow-sm border border-sage-200 p-12 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-10 w-10 border-3 border-sage-200 border-t-sage-600"></div>
              <p className="text-sm text-sage-600">인출 내역을 불러오는 중...</p>
            </div>
          </div>
        ) : withdrawals.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-sage-200 p-12 text-center">
            <div className="w-16 h-16 bg-sage-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Wallet className="w-8 h-8 text-sage-400" />
            </div>
            <p className="text-lg font-medium text-sage-700 mb-2">인출 내역이 없습니다</p>
            <p className="text-sm text-sage-500 mb-6">새로운 인출 내역을 등록해보세요.</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-3 text-white bg-sage-600 rounded-xl hover:bg-sage-700 active:bg-sage-800 transition-colors inline-flex items-center gap-2 font-medium min-h-[48px] shadow-sm focus:outline-none focus:ring-2 focus:ring-sage-500 focus:ring-offset-2"
            >
              <Plus className="w-5 h-5" />
              첫 인출 등록하기
            </button>
          </div>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="block lg:hidden space-y-3">
              {withdrawals.map((withdrawal) => (
                <div
                  key={withdrawal.id}
                  className="bg-white rounded-xl border border-sage-200 p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                          withdrawal.partner_name === '김현성'
                            ? 'bg-sage-100 text-sage-700'
                            : 'bg-coral-100 text-coral-700'
                        }`}>
                          {withdrawal.partner_name}
                        </span>
                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
                          {withdrawal.withdrawal_type}
                        </span>
                      </div>
                      {withdrawal.description && (
                        <p className="text-sm text-sage-600 mt-1">{withdrawal.description}</p>
                      )}
                    </div>
                    <p className="text-lg font-bold text-sage-800 ml-3">
                      {withdrawal.amount.toLocaleString()}<span className="text-sm font-medium">원</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-sage-500 pt-3 border-t border-sage-100">
                    <span>{new Date(withdrawal.withdrawal_date).toLocaleDateString('ko-KR')}</span>
                    <span className="text-sage-300">|</span>
                    <span>정산월: {withdrawal.month_key}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden lg:block bg-white rounded-xl shadow-sm border border-sage-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-sage-50 border-b border-sage-200">
                    <tr>
                      <th className="px-5 py-4 text-left text-sm font-semibold text-sage-700">인출일</th>
                      <th className="px-5 py-4 text-left text-sm font-semibold text-sage-700">변호사</th>
                      <th className="px-5 py-4 text-center text-sm font-semibold text-sage-700">유형</th>
                      <th className="px-5 py-4 text-right text-sm font-semibold text-sage-700">금액</th>
                      <th className="px-5 py-4 text-center text-sm font-semibold text-sage-700">정산월</th>
                      <th className="px-5 py-4 text-left text-sm font-semibold text-sage-700">설명</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-sage-100">
                    {withdrawals.map((withdrawal) => (
                      <tr key={withdrawal.id} className="hover:bg-sage-50 transition-colors">
                        <td className="px-5 py-4 whitespace-nowrap">
                          <span className="text-base text-sage-800">
                            {new Date(withdrawal.withdrawal_date).toLocaleDateString('ko-KR')}
                          </span>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <span className={`px-3 py-1.5 text-sm font-medium rounded-full ${
                            withdrawal.partner_name === '김현성'
                              ? 'bg-sage-100 text-sage-700'
                              : 'bg-coral-100 text-coral-700'
                          }`}>
                            {withdrawal.partner_name}
                          </span>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap text-center">
                          <span className="px-3 py-1.5 text-sm font-medium rounded-full bg-gray-100 text-gray-600">
                            {withdrawal.withdrawal_type}
                          </span>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap text-right">
                          <span className="text-lg font-bold text-sage-800">
                            {withdrawal.amount.toLocaleString()}
                          </span>
                          <span className="text-sm text-sage-500 ml-0.5">원</span>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap text-center">
                          <span className="text-base text-sage-600">
                            {withdrawal.month_key}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className="text-base text-sage-600 max-w-xs truncate block">
                            {withdrawal.description || '-'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Summary */}
            <div className="mt-4 bg-white rounded-xl shadow-sm border border-sage-200 p-5">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                <span className="text-base text-sage-600">
                  총 <span className="font-semibold text-sage-700">{withdrawals.length}</span>건
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-sm text-sage-500">합계:</span>
                  <span className="text-2xl font-bold text-sage-800">
                    {withdrawals.reduce((sum, w) => sum + parseAmount(w.amount), 0).toLocaleString()}
                  </span>
                  <span className="text-base text-sage-600">원</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Create Withdrawal Modal */}
      <WithdrawalFormModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateWithdrawal}
      />
    </div>
  )
}
