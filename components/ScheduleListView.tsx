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
        return 'bg-sage-100 text-sage-800 border-sage-200'
      case 'DEADLINE':
        return 'bg-orange-100 text-orange-700 border-orange-200'
      case 'CONSULTATION':
        return 'bg-sage-50 text-sage-700 border-sage-200'
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SCHEDULED':
      case 'pending':
      case 'PENDING':
        return 'bg-sage-50 text-sage-700 border-sage-200'
      case 'COMPLETED':
      case 'confirmed':
        return 'bg-green-50 text-green-700 border-green-200'
      case 'CANCELLED':
      case 'cancelled':
        return 'bg-gray-50 text-gray-700 border-gray-200'
      case 'POSTPONED':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200'
      case 'OVERDUE':
        return 'bg-red-50 text-red-700 border-red-200'
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200'
    }
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
      <div className="flex flex-wrap items-center gap-3 bg-white p-4 rounded-lg border border-sage-200">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-sage-800">필터:</span>
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
          <span className="text-sm font-medium text-sage-800">정렬:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'date' | 'type')}
            className="form-input-standard"
          >
            <option value="date">날짜순</option>
            <option value="type">종류별</option>
          </select>
        </div>

        <div className="ml-auto text-sm text-sage-700">
          총 <span className="font-semibold text-sage-900">{sortedSchedules.length}</span>개
        </div>
      </div>

      {/* 목록 */}
      {sortedSchedules.length === 0 ? (
        <div className="bg-white rounded-lg border border-sage-200 p-12 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-sage-100 rounded-full mb-4">
            
          </div>
          <p className="text-gray-600 font-medium">일정이 없습니다.</p>
          <p className="text-sm text-sage-600 mt-1">새로운 일정을 추가해보세요.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-sage-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-sage-50 border-b border-sage-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-sage-800 uppercase tracking-wider">
                    날짜/시간
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-sage-800 uppercase tracking-wider">
                    종류
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-sage-800 uppercase tracking-wider">
                    제목
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-sage-800 uppercase tracking-wider">
                    참조
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-sage-800 uppercase tracking-wider">
                    장소
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-sage-800 uppercase tracking-wider">
                    상태
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-sage-800 uppercase tracking-wider">
                    액션
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sage-100">
                {sortedSchedules.map((schedule) => (
                  <tr
                    key={schedule.id}
                    className="hover:bg-sage-50 cursor-pointer transition-colors"
                    onClick={() => onEdit(schedule)}
                  >
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {formatDate(schedule.event_date)}
                      </div>
                      <div className="text-sm text-sage-600">
                        {formatTime(schedule.event_time)}
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-md border ${getTypeColor(schedule.event_type)}`}>
                        {schedule.event_type_kr}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm font-medium text-gray-900 max-w-md truncate">
                        {schedule.title}
                      </div>
                      {schedule.description && (
                        <div className="text-sm text-sage-600 max-w-md truncate">
                          {schedule.description}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {schedule.reference_id}
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm text-sage-600">
                        {schedule.location || '-'}
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
                        className="text-sage-700 hover:text-sage-900 font-medium mr-3"
                      >
                        수정
                      </button>
                      {onDelete && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onDelete(schedule)
                          }}
                          className="text-red-600 hover:text-red-900 font-medium"
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
