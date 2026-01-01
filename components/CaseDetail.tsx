'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import type { CourtHearing, CaseDeadline } from '@/types/court-hearing'
import {
  HEARING_TYPE_LABELS,
  HEARING_STATUS_LABELS,
  DEADLINE_TYPE_LABELS,
  DEADLINE_STATUS_LABELS,
  formatDaysUntil,
  HearingType,
  HearingStatus,
  DeadlineType,
  DeadlineStatus
} from '@/types/court-hearing'
import UnifiedScheduleModal from './UnifiedScheduleModal'
import AdminHeader from './AdminHeader'
import HearingDetailModal from './HearingDetailModal'
import CasePaymentsModal from './CasePaymentsModal'

interface Client {
  id: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
  birth_date: string | null
  gender: string | null
  notes: string | null
}

interface RelatedCase {
  id: string
  case_id: string
  related_case_id: string
  relation_type: string | null
  notes: string | null
  related_case?: {
    id: string
    case_name: string
    contract_number: string | null
    status: string
  }
}

interface LegalCase {
  id: string
  contract_number: string | null
  case_name: string
  client_id: string
  status: '진행중' | '종결'
  office: string | null
  contract_date: string | null
  retainer_fee: number | null
  total_received: number | null
  outstanding_balance: number | null
  success_fee_agreement: string | null
  calculated_success_fee: number | null
  court_case_number: string | null
  court_name: string | null
  case_type: string | null
  judge_name: string | null
  notes: string | null
  is_new_case: boolean
  onedrive_folder_url: string | null
  created_at: string
  updated_at: string
  client?: Client
  case_relations?: RelatedCase[]
}

interface Schedule {
  id: string
  title: string
  scheduled_date: string
  scheduled_time: string | null
  schedule_type: 'trial' | 'consultation' | 'meeting'
  location: string | null
  description: string | null
}

// 대법원 진행사항 관련 인터페이스
interface ScourtProgressItem {
  date: string
  content: string
  result?: string | null
}

interface ScourtHearingItem {
  date: string
  time?: string
  type: string
  location?: string
  result?: string
}

interface ScourtSnapshot {
  id: string
  scrapedAt: string
  caseType: string
  basicInfo: Record<string, string>
  hearings: ScourtHearingItem[]
  progress: ScourtProgressItem[]
  documents: { date: string; content: string }[]
  lowerCourt: { court: string; caseNo: string }[]
  relatedCases: { caseNo: string; caseName?: string; relation?: string }[]
}

interface ScourtSyncStatus {
  lastSync: string | null
  status: string | null
  caseNumber: string | null
  isLinked: boolean
  profileId: string | null
}

interface UnifiedScheduleItem {
  id: string
  type: 'court_hearing' | 'deadline' | 'schedule'
  title: string
  date: string
  datetime?: string
  location?: string | null
  status?: string
  days_until?: number
  subtype?: string
  source: CourtHearing | CaseDeadline | Schedule
}

export default function CaseDetail({ caseData }: { caseData: LegalCase }) {
  const [unifiedSchedules, setUnifiedSchedules] = useState<UnifiedScheduleItem[]>([])
  const [loading, setLoading] = useState(false)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [selectedHearing, setSelectedHearing] = useState<CourtHearing | null>(null)
  const [showHearingModal, setShowHearingModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [reportModal, setReportModal] = useState<{ title: string; report: string; court?: string | null; caseNumber?: string | null; date?: string | null } | null>(null)
  const [paymentTotal, setPaymentTotal] = useState<number | null>(null)
  const [isNewCase, setIsNewCase] = useState(caseData.is_new_case ?? false)
  const [isUpdatingNewCase, setIsUpdatingNewCase] = useState(false)

  // 대법원 진행사항 관련 상태
  const [scourtSnapshot, setScourtSnapshot] = useState<ScourtSnapshot | null>(null)
  const [scourtSyncStatus, setScourtSyncStatus] = useState<ScourtSyncStatus | null>(null)
  const [scourtLoading, setScourtLoading] = useState(false)
  const [scourtSyncing, setScourtSyncing] = useState(false)
  const [showProgressDetail, setShowProgressDetail] = useState(false)

  // 탭 상태: 'schedules' | 'progress'
  const [activeTab, setActiveTab] = useState<'schedules' | 'progress'>('schedules')

  const router = useRouter()
  const supabase = createClient()
  const clientDisplayName = caseData.client?.name ? `${caseData.client.name}님` : '의뢰인님'

  // 신건여부 토글 함수
  const handleToggleNewCase = async () => {
    setIsUpdatingNewCase(true)
    try {
      const newValue = !isNewCase
      const { error } = await supabase
        .from('legal_cases')
        .update({ is_new_case: newValue })
        .eq('id', caseData.id)

      if (error) throw error

      setIsNewCase(newValue)
    } catch (error) {
      console.error('신건여부 업데이트 실패:', error)
      alert('신건여부 변경에 실패했습니다.')
    } finally {
      setIsUpdatingNewCase(false)
    }
  }

  // 대법원 스냅샷 조회
  const fetchScourtSnapshot = useCallback(async () => {
    if (!caseData.court_case_number) return

    setScourtLoading(true)
    try {
      const res = await fetch(`/api/admin/scourt/snapshot?caseId=${caseData.id}`)
      const data = await res.json()

      if (data.success) {
        setScourtSnapshot(data.snapshot)
        setScourtSyncStatus(data.syncStatus)
      }
    } catch (error) {
      console.error('스냅샷 조회 실패:', error)
    } finally {
      setScourtLoading(false)
    }
  }, [caseData.id, caseData.court_case_number])

  // 대법원 동기화 실행
  const handleScourtSync = async () => {
    if (!caseData.court_case_number) {
      alert('사건번호가 없습니다.')
      return
    }

    setScourtSyncing(true)
    try {
      const res = await fetch('/api/admin/scourt/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          legalCaseId: caseData.id,
          caseNumber: caseData.court_case_number,
          forceRefresh: true,
        }),
      })
      const data = await res.json()

      if (data.success) {
        // 동기화 성공 후 스냅샷 새로고침
        await fetchScourtSnapshot()
        if (data.updateCount > 0) {
          alert(`동기화 완료: ${data.updateCount}건의 변경사항이 있습니다.`)
        } else {
          alert('동기화 완료: 변경사항이 없습니다.')
        }
      } else if (data.skipped) {
        alert('최근에 동기화되었습니다.')
      } else {
        alert(data.error || '동기화 실패')
      }
    } catch (error) {
      console.error('동기화 실패:', error)
      alert('동기화 중 오류가 발생했습니다.')
    } finally {
      setScourtSyncing(false)
    }
  }

  const fetchAllSchedules = useCallback(async () => {
    // case_id로 조회 - 사건번호 없어도 동작
    if (!caseData.id) return

    try {
      setLoading(true)
      const unified: UnifiedScheduleItem[] = []

      const { data: hearings, error: hearingError } = await supabase
        .from('court_hearings')
        .select('*')
        .eq('case_id', caseData.id)
        .order('hearing_date', { ascending: true })

      if (hearingError) throw hearingError

      const { data: deadlines, error: deadlineError } = await supabase
        .from('case_deadlines')
        .select('*')
        .eq('case_id', caseData.id)
        .order('deadline_date', { ascending: true })

      if (deadlineError) throw deadlineError

      const { data: schedules } = await supabase
        .from('general_schedules')
        .select('*')
        .eq('case_id', caseData.id)
        .order('schedule_date', { ascending: true })

      if (hearings && hearings.length > 0) {
        hearings.forEach(hearing => {
          const date = new Date(hearing.hearing_date)
          const today = new Date()
          today.setHours(0, 0, 0, 0)
          date.setHours(0, 0, 0, 0)
          const daysUntil = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

          unified.push({
            id: hearing.id,
            type: 'court_hearing',
            title: HEARING_TYPE_LABELS[hearing.hearing_type as HearingType],
            date: hearing.hearing_date.split('T')[0],
            datetime: hearing.hearing_date,
            location: hearing.location,
            status: hearing.status,
            days_until: daysUntil,
            subtype: hearing.hearing_type,
            source: hearing
          })
        })
      }

      if (deadlines) {
        deadlines.forEach(deadline => {
          const date = new Date(deadline.deadline_date)
          const today = new Date()
          today.setHours(0, 0, 0, 0)
          date.setHours(0, 0, 0, 0)
          const daysUntil = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

          unified.push({
            id: deadline.id,
            type: 'deadline',
            title: DEADLINE_TYPE_LABELS[deadline.deadline_type as DeadlineType],
            date: deadline.deadline_date,
            datetime: `${deadline.deadline_date}T00:00:00`,
            status: deadline.status,
            days_until: daysUntil,
            subtype: deadline.deadline_type,
            source: deadline
          })
        })
      }

      if (schedules && schedules.length > 0) {
        schedules.forEach(schedule => {
          const date = new Date(schedule.schedule_date)
          const today = new Date()
          today.setHours(0, 0, 0, 0)
          date.setHours(0, 0, 0, 0)
          const daysUntil = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

          unified.push({
            id: schedule.id,
            type: 'schedule',
            title: schedule.title,
            date: schedule.schedule_date,
            datetime: schedule.schedule_time ? `${schedule.schedule_date}T${schedule.schedule_time}` : undefined,
            location: schedule.location,
            days_until: daysUntil,
            subtype: schedule.schedule_type,
            source: schedule
          })
        })
      }

      unified.sort((a, b) => a.date.localeCompare(b.date))
      setUnifiedSchedules(unified)
    } catch (error) {
      console.error('일정 조회 실패:', error)
      setUnifiedSchedules([])
    } finally {
      setLoading(false)
    }
  }, [caseData.id, supabase])

  useEffect(() => {
    fetchAllSchedules()
  }, [fetchAllSchedules])

  // 대법원 스냅샷 조회
  useEffect(() => {
    fetchScourtSnapshot()
  }, [fetchScourtSnapshot])

  useEffect(() => {
    const fetchPayments = async () => {
      const { data, error } = await supabase
        .from('payments')
        .select('amount')
        .eq('case_id', caseData.id)

      if (!error && data) {
        const total = data.reduce((sum, p) => sum + p.amount, 0)
        setPaymentTotal(total)
      }
    }
    fetchPayments()
  }, [caseData.id, supabase])

  const formatCurrency = (amount: number | null) => {
    if (!amount) return '-'
    return `${amount.toLocaleString('ko-KR')}원`
  }

  const calculateOutstandingBalance = () => {
    const retainer = caseData.retainer_fee || 0
    const successFee = caseData.calculated_success_fee || 0
    const received = (paymentTotal ?? caseData.total_received) || 0
    return retainer + successFee - received
  }

  const formatDate = (date: string | null) => {
    if (!date) return '-'
    const d = new Date(date)
    const year = String(d.getFullYear()).slice(2)
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}.${month}.${day}`
  }

  const formatDateTime = (datetime: string) => {
    const d = new Date(datetime)
    const year = String(d.getFullYear()).slice(2)
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const hour = String(d.getHours()).padStart(2, '0')
    const minute = String(d.getMinutes()).padStart(2, '0')
    return `${year}.${month}.${day} ${hour}:${minute}`
  }

  const getStatusStyle = (status: string) => {
    return status === '진행중'
      ? 'bg-sage-100 text-sage-700'
      : 'bg-gray-100 text-gray-500'
  }

  const getOfficeStyle = (office: string | null) => {
    switch (office) {
      case '평택': return 'bg-blue-50 text-blue-700'
      case '천안': return 'bg-purple-50 text-purple-700'
      case '소송구조': return 'bg-amber-50 text-amber-700'
      default: return 'bg-gray-100 text-gray-600'
    }
  }

  const getScheduleTypeStyle = (type: 'court_hearing' | 'deadline' | 'schedule', subtype?: string) => {
    if (type === 'court_hearing') {
      if (subtype === 'HEARING_LAWYER_MEETING') {
        return 'border-l-teal-400 bg-teal-50'
      }
      return 'border-l-blue-400 bg-blue-50'
    } else if (type === 'deadline') {
      return 'border-l-orange-400 bg-orange-50'
    } else {
      if (subtype === 'trial') {
        return 'border-l-purple-400 bg-purple-50'
      } else if (subtype === 'consultation') {
        return 'border-l-indigo-400 bg-indigo-50'
      } else if (subtype === 'meeting') {
        return 'border-l-emerald-400 bg-emerald-50'
      }
      return 'border-l-gray-400 bg-gray-50'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader title="사건 상세" subtitle={caseData.case_name} />

      <div className="max-w-5xl mx-auto pt-20 pb-8 px-4">
        {/* Header Actions */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 text-xs font-medium rounded ${getOfficeStyle(caseData.office)}`}>
              {caseData.office || '-'}
            </span>
            <span className={`px-2 py-0.5 text-xs font-medium rounded ${getStatusStyle(caseData.status)}`}>
              {caseData.status}
            </span>
            {/* 신건여부 토글 */}
            <button
              onClick={handleToggleNewCase}
              disabled={isUpdatingNewCase}
              className={`px-2 py-0.5 text-xs font-medium rounded flex items-center gap-1 transition-colors ${
                isNewCase
                  ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              } ${isUpdatingNewCase ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              {isUpdatingNewCase ? (
                <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <svg className={`w-3 h-3 ${isNewCase ? 'text-blue-600' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isNewCase ? "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" : "M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"} />
                </svg>
              )}
              신건
            </button>
            {/* 문서 폴더 뱃지 */}
            {caseData.onedrive_folder_url && (
              <a
                href={caseData.onedrive_folder_url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2 py-0.5 text-xs font-medium rounded flex items-center gap-1 bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
                title="소송 서류 폴더 열기"
              >
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M7.71 3.5l1.6 1.5h5.36a1.5 1.5 0 0 1 1.5 1.5v1h2.33a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5H5.5A1.5 1.5 0 0 1 4 17V5a1.5 1.5 0 0 1 1.5-1.5h2.21z"/>
                </svg>
                Drive
              </a>
            )}
          </div>
          <button
            onClick={() => router.push(`/cases/${caseData.id}/edit`)}
            className="px-4 py-1.5 text-sm font-medium text-sage-700 bg-white border border-gray-200 rounded hover:bg-gray-50 transition-colors"
          >
            수정
          </button>
        </div>

        {/* Case Overview */}
        <div className="bg-white rounded-lg border border-gray-200 p-5 mb-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">사건 개요</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <label className="text-xs text-gray-500">계약번호</label>
              <p className="mt-0.5 text-gray-900">{caseData.contract_number || '-'}</p>
            </div>
            <div>
              <label className="text-xs text-gray-500">계약일</label>
              <p className="mt-0.5 text-gray-900">{formatDate(caseData.contract_date)}</p>
            </div>
            <div>
              <label className="text-xs text-gray-500">사건번호</label>
              <p className="mt-0.5 text-gray-900">{caseData.court_case_number || '-'}</p>
            </div>
            <div>
              <label className="text-xs text-gray-500">법원</label>
              <p className="mt-0.5 text-gray-900">{caseData.court_name || '-'}</p>
            </div>
            <div>
              <label className="text-xs text-gray-500">담당 판사</label>
              <p className="mt-0.5 text-gray-900">{caseData.judge_name || '-'}</p>
            </div>
            <div>
              <label className="text-xs text-gray-500">사건종류</label>
              <p className="mt-0.5 text-gray-900">{caseData.case_type || '-'}</p>
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-500">사건명</label>
              <p className="mt-0.5 text-gray-900 font-medium">{caseData.case_name}</p>
            </div>
          </div>
        </div>

        {/* Fee + Client Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {/* Fee Info */}
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">수임료 정보</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">착수금</span>
                <span className="font-medium text-gray-900">{formatCurrency(caseData.retainer_fee)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">발생 성공보수</span>
                <span className="font-medium text-blue-600">{formatCurrency(caseData.calculated_success_fee)}</span>
              </div>
              <div className="flex justify-between border-t border-gray-100 pt-3">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(true)}
                  className="text-gray-500 underline hover:text-sage-600"
                >
                  입금액
                </button>
                <span className="font-medium text-emerald-600">{formatCurrency(paymentTotal ?? caseData.total_received)}</span>
              </div>
              <div className="flex justify-between border-t border-gray-100 pt-3">
                <span className="text-gray-500">미수금</span>
                <span className="font-bold text-red-600">{formatCurrency(calculateOutstandingBalance())}</span>
              </div>
              {caseData.success_fee_agreement && (
                <div className="border-t border-gray-100 pt-3">
                  <label className="text-xs text-gray-500">성공보수 약정</label>
                  <p className="mt-0.5 text-gray-700">{caseData.success_fee_agreement}</p>
                </div>
              )}
            </div>
          </div>

          {/* Client Info */}
          {caseData.client && (
            <div
              className="bg-white rounded-lg border border-gray-200 p-5 cursor-pointer hover:border-sage-300 transition-colors"
              onClick={() => router.push(`/clients/${caseData.client_id}`)}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-gray-900">의뢰인 정보</h2>
                <span className="text-xs text-sage-600">상세보기 &rarr;</span>
              </div>
              <div className="space-y-2 text-sm">
                <div>
                  <label className="text-xs text-gray-500">이름</label>
                  <p className="mt-0.5 text-gray-900 font-medium">{caseData.client.name}</p>
                </div>
                {caseData.client.phone && (
                  <div>
                    <label className="text-xs text-gray-500">연락처</label>
                    <p className="mt-0.5 text-gray-900">{caseData.client.phone}</p>
                  </div>
                )}
                {caseData.client.email && (
                  <div>
                    <label className="text-xs text-gray-500">이메일</label>
                    <p className="mt-0.5 text-gray-900">{caseData.client.email}</p>
                  </div>
                )}
                {caseData.client.birth_date && (
                  <div>
                    <label className="text-xs text-gray-500">생년월일</label>
                    <p className="mt-0.5 text-gray-900">{formatDate(caseData.client.birth_date)}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Related Cases */}
        {caseData.case_relations && caseData.case_relations.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-5 mb-4">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">관련 사건</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {caseData.case_relations.map((relation) => (
                <div
                  key={relation.id}
                  onClick={() => router.push(`/cases/${relation.related_case_id}`)}
                  className="flex items-center justify-between p-3 border border-gray-200 rounded hover:border-sage-300 hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <div>
                    {relation.relation_type && (
                      <span className="inline-block px-1.5 py-0.5 text-xs font-medium bg-blue-50 text-blue-700 rounded mr-2">
                        {relation.relation_type}
                      </span>
                    )}
                    <span className="text-sm text-gray-900">{relation.related_case?.case_name || '사건명 없음'}</span>
                    {relation.related_case?.contract_number && (
                      <span className="text-xs text-gray-400 ml-2">{relation.related_case.contract_number}</span>
                    )}
                  </div>
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        {caseData.notes && (
          <div className="bg-white rounded-lg border border-gray-200 p-5 mb-4">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">메모</h2>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{caseData.notes}</p>
          </div>
        )}

        {/* 일정/진행사항 탭 UI */}
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          {/* 탭 헤더 */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
              <button
                onClick={() => setActiveTab('schedules')}
                className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  activeTab === 'schedules'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                일정
              </button>
              <button
                onClick={() => setActiveTab('progress')}
                className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  activeTab === 'progress'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                진행사항
              </button>
            </div>
            <div className="flex items-center gap-2">
              {activeTab === 'schedules' && (
                <button
                  onClick={() => setShowScheduleModal(true)}
                  className="px-3 py-1 text-xs font-medium text-white bg-sage-600 rounded hover:bg-sage-700 transition-colors"
                >
                  + 일정 추가
                </button>
              )}
              {activeTab === 'progress' && caseData.court_case_number && (
                <>
                  {scourtSnapshot && (
                    <button
                      onClick={() => setShowProgressDetail(!showProgressDetail)}
                      className="px-3 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
                    >
                      {showProgressDetail ? '접기' : '상세보기'}
                    </button>
                  )}
                  <button
                    onClick={handleScourtSync}
                    disabled={scourtSyncing || !scourtSyncStatus?.isLinked}
                    className={`px-3 py-1 text-xs font-medium rounded transition-colors flex items-center gap-1 ${
                      scourtSyncing
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : scourtSyncStatus?.isLinked
                        ? 'bg-sage-600 text-white hover:bg-sage-700'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }`}
                    title={!scourtSyncStatus?.isLinked ? '대법원 사건 연동이 필요합니다' : ''}
                  >
                    {scourtSyncing ? (
                      <>
                        <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        동기화 중...
                      </>
                    ) : (
                      <>
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        동기화
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* 일정 탭 내용 */}
          {activeTab === 'schedules' && (
            <>
              {loading ? (
                <div className="py-8 text-center text-gray-400 text-sm">
                  로딩 중...
                </div>
              ) : unifiedSchedules.length === 0 ? (
                <div className="py-8 text-center text-gray-400 text-sm">
                  등록된 일정이 없습니다
                </div>
              ) : (
                <div className="space-y-2">
                  {unifiedSchedules.map((item) => {
                    const isHearing = item.type === 'court_hearing'
                    const isDeadline = item.type === 'deadline'
                    const source = item.source
                    const itemKey = `${item.type}-${item.id}`
                    const hasReport = isHearing && 'report' in source && source.report

                    return (
                      <div
                        key={itemKey}
                        onClick={() => {
                          if (isHearing) {
                            setSelectedHearing(item.source as CourtHearing)
                            setShowHearingModal(true)
                          }
                        }}
                        className={`border-l-4 rounded p-3 cursor-pointer hover:shadow-sm transition-shadow ${getScheduleTypeStyle(item.type, item.subtype)}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-medium text-gray-700">{item.title}</span>
                            {item.status && (
                              <span className={`text-xs ${
                                isHearing
                                  ? item.status === 'COMPLETED' ? 'text-green-600' :
                                    item.status === 'POSTPONED' ? 'text-yellow-600' :
                                    item.status === 'CANCELLED' ? 'text-gray-500' :
                                    'text-blue-600'
                                  : item.status === 'COMPLETED' ? 'text-green-600' :
                                    item.status === 'OVERDUE' ? 'text-red-600' :
                                    'text-yellow-600'
                              }`}>
                                {isHearing
                                  ? item.status === 'COMPLETED'
                                    ? '속행'
                                    : HEARING_STATUS_LABELS[item.status as HearingStatus]
                                  : DEADLINE_STATUS_LABELS[item.status as DeadlineStatus]}
                              </span>
                            )}
                            {item.days_until !== undefined && (
                              <span className={`text-xs font-medium ${
                                item.days_until <= 1 ? 'text-red-600' :
                                item.days_until <= 3 ? 'text-orange-600' :
                                item.days_until <= 7 ? 'text-yellow-600' :
                                'text-green-600'
                              }`}>
                                {formatDaysUntil(item.days_until)}
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-gray-600">
                            {item.datetime ? formatDateTime(item.datetime) : formatDate(item.date)}
                          </span>
                        </div>

                        {(item.location || hasReport) && (
                          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                            {item.location && (
                              <span className="flex items-center gap-1">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                </svg>
                                {item.location}
                              </span>
                            )}
                            {hasReport && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setReportModal({
                                    title: `${item.title || '재판기일'} 보고서`,
                                    report: source.report || '',
                                    court: caseData.court_name,
                                    caseNumber: caseData.court_case_number,
                                    date: item.date
                                  })
                                }}
                                className="text-blue-600 hover:text-blue-700 flex items-center gap-1"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                보고서 보기
                              </button>
                            )}
                          </div>
                        )}

                        {isDeadline && (
                          <div className="mt-2 text-xs text-gray-500">
                            기산일: {formatDate((source as CaseDeadline).trigger_date)}
                            {(source as CaseDeadline).completed_at && (
                              <span className="ml-3 text-green-600">
                                완료: {formatDateTime((source as CaseDeadline).completed_at!)}
                              </span>
                            )}
                          </div>
                        )}

                        {(('notes' in source && source.notes) || ('description' in source && source.description)) && (
                          <p className="mt-2 text-xs text-gray-500 italic">
                            {('notes' in source && source.notes) || ('description' in source && source.description)}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}

          {/* 진행사항 탭 내용 */}
          {activeTab === 'progress' && (
            <>
              {!caseData.court_case_number ? (
                <div className="py-8 text-center text-gray-400 text-sm">
                  사건번호를 먼저 등록해주세요
                </div>
              ) : scourtLoading ? (
                <div className="py-6 text-center text-gray-400 text-sm">
                  로딩 중...
                </div>
              ) : !scourtSyncStatus?.isLinked ? (
                <div className="py-6 text-center text-gray-400 text-sm">
                  <p>대법원 사건 연동이 필요합니다.</p>
                  <p className="mt-1 text-xs">사건번호로 검색하여 사건을 연동해주세요.</p>
                </div>
              ) : !scourtSnapshot ? (
                <div className="py-6 text-center text-gray-400 text-sm">
                  <p>동기화된 데이터가 없습니다.</p>
                  <p className="mt-1 text-xs">동기화 버튼을 눌러 대법원에서 정보를 가져오세요.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* 최근 진행내용 요약 (최대 5개) */}
                  {scourtSnapshot.progress.slice(0, showProgressDetail ? undefined : 5).map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0"
                    >
                      <span className="text-xs text-gray-400 whitespace-nowrap pt-0.5">
                        {item.date}
                      </span>
                      <div className="flex-1">
                        <p className="text-sm text-gray-700">{item.content}</p>
                        {item.result && (
                          <span className="inline-block mt-1 px-1.5 py-0.5 text-xs bg-blue-50 text-blue-600 rounded">
                            {item.result}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}

                  {!showProgressDetail && scourtSnapshot.progress.length > 5 && (
                    <button
                      onClick={() => setShowProgressDetail(true)}
                      className="w-full py-2 text-xs text-gray-500 hover:text-gray-700 transition-colors"
                    >
                      + {scourtSnapshot.progress.length - 5}건 더보기
                    </button>
                  )}

                  {/* 상세보기 모드에서 추가 정보 표시 */}
                  {showProgressDetail && (
                    <>
                      {/* 심급내용 */}
                      {scourtSnapshot.lowerCourt && scourtSnapshot.lowerCourt.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-gray-100">
                          <h3 className="text-xs font-semibold text-gray-500 mb-2">심급내용</h3>
                          <div className="space-y-1">
                            {scourtSnapshot.lowerCourt.map((item, idx) => (
                              <div key={idx} className="flex gap-2 text-xs p-2 bg-gray-50 rounded">
                                <span className="text-gray-500">{item.court}</span>
                                <span className="text-gray-700 font-medium">{item.caseNo}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 연계사건 */}
                      {scourtSnapshot.relatedCases && scourtSnapshot.relatedCases.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-gray-100">
                          <h3 className="text-xs font-semibold text-gray-500 mb-2">연계사건</h3>
                          <div className="space-y-1">
                            {scourtSnapshot.relatedCases.map((item, idx) => (
                              <div key={idx} className="flex items-center gap-2 text-xs p-2 bg-blue-50 rounded">
                                {item.relation && (
                                  <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px]">
                                    {item.relation}
                                  </span>
                                )}
                                <span className="text-gray-700 font-medium">{item.caseNo}</span>
                                {item.caseName && (
                                  <span className="text-gray-500">{item.caseName}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 기본정보 */}
                      {scourtSnapshot.basicInfo && Object.keys(scourtSnapshot.basicInfo).length > 0 && (
                        <div className="mt-4 pt-4 border-t border-gray-100">
                          <h3 className="text-xs font-semibold text-gray-500 mb-2">기본정보 (대법원)</h3>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            {Object.entries(scourtSnapshot.basicInfo).map(([key, value]) => (
                              <div key={key} className="flex gap-2">
                                <span className="text-gray-400">{key}</span>
                                <span className="text-gray-700">{value}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 제출서류 */}
                      {scourtSnapshot.documents && scourtSnapshot.documents.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-gray-100">
                          <h3 className="text-xs font-semibold text-gray-500 mb-2">제출서류</h3>
                          <div className="space-y-1">
                            {scourtSnapshot.documents.map((doc, idx) => (
                              <div key={idx} className="flex gap-2 text-xs">
                                <span className="text-gray-400">{doc.date}</span>
                                <span className="text-gray-700">{doc.content}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Unified Schedule Modal */}
      <UnifiedScheduleModal
        isOpen={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        onSuccess={() => {
          fetchAllSchedules()
          setShowScheduleModal(false)
        }}
        prefilledCaseId={caseData.id}
        prefilledCaseNumber={caseData.court_case_number || undefined}
      />

      <HearingDetailModal
        isOpen={showHearingModal}
        onClose={() => {
          setShowHearingModal(false)
          setSelectedHearing(null)
        }}
        onSuccess={() => {
          fetchAllSchedules()
        }}
        hearing={selectedHearing}
      />

      {/* Report Modal */}
      {reportModal && (
        <div className="fixed inset-0 z-[20050] flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white w-full max-w-2xl rounded-lg border border-gray-200 overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="relative px-6 pt-4 pb-3 flex items-center justify-center border-b border-gray-100">
              <Image
                src="/images/logo-horizontal.png"
                alt="법무법인 더율 로고"
                width={110}
                height={22}
                className="h-5 w-auto"
                priority
              />
              <button
                onClick={() => setReportModal(null)}
                className="absolute top-3 right-3 p-1 text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="닫기"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-8 py-8 text-sm text-gray-900 leading-relaxed space-y-4">
              <div className="text-center">
                <p className="text-lg font-bold">변론기일진행보고서</p>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex gap-4">
                  <span className="w-14 text-gray-500">수신</span>
                  <span>{clientDisplayName}</span>
                </div>
                <div className="flex gap-4">
                  <span className="w-14 text-gray-500">발신</span>
                  <span>법무법인 더율 담당 변호사</span>
                </div>
                <div className="flex gap-4">
                  <span className="w-14 text-gray-500">사안</span>
                  <span>{`${reportModal.court || '해당법원'} ${reportModal.caseNumber || '해당사건번호'}`}</span>
                </div>
                <div className="flex gap-4">
                  <span className="w-14 text-gray-500">변론기일</span>
                  <span>{reportModal.date ? new Date(reportModal.date).toLocaleDateString('ko-KR') : '-'}</span>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4 space-y-3">
                <p>
                  {clientDisplayName.replace('님', '')}님이 의뢰하신 위 사건에 대하여 다음과 같이 변론기일보고를 드립니다.
                </p>

                <p className="text-center font-semibold">다음</p>

                <div className="whitespace-pre-wrap min-h-[160px]">
                  {reportModal.report || '등록된 보고서가 없습니다.'}
                </div>

                <p className="text-center text-gray-500">
                  {reportModal.date ? new Date(reportModal.date).toLocaleDateString('ko-KR') : ''}
                </p>

                <div className="text-right mt-6 space-y-1">
                  <div className="inline-flex items-center justify-end gap-2">
                    <p className="font-bold">법무법인 더율</p>
                    <Image
                      src="/images/stamp-lawfirm.svg"
                      alt="법무법인 더율 법인인감"
                      width={48}
                      height={48}
                      className="h-12 w-12"
                    />
                  </div>
                  <p className="text-xs text-gray-500">담당 변호사</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Case Payments Modal */}
      <CasePaymentsModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        caseId={caseData.id}
        caseName={caseData.case_name}
        clientName={caseData.client?.name}
        officeLocation={
          caseData.office === '평택' || caseData.office === '천안'
            ? caseData.office
            : undefined
        }
      />
    </div>
  )
}
