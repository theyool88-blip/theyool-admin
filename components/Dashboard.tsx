'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  FileText,
  Users,
  Calendar,
  MessageSquare,
  CreditCard,
  Wallet,
  TrendingUp,
  TrendingDown,
  Clock,
  AlertCircle,
  Gavel,
  ArrowRight,
  Plus,
} from 'lucide-react'
import WeeklyCalendar from './WeeklyCalendar'
import QuickAddHearingModal from './QuickAddHearingModal'
import HearingDetailModal from './HearingDetailModal'
import UnifiedScheduleModal, { type EditScheduleData } from './UnifiedScheduleModal'
import { CourtHearing } from '@/types/court-hearing'
import MetricCard, { MetricCardGrid } from './ui/MetricCard'
import { QuickActionsBar, ActionButton } from './ui/ActionCard'
import StatusBadge, { UrgencyBadge } from './ui/StatusBadge'
import { Activity, ActivityListCompact } from './ui/ActivityFeed'
import EmptyState from './ui/EmptyState'

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

interface DashboardMetrics {
  totalRevenue: number
  totalExpense: number
  netProfit: number
  pendingConsultations: number
  activeCases: number
  upcomingHearings: number
  revenueTrend: number
  expenseTrend: number
}

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
  const [dayEvents, setDayEvents] = useState<Array<{ id?: string; type: string; time: string; title: string; amount?: number; event_type?: string; event_data?: CalendarEvent; payment_data?: Record<string, unknown>; expense_data?: Record<string, unknown>; sortType?: string }>>([])
  const [dayEventsDate, setDayEventsDate] = useState('')
  const [dayEventsLoading, setDayEventsLoading] = useState(false)
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalRevenue: 0,
    totalExpense: 0,
    netProfit: 0,
    pendingConsultations: 0,
    activeCases: 0,
    upcomingHearings: 0,
    revenueTrend: 0,
    expenseTrend: 0,
  })
  const [recentActivities, setRecentActivities] = useState<Activity[]>([])

  useEffect(() => {
    fetchUrgentItems()
    fetchMetrics()
    fetchRecentActivities()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchMetrics = async () => {
    try {
      // 이번 달 매출/지출 조회
      const now = new Date()
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]

      // 지난 달
      const prevFirstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0]
      const prevLastDay = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0]

      // 매출 (이번 달)
      const { data: payments } = await supabase
        .from('payments')
        .select('amount')
        .gte('payment_date', firstDay)
        .lte('payment_date', lastDay)

      const totalRevenue = (payments || []).reduce((sum, p) => sum + (p.amount || 0), 0)

      // 매출 (지난 달)
      const { data: prevPayments } = await supabase
        .from('payments')
        .select('amount')
        .gte('payment_date', prevFirstDay)
        .lte('payment_date', prevLastDay)

      const prevRevenue = (prevPayments || []).reduce((sum, p) => sum + (p.amount || 0), 0)
      const revenueTrend = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0

      // 지출 (이번 달)
      const { data: expenses } = await supabase
        .from('expenses')
        .select('amount')
        .gte('expense_date', firstDay)
        .lte('expense_date', lastDay)

      const totalExpense = (expenses || []).reduce((sum, e) => sum + (e.amount || 0), 0)

      // 지출 (지난 달)
      const { data: prevExpenses } = await supabase
        .from('expenses')
        .select('amount')
        .gte('expense_date', prevFirstDay)
        .lte('expense_date', prevLastDay)

      const prevExpense = (prevExpenses || []).reduce((sum, e) => sum + (e.amount || 0), 0)
      const expenseTrend = prevExpense > 0 ? ((totalExpense - prevExpense) / prevExpense) * 100 : 0

      // 대기중 상담
      const { count: pendingConsultations } = await supabase
        .from('consultations')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')

      // 진행중 사건
      const { count: activeCases } = await supabase
        .from('cases')
        .select('*', { count: 'exact', head: true })
        .eq('status', '진행중')

      // D-7 이내 기일
      const today = new Date().toISOString().split('T')[0]
      const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      const { count: upcomingHearings } = await supabase
        .from('court_hearings')
        .select('*', { count: 'exact', head: true })
        .gte('hearing_date', today)
        .lte('hearing_date', nextWeek)

      setMetrics({
        totalRevenue,
        totalExpense,
        netProfit: totalRevenue - totalExpense,
        pendingConsultations: pendingConsultations || 0,
        activeCases: activeCases || 0,
        upcomingHearings: upcomingHearings || 0,
        revenueTrend,
        expenseTrend,
      })
    } catch (error) {
      console.error('메트릭 조회 실패:', error)
    }
  }

  const fetchRecentActivities = async () => {
    try {
      // 최근 활동 (최근 등록된 사건, 상담, 입금 등)
      const activities: Activity[] = []

      // 최근 사건
      const { data: recentCases } = await supabase
        .from('cases')
        .select('id, case_number, case_name, created_at')
        .order('created_at', { ascending: false })
        .limit(3)

      recentCases?.forEach(c => {
        activities.push({
          id: `case-${c.id}`,
          type: 'case',
          title: `${c.case_name || c.case_number} 사건 등록`,
          timestamp: c.created_at,
          href: `/cases/${c.id}`,
        })
      })

      // 최근 상담
      const { data: recentConsultations } = await supabase
        .from('consultations')
        .select('id, name, created_at')
        .order('created_at', { ascending: false })
        .limit(3)

      recentConsultations?.forEach(c => {
        activities.push({
          id: `consultation-${c.id}`,
          type: 'consultation',
          title: `${c.name} 상담 등록`,
          timestamp: c.created_at,
          href: `/admin/consultations`,
        })
      })

      // 최근 입금
      const { data: recentPayments } = await supabase
        .from('payments')
        .select('id, depositor_name, amount, created_at')
        .order('created_at', { ascending: false })
        .limit(3)

      recentPayments?.forEach(p => {
        activities.push({
          id: `payment-${p.id}`,
          type: 'payment',
          title: `${p.depositor_name || '입금'} ${(p.amount || 0).toLocaleString()}원`,
          timestamp: p.created_at,
          href: `/admin/payments`,
        })
      })

      // 시간순 정렬
      activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

      setRecentActivities(activities.slice(0, 5))
    } catch (error) {
      console.error('최근 활동 조회 실패:', error)
    }
  }

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

  const formatDateTime = (datetime: string) => {
    const d = new Date(datetime)
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const hour = String(d.getHours()).padStart(2, '0')
    const minute = String(d.getMinutes()).padStart(2, '0')
    return `${month}.${day} ${hour}:${minute}`
  }

  const handleViewAll = async (date: Date, _schedules: Schedule[]) => {
    const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    const dayStr = localDate.toISOString().split('T')[0]
    setDayEventsDate(dayStr)
    setDayEventsLoading(true)
    try {
      // 1) unified calendar events for the day
      const calRes = await fetch(`/api/admin/calendar?start_date=${dayStr}&end_date=${dayStr}`)
      const calJson = await calRes.json()
      const calendarEvents = (calJson.data || []).map((ev: CalendarEvent) => {
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
      const payments = (payJson.data || []).map((p: { id: string; case_name?: string; depositor_name?: string; payment_category?: string; amount?: number }) => ({
        id: p.id,
        type: 'payment',
        time: '',
        title: `[입금] ${p.case_name || p.depositor_name || '입금'} (${p.payment_category})`,
        amount: p.amount,
        payment_data: p as Record<string, unknown>
      }))

      // 3) expenses for the day
      const expRes = await fetch(`/api/admin/expenses?startDate=${dayStr}&endDate=${dayStr}`)
      const expJson = await expRes.json()
      const expenses = (expJson.expenses || []).map((e: { id: string; expense_category?: string; subcategory?: string; vendor_name?: string; amount?: number }) => ({
        id: e.id,
        type: 'expense',
        time: '',
        title: `[지출] ${e.expense_category}${e.subcategory ? `/${e.subcategory}` : ''}${e.vendor_name ? ` - ${e.vendor_name}` : ''}`,
        amount: e.amount,
        expense_data: e as Record<string, unknown>
      }))

      interface DayEventItem {
        id?: string;
        type: string;
        time: string;
        title: string;
        amount?: number;
        sortType?: string;
        event_type?: string;
        event_data?: CalendarEvent;
        payment_data?: Record<string, unknown>;
        expense_data?: Record<string, unknown>;
      }

      const combined = [
        ...calendarEvents,
        ...payments,
        ...expenses,
      ].map((item: DayEventItem) => ({
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

  // 날짜 포맷 유틸
  const formatKoreanDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return `${date.getMonth() + 1}월 ${date.getDate()}일`
  }

  // 긴급 알림 수 (D-3 이내)
  const urgentCount = combinedSchedules.filter(s => s.days_until <= 3).length

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">대시보드</h1>
          <p className="page-subtitle">
            안녕하세요, {profile.name || '사용자'}님. 오늘의 업무 현황입니다.
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <QuickActionsBar className="mb-6">
        <ActionButton
          icon={FileText}
          label="사건 추가"
          onClick={() => router.push('/cases/new')}
        />
        <ActionButton
          icon={Users}
          label="의뢰인 추가"
          onClick={() => router.push('/clients/new')}
        />
        <ActionButton
          icon={Calendar}
          label="일정 추가"
          onClick={() => {
            setSelectedDate('')
            setEditScheduleData(undefined)
            setUnifiedModalTab('schedule')
            setShowUnifiedModal(true)
          }}
        />
        <ActionButton
          icon={MessageSquare}
          label="상담 등록"
          onClick={() => router.push('/admin/consultations?new=true')}
        />
        <ActionButton
          icon={CreditCard}
          label="입금 등록"
          onClick={() => {
            setEditScheduleData(undefined)
            setUnifiedModalTab('payment')
            setShowUnifiedModal(true)
          }}
        />
        <ActionButton
          icon={Wallet}
          label="지출 등록"
          onClick={() => {
            setEditScheduleData(undefined)
            setUnifiedModalTab('expense')
            setShowUnifiedModal(true)
          }}
        />
      </QuickActionsBar>

      {/* KPI Cards */}
      <MetricCardGrid columns={4} className="mb-6">
        <MetricCard
          label="이번 달 매출"
          value={`${(metrics.totalRevenue / 10000).toLocaleString()}만원`}
          icon={TrendingUp}
          trend={{
            direction: metrics.revenueTrend > 0 ? 'up' : metrics.revenueTrend < 0 ? 'down' : 'neutral',
            value: `${Math.abs(metrics.revenueTrend).toFixed(1)}%`
          }}
        />
        <MetricCard
          label="이번 달 지출"
          value={`${(metrics.totalExpense / 10000).toLocaleString()}만원`}
          icon={TrendingDown}
          trend={{
            direction: metrics.expenseTrend > 0 ? 'up' : metrics.expenseTrend < 0 ? 'down' : 'neutral',
            value: `${Math.abs(metrics.expenseTrend).toFixed(1)}%`
          }}
        />
        <MetricCard
          label="순이익"
          value={`${(metrics.netProfit / 10000).toLocaleString()}만원`}
          icon={CreditCard}
        />
        <MetricCard
          label="대기중 상담"
          value={metrics.pendingConsultations.toString()}
          icon={MessageSquare}
          variant="warning"
        />
      </MetricCardGrid>

      {/* Urgent Alerts Section */}
      {urgentCount > 0 && (
        <div className="card border-l-4 border-l-[var(--color-danger)] mb-6">
          <div className="card-header">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-[var(--color-danger)]" />
              <h2 className="card-title">즉시 조치 필요</h2>
              <span className="count-badge danger">{urgentCount}</span>
            </div>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {combinedSchedules.filter(s => s.days_until <= 3).slice(0, 6).map((item) => (
                <div
                  key={item.id}
                  className="p-3 rounded-lg bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] cursor-pointer transition-colors"
                  onClick={async () => {
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
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <StatusBadge variant={item.type === 'deadline' ? 'warning' : 'active'} showDot={false}>
                          {item.type === 'deadline' ? '마감' : '기일'}
                        </StatusBadge>
                        <UrgencyBadge daysUntil={item.days_until} />
                      </div>
                      <p className="text-body font-medium truncate">{item.title}</p>
                      {item.location && (
                        <p className="text-caption mt-1">{item.location}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* 주간 캘린더 & 당일 이벤트 (2/3) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Weekly Calendar */}
          <div className="card">
            <WeeklyCalendar
              initialSchedules={initialSchedules}
              onScheduleClick={async (schedule) => {
                if (schedule.event_type === 'COURT_HEARING') {
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
          </div>

          {/* Day Events */}
          <div className="card">
            <div className="card-header">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-[var(--sage-primary)]" />
                <h2 className="card-title">당일 이벤트</h2>
                {dayEventsDate && (
                  <span className="text-caption">{formatKoreanDate(dayEventsDate)}</span>
                )}
              </div>
            </div>
            <div className="card-body">
              {dayEventsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-[var(--border-default)] border-t-[var(--sage-primary)]"></div>
                </div>
              ) : dayEvents.length === 0 ? (
                <EmptyState
                  type="noData"
                  title="이벤트 없음"
                  description="선택된 날짜의 이벤트가 없습니다."
                  compact
                />
              ) : (
                <div className="space-y-2">
                  {dayEvents.map((item, idx) => (
                    <DayEventItem
                      key={idx}
                      item={item}
                      onClick={async () => {
                        // 입금 클릭
                        if (item.type === 'payment' && item.payment_data) {
                          const p = item.payment_data as {
                            id?: string;
                            payment_date?: string;
                            depositor_name?: string;
                            amount?: number;
                            payment_category?: string;
                            office_location?: string;
                            case_id?: string;
                            case_name?: string;
                            consultation_id?: string;
                            memo?: string;
                            receipt_type?: string;
                          }
                          setEditScheduleData({
                            id: p.id as string,
                            event_type: 'PAYMENT',
                            payment_date: p.payment_date as string | undefined,
                            depositor_name: p.depositor_name as string | undefined,
                            amount: p.amount as number | undefined,
                            payment_category: p.payment_category as string | undefined,
                            office_location: p.office_location as string | undefined,
                            case_id: p.case_id as string | undefined,
                            case_name: p.case_name as string | undefined,
                            consultation_id: p.consultation_id as string | undefined,
                            memo: p.memo as string | undefined,
                            receipt_type: p.receipt_type as string | undefined,
                          })
                          setUnifiedModalTab('payment')
                          setShowUnifiedModal(true)
                          return
                        }
                        // 지출 클릭
                        if (item.type === 'expense' && item.expense_data) {
                          const e = item.expense_data as {
                            id?: string;
                            expense_date?: string;
                            amount?: number;
                            expense_category?: string;
                            subcategory?: string;
                            office_location?: string;
                            vendor_name?: string;
                            memo?: string;
                            payment_method?: string;
                          }
                          setEditScheduleData({
                            id: e.id as string,
                            event_type: 'EXPENSE',
                            expense_date: e.expense_date as string | undefined,
                            amount: e.amount as number | undefined,
                            expense_category: e.expense_category as string | undefined,
                            subcategory: e.subcategory as string | undefined,
                            office_location: e.office_location as string | undefined,
                            vendor_name: e.vendor_name as string | undefined,
                            memo: e.memo as string | undefined,
                            payment_method: e.payment_method as string | undefined,
                          })
                          setUnifiedModalTab('expense')
                          setShowUnifiedModal(true)
                          return
                        }
                        // 캘린더 이벤트 클릭
                        if ((item.type === 'court' || item.type === 'consultation') && item.id && item.event_type) {
                          setUnifiedModalTab('schedule')
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
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Sidebar (1/3) */}
        <div className="space-y-6">
          {/* Upcoming Hearings */}
          <div className="card">
            <div className="card-header">
              <div className="flex items-center gap-2">
                <Gavel className="w-5 h-5 text-[var(--sage-primary)]" />
                <h2 className="card-title">재판일정</h2>
                <span className="text-caption">D-10 이내</span>
              </div>
              <button
                onClick={() => {
                  setSelectedDate('')
                  setEditScheduleData(undefined)
                  setUnifiedModalTab('schedule')
                  setShowUnifiedModal(true)
                }}
                className="btn btn-ghost btn-sm"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="card-body">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-[var(--border-default)] border-t-[var(--sage-primary)]"></div>
                </div>
              ) : combinedSchedules.length === 0 ? (
                <EmptyState
                  type="noData"
                  title="예정된 일정 없음"
                  description="10일 이내 예정된 일정이 없습니다."
                  compact
                />
              ) : (
                <div className="space-y-3">
                  {combinedSchedules.slice(0, 5).map((item) => (
                    <ScheduleItem
                      key={item.id}
                      item={item}
                      formatDateTime={formatDateTime}
                      onClick={async () => {
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
                      }}
                    />
                  ))}
                  {combinedSchedules.length > 5 && (
                    <Link
                      href="/schedules"
                      className="flex items-center justify-center gap-1 py-2 text-caption font-medium text-[var(--sage-primary)] hover:text-[var(--sage-primary-hover)] transition-colors"
                    >
                      전체 보기
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Recent Activities */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">최근 활동</h2>
            </div>
            <div className="card-body">
              {recentActivities.length > 0 ? (
                <ActivityListCompact activities={recentActivities} maxItems={5} />
              ) : (
                <EmptyState
                  type="noData"
                  title="활동 없음"
                  description="최근 활동이 없습니다."
                  compact
                />
              )}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">현황</h2>
            </div>
            <div className="card-body space-y-3">
              <QuickStatItem
                label="진행중 사건"
                value={metrics.activeCases}
                href="/cases?status=진행중"
              />
              <QuickStatItem
                label="D-7 이내 기일"
                value={metrics.upcomingHearings}
                href="/schedules"
                variant={metrics.upcomingHearings > 0 ? 'warning' : 'default'}
              />
              <QuickStatItem
                label="대기중 상담"
                value={metrics.pendingConsultations}
                href="/admin/consultations?status=pending"
                variant={metrics.pendingConsultations > 0 ? 'danger' : 'default'}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <section className="grid grid-cols-3 md:grid-cols-6 gap-3">
        <QuickLink href="/cases" label="사건" icon={FileText} />
        <QuickLink href="/clients" label="의뢰인" icon={Users} />
        <QuickLink href="/schedules" label="일정" icon={Calendar} />
        <QuickLink href="/admin/consultations" label="상담" icon={MessageSquare} />
        <QuickLink href="/admin/payments" label="입금" icon={CreditCard} />
        <QuickLink href="/admin/expenses" label="지출" icon={Wallet} />
      </section>

      {/* Modals */}
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
          fetchMetrics()
          fetchRecentActivities()
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

// Sub-components
interface DayEventItemProps {
  item: {
    id?: string
    type: string
    time: string
    title: string
    amount?: number
    event_type?: string
  }
  onClick: () => void
}

function DayEventItem({ item, onClick }: DayEventItemProps) {
  const getTypeConfig = () => {
    switch (item.type) {
      case 'court':
        return { label: '법원', variant: 'active' as const, bgClass: 'hover:bg-[var(--sage-muted)]' }
      case 'consultation':
        return { label: '상담', variant: 'info' as const, bgClass: 'hover:bg-[var(--color-info-muted)]' }
      case 'payment':
        return { label: '입금', variant: 'success' as const, bgClass: 'hover:bg-[var(--color-success-muted)]' }
      case 'expense':
        return { label: '지출', variant: 'warning' as const, bgClass: 'hover:bg-[var(--color-warning-muted)]' }
      default:
        return { label: '일정', variant: 'neutral' as const, bgClass: 'hover:bg-[var(--bg-hover)]' }
    }
  }

  const config = getTypeConfig()

  return (
    <div
      onClick={onClick}
      className={`p-3 rounded-lg border border-[var(--border-default)] cursor-pointer transition-colors ${config.bgClass}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <StatusBadge variant={config.variant} showDot={false}>
              {config.label}
            </StatusBadge>
            {item.time && (
              <span className="text-caption">{item.time}</span>
            )}
          </div>
          <p className="text-body truncate">{item.title}</p>
        </div>
        {typeof item.amount === 'number' && (
          <span className="text-body font-medium ml-3 text-[var(--text-primary)]">
            {item.amount.toLocaleString('ko-KR')}원
          </span>
        )}
      </div>
    </div>
  )
}

interface ScheduleItemProps {
  item: CombinedScheduleItem
  formatDateTime: (datetime: string) => string
  onClick: () => void
}

function ScheduleItem({ item, formatDateTime, onClick }: ScheduleItemProps) {
  const isHearing = item.type === 'hearing' && item.event_type === 'COURT_HEARING'
  const isDeadline = item.type === 'deadline'

  return (
    <div
      className={`p-3 rounded-lg border border-[var(--border-default)] ${item.event_type === 'COURT_HEARING' ? 'cursor-pointer hover:bg-[var(--bg-hover)]' : ''} transition-colors`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <StatusBadge variant={isDeadline ? 'warning' : 'active'} showDot={false}>
              {isDeadline ? '마감' : '기일'}
            </StatusBadge>
            <UrgencyBadge daysUntil={item.days_until} />
          </div>
          <p className="text-body font-medium truncate">{item.title}</p>
          {item.case_number && (
            <p className="text-caption mt-0.5">{item.case_number}</p>
          )}
          {isHearing && item.datetime && (
            <p className="text-caption mt-0.5">
              {formatDateTime(item.datetime)}
              {item.location && ` | ${item.location}`}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

interface QuickStatItemProps {
  label: string
  value: number
  href: string
  variant?: 'default' | 'warning' | 'danger'
}

function QuickStatItem({ label, value, href, variant = 'default' }: QuickStatItemProps) {
  const valueClass = variant === 'danger'
    ? 'text-[var(--color-danger)]'
    : variant === 'warning'
    ? 'text-[var(--color-warning)]'
    : 'text-[var(--text-primary)]'

  return (
    <Link
      href={href}
      className="flex items-center justify-between p-2 -mx-2 rounded-lg hover:bg-[var(--bg-hover)] transition-colors"
    >
      <span className="text-body">{label}</span>
      <span className={`text-subheading font-semibold ${valueClass}`}>{value}</span>
    </Link>
  )
}

interface QuickLinkProps {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

function QuickLink({ href, label, icon: Icon }: QuickLinkProps) {
  return (
    <Link
      href={href}
      className="card p-4 flex flex-col items-center justify-center gap-2 hover:border-[var(--sage-primary)] hover:bg-[var(--sage-muted)] transition-colors group"
    >
      <Icon className="w-6 h-6 text-[var(--sage-primary)]" />
      <span className="text-caption font-medium text-[var(--text-secondary)] group-hover:text-[var(--sage-primary)]">
        {label}
      </span>
    </Link>
  )
}
