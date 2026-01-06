'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Search, Download, Edit, Trash2, ChevronLeft, Filter, X } from 'lucide-react'
import type { Expense } from '@/types/expense'
import ExpenseFormModal from '@/components/admin/ExpenseFormModal'
import { exportExpensesToExcel } from '@/lib/excel-export'
import type { ExpenseFormData } from '@/components/admin/ExpenseFormModal'

export default function ExpenseListPage() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showFilters, setShowFilters] = useState(false)

  const fetchExpenses = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (categoryFilter) params.append('category', categoryFilter)
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)

      const response = await fetch(`/api/admin/expenses?${params}`)
      if (response.ok) {
        const data = await response.json()
        setExpenses(data.expenses || [])
      }
    } catch (error) {
      console.error('Failed to fetch expenses:', error)
    } finally {
      setLoading(false)
    }
  }, [categoryFilter, endDate, startDate])

  useEffect(() => {
    fetchExpenses()
  }, [fetchExpenses])

  const handleCreateExpense = async (data: ExpenseFormData) => {
    const response = await fetch('/api/admin/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (!response.ok) throw new Error('Failed to create expense')
    fetchExpenses()
  }

  const deleteExpense = async (id: string) => {
    if (!confirm('이 지출 내역을 삭제하시겠습니까?')) return

    try {
      const response = await fetch(`/api/admin/expenses/${id}`, {
        method: 'DELETE'
      })
      if (response.ok) {
        fetchExpenses()
      }
    } catch (error) {
      console.error('Failed to delete expense:', error)
    }
  }

  const filteredExpenses = expenses.filter(expense => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    return (
      expense.vendor_name?.toLowerCase().includes(term) ||
      expense.memo?.toLowerCase().includes(term) ||
      expense.subcategory?.toLowerCase().includes(term)
    )
  })

  const categories = ['임대료', '인건비', '필수운영비', '마케팅비', '광고비', '세금', '식대', '구독료', '기타']

  const handleExport = () => {
    const filename = `지출내역_${startDate || new Date().toISOString().slice(0, 7)}.xlsx`
    exportExpensesToExcel(filteredExpenses, filename)
  }

  const clearFilters = () => {
    setCategoryFilter('')
    setStartDate('')
    setEndDate('')
  }

  const hasActiveFilters = categoryFilter || startDate || endDate

  return (
    <div className="min-h-screen bg-sage-50 pt-16">
      {/* Header */}
      <div className="bg-white border-b border-sage-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5 sm:py-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <Link
                href="/admin/expenses"
                className="w-11 h-11 flex items-center justify-center rounded-xl bg-sage-100 hover:bg-sage-200 active:bg-sage-300 transition-colors focus:outline-none focus:ring-2 focus:ring-sage-500 focus:ring-offset-2"
                aria-label="뒤로 가기"
              >
                <ChevronLeft className="w-5 h-5 text-sage-700" />
              </Link>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-sage-800">지출 내역 관리</h1>
                <p className="text-sm text-sage-600 mt-0.5">
                  전체 <span className="font-semibold text-sage-700">{filteredExpenses.length}</span>건의 지출 내역
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 sm:gap-3">
              <button
                onClick={handleExport}
                className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm text-sage-700 bg-white border border-sage-300 rounded-xl hover:bg-sage-50 active:bg-sage-100 transition-colors min-h-[48px] shadow-sm focus:outline-none focus:ring-2 focus:ring-sage-500 focus:ring-offset-2"
              >
                <Download className="w-5 h-5 flex-shrink-0" />
                <span className="hidden sm:inline">Excel 다운로드</span>
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm text-white bg-sage-600 rounded-xl hover:bg-sage-700 active:bg-sage-800 transition-colors min-h-[48px] shadow-sm font-medium focus:outline-none focus:ring-2 focus:ring-sage-500 focus:ring-offset-2"
              >
                <Plus className="w-5 h-5 flex-shrink-0" />
                <span>새 지출 등록</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-white border-b border-sage-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
          {/* Search Bar */}
          <div className="flex gap-3 mb-3">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-sage-400" />
              <input
                type="text"
                placeholder="공급업체명, 메모로 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 text-base border border-sage-300 rounded-xl focus:ring-2 focus:ring-sage-500 focus:border-transparent min-h-[48px] text-sage-800 placeholder:text-sage-400"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center justify-center gap-2 px-4 py-3 border rounded-xl transition-colors min-w-[48px] min-h-[48px] focus:outline-none focus:ring-2 focus:ring-sage-500 focus:ring-offset-2 ${
                hasActiveFilters
                  ? 'bg-sage-100 border-sage-400 text-sage-700'
                  : 'bg-white border-sage-300 text-sage-600 hover:bg-sage-50 active:bg-sage-100'
              }`}
            >
              <Filter className="w-5 h-5 flex-shrink-0" />
              <span className="hidden sm:inline font-medium">필터</span>
              {hasActiveFilters && (
                <span className="w-5 h-5 bg-sage-600 text-white text-xs rounded-full flex items-center justify-center font-medium">
                  {[categoryFilter, startDate, endDate].filter(Boolean).length}
                </span>
              )}
            </button>
          </div>

          {/* Filter Panel */}
          {showFilters && (
            <div className="bg-sage-50 rounded-xl p-4 animate-slideDown border border-sage-200">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-sage-700">상세 필터</span>
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="flex items-center gap-1.5 text-sm text-sage-600 hover:text-sage-800 transition-colors px-2 py-1 rounded-lg hover:bg-sage-100"
                  >
                    <X className="w-4 h-4" />
                    필터 초기화
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Category Filter */}
                <div>
                  <label className="block text-sm font-medium text-sage-600 mb-1.5">카테고리</label>
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="w-full px-4 py-2.5 text-base border border-sage-300 rounded-xl focus:ring-2 focus:ring-sage-500 focus:border-transparent bg-white min-h-[44px] text-sage-800"
                  >
                    <option value="">전체 카테고리</option>
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                {/* Start Date */}
                <div>
                  <label className="block text-sm font-medium text-sage-600 mb-1.5">시작일</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-4 py-2.5 text-base border border-sage-300 rounded-xl focus:ring-2 focus:ring-sage-500 focus:border-transparent bg-white min-h-[44px] text-sage-800"
                  />
                </div>

                {/* End Date */}
                <div>
                  <label className="block text-sm font-medium text-sage-600 mb-1.5">종료일</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-4 py-2.5 text-base border border-sage-300 rounded-xl focus:ring-2 focus:ring-sage-500 focus:border-transparent bg-white min-h-[44px] text-sage-800"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {loading ? (
          <div className="bg-white rounded-xl shadow-sm border border-sage-200 p-12 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-10 w-10 border-3 border-sage-200 border-t-sage-600"></div>
              <p className="text-sm text-sage-600">지출 내역을 불러오는 중...</p>
            </div>
          </div>
        ) : filteredExpenses.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-sage-200 p-12 text-center">
            <div className="w-16 h-16 bg-sage-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-sage-400" />
            </div>
            <p className="text-lg font-medium text-sage-700 mb-2">지출 내역이 없습니다</p>
            <p className="text-sm text-sage-500 mb-6">새로운 지출 내역을 등록해보세요.</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-3 text-white bg-sage-600 rounded-xl hover:bg-sage-700 active:bg-sage-800 transition-colors inline-flex items-center gap-2 font-medium min-h-[48px] shadow-sm focus:outline-none focus:ring-2 focus:ring-sage-500 focus:ring-offset-2"
            >
              <Plus className="w-5 h-5" />
              첫 지출 등록하기
            </button>
          </div>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="block lg:hidden space-y-3">
              {filteredExpenses.map((expense) => (
                <div
                  key={expense.id}
                  className="bg-white rounded-xl border border-sage-200 p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-sage-100 text-sage-700">
                          {expense.expense_category}
                        </span>
                        {expense.is_recurring && (
                          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-coral-100 text-coral-700">
                            고정
                          </span>
                        )}
                      </div>
                      <h3 className="text-base font-semibold text-sage-800 truncate">
                        {expense.vendor_name || '-'}
                      </h3>
                      {expense.memo && (
                        <p className="text-sm text-sage-500 mt-1 line-clamp-2">{expense.memo}</p>
                      )}
                    </div>
                    <p className="text-lg font-bold text-sage-800 ml-3">
                      {expense.amount.toLocaleString()}<span className="text-sm font-medium">원</span>
                    </p>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-sage-100">
                    <div className="flex items-center gap-3 text-sm text-sage-500">
                      <span>{(() => {
                        const d = new Date(expense.expense_date)
                        return `${String(d.getFullYear()).slice(2)}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
                      })()}</span>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => {/* TODO: Edit modal */}}
                        className="w-11 h-11 flex items-center justify-center rounded-xl hover:bg-sage-100 active:bg-sage-200 transition-colors text-sage-600 focus:outline-none focus:ring-2 focus:ring-sage-500"
                        aria-label="수정"
                      >
                        <Edit className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => deleteExpense(expense.id)}
                        className="w-11 h-11 flex items-center justify-center rounded-xl hover:bg-red-50 active:bg-red-100 transition-colors text-red-500 focus:outline-none focus:ring-2 focus:ring-red-500"
                        aria-label="삭제"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden lg:block bg-white rounded-xl shadow-sm border border-sage-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-sage-50 border-b border-sage-200">
                    <tr>
                      <th className="px-5 py-4 text-left text-sm font-semibold text-sage-700">
                        지출일
                      </th>
                      <th className="px-5 py-4 text-left text-sm font-semibold text-sage-700">
                        카테고리
                      </th>
                      <th className="px-5 py-4 text-left text-sm font-semibold text-sage-700">
                        공급업체 / 메모
                      </th>
                      <th className="px-5 py-4 text-right text-sm font-semibold text-sage-700">
                        금액
                      </th>
                      <th className="px-5 py-4 text-center text-sm font-semibold text-sage-700">
                        유형
                      </th>
                      <th className="px-5 py-4 text-center text-sm font-semibold text-sage-700">
                        작업
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-sage-100">
                    {filteredExpenses.map((expense) => (
                      <tr key={expense.id} className="hover:bg-sage-50 transition-colors">
                        <td className="px-5 py-4 whitespace-nowrap">
                          <span className="text-base text-sage-800">
                            {(() => {
                              const d = new Date(expense.expense_date)
                              return `${String(d.getFullYear()).slice(2)}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
                            })()}
                          </span>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <span className="px-3 py-1.5 text-sm font-medium rounded-full bg-sage-100 text-sage-700">
                            {expense.expense_category}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <p className="text-base font-medium text-sage-800">
                            {expense.vendor_name || '-'}
                          </p>
                          {expense.memo && (
                            <p className="text-sm text-sage-500 mt-0.5 max-w-xs truncate">{expense.memo}</p>
                          )}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap text-right">
                          <span className="text-lg font-bold text-sage-800">
                            {expense.amount.toLocaleString()}
                          </span>
                          <span className="text-sm text-sage-500 ml-0.5">원</span>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap text-center">
                          {expense.is_recurring ? (
                            <span className="px-3 py-1.5 text-sm font-medium rounded-full bg-coral-100 text-coral-700">
                              고정
                            </span>
                          ) : (
                            <span className="px-3 py-1.5 text-sm font-medium rounded-full bg-gray-100 text-gray-600">
                              일반
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <div className="flex justify-center gap-1">
                            <button
                              onClick={() => {/* TODO: Edit modal */}}
                              className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-sage-100 active:bg-sage-200 transition-colors text-sage-600 focus:outline-none focus:ring-2 focus:ring-sage-500"
                              aria-label="수정"
                            >
                              <Edit className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => deleteExpense(expense.id)}
                              className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-red-50 active:bg-red-100 transition-colors text-red-500 focus:outline-none focus:ring-2 focus:ring-red-500"
                              aria-label="삭제"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Summary */}
            <div className="mt-4 bg-white rounded-xl shadow-sm border border-sage-200 p-5">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                <span className="text-base text-sage-600">
                  총 <span className="font-semibold text-sage-700">{filteredExpenses.length}</span>건
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-sm text-sage-500">합계:</span>
                  <span className="text-2xl font-bold text-sage-800">
                    {filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0).toLocaleString()}
                  </span>
                  <span className="text-base text-sage-600">원</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Create Modal */}
      <ExpenseFormModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateExpense}
        title="새 지출 등록"
      />
    </div>
  )
}
