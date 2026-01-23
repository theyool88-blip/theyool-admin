'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Payment } from '@/types/payment'
import { formatCurrency } from '@/types/payment'

interface ClientPaymentsModalProps {
  isOpen: boolean
  onClose: () => void
  clientId: string
  clientName: string
}

export default function ClientPaymentsModal({
  isOpen,
  onClose,
  clientId,
  clientName,
}: ClientPaymentsModalProps) {
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [totalAmount, setTotalAmount] = useState(0)
  const supabase = createClient()

  const fetchPayments = useCallback(async () => {
    setLoading(true)
    try {
      // client_id 직접 조회 (우선)
      const { data: byClientId, error: clientErr } = await supabase
        .from('payments')
        .select('*, legal_cases:legal_cases(case_name)')
        .eq('client_id', clientId)
        .order('payment_date', { ascending: false })

      if (clientErr) throw clientErr

      const results: Payment[] = []
      const seen = new Set<string>()

      // 1) client_id 기반 조회 결과
      ;(byClientId || []).forEach((p: Payment & { legal_cases?: { case_name?: string } | null }) => {
        if (!seen.has(p.id)) {
          seen.add(p.id)
          results.push({
            ...p,
            case_name: p.case_name || p.legal_cases?.case_name || '-',
          })
        }
      })

      // 2) 기존 데이터 호환: 사건 경유 조회 (client_id가 없는 기존 입금)
      const { data: cases, error: casesErr } = await supabase
        .from('legal_cases')
        .select('id, case_name')
        .eq('client_id', clientId)

      if (casesErr) {
        console.error('Failed to fetch client cases:', casesErr)
        // 첫 번째 조회 결과만으로 진행
      }

      const caseIds = cases?.map(c => c.id) || []
      const caseNameMap = new Map((cases || []).map(c => [c.id, c.case_name]))

      if (caseIds.length > 0) {
        const { data: byCase, error: caseErr } = await supabase
          .from('payments')
          .select('*, legal_cases:legal_cases(case_name)')
          .in('case_id', caseIds)
          .is('client_id', null)  // client_id가 없는 것만 (중복 방지)
          .order('payment_date', { ascending: false })
        if (caseErr) throw caseErr
        ;(byCase || []).forEach((p: Payment & { legal_cases?: { case_name?: string } | null }) => {
          if (!seen.has(p.id)) {
            seen.add(p.id)
            results.push({
              ...p,
              case_name: p.case_name || p.legal_cases?.case_name || caseNameMap.get(p.case_id || '') || '-',
            })
          }
        })
      }

      // 최신순 정렬
      results.sort((a, b) => (a.payment_date > b.payment_date ? -1 : 1))

      setPayments(results)
      const total = results.reduce((sum, p) => sum + p.amount, 0)
      setTotalAmount(total)
    } catch (error) {
      console.error('Failed to fetch payments:', error)
    } finally {
      setLoading(false)
    }
  }, [clientId, supabase])

  useEffect(() => {
    if (isOpen) {
      fetchPayments()
    }
  }, [fetchPayments, isOpen])

  if (!isOpen) return null

  const fmtDate = (d: string) => {
    const date = new Date(d)
    const yy = String(date.getFullYear()).slice(2)
    const mm = String(date.getMonth() + 1).padStart(2, '0')
    const dd = String(date.getDate()).padStart(2, '0')
    return `${yy}.${mm}.${dd}`
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-[var(--bg-secondary)] rounded-xl shadow-xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-[var(--border-subtle)]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">{clientName}</h2>
              <p className="text-sm text-[var(--text-muted)] mt-0.5">전체 입금 내역</p>
            </div>
            <button
              onClick={onClose}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {/* Summary Stats */}
          <div className="mt-4 flex items-center gap-4">
            <div className="bg-[var(--sage-muted)] px-4 py-3 rounded-lg border border-[var(--border-subtle)]">
              <p className="text-xs text-[var(--text-muted)] mb-0.5">총 입금액</p>
              <p className="text-lg font-semibold text-[var(--text-primary)]">
                {formatCurrency(totalAmount)}
              </p>
            </div>
            <div className="bg-[var(--sage-muted)] px-4 py-3 rounded-lg border border-[var(--border-subtle)]">
              <p className="text-xs text-[var(--text-muted)] mb-0.5">입금 건수</p>
              <p className="text-lg font-semibold text-[var(--text-primary)]">{payments.length}건</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-[var(--border-subtle)] border-t-[var(--sage-primary)]"></div>
              <p className="mt-3 text-sm text-[var(--text-muted)]">불러오는 중...</p>
            </div>
          ) : payments.length === 0 ? (
            <div className="py-16 text-center text-[var(--text-muted)] text-sm">
              입금 내역이 없습니다
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-[var(--bg-tertiary)] sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">입금일</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">사건명</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">입금자</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">금액</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">방법</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">명목</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {payments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-[var(--bg-hover)] transition-colors">
                    <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">
                      {fmtDate(payment.payment_date)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {payment.case_id ? (
                        <Link
                          href={`/cases/${payment.case_id}`}
                          className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:underline font-medium"
                        >
                          {payment.case_name || '-'}
                        </Link>
                      ) : (
                        <span className="text-[var(--text-muted)]">{payment.case_name || '-'}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--text-primary)]">
                      {payment.depositor_name || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-[var(--text-primary)]">
                      {formatCurrency(payment.amount)}
                    </td>
                    <td className="px-4 py-3">
                      {payment.receipt_type ? (
                        <span className="inline-flex px-2 py-0.5 text-xs font-medium bg-[var(--sage-muted)] text-[var(--sage-primary)] rounded-md">
                          {payment.receipt_type}
                        </span>
                      ) : (
                        <span className="text-[var(--text-muted)]">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-md ${
                        payment.payment_category === '환불'
                          ? 'bg-[var(--color-danger-muted)] text-[var(--color-danger)]'
                          : 'bg-[var(--sage-muted)] text-[var(--sage-primary)]'
                      }`}>
                        {payment.payment_category}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[var(--border-subtle)] bg-[var(--bg-tertiary)]">
          <button
            onClick={onClose}
            className="btn btn-secondary"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}
