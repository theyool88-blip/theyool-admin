'use client'

import { useState, useEffect, useCallback } from 'react'

interface Holiday {
  id: string
  holiday_date: string
  holiday_name: string
  year: number
}

/**
 * 공휴일 목록 조회 (읽기 전용)
 * 공휴일 관리(추가/수정/삭제)는 슈퍼 어드민 전용입니다.
 */
export default function HolidayManagement() {
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())

  const fetchHolidays = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/admin/holidays?year=${selectedYear}`)
      const result = await response.json()

      if (result.success) {
        setHolidays(result.data)
      }
    } catch (error) {
      console.error('공휴일 조회 실패:', error)
    } finally {
      setLoading(false)
    }
  }, [selectedYear])

  useEffect(() => {
    fetchHolidays()
  }, [fetchHolidays])

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 1 + i)

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="form-input"
          >
            {years.map(year => (
              <option key={year} value={year}>{year}년</option>
            ))}
          </select>
          <span className="text-caption">
            {holidays.length}개의 공휴일
          </span>
        </div>
      </div>

      {/* Description */}
      <p className="text-caption mb-4">
        법정 기간 계산에 사용되는 공휴일입니다. 공휴일 관리는 슈퍼 어드민에서만 가능합니다.
      </p>

      {/* Table */}
      <div className="card">
        {loading ? (
          <div className="py-12 text-center">
            <div className="animate-spin inline-block rounded-full h-6 w-6 border-2 border-[var(--border-default)] border-t-[var(--text-secondary)]"></div>
          </div>
        ) : holidays.length === 0 ? (
          <div className="py-12 text-center text-[var(--text-muted)] text-sm">
            등록된 공휴일이 없습니다.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[var(--bg-primary)] text-[var(--text-tertiary)] text-xs">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">날짜</th>
                <th className="px-4 py-2.5 text-left font-medium">공휴일명</th>
                <th className="px-4 py-2.5 text-left font-medium">요일</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {holidays.map((holiday) => {
                const date = new Date(holiday.holiday_date)
                const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()]
                const isWeekend = date.getDay() === 0 || date.getDay() === 6

                return (
                  <tr key={holiday.id} className="hover:bg-[var(--bg-hover)]">
                    <td className="px-4 py-3 font-medium text-[var(--text-primary)]">
                      {holiday.holiday_date}
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">
                      {holiday.holiday_name}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs ${isWeekend ? 'text-[var(--color-danger)]' : 'text-[var(--text-tertiary)]'}`}>
                        {dayOfWeek}요일
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
