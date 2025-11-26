'use client'

import { useState, useEffect, useCallback } from 'react'

interface Holiday {
  id: string
  holiday_date: string
  holiday_name: string
  year: number
  created_at: string
}

export default function HolidayManagement() {
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null)

  const [formData, setFormData] = useState({
    holiday_date: '',
    holiday_name: ''
  })

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
      alert('공휴일을 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }, [selectedYear])

  useEffect(() => {
    fetchHolidays()
  }, [fetchHolidays])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      if (editingHoliday) {
        const response = await fetch(`/api/admin/holidays/${editingHoliday.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        })

        const result = await response.json()
        if (result.success) {
          alert('공휴일이 수정되었습니다.')
          setEditingHoliday(null)
          fetchHolidays()
        } else {
          alert(result.error || '수정 실패')
        }
      } else {
        const response = await fetch('/api/admin/holidays', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        })

        const result = await response.json()
        if (result.success) {
          alert('공휴일이 추가되었습니다.')
          setIsAddModalOpen(false)
          fetchHolidays()
        } else {
          alert(result.error || '추가 실패')
        }
      }

      setFormData({ holiday_date: '', holiday_name: '' })
    } catch (error) {
      console.error('공휴일 저장 실패:', error)
      alert('저장에 실패했습니다.')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('이 공휴일을 삭제하시겠습니까?')) return

    try {
      const response = await fetch(`/api/admin/holidays/${id}`, {
        method: 'DELETE'
      })

      const result = await response.json()
      if (result.success) {
        alert('공휴일이 삭제되었습니다.')
        fetchHolidays()
      } else {
        alert(result.error || '삭제 실패')
      }
    } catch (error) {
      console.error('공휴일 삭제 실패:', error)
      alert('삭제에 실패했습니다.')
    }
  }

  const handleEdit = (holiday: Holiday) => {
    setEditingHoliday(holiday)
    setFormData({
      holiday_date: holiday.holiday_date,
      holiday_name: holiday.holiday_name
    })
    setIsAddModalOpen(true)
  }

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 1 + i)

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sage-500"
          >
            {years.map(year => (
              <option key={year} value={year}>{year}년</option>
            ))}
          </select>
          <span className="text-xs text-gray-500">
            {holidays.length}개의 공휴일
          </span>
        </div>
        <button
          onClick={() => {
            setEditingHoliday(null)
            setFormData({ holiday_date: '', holiday_name: '' })
            setIsAddModalOpen(true)
          }}
          className="px-3 py-1.5 text-sm bg-sage-600 text-white rounded-lg hover:bg-sage-700 transition-colors"
        >
          + 공휴일 추가
        </button>
      </div>

      {/* Description */}
      <p className="text-xs text-gray-500 mb-4">
        법정 기간 계산에 사용되는 공휴일을 관리합니다 (민법 제161조 적용)
      </p>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200">
        {loading ? (
          <div className="py-12 text-center">
            <div className="animate-spin inline-block rounded-full h-6 w-6 border-2 border-gray-300 border-t-gray-600"></div>
          </div>
        ) : holidays.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm">
            등록된 공휴일이 없습니다.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">날짜</th>
                <th className="px-4 py-2.5 text-left font-medium">공휴일명</th>
                <th className="px-4 py-2.5 text-left font-medium">요일</th>
                <th className="px-4 py-2.5 text-right font-medium">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {holidays.map((holiday) => {
                const date = new Date(holiday.holiday_date)
                const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()]
                const isWeekend = date.getDay() === 0 || date.getDay() === 6

                return (
                  <tr key={holiday.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {holiday.holiday_date}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {holiday.holiday_name}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs ${isWeekend ? 'text-red-500' : 'text-gray-500'}`}>
                        {dayOfWeek}요일
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleEdit(holiday)}
                        className="text-sage-600 hover:text-sage-800 text-xs mr-3"
                      >
                        수정
                      </button>
                      <button
                        onClick={() => handleDelete(holiday.id)}
                        className="text-red-500 hover:text-red-700 text-xs"
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full max-w-sm">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">
                {editingHoliday ? '공휴일 수정' : '공휴일 추가'}
              </h3>
            </div>

            <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  날짜 <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.holiday_date}
                  onChange={(e) => setFormData({ ...formData, holiday_date: e.target.value })}
                  required
                  className="w-full px-3 py-2 text-sm text-gray-900 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-transparent"
                  style={{ colorScheme: 'light' }}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  공휴일명 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.holiday_name}
                  onChange={(e) => setFormData({ ...formData, holiday_name: e.target.value })}
                  placeholder="예: 설날, 추석, 어린이날"
                  required
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-transparent"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false)
                    setEditingHoliday(null)
                    setFormData({ holiday_date: '', holiday_name: '' })
                  }}
                  className="flex-1 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 text-sm bg-sage-600 text-white rounded-lg hover:bg-sage-700 transition-colors"
                >
                  {editingHoliday ? '수정' : '추가'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
