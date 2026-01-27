'use client'

import { useState } from 'react'

interface UnifiedSchedule {
  id: string
  event_type: 'COURT_HEARING' | 'DEADLINE' | 'CONSULTATION'
  event_type_kr: string
  event_subtype: string | null
  title: string
  case_name: string
  event_date: string
  event_time: string | null
  event_datetime: string | null
  reference_id: string
  location: string | null
  description: string | null
  status: string
  sort_priority: number
}

interface ScheduleListViewProps {
  schedules: UnifiedSchedule[]
  onEdit: (schedule: UnifiedSchedule) => void
  onDelete?: (schedule: UnifiedSchedule) => void
}

export default function ScheduleListView({ schedules, onEdit, onDelete }: ScheduleListViewProps) {
  const [sortBy, setSortBy] = useState<'date' | 'type'>('date')
  const [filterType, setFilterType] = useState<string>('all')

  // 필터링
  const filteredSchedules = schedules.filter(schedule => {
    if (filterType === 'all') return true
    return schedule.event_type === filterType
  })

  // 정렬
  const sortedSchedules = [...filteredSchedules].sort((a, b) => {
    if (sortBy === 'date') {
      const dateCompare = a.event_date.localeCompare(b.event_date)
      if (dateCompare !== 0) return dateCompare
      return (a.sort_priority || 0) - (b.sort_priority || 0)
    } else {
      return a.event_type.localeCompare(b.event_type)
    }
  })

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'COURT_HEARING':
        return 'bg-[var(--sage-muted)] text-[var(--text-primary)] border-[var(--border-default)]'
      case 'DEADLINE':
        return 'bg-[var(--color-warning-muted)] text-[var(--color-warning)] border-[var(--border-default)]'
      case 'CONSULTATION':
        return 'bg-[var(--sage-muted)] text-[var(--sage-primary)] border-[var(--border-default)]'
      default:
        return 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border-[var(--border-default)]'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SCHEDULED':
      case 'pending':
      case 'PENDING':
        return 'bg-[var(--sage-muted)] text-[var(--sage-primary)] border-[var(--border-default)]'
      case 'COMPLETED':
      case 'confirmed':
        return 'bg-[var(--color-success-muted)] text-[var(--color-success)] border-[var(--border-default)]'
      case 'CANCELLED':
      case 'cancelled':
        return 'bg-[var(--bg-primary)] text-[var(--text-secondary)] border-[var(--border-default)]'
      case 'POSTPONED':
        return 'bg-[var(--color-warning-muted)] text-[var(--color-warning)] border-[var(--border-default)]'
      case 'OVERDUE':
        return 'bg-[var(--color-danger-muted)] text-[var(--color-danger)] border-[var(--border-default)]'
      default:
        return 'bg-[var(--bg-primary)] text-[var(--text-secondary)] border-[var(--border-default)]'
    }
  }

  // 법원명을 축약형으로 변환 (장소 뒷부분은 유지)
  // "수원가정법원 평택지원 제21호 법정" → "평택지원 제21호 법정"
  const shortenCourtLocation = (location?: string | null): string => {
    if (!location) return '-'

    // 1. OO지원 패턴 (평택지원, 안산지원, 천안지원)
    const jiwonMatch = location.match(/[가-힣]+법원\s+([가-힣]{2,4}지원)\s+(.+)/)
    if (jiwonMatch) {
      return `${jiwonMatch[1]} ${jiwonMatch[2]}`
    }

    // 2. 고등법원
    const goMatch = location.match(/([가-힣]{2,3})고등법원\s+(.+)/)
    if (goMatch) {
      return `${goMatch[1]}고법 ${goMatch[2]}`
    }

    // 3. 가정법원 본원
    const gaMatch = location.match(/([가-힣]{2,3})가정법원\s+(.+)/)
    if (gaMatch) {
      return `${gaMatch[1]}가정 ${gaMatch[2]}`
    }

    // 4. 지방법원 본원
    const jiMatch = location.match(/([가-힣]{2,3})지방법원\s+(.+)/)
    if (jiMatch) {
      return `${jiMatch[1]}지법 ${jiMatch[2]}`
    }

    return location
  }

  const formatDate = (date: string) => {
    const d = new Date(date)
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const weekday = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()]
    return `${month}.${day} (${weekday})`
  }

  const formatTime = (time: string | null) => {
    if (!time || time === '00:00') return '-'
    return time
  }

  return (
    <div className="space-y-4">
      {/* 필터 및 정렬 */}
      <div className="flex flex-wrap items-center gap-3 bg-[var(--bg-secondary)] p-4 rounded-lg border border-[var(--border-default)]">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[var(--text-primary)]">필터:</span>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="form-input-standard"
          >
            <option value="all">전체</option>
            <option value="COURT_HEARING">법원 기일</option>
            <option value="DEADLINE">데드라인</option>
            <option value="CONSULTATION">상담</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[var(--text-primary)]">정렬:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'date' | 'type')}
            className="form-input-standard"
          >
            <option value="date">날짜순</option>
            <option value="type">종류별</option>
          </select>
        </div>

        <div className="ml-auto text-sm text-[var(--sage-primary)]">
          총 <span className="font-semibold text-[var(--text-primary)]">{sortedSchedules.length}</span>개
        </div>
      </div>

      {/* 목록 */}
      {sortedSchedules.length === 0 ? (
        <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-default)] p-12 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[var(--sage-muted)] rounded-full mb-4">

          </div>
          <p className="text-[var(--text-secondary)] font-medium">일정이 없습니다.</p>
          <p className="text-sm text-[var(--sage-primary)] mt-1">새로운 일정을 추가해보세요.</p>
        </div>
      ) : (
        <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-default)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[var(--sage-muted)] border-b border-[var(--border-default)]">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider">
                    날짜/시간
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider">
                    종류
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider">
                    제목
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider">
                    참조
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider">
                    장소
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider">
                    상태
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider">
                    액션
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {sortedSchedules.map((schedule) => (
                  <tr
                    key={schedule.id}
                    className="hover:bg-[var(--bg-hover)] cursor-pointer transition-colors"
                    onClick={() => onEdit(schedule)}
                  >
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-[var(--text-primary)]">
                        {formatDate(schedule.event_date)}
                      </div>
                      <div className="text-sm text-[var(--sage-primary)]">
                        {formatTime(schedule.event_time)}
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-md border ${getTypeColor(schedule.event_type)}`}>
                        {schedule.event_type_kr}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm font-medium text-[var(--text-primary)] max-w-md truncate">
                        {schedule.title}
                      </div>
                      {schedule.description && (
                        <div className="text-sm text-[var(--sage-primary)] max-w-md truncate">
                          {schedule.description}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm text-[var(--text-primary)]">
                        {schedule.reference_id}
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm text-[var(--sage-primary)]">
                        {shortenCourtLocation(schedule.location)}
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-md border ${getStatusColor(schedule.status)}`}>
                        {schedule.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-right text-sm">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onEdit(schedule)
                        }}
                        className="text-[var(--sage-primary)] hover:text-[var(--text-primary)] font-medium mr-3"
                      >
                        수정
                      </button>
                      {onDelete && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onDelete(schedule)
                          }}
                          className="text-[var(--color-danger)] hover:text-[var(--color-danger)] font-medium"
                        >
                          삭제
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
