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
  // SCOURT 연동 관련
  enc_cs_no?: string | null
  scourt_wmonid?: string | null
  scourt_case_name?: string | null
  client_role?: 'plaintiff' | 'defendant' | null
  opponent_name?: string | null
  case_result?: string | null
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
  const [scourtOpening, setScourtOpening] = useState(false)
  const [showProgressDetail, setShowProgressDetail] = useState(false)

  // 탭 상태: 'schedules' | 'progress'
  const [activeTab, setActiveTab] = useState<'schedules' | 'progress'>('schedules')

  // 계약 정보 드롭다운 상태
  const [showContractInfo, setShowContractInfo] = useState(false)

  // 나의사건 연동 상태
  const isLinked = !!caseData.enc_cs_no || scourtSyncStatus?.isLinked

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

  // SCOURT 사건 상세 페이지 열기 (Puppeteer)
  const handleOpenScourtCase = async () => {
    if (!caseData.court_case_number) {
      alert('사건번호가 없습니다.')
      return
    }

    setScourtOpening(true)
    try {
      const res = await fetch('/api/admin/scourt/open-case', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseId: caseData.id,
          caseNumber: caseData.court_case_number,
        }),
      })
      const data = await res.json()

      if (!data.success) {
        alert(data.error || '사건 열기 실패')
      }
      // 성공 시 Puppeteer 브라우저 창이 자동으로 열림
    } catch (error) {
      console.error('사건 열기 실패:', error)
      alert('사건 열기 중 오류가 발생했습니다.')
    } finally {
      setScourtOpening(false)
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

  // 진행내용 일자 포맷 (YYYYMMDD → YYYY-MM-DD)
  const formatProgressDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    if (dateStr.includes('-')) return dateStr
    if (dateStr.length === 8 && /^\d{8}$/.test(dateStr)) {
      return `${dateStr.slice(0,4)}-${dateStr.slice(4,6)}-${dateStr.slice(6,8)}`
    }
    if (/^\d{4}\.\d{2}\.\d{2}/.test(dateStr)) {
      return dateStr.replace(/^(\d{4})\.(\d{2})\.(\d{2})/, '$1-$2-$3')
    }
    return dateStr
  }

  // basicInfo 필드 조회 헬퍼 (한글/API 필드명 모두 지원)
  const getBasicInfo = (koreanKey: string, apiKey?: string): string | number | undefined => {
    if (!scourtSnapshot?.basicInfo) return undefined
    const info = scourtSnapshot.basicInfo as Record<string, any>
    return info[koreanKey] || (apiKey ? info[apiKey] : undefined)
  }

  // 진행내용 색상 결정 (SCOURT와 동일한 규칙)
  // - Blue (#003399): 기일 (괄호 포함, 예: "변론기일(제21호 법정)")
  // - Green (#336633): 명령 (송달 제외, 예: "조정조치명령서", "기일변경명령")
  // - Orange (#CC6600): 송달 (예: "소장부본 송달", "소환장 송달")
  // - Dark Red (#660000): 제출 (예: "준비서면 제출", "답변서 제출")
  // - Black (#000000): 기타 기본
  const getProgressColor = (content: string): string => {
    if (!content) return '#000000'

    // 송달: 내용에 "송달" 포함
    if (content.includes('송달')) {
      return '#CC6600'
    }

    // 기일: "기일(" 패턴 (괄호로 시작하는 기일 정보)
    if (/기일\s*\(/.test(content)) {
      return '#003399'
    }

    // 명령: "명령" 포함 (단, 송달 제외 - 위에서 이미 처리됨)
    if (content.includes('명령')) {
      return '#336633'
    }

    // 제출: "제출" 포함
    if (content.includes('제출')) {
      return '#660000'
    }

    // 기본: 검정
    return '#000000'
  }

  // 당사자 이름 조회 (의뢰인 여부 포함)
  const getPartyName = (role: 'plaintiff' | 'defendant', scourtName?: string) => {
    const isClient = caseData.client_role === role
    if (isClient && caseData.client?.name) {
      return { name: caseData.client.name, isClient: true }
    }
    if (role === 'plaintiff' && caseData.client_role === 'defendant' && caseData.opponent_name) {
      return { name: caseData.opponent_name, isClient: false }
    }
    if (role === 'defendant' && caseData.client_role === 'plaintiff' && caseData.opponent_name) {
      return { name: caseData.opponent_name, isClient: false }
    }
    if (scourtName) {
      return { name: scourtName, isClient: false }
    }
    return { name: '-', isClient: false }
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

        {/* Case Overview - 법원 사건번호 사건명 형식 + 계약정보 드롭다운 */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-5 shadow-sm">
          {/* 제목: 법원 사건번호 사건명 + 나의사건보기 버튼 */}
          <div className="flex items-start justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">
              {caseData.court_name} {caseData.court_case_number} {getBasicInfo('사건명', 'csNm') || caseData.scourt_case_name || caseData.case_name}
            </h2>
            {isLinked && (
              <button
                onClick={handleOpenScourtCase}
                disabled={scourtOpening}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="대법원 나의사건검색에서 원본 보기"
              >
                {scourtOpening ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                )}
                {scourtOpening ? '여는 중...' : '나의사건보기'}
              </button>
            )}
          </div>

          {/* 원고/피고 - 의뢰인이 먼저 나오도록 */}
          <div className="flex flex-wrap gap-6 mb-5">
            {(() => {
              const plaintiffInfo = getPartyName('plaintiff', String(getBasicInfo('원고', 'aplNm') || ''))
              const defendantInfo = getPartyName('defendant', String(getBasicInfo('피고', 'rspNm') || ''))

              // 의뢰인이 먼저 나오도록 순서 결정
              const parties = [
                { role: 'plaintiff', label: '원고', info: plaintiffInfo, color: 'blue' },
                { role: 'defendant', label: '피고', info: defendantInfo, color: 'red' }
              ]

              // 의뢰인을 먼저 정렬
              parties.sort((a, b) => {
                if (a.info.isClient && !b.info.isClient) return -1
                if (!a.info.isClient && b.info.isClient) return 1
                return 0
              })

              return parties.map((party) => (
                <div key={party.role} className="flex items-center gap-2">
                  {party.info.isClient ? (
                    <>
                      <span className="px-2.5 py-1 bg-sage-100 text-sage-700 rounded-md text-sm">
                        <span className="font-bold">의뢰인</span> {party.label}
                      </span>
                      <span className="text-base font-semibold text-gray-900">
                        {party.info.name}
                        {caseData.client?.phone && (
                          <span className="font-normal text-gray-500 ml-1">({caseData.client.phone})</span>
                        )}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="px-2.5 py-1 bg-gray-100 text-gray-600 rounded-md text-sm font-medium">{party.label}</span>
                      <span className="text-base text-gray-700">{party.info.name}</span>
                    </>
                  )}
                </div>
              ))
            })()}
          </div>

          {/* 추가 정보 (재판부, 접수일, 인지액 등) */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm mt-1">
            {getBasicInfo('재판부', 'jdgNm') && (
              <div className="flex items-center gap-1.5">
                <span className="text-gray-500">재판부</span>
                <span className="text-gray-800 font-medium">{getBasicInfo('재판부', 'jdgNm')}</span>
                {getBasicInfo('재판부전화번호', 'jdgTelno') && (
                  <span className="text-gray-600 text-xs ml-1">({getBasicInfo('재판부전화번호', 'jdgTelno')})</span>
                )}
              </div>
            )}
            {caseData.judge_name && (
              <div className="flex items-center gap-1.5">
                <span className="text-gray-500">담당 판사</span>
                <span className="text-gray-800 font-medium">{caseData.judge_name}</span>
              </div>
            )}
            {getBasicInfo('접수일', 'rcptDt') && (
              <div className="flex items-center gap-1.5">
                <span className="text-gray-500">접수일</span>
                <span className="text-gray-800 font-medium">{formatProgressDate(String(getBasicInfo('접수일', 'rcptDt')))}</span>
              </div>
            )}
            {getBasicInfo('인지액', 'stmpAmnt') && (
              <div className="flex items-center gap-1.5">
                <span className="text-gray-500">인지액</span>
                <span className="text-gray-800 font-medium">{Number(getBasicInfo('인지액', 'stmpAmnt')).toLocaleString()}원</span>
              </div>
            )}
            {(() => {
              const mrgrDvs = getBasicInfo('병합구분', 'mrgrDvs')
              return mrgrDvs && mrgrDvs !== '없음' && (
                <span className="px-2.5 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-md text-sm font-medium">
                  {mrgrDvs}
                </span>
              )
            })()}
            {(getBasicInfo('종국결과', 'endRslt') || caseData.case_result) && (
              <span className="px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-md text-sm font-medium">
                {getBasicInfo('종국결과', 'endRslt') || caseData.case_result}
              </span>
            )}
            {getBasicInfo('판결도달일', 'jdgArvDt') && (
              <span className="px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-md text-sm font-medium">
                {formatProgressDate(String(getBasicInfo('판결도달일', 'jdgArvDt')))} 도달
              </span>
            )}
            {getBasicInfo('확정일', 'cfrmDt') && (
              <span className="px-2.5 py-1 bg-green-50 text-green-700 border border-green-200 rounded-md text-sm font-medium">
                {formatProgressDate(String(getBasicInfo('확정일', 'cfrmDt')))} 확정
              </span>
            )}
            {getBasicInfo('조사관', 'exmnrNm') && (
              <div className="flex items-center gap-1.5">
                <span className="text-gray-500">조사관</span>
                <span className="text-gray-800 font-medium">{getBasicInfo('조사관', 'exmnrNm')}</span>
                {getBasicInfo('조사관전화번호', 'exmnrTelNo') && (
                  <span className="text-gray-600 text-xs ml-1">({getBasicInfo('조사관전화번호', 'exmnrTelNo')})</span>
                )}
              </div>
            )}
            {getBasicInfo('보존여부', 'prsrvYn') === 'Y' && (
              <span className="px-2.5 py-1 bg-gray-100 text-gray-700 border border-gray-200 rounded-md text-sm font-medium">
                {getBasicInfo('보존내용', 'prsrvCtt') || '기록보존'}
              </span>
            )}
          </div>

          {/* 계약 정보 드롭다운 */}
          <div className="border-t border-gray-100 mt-5 pt-4">
            <button
              onClick={() => setShowContractInfo(!showContractInfo)}
              className="flex items-center justify-between w-full text-left"
            >
              <span className="text-sm font-medium text-gray-700">계약 정보</span>
              <svg
                className={`w-5 h-5 text-gray-400 transition-transform ${showContractInfo ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showContractInfo && (
              <div className="mt-4 space-y-4">
                {/* 계약 기본 정보 */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <label className="text-xs text-gray-400">계약번호</label>
                    <p className="mt-0.5 text-gray-900">{caseData.contract_number || '-'}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">계약일</label>
                    <p className="mt-0.5 text-gray-900">{formatDate(caseData.contract_date)}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">사건종류</label>
                    <p className="mt-0.5 text-gray-900">{caseData.case_type || '기타'}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">의뢰인</label>
                    <p
                      className="mt-0.5 text-gray-900 cursor-pointer hover:text-sage-600"
                      onClick={() => caseData.client && router.push(`/clients/${caseData.client_id}`)}
                    >
                      {caseData.client?.name || '-'} &rsaquo;
                    </p>
                  </div>
                </div>

                {/* 수임료 정보 */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm border-t border-gray-100 pt-4">
                  <div>
                    <label className="text-xs text-gray-400">착수금</label>
                    <p className="mt-0.5 text-gray-900">{formatCurrency(caseData.retainer_fee)}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">발생 성공보수</label>
                    <p className="mt-0.5 text-gray-900">{formatCurrency(caseData.calculated_success_fee)}</p>
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={() => setShowPaymentModal(true)}
                      className="text-xs text-gray-400 hover:text-sage-600"
                    >
                      입금액 &rsaquo;
                    </button>
                    <p className="mt-0.5 text-gray-900">{formatCurrency(paymentTotal ?? caseData.total_received)}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">미수금</label>
                    <p className="mt-0.5 text-red-600 font-medium">{formatCurrency(calculateOutstandingBalance())}</p>
                  </div>
                </div>

                {/* 성공보수 약정 */}
                <div className="text-sm border-t border-gray-100 pt-4">
                  <label className="text-xs text-gray-400">성공보수 약정</label>
                  <p className="mt-0.5 text-gray-700">{caseData.success_fee_agreement || '-'}</p>
                </div>
              </div>
            )}
          </div>
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

        {/* 일정 섹션 */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-5 shadow-sm relative">
          {/* 일정 추가 버튼 - 우측 상단 */}
          <button
            onClick={() => setShowScheduleModal(true)}
            className="absolute top-4 right-4 p-2 text-sage-600 hover:bg-sage-50 rounded-lg transition-colors"
            title="일정 추가"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>

          {loading ? (
            <div className="py-10 text-center text-gray-400 text-base">
              로딩 중...
            </div>
          ) : unifiedSchedules.length === 0 ? (
            <div className="py-10 text-center text-gray-400 text-base">
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
        </div>

        {/* 진행내용 섹션 */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm relative">
          {/* 동기화 버튼 - 우측 상단 */}
          {caseData.court_case_number && (isLinked || scourtSyncStatus?.isLinked) && (
            <button
              onClick={handleScourtSync}
              disabled={scourtSyncing}
              className={`absolute top-4 right-4 p-2 rounded-lg transition-colors ${
                scourtSyncing
                  ? 'text-gray-400 cursor-not-allowed'
                  : 'text-sage-600 hover:bg-sage-50'
              }`}
              title="대법원 정보 동기화"
            >
              {scourtSyncing ? (
                <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
            </button>
          )}

          {!caseData.court_case_number ? (
            <div className="py-10 text-center text-gray-400 text-base">
              사건번호를 먼저 등록해주세요
            </div>
          ) : scourtLoading ? (
            <div className="py-10 text-center text-gray-400 text-base">
              로딩 중...
            </div>
          ) : !(isLinked || scourtSyncStatus?.isLinked) ? (
            <div className="py-10 text-center text-gray-400">
              <p className="text-base">대법원 사건 연동이 필요합니다.</p>
              <p className="mt-2 text-sm">사건번호로 검색하여 사건을 연동해주세요.</p>
            </div>
          ) : !scourtSnapshot ? (
            <div className="py-10 text-center text-gray-400">
              <p className="text-base">동기화된 데이터가 없습니다.</p>
              <p className="mt-2 text-sm">동기화 버튼을 눌러 대법원에서 정보를 가져오세요.</p>
            </div>
          ) : (
            <div className="space-y-8">
              {/* 상소심/이송 관련사건 */}
              {((scourtSnapshot.lowerCourt && scourtSnapshot.lowerCourt.length > 0) ||
                (scourtSnapshot.relatedCases && scourtSnapshot.relatedCases.length > 0)) && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                    상소심/이송 관련사건
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-purple-50 border-b border-purple-200">
                          <th className="py-3 px-4 text-left text-sm text-purple-700 font-semibold w-32">구분</th>
                          <th className="py-3 px-4 text-left text-sm text-purple-700 font-semibold">법원</th>
                          <th className="py-3 px-4 text-left text-sm text-purple-700 font-semibold">사건번호</th>
                        </tr>
                      </thead>
                      <tbody>
                        {scourtSnapshot.lowerCourt?.map((item: any, idx: number) => (
                          <tr key={`lower-${idx}`} className="border-b border-gray-100 last:border-0 hover:bg-purple-50/50 transition-colors">
                            <td className="py-3 px-4 text-sm text-purple-600 font-medium">하심사건</td>
                            <td className="py-3 px-4 text-sm text-gray-700">{item.court || '-'}</td>
                            <td className="py-3 px-4 text-sm text-gray-900 font-medium">{item.caseNo || '-'}</td>
                          </tr>
                        ))}
                        {scourtSnapshot.relatedCases?.map((item: any, idx: number) => (
                          <tr key={`related-${idx}`} className="border-b border-gray-100 last:border-0 hover:bg-purple-50/50 transition-colors">
                            <td className="py-3 px-4 text-sm text-purple-600 font-medium">{item.relation || '관련사건'}</td>
                            <td className="py-3 px-4 text-sm text-gray-700">{item.caseName || '-'}</td>
                            <td className="py-3 px-4 text-sm text-gray-900 font-medium">{item.caseNo || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 최근 기일 */}
              {scourtSnapshot.hearings && scourtSnapshot.hearings.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    최근 기일
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-blue-50 border-b border-blue-200">
                          <th className="py-3 px-4 text-left text-sm text-blue-700 font-semibold w-28">일자</th>
                          <th className="py-3 px-4 text-left text-sm text-blue-700 font-semibold w-20">시각</th>
                          <th className="py-3 px-4 text-left text-sm text-blue-700 font-semibold">기일구분</th>
                          <th className="py-3 px-4 text-left text-sm text-blue-700 font-semibold">기일장소</th>
                          <th className="py-3 px-4 text-left text-sm text-blue-700 font-semibold w-24">결과</th>
                        </tr>
                      </thead>
                      <tbody>
                        {scourtSnapshot.hearings.map((hearing: any, idx: number) => (
                          <tr key={idx} className="border-b border-gray-100 last:border-0 hover:bg-blue-50/50 transition-colors">
                            <td className="py-3 px-4 text-sm text-gray-900 font-medium">{formatProgressDate(hearing.trmDt || hearing.date)}</td>
                            <td className="py-3 px-4 text-sm text-gray-700">
                              {hearing.trmHm ? `${hearing.trmHm.slice(0,2)}:${hearing.trmHm.slice(2)}` : hearing.time || '-'}
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-700">{hearing.trmNm || hearing.type || '-'}</td>
                            <td className="py-3 px-4 text-sm text-gray-600">{hearing.trmPntNm || hearing.location || '-'}</td>
                            <td className="py-3 px-4 text-sm text-gray-600">{hearing.rslt || hearing.result || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 최근 제출서류 */}
              {scourtSnapshot.documents && scourtSnapshot.documents.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    최근 제출서류
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-amber-50 border-b border-amber-200">
                          <th className="py-3 px-4 text-left text-sm text-amber-700 font-semibold w-28">일자</th>
                          <th className="py-3 px-4 text-left text-sm text-amber-700 font-semibold">내용</th>
                        </tr>
                      </thead>
                      <tbody>
                        {scourtSnapshot.documents.map((doc: any, idx: number) => (
                          <tr key={idx} className="border-b border-gray-100 last:border-0 hover:bg-amber-50/50 transition-colors">
                            <td className="py-3 px-4 text-sm text-gray-900 font-medium">{formatProgressDate(doc.ofdocRcptYmd || doc.date)}</td>
                            <td className="py-3 px-4 text-sm text-gray-700">{doc.content || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 진행내용 */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4 text-sage-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                  진행내용
                </h3>
              {scourtSnapshot.progress && scourtSnapshot.progress.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-sage-50 border-b border-sage-200">
                        <th className="py-4 px-5 text-left text-sm text-sage-700 font-semibold w-32">일자</th>
                        <th className="py-4 px-5 text-left text-sm text-sage-700 font-semibold">내용</th>
                        <th className="py-4 px-5 text-left text-sm text-sage-700 font-semibold w-36">결과</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scourtSnapshot.progress.slice(0, showProgressDetail ? undefined : 10).map((item, idx) => {
                        const textColor = getProgressColor(item.content || '')
                        return (
                          <tr key={idx} className="border-b border-gray-100 last:border-0 hover:bg-sage-50/50 transition-colors">
                            <td className="py-4 px-5 text-base font-medium whitespace-nowrap" style={{ color: textColor }}>{formatProgressDate(item.date)}</td>
                            <td className="py-4 px-5 text-base leading-relaxed" style={{ color: textColor }}>{item.content || '-'}</td>
                            <td className="py-4 px-5 text-base" style={{ color: textColor }}>{item.result ? formatProgressDate(item.result) : '-'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  {!showProgressDetail && scourtSnapshot.progress.length > 10 && (
                    <button
                      onClick={() => setShowProgressDetail(true)}
                      className="w-full py-3.5 text-sm text-sage-600 hover:text-sage-700 hover:bg-sage-50 transition-colors mt-2 border-t border-gray-100 font-medium"
                    >
                      + {scourtSnapshot.progress.length - 10}건 더보기
                    </button>
                  )}
                </div>
              ) : (
                <div className="py-10 text-center text-gray-400">
                  <p className="text-base">진행내용 데이터가 없습니다.</p>
                  <p className="mt-2 text-sm">동기화 버튼을 눌러 최신 정보를 가져오세요.</p>
                </div>
              )}
              </div>
            </div>
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
      />
    </div>
  )
}
