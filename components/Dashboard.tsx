'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import WeeklyCalendar from './WeeklyCalendar'
import QuickAddHearingModal from './QuickAddHearingModal'
import HearingDetailModal from './HearingDetailModal'
import UnifiedScheduleModal, { type EditScheduleData } from './UnifiedScheduleModal'
import { formatDaysUntil, CourtHearing } from '@/types/court-hearing'

interface Profile {
  id: string
  name: string
  email: string
  role: string
  is_active: boolean
}

export interface Schedule {
  id: string
  title: string
  scheduled_date: string
  scheduled_time: string | null
  schedule_type: 'trial' | 'consultation' | 'meeting'
  location: string | null
  case_id: string | null
}

interface CombinedScheduleItem {
  id: string
  type: 'hearing' | 'deadline'
  case_number: string | null
  title: string
  date: string
  datetime?: string
  location?: string | null
  days_until: number
  event_type?: string
  event_subtype?: string | null
  full_data?: CalendarEvent
}

interface CalendarEvent {
  id: string
  event_type: string
  event_subtype?: string | null
  title: string
  event_date: string
  event_time?: string | null
  event_datetime?: string | null
  location?: string | null
  reference_id?: string | null
  case_name?: string | null
  description?: string | null
  status?: string | null
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function Dashboard({ profile, initialSchedules }: { profile: Profile, initialSchedules: Schedule[] }) {
  const router = useRouter()
  const supabase = createClient()

  const [showHearingModal, setShowHearingModal] = useState(false)
  const [selectedHearing, setSelectedHearing] = useState<CourtHearing | null>(null)
  const [showHearingDetailModal, setShowHearingDetailModal] = useState(false)
  const [combinedSchedules, setCombinedSchedules] = useState<CombinedScheduleItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [showUnifiedModal, setShowUnifiedModal] = useState(false)
  const [editScheduleData, setEditScheduleData] = useState<EditScheduleData | undefined>(undefined)
  const [unifiedModalTab, setUnifiedModalTab] = useState<'schedule' | 'payment' | 'expense'>('schedule')
  const [dayEvents, setDayEvents] = useState<Array<{ id?: string; type: string; time: string; title: string; amount?: number; event_type?: string; event_data?: any; payment_data?: any; expense_data?: any; sortType?: string }>>([])
  const [dayEventsDate, setDayEventsDate] = useState('')
  const [dayEventsLoading, setDayEventsLoading] = useState(false)

  useEffect(() => {
    fetchUrgentItems()
  }, [])

  const fetchUrgentItems = async () => {
    try {
      setLoading(true)

      // 통합 캘린더 API 사용 - 지난 일정 포함하여 조회 (D-30 ~ D+30)
      const today = new Date()
      const pastMonth = new Date()
      pastMonth.setDate(today.getDate() - 30)
      const nextMonth = new Date()
      nextMonth.setDate(today.getDate() + 30)

      const startDate = pastMonth.toISOString().split('T')[0]
      const endDate = nextMonth.toISOString().split('T')[0]

      const response = await fetch(`/api/admin/calendar?start_date=${startDate}&end_date=${endDate}`)
      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || '일정 조회 실패')
      }

      // 통합 스케줄 생성
      const combined: CombinedScheduleItem[] = []
      today.setHours(0, 0, 0, 0)

      if (result.data) {
        (result.data as CalendarEvent[]).forEach((event) => {
          const eventDate = new Date(event.event_date)
          eventDate.setHours(0, 0, 0, 0)
          const daysUntil = Math.ceil((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

          // D-10 이내만 표시 (오늘 포함, 10일 후까지)
          if (daysUntil < 0 || daysUntil > 10) {
            return
          }

          // 재판일정(D-10)에서는 상담 제외
          if (event.event_type === 'CONSULTATION') {
            return
          }

          // event_type에 따라 type 결정
          let type: 'hearing' | 'deadline' = 'hearing'

          // VIEW에서 이미 한글 제목 형식으로 변환됨: "(종류) 사건명"
          const title = event.title

          if (event.event_type === 'DEADLINE') {
            type = 'deadline'
          } else {
            type = 'hearing' // COURT_HEARING만
          }

          combined.push({
            id: event.id,
            type,
            case_number: event.reference_id ?? null,
            title,
            date: event.event_date,
            datetime: event.event_datetime ?? undefined,
            location: event.location,
            days_until: daysUntil,
            event_type: event.event_type,
            event_subtype: event.event_subtype,
            full_data: event
          })
        })
      }

      // 날짜순 정렬 (가까운 날짜 먼저)
      combined.sort((a, b) => {
        if (a.days_until !== b.days_until) {
          return a.days_until - b.days_until
        }
        return a.date.localeCompare(b.date)
      })

      setCombinedSchedules(combined)
    } catch (error) {
      console.error('일정 조회 실패:', error)
    } finally {
      setLoading(false)
    }
  }

  const getUrgencyBadge = (daysUntil?: number) => {
    if (daysUntil !== undefined && daysUntil <= 3) {
      return 'bg-red-100 text-red-700'
    }
    if (daysUntil !== undefined && daysUntil <= 7) {
      return 'bg-amber-100 text-amber-700'
    }
    return 'bg-gray-100 text-gray-600'
  }

  const formatDateTime = (datetime: string) => {
    const d = new Date(datetime)
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const hour = String(d.getHours()).padStart(2, '0')
    const minute = String(d.getMinutes()).padStart(2, '0')
    return `${month}.${day} ${hour}:${minute}`
  }

  const handleViewAll = async (date: Date, schedules: Schedule[]) => {
    const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    const dayStr = localDate.toISOString().split('T')[0]
    setDayEventsDate(dayStr)
    setDayEventsLoading(true)
    try {
      // 1) unified calendar events for the day
      const calRes = await fetch(`/api/admin/calendar?start_date=${dayStr}&end_date=${dayStr}`)
      const calJson = await calRes.json()
      const calendarEvents = (calJson.data || []).map((ev: any) => {
        const time = ev.event_time && ev.event_time !== '00:00' ? ev.event_time : ''
        const eventType = ev.event_type === 'COURT_HEARING'
          ? 'court'
          : ev.event_type === 'CONSULTATION'
          ? 'consultation'
          : 'calendar'
        const sortType = ev.event_type === 'COURT_HEARING'
          ? 'calendar_court'
          : ev.event_type === 'CONSULTATION'
          ? 'calendar_consultation'
          : 'calendar_other'
        return {
          id: ev.id,
          type: eventType,
          time,
          title: ev.title,
          sortType,
          event_type: ev.event_type,
          event_data: ev
        }
      })

      // 2) payments for the day
      const payRes = await fetch(`/api/admin/payments?from_date=${dayStr}&to_date=${dayStr}`)
      const payJson = await payRes.json()
      const payments = (payJson.data || []).map((p: any) => ({
        id: p.id,
        type: 'payment',
        time: '',
        title: `[입금] ${p.case_name || p.depositor_name || '입금'} (${p.payment_category})`,
        amount: p.amount,
        payment_data: p
      }))

      // 3) expenses for the day
      const expRes = await fetch(`/api/admin/expenses?startDate=${dayStr}&endDate=${dayStr}`)
      const expJson = await expRes.json()
      const expenses = (expJson.expenses || []).map((e: any) => ({
        id: e.id,
        type: 'expense',
        time: '',
        title: `[지출] ${e.expense_category}${e.subcategory ? `/${e.subcategory}` : ''}${e.vendor_name ? ` - ${e.vendor_name}` : ''}`,
        amount: e.amount,
        expense_data: e
      }))

      const combined = [
        ...calendarEvents,
        ...payments,
        ...expenses,
      ].map((item: any) => ({
        id: item.id,
        type: item.type,
        time: parseTime(item.time),
        title: item.title,
        amount: item.amount,
        sortType: item.sortType || (item.type === 'calendar' ? 'calendar_other' : item.type),
        event_type: item.event_type,
        event_data: item.event_data,
        payment_data: item.payment_data,
        expense_data: item.expense_data
      }))

      const sorted = sortDayItems(combined)
      setDayEvents(sorted)
    } catch (err) {
      console.error('Failed to load day events', err)
      setDayEvents([])
    } finally {
      setDayEventsLoading(false)
    }
  }

  useEffect(() => {
    // 페이지 로드시 오늘 날짜 기준 이벤트 표시
    const today = new Date()
    handleViewAll(today, [])
  }, [])

  return (
    <div className="max-w-5xl mx-auto pt-20 pb-8 px-4">
      {/* 주간 캘린더 */}
      <WeeklyCalendar
        initialSchedules={initialSchedules}
        onScheduleClick={async (schedule) => {
          if (schedule.event_type === 'COURT_HEARING') {
            // 법원기일 편집 - UnifiedScheduleModal 사용
            const { data: hearing } = await supabase
              .from('court_hearings')
              .select('*')
              .eq('id', schedule.id)
              .single()

            if (hearing) {
              const hearingDateTime = new Date(hearing.hearing_date)
              const dateStr = hearingDateTime.toISOString().split('T')[0]
              const timeStr = hearingDateTime.toTimeString().slice(0, 5)

              setEditScheduleData({
                id: hearing.id,
                event_type: 'COURT_HEARING',
                event_subtype: hearing.hearing_type,
                reference_id: hearing.case_number,
                case_name: null,
                case_id: null,
                event_date: dateStr,
                event_time: timeStr,
                location: hearing.location || null,
                description: hearing.notes || null,
                status: hearing.status,
                report: hearing.report || null,
                result: hearing.result || null,
                judge_name: hearing.judge_name || null
              })
              setUnifiedModalTab('schedule')
              setShowUnifiedModal(true)
            }
          } else if (schedule.event_type === 'CONSULTATION') {
            // 상담 수정 모달로 연결
            const consultationId = schedule.id
            const { data: consultation } = await supabase
              .from('consultations')
              .select('*')
              .eq('id', consultationId)
              .single()

            if (consultation) {
              setEditScheduleData({
                id: consultation.id,
                event_type: 'CONSULTATION',
                event_subtype: consultation.request_type,
                reference_id: consultation.id,
                case_name: consultation.name,
                case_id: consultation.case_id || null,
                event_date: consultation.preferred_date || consultation.confirmed_date || '',
                event_time: consultation.preferred_time || consultation.confirmed_time || null,
                location: consultation.office_location || null,
                description: consultation.message || null,
                status: consultation.status || 'confirmed',
                preferred_date: consultation.preferred_date,
                preferred_time: consultation.preferred_time,
                confirmed_date: consultation.confirmed_date,
                confirmed_time: consultation.confirmed_time
              })
              setUnifiedModalTab('schedule')
              setShowUnifiedModal(true)
            }
          }
        }}
        onDateClick={(date) => {
          const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
          const formattedDate = localDate.toISOString().split('T')[0]
          setSelectedDate(formattedDate)
          setEditScheduleData(undefined)
          setUnifiedModalTab('schedule')
          setShowUnifiedModal(true)
        }}
        onViewAll={(date, schedules) => handleViewAll(date, schedules)}
      />

      {/* 당일 이벤트 */}
      <section className="mt-5">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-gray-900">당일 이벤트</h2>
              {dayEventsDate && (
                <span className="text-xs text-gray-500">{dayEventsDate}</span>
              )}
            </div>
          </div>
          {dayEventsLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-300 border-t-gray-600"></div>
            </div>
          ) : dayEvents.length === 0 ? (
            <p className="text-center text-xs text-gray-400 py-8">선택된 날짜의 이벤트가 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {dayEvents.map((item, idx) => (
                <div
                  key={idx}
                  onClick={async () => {
                    // 입금 클릭
                    if (item.type === 'payment' && item.payment_data) {
                      const p = item.payment_data
                      setEditScheduleData({
                        id: p.id,
                        event_type: 'PAYMENT',
                        payment_date: p.payment_date,
                        depositor_name: p.depositor_name,
                        amount: p.amount,
                        payment_category: p.payment_category,
                        office_location: p.office_location,
                        case_id: p.case_id,
                        case_name: p.case_name,
                        consultation_id: p.consultation_id,
                        memo: p.memo,
                        receipt_type: p.receipt_type,
                      })
                      setUnifiedModalTab('payment')
                      setShowUnifiedModal(true)
                      return
                    }
                    // 지출 클릭
                    if (item.type === 'expense' && item.expense_data) {
                      const e = item.expense_data
                      setEditScheduleData({
                        id: e.id,
                        event_type: 'EXPENSE',
                        expense_date: e.expense_date,
                        amount: e.amount,
                        expense_category: e.expense_category,
                        subcategory: e.subcategory,
                        office_location: e.office_location,
                        vendor_name: e.vendor_name,
                        memo: e.memo,
                        payment_method: e.payment_method,
                      })
                      setUnifiedModalTab('expense')
                      setShowUnifiedModal(true)
                      return
                    }
                    // 캘린더 이벤트 클릭
                    if ((item.type === 'court' || item.type === 'consultation') && item.id && item.event_type) {
                      setUnifiedModalTab('schedule')
                      // 캘린더 이벤트 클릭 시 UnifiedScheduleModal로 편집
                      if (item.event_type === 'COURT_HEARING') {
                        const { data: hearing } = await supabase
                          .from('court_hearings')
                          .select('*')
                          .eq('id', item.id)
                          .single()

                        if (hearing) {
                          const hearingDateTime = new Date(hearing.hearing_date)
                          const dateStr = hearingDateTime.toISOString().split('T')[0]
                          const timeStr = hearingDateTime.toTimeString().slice(0, 5)

                          setEditScheduleData({
                            id: hearing.id,
                            event_type: 'COURT_HEARING',
                            event_subtype: hearing.hearing_type,
                            reference_id: hearing.case_number,
                            event_date: dateStr,
                            event_time: timeStr,
                            location: hearing.location || null,
                            description: hearing.notes || null,
                            status: hearing.status,
                            report: hearing.report || null,
                            result: hearing.result || null,
                            judge_name: hearing.judge_name || null
                          })
                          setUnifiedModalTab('schedule')
                          setShowUnifiedModal(true)
                        }
                      } else if (item.event_type === 'CONSULTATION') {
                        const { data: consultation } = await supabase
                          .from('consultations')
                          .select('*')
                          .eq('id', item.id)
                          .single()

                        if (consultation) {
                          setEditScheduleData({
                            id: consultation.id,
                            event_type: 'CONSULTATION',
                            reference_id: consultation.phone,
                            case_name: consultation.name,
                            location: consultation.office_location,
                            description: consultation.message,
                            status: consultation.status,
                            preferred_date: consultation.preferred_date,
                            preferred_time: consultation.preferred_time,
                            confirmed_date: consultation.confirmed_date,
                            confirmed_time: consultation.confirmed_time
                          })
                          setUnifiedModalTab('schedule')
                          setShowUnifiedModal(true)
                        }
                      }
                    }
                  }}
                  className={`px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                    item.type === 'payment'
                      ? 'hover:bg-emerald-50 border-emerald-200'
                      : item.type === 'expense'
                      ? 'hover:bg-orange-50 border-orange-200'
                      : (item.type === 'court' || item.type === 'consultation')
                      ? 'hover:bg-gray-50 border-gray-200'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            item.type === 'court'
                              ? 'bg-sage-100 text-sage-700'
                              : item.type === 'consultation'
                              ? 'bg-blue-100 text-blue-700'
                              : item.type === 'payment'
                              ? 'bg-emerald-100 text-emerald-700'
                              : item.type === 'expense'
                              ? 'bg-orange-100 text-orange-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {item.type === 'court' ? '법원' : item.type === 'consultation' ? '상담' : item.type === 'payment' ? '입금' : item.type === 'expense' ? '지출' : '일정'}
                        </span>
                        {item.time && (
                          <span className="text-[10px] text-gray-500">{item.time}</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-800 truncate">{item.title}</p>
                    </div>
                    {typeof item.amount === 'number' && (
                      <span className={`text-xs font-semibold ml-3 ${item.type === 'expense' ? 'text-orange-600' : 'text-emerald-600'}`}>
                        {item.amount.toLocaleString('ko-KR')}원
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 재판일정 (D-10 이내) */}
      <section className="mt-5">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-gray-900">재판일정</h2>
              <span className="text-xs text-gray-500">D-10 이내</span>
              {combinedSchedules.length > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] bg-sage-100 text-sage-700 rounded font-medium">
                  {combinedSchedules.length}
                </span>
              )}
            </div>
            <button
              onClick={() => {
                setSelectedDate('')
                setEditScheduleData(undefined)
                setUnifiedModalTab('schedule')
                setShowUnifiedModal(true)
              }}
              className="px-3 py-1.5 text-xs font-medium text-white bg-sage-600 hover:bg-sage-700 rounded-lg transition-colors"
            >
              + 일정 추가
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-300 border-t-gray-600"></div>
            </div>
          ) : combinedSchedules.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-xs text-gray-400">10일 이내 예정된 일정이 없습니다.</p>
            </div>
          ) : (
            <>
              <div className="divide-y divide-gray-100">
                {combinedSchedules.slice(0, 10).map((item) => {
                  const isHearing = item.type === 'hearing' && item.event_type === 'COURT_HEARING'
                  const isDeadline = item.type === 'deadline'

                  const handleClick = async () => {
                    // 법원기일(COURT_HEARING)만 클릭 가능
                    if (item.event_type === 'COURT_HEARING') {
                      // court_hearings 테이블에서 전체 데이터 조회
                      const { data: hearing } = await supabase
                        .from('court_hearings')
                        .select('*')
                        .eq('id', item.id)
                        .single()

                      if (hearing) {
                        const hearingDateTime = new Date(hearing.hearing_date)
                        const dateStr = hearingDateTime.toISOString().split('T')[0]
                        const timeStr = hearingDateTime.toTimeString().slice(0, 5)

                        setEditScheduleData({
                          id: hearing.id,
                          event_type: 'COURT_HEARING',
                          event_subtype: hearing.hearing_type,
                          reference_id: hearing.case_number,
                          case_name: null,
                          case_id: null,
                          event_date: dateStr,
                          event_time: timeStr,
                          location: hearing.location || null,
                          description: hearing.notes || null,
                          status: hearing.status,
                          report: hearing.report || null,
                          result: hearing.result || null,
                          judge_name: hearing.judge_name || null
                        })
                        setUnifiedModalTab('schedule')
                        setShowUnifiedModal(true)
                      }
                    }
                  }

                  return (
                    <div
                      key={`${item.type}-${item.id}`}
                      className={`py-3 first:pt-0 last:pb-0 ${item.event_type === 'COURT_HEARING' ? 'cursor-pointer hover:bg-gray-50 -mx-4 px-4 transition-colors' : ''}`}
                      onClick={handleClick}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              isDeadline ? 'bg-orange-100 text-orange-700' : 'bg-sage-100 text-sage-700'
                            }`}>
                              {isDeadline ? '마감' : '기일'}
                            </span>
                            <span className="text-xs text-gray-800 font-medium truncate">
                              {item.title}
                            </span>
                          </div>
                          {item.case_number && (
                            <Link
                              href={`/cases/${item.case_number}`}
                              className="text-[10px] text-gray-500 hover:text-sage-600 hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {item.case_number}
                            </Link>
                          )}
                          {isHearing && item.datetime && (
                            <p className="text-[10px] text-gray-500 mt-0.5">
                              {formatDateTime(item.datetime)}
                              {item.location && ` | ${item.location}`}
                            </p>
                          )}
                          {isDeadline && (
                            <p className="text-[10px] text-gray-500 mt-0.5">
                              만료: {item.date}
                            </p>
                          )}
                        </div>
                        <span className={`px-2 py-1 rounded text-[10px] font-semibold whitespace-nowrap ${getUrgencyBadge(item.days_until)}`}>
                          {formatDaysUntil(item.days_until)}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
              {combinedSchedules.length > 10 && (
                <div className="mt-4 pt-3 border-t border-gray-100">
                  <Link
                    href="/schedules"
                    className="flex items-center justify-center gap-1 text-xs text-sage-600 hover:text-sage-700 font-medium"
                  >
                    <span>전체 일정 보기</span>
                    <span className="px-1.5 py-0.5 text-[10px] bg-sage-100 rounded">
                      +{combinedSchedules.length - 10}
                    </span>
                  </Link>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* 빠른 링크 */}
      <section className="mt-5">
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          <QuickLink href="/cases" label="사건" icon="case" />
          <QuickLink href="/clients" label="의뢰인" icon="client" />
          <QuickLink href="/schedules" label="일정" icon="schedule" />
          <QuickLink href="/admin/consultations" label="상담" icon="consultation" />
          <QuickLink href="/admin/payments" label="입금" icon="payments" />
          <QuickLink href="/admin/expenses" label="지출" icon="expenses" />
        </div>
      </section>


      {/* 모달 */}
      <QuickAddHearingModal
        isOpen={showHearingModal}
        onClose={() => {
          setShowHearingModal(false)
          setSelectedDate('')
        }}
        onSuccess={() => {
          fetchUrgentItems()
          router.refresh()
          setSelectedDate('')
        }}
        prefilledDate={selectedDate}
      />

      <HearingDetailModal
        isOpen={showHearingDetailModal}
        onClose={() => {
          setShowHearingDetailModal(false)
          setSelectedHearing(null)
        }}
        onSuccess={() => {
          fetchUrgentItems()
        }}
        hearing={selectedHearing}
      />

      <UnifiedScheduleModal
        isOpen={showUnifiedModal}
        onClose={() => {
          setShowUnifiedModal(false)
          setSelectedDate('')
          setEditScheduleData(undefined)
          setUnifiedModalTab('schedule')
        }}
        onSuccess={() => {
          fetchUrgentItems()
          router.refresh()
          setSelectedDate('')
          setShowUnifiedModal(false)
          setEditScheduleData(undefined)
          setUnifiedModalTab('schedule')
        }}
        prefilledDate={selectedDate}
        editMode={Boolean(editScheduleData)}
        editData={editScheduleData}
        initialTab={unifiedModalTab}
      />
    </div>
  )
}

// Helpers
const parseTime = (time?: string | null) => {
  if (!time) return ''
  return time.slice(0, 5)
}

const sortDayItems = <T extends { time: string; type: string }>(items: T[]): T[] => {
  const priority = (t: string) => {
    if (t === 'court' || t === 'calendar_court') return 0
    if (t === 'consultation' || t === 'calendar_consultation') return 1
    if (t === 'payment') return 2
    if (t === 'expense') return 3
    return 4
  }
  return items.sort((a, b) => {
    const pa = priority(a.type)
    const pb = priority(b.type)
    if (pa !== pb) return pa - pb
    return (a.time || '').localeCompare(b.time || '')
  })
}


function QuickLink({ href, label, icon }: { href: string, label: string, icon: string }) {
  const getIcon = () => {
    const iconClass = "w-5 h-5 text-sage-600"
    switch(icon) {
      case 'case':
        return (
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        )
      case 'client':
        return (
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        )
      case 'schedule':
        return (
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        )
      case 'consultation':
        return (
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        )
      case 'payments':
        return (
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-2m0-6h2a2 2 0 012 2v2a2 2 0 01-2 2h-2m0-6v6" />
          </svg>
        )
      case 'expenses':
        return (
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V6m0 10v2m-7-6a7 7 0 1114 0 7 7 0 01-14 0z" />
          </svg>
        )
      default:
        return null
    }
  }

  return (
    <Link
      href={href}
      className="bg-white rounded-lg border border-gray-200 p-4 flex flex-col items-center justify-center gap-2 hover:border-sage-300 hover:bg-sage-50/50 transition-colors group"
    >
      {getIcon()}
      <span className="text-xs font-medium text-gray-700 group-hover:text-sage-700">{label}</span>
    </Link>
  )
}
