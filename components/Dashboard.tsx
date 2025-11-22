'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import WeeklyCalendar from './WeeklyCalendar'
import QuickAddHearingModal from './QuickAddHearingModal'
import {
  HEARING_TYPE_LABELS,
  DEADLINE_TYPE_LABELS,
  formatDaysUntil,
  HearingType,
  DeadlineType
} from '@/types/court-hearing'

interface Profile {
  id: string
  name: string
  email: string
  role: string
  is_active: boolean
}

interface Schedule {
  id: string
  title: string
  scheduled_date: string
  scheduled_time: string | null
  schedule_type: 'trial' | 'consultation' | 'meeting'
  location: string | null
  case_id: string | null
}

interface UpcomingHearing {
  id: string
  case_number: string
  hearing_type: string
  hearing_date: string
  location: string | null
  days_until_hearing: number
}

interface UrgentDeadline {
  id: string
  case_number: string
  deadline_type: string
  deadline_type_name: string
  deadline_date: string
  days_until_deadline: number
}

interface CombinedScheduleItem {
  id: string
  type: 'hearing' | 'deadline'
  case_number: string
  title: string
  date: string
  datetime?: string
  location?: string | null
  days_until: number
}

export default function Dashboard({ profile, initialSchedules }: { profile: Profile, initialSchedules: Schedule[] }) {
  const router = useRouter()
  const supabase = createClient()

  const [showHearingModal, setShowHearingModal] = useState(false)
  const [combinedSchedules, setCombinedSchedules] = useState<CombinedScheduleItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchUrgentItems()
  }, [])

  const fetchUrgentItems = async () => {
    try {
      setLoading(true)

      // D-7 이내 법원 기일 - 클라이언트 측 필터링
      const { data: allHearings, error: hearingError } = await supabase
        .from('upcoming_hearings')
        .select('*')

      if (hearingError) {
        console.error('법원 기일 조회 실패:', hearingError)
        throw hearingError
      }

      // 클라이언트에서 D-7 필터링
      const hearings = allHearings?.filter(h => {
        const daysUntil = typeof h.days_until_hearing === 'number'
          ? h.days_until_hearing
          : parseInt(h.days_until_hearing || '0')
        return daysUntil >= 0 && daysUntil <= 7
      }) || []

      // D-7 이내 데드라인 - 클라이언트 측 필터링
      const { data: allDeadlines, error: deadlineError } = await supabase
        .from('urgent_deadlines')
        .select('*')

      if (deadlineError) {
        console.error('데드라인 조회 실패:', deadlineError)
        throw deadlineError
      }

      // 클라이언트에서 D-7 필터링
      const deadlines = allDeadlines?.filter(d => {
        const daysUntil = typeof d.days_until_deadline === 'number'
          ? d.days_until_deadline
          : parseInt(d.days_until_deadline || '0')
        return daysUntil >= 0 && daysUntil <= 7
      }) || []

      // 통합 스케줄 생성
      const combined: CombinedScheduleItem[] = []

      // 법원 기일 추가
      if (hearings) {
        hearings.forEach(hearing => {
          combined.push({
            id: hearing.id,
            type: 'hearing',
            case_number: hearing.case_number,
            title: HEARING_TYPE_LABELS[hearing.hearing_type as HearingType],
            date: hearing.hearing_date.split('T')[0],
            datetime: hearing.hearing_date,
            location: hearing.location,
            days_until: hearing.days_until_hearing
          })
        })
      }

      // 데드라인 추가
      if (deadlines) {
        deadlines.forEach(deadline => {
          combined.push({
            id: deadline.id,
            type: 'deadline',
            case_number: deadline.case_number,
            title: deadline.deadline_type_name,
            date: deadline.deadline_date,
            days_until: deadline.days_until_deadline
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

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const getUrgencyColor = (days: number) => {
    if (days <= 1) return 'bg-red-100 text-red-700 border-red-200'
    if (days <= 3) return 'bg-orange-100 text-orange-700 border-orange-200'
    return 'bg-yellow-100 text-yellow-700 border-yellow-200'
  }

  const formatDateTime = (datetime: string) => {
    const d = new Date(datetime)
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const hour = String(d.getHours()).padStart(2, '0')
    const minute = String(d.getMinutes()).padStart(2, '0')
    return `${month}.${day} ${hour}:${minute}`
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">율</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">법무법인 더율</h1>
              <p className="text-sm text-gray-600">관리자 시스템</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
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
        {/* 주간 캘린더 */}
        <WeeklyCalendar initialSchedules={initialSchedules} />

        {/* 이번 주 일정 위젯 (통합) */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-8 mt-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl">📅</span>
              <h2 className="text-lg font-bold text-gray-900">이번 주 일정 (D-7 이내)</h2>
              {combinedSchedules.length > 0 && (
                <span className="px-2 py-1 text-xs font-bold bg-blue-100 text-blue-700 rounded-full">
                  {combinedSchedules.length}
                </span>
              )}
            </div>
            <button
              onClick={() => setShowHearingModal(true)}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              + 법원기일 추가
            </button>
          </div>

          {loading ? (
            <div className="text-center py-8">
              <p className="text-sm text-gray-500">로딩 중...</p>
            </div>
          ) : combinedSchedules.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-gray-600">7일 이내 예정된 일정이 없습니다.</p>
            </div>
          ) : (
            <>
            <div className="space-y-2">
              {combinedSchedules.slice(0, 10).map((item) => {
                const isHearing = item.type === 'hearing'
                const icon = isHearing ? '⚖️' : '⏰'
                const bgHoverClass = isHearing ? 'hover:bg-blue-50 hover:border-blue-300' : 'hover:bg-orange-50 hover:border-orange-300'

                return (
                  <div
                    key={`${item.type}-${item.id}`}
                    className={`p-3 border border-gray-200 rounded-lg ${bgHoverClass} transition-all cursor-pointer`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{icon}</span>
                        <span className="text-sm font-semibold text-gray-900">
                          {item.title}
                        </span>
                      </div>
                      <span className={`px-2 py-1 rounded-md text-xs font-bold ${getUrgencyColor(item.days_until)}`}>
                        {formatDaysUntil(item.days_until)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 mb-1">
                      사건번호: {item.case_number}
                    </p>
                    {isHearing && item.datetime ? (
                      <p className="text-xs text-gray-500">
                        일시: {formatDateTime(item.datetime)}
                        {item.location && ` · ${item.location}`}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-500">
                        만료일: {item.date}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
            {combinedSchedules.length > 10 && (
              <div className="mt-4 text-center">
                <a
                  href="/schedules"
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  더보기 ({combinedSchedules.length - 10}개 더)
                  <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </a>
              </div>
            )}
            </>
          )}
        </div>

        {/* 빠른 링크 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
          <QuickLink href="/cases" label="사건 관리" icon="⚖️" />
          <QuickLink href="/clients" label="의뢰인 관리" icon="👥" />
          <QuickLink href="/schedules" label="일정 관리" icon="📅" />
          <QuickLink href="/consultations" label="상담 신청" icon="💬" />
        </div>
      </main>

      {/* 모달 */}
      <QuickAddHearingModal
        isOpen={showHearingModal}
        onClose={() => setShowHearingModal(false)}
        onSuccess={() => {
          fetchUrgentItems()
          router.refresh()
        }}
      />
    </div>
  )
}


function QuickLink({ href, label, icon }: { href: string, label: string, icon: string }) {
  return (
    <a
      href={href}
      className="flex flex-col items-center justify-center p-6 bg-white rounded-lg shadow hover:shadow-md transition-shadow"
    >
      <span className="text-3xl mb-2">{icon}</span>
      <span className="text-sm font-medium text-gray-900">{label}</span>
    </a>
  )
}
