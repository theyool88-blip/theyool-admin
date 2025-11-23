'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Holiday {
  id: string
  holiday_date: string
  holiday_name: string
  year: number
  created_at: string
}

export default function HolidaysManagement() {
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null)

  const [formData, setFormData] = useState({
    holiday_date: '',
    holiday_name: ''
  })

  const supabase = createClient()

  useEffect(() => {
    fetchHolidays()
  }, [selectedYear])

  const fetchHolidays = async () => {
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
  }

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
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">공휴일 관리</h1>
          <p className="mt-1 text-sm text-gray-600">
            법정 기간 계산에 사용되는 공휴일을 관리합니다
          </p>
        </div>
        <button
          onClick={() => {
            setEditingHoliday(null)
            setFormData({ holiday_date: '', holiday_name: '' })
            setIsAddModalOpen(true)
          }}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          + 공휴일 추가
        </button>
      </div>

      <div className="mb-6 flex items-center gap-4">
        <label className="text-sm font-semibold text-gray-700">연도:</label>
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(parseInt(e.target.value))}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
        >
          {years.map(year => (
            <option key={year} value={year}>{year}년</option>
          ))}
        </select>
        <span className="text-sm text-gray-600">
          총 {holidays.length}개의 공휴일
        </span>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">로딩 중...</div>
      ) : holidays.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          등록된 공휴일이 없습니다.
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  날짜
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  공휴일명
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  요일
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  작업
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {holidays.map((holiday) => {
                const date = new Date(holiday.holiday_date)
                const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()]

                return (
                  <tr key={holiday.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {holiday.holiday_date}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {holiday.holiday_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {dayOfWeek}요일
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleEdit(holiday)}
                        className="text-blue-600 hover:text-blue-900 mr-4"
                      >
                        수정
                      </button>
                      <button
                        onClick={() => handleDelete(holiday.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {editingHoliday ? '공휴일 수정' : '공휴일 추가'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  날짜 *
                </label>
                <input
                  type="date"
                  value={formData.holiday_date}
                  onChange={(e) => setFormData({ ...formData, holiday_date: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  공휴일명 *
                </label>
                <input
                  type="text"
                  value={formData.holiday_name}
                  onChange={(e) => setFormData({ ...formData, holiday_name: e.target.value })}
                  placeholder="예: 설날, 추석, 어린이날"
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false)
                    setEditingHoliday(null)
                    setFormData({ holiday_date: '', holiday_name: '' })
                  }}
                  className="flex-1 px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700"
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
