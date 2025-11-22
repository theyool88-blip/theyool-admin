'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
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
  notes: string | null
  created_at: string
  updated_at: string
  client?: Client
  case_relations?: RelatedCase[]
}

interface Profile {
  id: string
  name: string
  email: string
  role: string
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

export default function CaseDetail({ profile, caseData }: { profile: Profile, caseData: LegalCase }) {
  const [unifiedSchedules, setUnifiedSchedules] = useState<UnifiedScheduleItem[]>([])
  const [loading, setLoading] = useState(false)
  const [showScheduleModal, setShowScheduleModal] = useState(false)

  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    fetchAllSchedules()
  }, [])

  const fetchAllSchedules = async () => {
    if (!caseData.court_case_number) return

    try {
      setLoading(true)
      const unified: UnifiedScheduleItem[] = []

      // Fetch court hearings
      const { data: hearings, error: hearingError } = await supabase
        .from('court_hearings')
        .select('*')
        .eq('case_number', caseData.court_case_number)
        .order('hearing_date', { ascending: true })

      if (hearingError) throw hearingError

      // Fetch deadlines
      const { data: deadlines, error: deadlineError } = await supabase
        .from('case_deadlines')
        .select('*')
        .eq('case_number', caseData.court_case_number)
        .order('deadline_date', { ascending: true })

      if (deadlineError) throw deadlineError

      // Fetch schedules
      const { data: schedules, error: scheduleError } = await supabase
        .from('case_schedules')
        .select('*')
        .eq('case_id', caseData.id)
        .order('scheduled_date', { ascending: true })

      if (scheduleError) throw scheduleError

      // Transform hearings
      if (hearings) {
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

      // Transform deadlines
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
            datetime: deadline.deadline_datetime,
            status: deadline.status,
            days_until: daysUntil,
            subtype: deadline.deadline_type,
            source: deadline
          })
        })
      }

      // Transform schedules
      if (schedules) {
        schedules.forEach(schedule => {
          const date = new Date(schedule.scheduled_date)
          const today = new Date()
          today.setHours(0, 0, 0, 0)
          date.setHours(0, 0, 0, 0)
          const daysUntil = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

          unified.push({
            id: schedule.id,
            type: 'schedule',
            title: schedule.title,
            date: schedule.scheduled_date,
            datetime: schedule.scheduled_time ? `${schedule.scheduled_date}T${schedule.scheduled_time}` : undefined,
            location: schedule.location,
            days_until: daysUntil,
            subtype: schedule.schedule_type,
            source: schedule
          })
        })
      }

      // Sort by date
      unified.sort((a, b) => {
        return a.date.localeCompare(b.date)
      })

      setUnifiedSchedules(unified)
    } catch (error) {
      console.error('일정 조회 실패:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const formatCurrency = (amount: number | null) => {
    if (!amount) return '-'
    return `${amount.toLocaleString('ko-KR')}원`
  }

  const calculateOutstandingBalance = () => {
    const retainer = caseData.retainer_fee || 0
    const successFee = caseData.calculated_success_fee || 0
    const received = caseData.total_received || 0
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

  const getStatusColor = (status: string) => {
    return status === '진행중'
      ? 'bg-emerald-50 text-emerald-700 border-l-emerald-400'
      : 'bg-gray-50 text-gray-600 border-l-gray-400'
  }

  const getOfficeColor = (office: string) => {
    switch (office) {
      case '평택': return 'bg-blue-50 text-blue-700'
      case '천안': return 'bg-purple-50 text-purple-700'
      case '소송구조': return 'bg-amber-50 text-amber-700'
      default: return 'bg-gray-50 text-gray-700'
    }
  }

  const getScheduleTypeColor = (type: 'court_hearing' | 'deadline' | 'schedule', subtype?: string) => {
    if (type === 'court_hearing') {
      // 변호사미팅은 청록색, 일반 법원기일은 파란색
      if (subtype === 'HEARING_LAWYER_MEETING') {
        return 'bg-teal-50 text-teal-700 border-l-teal-400'
      }
      return 'bg-blue-50 text-blue-700 border-l-blue-400'
    } else if (type === 'deadline') {
      return 'bg-orange-50 text-orange-700 border-l-orange-400'
    } else {
      // Schedule types
      if (subtype === 'trial') {
        return 'bg-purple-50 text-purple-700 border-l-purple-400'
      } else if (subtype === 'consultation') {
        return 'bg-indigo-50 text-indigo-700 border-l-indigo-400'
      } else if (subtype === 'meeting') {
        return 'bg-emerald-50 text-emerald-700 border-l-emerald-400'
      }
      return 'bg-gray-50 text-gray-700 border-l-gray-400'
    }
  }

  const getHearingStatusColor = (status: HearingStatus) => {
    switch (status) {
      case 'SCHEDULED': return 'bg-blue-50 text-blue-700'
      case 'COMPLETED': return 'bg-green-50 text-green-700'
      case 'POSTPONED': return 'bg-yellow-50 text-yellow-700'
      case 'CANCELLED': return 'bg-gray-50 text-gray-600'
      default: return 'bg-gray-50 text-gray-600'
    }
  }

  const getDeadlineStatusColor = (status: DeadlineStatus) => {
    switch (status) {
      case 'PENDING': return 'bg-yellow-50 text-yellow-700'
      case 'COMPLETED': return 'bg-green-50 text-green-700'
      case 'OVERDUE': return 'bg-red-50 text-red-700'
      default: return 'bg-gray-50 text-gray-600'
    }
  }

  const calculateDaysUntil = (deadlineDate: string): number => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const deadline = new Date(deadlineDate)
    deadline.setHours(0, 0, 0, 0)
    const diffTime = deadline.getTime() - today.getTime()
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  }

  const handleDeleteSchedule = async (item: UnifiedScheduleItem) => {
    const confirmMsg = item.type === 'court_hearing'
      ? '이 법원 기일을 삭제하시겠습니까?'
      : item.type === 'deadline'
      ? '이 데드라인을 삭제하시겠습니까?'
      : '이 일정을 삭제하시겠습니까?'

    if (!confirm(confirmMsg)) return

    try {
      const tableName = item.type === 'court_hearing'
        ? 'court_hearings'
        : item.type === 'deadline'
        ? 'case_deadlines'
        : 'case_schedules'

      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', item.id)

      if (error) throw error

      alert('일정이 삭제되었습니다.')
      fetchAllSchedules()
    } catch (error: any) {
      console.error('일정 삭제 실패:', error)
      alert(`삭제 실패: ${error.message}`)
    }
  }

  const handleUpdateHearingStatus = async (hearingId: string, newStatus: HearingStatus) => {
    try {
      const { error } = await supabase
        .from('court_hearings')
        .update({ status: newStatus })
        .eq('id', hearingId)

      if (error) throw error

      alert('법원 기일 상태가 변경되었습니다.')
      fetchAllSchedules()
    } catch (error: any) {
      console.error('법원 기일 상태 변경 실패:', error)
      alert(`상태 변경 실패: ${error.message}`)
    }
  }

  const handleCompleteDeadline = async (deadlineId: string) => {
    try {
      const { error } = await supabase
        .from('case_deadlines')
        .update({
          status: 'COMPLETED',
          completed_at: new Date().toISOString()
        })
        .eq('id', deadlineId)

      if (error) throw error

      alert('데드라인이 완료 처리되었습니다.')
      fetchAllSchedules()
    } catch (error: any) {
      console.error('데드라인 완료 처리 실패:', error)
      alert(`완료 처리 실패: ${error.message}`)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <a href="/" className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg flex items-center justify-center hover:from-blue-600 hover:to-blue-800 transition-colors cursor-pointer">
              <span className="text-white font-bold text-lg">율</span>
            </a>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">사건 상세</h1>
              <p className="text-sm text-gray-600">{caseData.case_name}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="/cases"
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              목록으로
            </a>
            <a
              href={`/cases/${caseData.id}/edit`}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
            >
              수정
            </a>
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">{profile.name}</p>
              <p className="text-xs text-gray-500">
                {profile.role === 'admin' ? '관리자' : '직원'}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
            {/* 사건 개요 */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">사건 개요</h2>
                <div className="flex gap-2">
                  <span className={`inline-flex px-3 py-1.5 text-sm font-semibold rounded-md ${getOfficeColor(caseData.office)}`}>
                    {caseData.office}
                  </span>
                  <span className={`inline-flex px-3 py-1.5 text-sm font-semibold rounded-md border-l-4 ${getStatusColor(caseData.status)}`}>
                    {caseData.status}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">계약번호</label>
                  <p className="mt-1 text-base text-gray-900">{caseData.contract_number || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">계약일</label>
                  <p className="mt-1 text-base text-gray-900">{formatDate(caseData.contract_date)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">사건번호</label>
                  <p className="mt-1 text-base text-gray-900">{caseData.court_case_number || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">법원</label>
                  <p className="mt-1 text-base text-gray-900">{caseData.court_name || '-'}</p>
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium text-gray-500">사건명</label>
                  <p className="mt-1 text-base text-gray-900 font-semibold">{caseData.case_name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">사건종류</label>
                  <p className="mt-1 text-base text-gray-900">{caseData.case_type || '-'}</p>
                </div>
              </div>
            </div>

            {/* 수임료 정보 + 의뢰인 정보 */}
            <div className="grid grid-cols-2 gap-6">
              {/* 수임료 정보 */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">수임료 정보</h2>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">착수금</label>
                    <p className="mt-1 text-lg font-semibold text-gray-900">{formatCurrency(caseData.retainer_fee)}</p>
                  </div>
                  <div className="border-t border-gray-100 pt-4">
                    <label className="text-sm font-medium text-gray-500">발생 성공보수</label>
                    <p className="mt-1 text-lg font-semibold text-blue-600">{formatCurrency(caseData.calculated_success_fee)}</p>
                  </div>
                  <div className="border-t border-gray-100 pt-4">
                    <label className="text-sm font-medium text-gray-500">입금액</label>
                    <p className="mt-1 text-lg font-semibold text-emerald-600">{formatCurrency(caseData.total_received)}</p>
                  </div>
                  <div className="border-t border-gray-100 pt-4">
                    <label className="text-sm font-medium text-gray-500">미수금</label>
                    <p className="mt-1 text-xs text-gray-500 mb-1">(착수금 + 발생성보 - 입금액)</p>
                    <p className="text-lg font-semibold text-red-600">{formatCurrency(calculateOutstandingBalance())}</p>
                  </div>
                  {caseData.success_fee_agreement && (
                    <div className="border-t border-gray-100 pt-4">
                      <label className="text-sm font-medium text-gray-500">성공보수 약정</label>
                      <p className="mt-1 text-sm text-gray-700">{caseData.success_fee_agreement}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* 의뢰인 정보 */}
              {caseData.client && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-6">의뢰인 정보</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">이름</label>
                      <p className="mt-1 text-base text-gray-900 font-semibold">{caseData.client.name}</p>
                    </div>
                    {caseData.client.phone && (
                      <div>
                        <label className="text-sm font-medium text-gray-500">연락처</label>
                        <p className="mt-1 text-base text-gray-900">{caseData.client.phone}</p>
                      </div>
                    )}
                    {caseData.client.email && (
                      <div>
                        <label className="text-sm font-medium text-gray-500">이메일</label>
                        <p className="mt-1 text-base text-gray-900">{caseData.client.email}</p>
                      </div>
                    )}
                    {caseData.client.birth_date && (
                      <div>
                        <label className="text-sm font-medium text-gray-500">생년월일</label>
                        <p className="mt-1 text-base text-gray-900">{formatDate(caseData.client.birth_date)}</p>
                      </div>
                    )}
                    {caseData.client.gender && (
                      <div>
                        <label className="text-sm font-medium text-gray-500">성별</label>
                        <p className="mt-1 text-base text-gray-900">{caseData.client.gender === 'M' ? '남성' : '여성'}</p>
                      </div>
                    )}
                    {caseData.client.address && (
                      <div>
                        <label className="text-sm font-medium text-gray-500">주소</label>
                        <p className="mt-1 text-base text-gray-900">{caseData.client.address}</p>
                      </div>
                    )}
                    {caseData.client.notes && (
                      <div>
                        <label className="text-sm font-medium text-gray-500">메모</label>
                        <p className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">{caseData.client.notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 관련 사건 */}
            {caseData.case_relations && caseData.case_relations.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">관련 사건</h2>
                <div className="grid grid-cols-2 gap-3">
                  {caseData.case_relations.map((relation) => (
                    <div
                      key={relation.id}
                      onClick={() => router.push(`/cases/${relation.related_case_id}`)}
                      className="p-4 border border-gray-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 cursor-pointer transition-all"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          {relation.relation_type && (
                            <span className="inline-block px-2 py-1 text-xs font-semibold bg-blue-100 text-blue-700 rounded">
                              {relation.relation_type}
                            </span>
                          )}
                        </div>
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                      <p className="text-sm font-medium text-gray-900">
                        {relation.related_case?.case_name || '사건명 없음'}
                      </p>
                      {relation.related_case?.contract_number && (
                        <p className="text-xs text-gray-500 mt-1">
                          {relation.related_case.contract_number}
                        </p>
                      )}
                      {relation.notes && (
                        <p className="mt-2 text-xs text-gray-600">{relation.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 메모 */}
            {caseData.notes && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">메모</h2>
                <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{caseData.notes}</p>
              </div>
            )}

          {/* 일정 목록 (Unified Schedules) */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">일정 목록</h2>
              <button
                onClick={() => setShowScheduleModal(true)}
                className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                + 일정 추가
              </button>
            </div>

            {!caseData.court_case_number ? (
              <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
                  <span className="text-2xl">⚠️</span>
                </div>
                <p className="text-gray-600 font-medium">사건번호가 등록되지 않았습니다.</p>
                <p className="text-sm text-gray-500 mt-1">사건번호를 먼저 등록해주세요.</p>
              </div>
            ) : loading ? (
              <div className="text-center py-12">
                <p className="text-gray-500">로딩 중...</p>
              </div>
            ) : unifiedSchedules.length === 0 ? (
              <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
                  <span className="text-2xl">📅</span>
                </div>
                <p className="text-gray-600 font-medium">등록된 일정이 없습니다.</p>
                <p className="text-sm text-gray-500 mt-1">새로운 일정을 추가해보세요.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {unifiedSchedules.map((item) => {
                  const isHearing = item.type === 'court_hearing'
                  const isDeadline = item.type === 'deadline'
                  const isSchedule = item.type === 'schedule'
                  const source = item.source as any

                  return (
                    <div
                      key={`${item.type}-${item.id}`}
                      className={`p-4 border-2 rounded-lg hover:shadow-md transition-all ${getScheduleTypeColor(item.type, item.subtype)}`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className={`px-3 py-1.5 rounded-md text-sm font-semibold ${getScheduleTypeColor(item.type, item.subtype)}`}>
                            {item.title}
                          </span>

                          {item.status && (
                            <span className={`px-3 py-1.5 rounded-md text-sm font-semibold ${
                              isHearing
                                ? getHearingStatusColor(item.status as HearingStatus)
                                : getDeadlineStatusColor(item.status as DeadlineStatus)
                            }`}>
                              {isHearing
                                ? HEARING_STATUS_LABELS[item.status as HearingStatus]
                                : DEADLINE_STATUS_LABELS[item.status as DeadlineStatus]
                              }
                            </span>
                          )}

                          {item.days_until !== undefined && (
                            <span className={`px-3 py-1.5 rounded-md text-sm font-bold ${
                              item.days_until <= 1 ? 'bg-red-100 text-red-700' :
                              item.days_until <= 3 ? 'bg-orange-100 text-orange-700' :
                              item.days_until <= 7 ? 'bg-yellow-100 text-yellow-700' :
                              'bg-green-100 text-green-700'
                            }`}>
                              {formatDaysUntil(item.days_until)}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {item.datetime && (
                            <span className="text-sm font-semibold text-gray-900">
                              {formatDateTime(item.datetime)}
                            </span>
                          )}
                          {!item.datetime && item.date && (
                            <span className="text-sm font-semibold text-gray-900">
                              {formatDate(item.date)}
                            </span>
                          )}

                          {/* Action buttons based on type */}
                          {isHearing && item.status === 'SCHEDULED' && (
                            <button
                              onClick={() => handleUpdateHearingStatus(item.id, 'COMPLETED')}
                              className="px-3 py-1 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded hover:bg-green-100"
                            >
                              완료
                            </button>
                          )}

                          {isDeadline && item.status === 'PENDING' && (
                            <button
                              onClick={() => handleCompleteDeadline(item.id)}
                              className="px-3 py-1 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded hover:bg-green-100"
                            >
                              완료
                            </button>
                          )}

                          <button
                            onClick={() => handleDeleteSchedule(item)}
                            className="px-3 py-1 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded hover:bg-red-100"
                          >
                            삭제
                          </button>
                        </div>
                      </div>

                      {/* Additional details */}
                      <div className="space-y-2">
                        {item.location && (
                          <p className="text-sm text-gray-600 flex items-center gap-1.5">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            {item.location}
                          </p>
                        )}

                        {isHearing && source.judge_name && (
                          <p className="text-sm text-gray-600">
                            담당 판사: {source.judge_name}
                          </p>
                        )}

                        {isDeadline && (
                          <div className="grid grid-cols-2 gap-4 text-sm pt-2">
                            <div>
                              <p className="text-gray-500">기산일</p>
                              <p className="text-gray-900 font-medium">{formatDate(source.trigger_date)}</p>
                            </div>
                            {source.completed_at && (
                              <div>
                                <p className="text-gray-500">완료일</p>
                                <p className="text-green-600 font-medium">{formatDateTime(source.completed_at)}</p>
                              </div>
                            )}
                          </div>
                        )}

                        {(source.notes || source.description) && (
                          <p className="text-sm text-gray-600 italic mt-2 pt-2 border-t border-gray-100">
                            {source.notes || source.description}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Unified Schedule Modal */}
      <UnifiedScheduleModal
        isOpen={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        onSuccess={() => {
          fetchAllSchedules()
          setShowScheduleModal(false)
        }}
        prefilledCaseNumber={caseData.court_case_number || undefined}
      />
    </div>
  )
}
