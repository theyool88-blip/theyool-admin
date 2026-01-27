'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Play, Pause, Edit, Trash2, Calendar, RefreshCw, ChevronLeft } from 'lucide-react'
import type { RecurringTemplate } from '@/types/expense'
import RecurringTemplateFormModal, { type RecurringTemplateData } from '@/components/admin/RecurringTemplateFormModal'

export default function RecurringExpensesPage() {
  const [templates, setTemplates] = useState<RecurringTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [showCreateModal, setShowCreateModal] = useState(false)

  const fetchTemplates = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/expenses/recurring')
      if (response.ok) {
        const data = await response.json()
        setTemplates(data.templates || [])
      }
    } catch (error) {
      console.error('Failed to fetch templates:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  const handleCreateTemplate = async (data: RecurringTemplateData) => {
    const response = await fetch('/api/admin/expenses/recurring', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (!response.ok) throw new Error('Failed to create template')
    fetchTemplates()
  }

  const toggleActive = async (id: string, currentActive: boolean) => {
    try {
      const response = await fetch(`/api/admin/expenses/recurring/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !currentActive })
      })
      if (response.ok) {
        fetchTemplates()
      }
    } catch (error) {
      console.error('Failed to toggle template:', error)
    }
  }

  const deleteTemplate = async (id: string) => {
    if (!confirm('이 고정 지출 템플릿을 삭제하시겠습니까?')) return

    try {
      const response = await fetch(`/api/admin/expenses/recurring/${id}`, {
        method: 'DELETE'
      })
      if (response.ok) {
        fetchTemplates()
      }
    } catch (error) {
      console.error('Failed to delete template:', error)
    }
  }

  const generateExpenses = async () => {
    if (!selectedMonth) {
      alert('월을 선택해주세요.')
      return
    }

    if (!confirm(`${selectedMonth}월의 고정 지출을 생성하시겠습니까?`)) return

    setGenerating(true)
    try {
      const response = await fetch('/api/admin/expenses/recurring/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monthKey: selectedMonth })
      })

      if (response.ok) {
        const result = await response.json()
        alert(`${result.count}개의 고정 지출이 생성되었습니다.`)
      } else {
        const error = await response.json()
        alert(`오류: ${error.error || '생성 실패'}`)
      }
    } catch (error) {
      console.error('Failed to generate expenses:', error)
      alert('고정 지출 생성 중 오류가 발생했습니다.')
    } finally {
      setGenerating(false)
    }
  }

  const activeTemplates = templates.filter(t => t.is_active)
  const inactiveTemplates = templates.filter(t => !t.is_active)

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pt-16">
      {/* Header */}
      <div className="bg-[var(--bg-secondary)] border-b border-[var(--border-default)] shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5 sm:py-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <Link
                href="/admin/expenses"
                className="w-11 h-11 flex items-center justify-center rounded-xl bg-[var(--sage-muted)] hover:bg-[var(--bg-hover)] active:bg-[var(--bg-tertiary)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--sage-primary)] focus:ring-offset-2"
                aria-label="뒤로 가기"
              >
                <ChevronLeft className="w-5 h-5 text-[var(--text-secondary)]" />
              </Link>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)]">고정 지출 템플릿</h1>
                <p className="text-sm text-[var(--text-secondary)] mt-0.5">
                  활성 <span className="font-semibold text-[var(--text-secondary)]">{activeTemplates.length}</span>개
                  <span className="mx-1.5 text-[var(--text-muted)]">|</span>
                  비활성 <span className="font-semibold text-[var(--text-tertiary)]">{inactiveTemplates.length}</span>개
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn btn-primary flex items-center justify-center gap-2 px-5 py-3 min-h-[48px] font-medium shadow-sm"
            >
              <Plus className="w-5 h-5 flex-shrink-0" />
              새 템플릿 추가
            </button>
          </div>
        </div>
      </div>

      {/* Generate Section */}
      <div className="bg-[var(--bg-secondary)] border-b border-[var(--border-default)]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5 sm:py-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-[var(--sage-muted)] flex items-center justify-center flex-shrink-0">
                <RefreshCw className="w-7 h-7 text-[var(--sage-primary)]" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-[var(--text-primary)]">고정 지출 자동 생성</h3>
                <p className="text-sm text-[var(--text-tertiary)] mt-0.5">
                  선택한 월의 고정 지출을 활성화된 템플릿으로 자동 생성합니다.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 sm:flex-shrink-0">
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="form-input px-4 py-3 text-base min-h-[48px]"
              />
              <button
                onClick={generateExpenses}
                disabled={generating || !selectedMonth}
                className="btn btn-primary px-6 py-3 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed font-medium min-h-[48px] whitespace-nowrap shadow-sm"
              >
                {generating ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    생성 중...
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5 flex-shrink-0" />
                    지출 생성
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Templates List */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {loading ? (
          <div className="card p-12 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-10 w-10 border-3 border-[var(--border-default)] border-t-[var(--sage-primary)]"></div>
              <p className="text-sm text-[var(--text-secondary)]">템플릿을 불러오는 중...</p>
            </div>
          </div>
        ) : templates.length === 0 ? (
          <div className="card p-12 text-center">
            <div className="w-16 h-16 bg-[var(--sage-muted)] rounded-full flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-8 h-8 text-[var(--text-muted)]" />
            </div>
            <p className="text-lg font-medium text-[var(--text-secondary)] mb-2">등록된 고정 지출 템플릿이 없습니다</p>
            <p className="text-sm text-[var(--text-tertiary)] mb-6">매월 반복되는 지출을 템플릿으로 등록해보세요.</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn btn-primary px-6 py-3 inline-flex items-center gap-2 font-medium min-h-[48px] shadow-sm"
            >
              <Plus className="w-5 h-5" />
              첫 템플릿 추가하기
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Active Templates */}
            {activeTemplates.length > 0 && (
              <div>
                <h2 className="text-base font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 bg-[var(--sage-primary)] rounded-full"></span>
                  활성 템플릿 ({activeTemplates.length}개)
                </h2>

                {/* Mobile Card View */}
                <div className="block lg:hidden space-y-3">
                  {activeTemplates.map((template) => (
                    <div
                      key={template.id}
                      className="card p-4"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-[var(--sage-muted)] text-[var(--text-secondary)]">
                              {template.expense_category}
                            </span>
                            <span className="text-sm text-[var(--text-tertiary)]">매월 {template.day_of_month}일</span>
                          </div>
                          <h3 className="text-base font-semibold text-[var(--text-primary)]">
                            {template.name}
                          </h3>
                        </div>
                        <p className="text-lg font-bold text-[var(--text-primary)] ml-3">
                          {template.amount.toLocaleString()}<span className="text-sm font-medium">원</span>
                        </p>
                      </div>
                      <div className="flex items-center justify-end pt-3 border-t border-[var(--border-subtle)]">
                        <div className="flex gap-1">
                          <button
                            onClick={() => toggleActive(template.id, template.is_active)}
                            className="w-11 h-11 flex items-center justify-center rounded-xl hover:bg-[var(--color-warning-muted)] transition-colors text-[var(--color-warning)] focus:outline-none focus:ring-2 focus:ring-[var(--color-warning)]"
                            aria-label="비활성화"
                          >
                            <Pause className="w-5 h-5" />
                          </button>
                          <button
                            className="w-11 h-11 flex items-center justify-center rounded-xl hover:bg-[var(--bg-hover)] transition-colors text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--sage-primary)]"
                            aria-label="수정"
                          >
                            <Edit className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => deleteTemplate(template.id)}
                            className="w-11 h-11 flex items-center justify-center rounded-xl hover:bg-[var(--color-danger-muted)] transition-colors text-[var(--color-danger)] focus:outline-none focus:ring-2 focus:ring-[var(--color-danger)]"
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
                <div className="hidden lg:block card overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-[var(--bg-primary)] border-b border-[var(--border-default)]">
                      <tr>
                        <th className="px-5 py-4 text-left text-sm font-semibold text-[var(--text-secondary)]">
                          템플릿명
                        </th>
                        <th className="px-5 py-4 text-left text-sm font-semibold text-[var(--text-secondary)]">
                          카테고리
                        </th>
                        <th className="px-5 py-4 text-right text-sm font-semibold text-[var(--text-secondary)]">
                          금액
                        </th>
                        <th className="px-5 py-4 text-center text-sm font-semibold text-[var(--text-secondary)]">
                          발생일
                        </th>
                        <th className="px-5 py-4 text-center text-sm font-semibold text-[var(--text-secondary)]">
                          작업
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-[var(--bg-secondary)] divide-y divide-[var(--border-subtle)]">
                      {activeTemplates.map((template) => (
                        <tr key={template.id} className="hover:bg-[var(--bg-hover)] transition-colors">
                          <td className="px-5 py-4">
                            <span className="text-base font-medium text-[var(--text-primary)]">
                              {template.name}
                            </span>
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap">
                            <span className="px-3 py-1.5 text-sm font-medium rounded-full bg-[var(--sage-muted)] text-[var(--text-secondary)]">
                              {template.expense_category}
                            </span>
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap text-right">
                            <span className="text-lg font-bold text-[var(--text-primary)]">
                              {template.amount.toLocaleString()}
                            </span>
                            <span className="text-sm text-[var(--text-tertiary)] ml-0.5">원</span>
                          </td>
                          <td className="px-5 py-4 text-center">
                            <span className="text-base text-[var(--text-secondary)]">
                              매월 {template.day_of_month}일
                            </span>
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap">
                            <div className="flex justify-center gap-1">
                              <button
                                onClick={() => toggleActive(template.id, template.is_active)}
                                className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-[var(--color-warning-muted)] transition-colors text-[var(--color-warning)] focus:outline-none focus:ring-2 focus:ring-[var(--color-warning)]"
                                aria-label="비활성화"
                              >
                                <Pause className="w-5 h-5" />
                              </button>
                              <button
                                className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-[var(--bg-hover)] transition-colors text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--sage-primary)]"
                                aria-label="수정"
                              >
                                <Edit className="w-5 h-5" />
                              </button>
                              <button
                                onClick={() => deleteTemplate(template.id)}
                                className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-[var(--color-danger-muted)] transition-colors text-[var(--color-danger)] focus:outline-none focus:ring-2 focus:ring-[var(--color-danger)]"
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
            )}

            {/* Inactive Templates */}
            {inactiveTemplates.length > 0 && (
              <div>
                <h2 className="text-base font-semibold text-[var(--text-secondary)] mb-3 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 bg-[var(--text-muted)] rounded-full"></span>
                  비활성 템플릿 ({inactiveTemplates.length}개)
                </h2>

                {/* Mobile Card View */}
                <div className="block lg:hidden space-y-3">
                  {inactiveTemplates.map((template) => (
                    <div
                      key={template.id}
                      className="card p-4 opacity-70"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]">
                              {template.expense_category}
                            </span>
                          </div>
                          <h3 className="text-base font-medium text-[var(--text-secondary)]">
                            {template.name}
                          </h3>
                        </div>
                        <p className="text-lg font-bold text-[var(--text-secondary)] ml-3">
                          {template.amount.toLocaleString()}<span className="text-sm font-medium">원</span>
                        </p>
                      </div>
                      <div className="flex items-center justify-end pt-3 border-t border-[var(--border-subtle)]">
                        <div className="flex gap-1">
                          <button
                            onClick={() => toggleActive(template.id, template.is_active)}
                            className="w-11 h-11 flex items-center justify-center rounded-xl hover:bg-[var(--bg-hover)] transition-colors text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--sage-primary)]"
                            aria-label="활성화"
                          >
                            <Play className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => deleteTemplate(template.id)}
                            className="w-11 h-11 flex items-center justify-center rounded-xl hover:bg-[var(--color-danger-muted)] transition-colors text-[var(--color-danger)] focus:outline-none focus:ring-2 focus:ring-[var(--color-danger)]"
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
                <div className="hidden lg:block card overflow-hidden opacity-80">
                  <table className="w-full">
                    <thead className="bg-[var(--bg-primary)] border-b border-[var(--border-default)]">
                      <tr>
                        <th className="px-5 py-4 text-left text-sm font-semibold text-[var(--text-secondary)]">
                          템플릿명
                        </th>
                        <th className="px-5 py-4 text-left text-sm font-semibold text-[var(--text-secondary)]">
                          카테고리
                        </th>
                        <th className="px-5 py-4 text-right text-sm font-semibold text-[var(--text-secondary)]">
                          금액
                        </th>
                        <th className="px-5 py-4 text-center text-sm font-semibold text-[var(--text-secondary)]">
                          작업
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-[var(--bg-secondary)] divide-y divide-[var(--border-subtle)]">
                      {inactiveTemplates.map((template) => (
                        <tr key={template.id} className="hover:bg-[var(--bg-hover)] transition-colors">
                          <td className="px-5 py-4">
                            <span className="text-base text-[var(--text-secondary)]">
                              {template.name}
                            </span>
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap">
                            <span className="px-3 py-1.5 text-sm font-medium rounded-full bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]">
                              {template.expense_category}
                            </span>
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap text-right">
                            <span className="text-lg font-semibold text-[var(--text-secondary)]">
                              {template.amount.toLocaleString()}
                            </span>
                            <span className="text-sm text-[var(--text-muted)] ml-0.5">원</span>
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap">
                            <div className="flex justify-center gap-1">
                              <button
                                onClick={() => toggleActive(template.id, template.is_active)}
                                className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-[var(--bg-hover)] transition-colors text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--sage-primary)]"
                                aria-label="활성화"
                              >
                                <Play className="w-5 h-5" />
                              </button>
                              <button
                                onClick={() => deleteTemplate(template.id)}
                                className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-[var(--color-danger-muted)] transition-colors text-[var(--color-danger)] focus:outline-none focus:ring-2 focus:ring-[var(--color-danger)]"
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
            )}
          </div>
        )}

        {/* Summary */}
        {activeTemplates.length > 0 && (
          <div className="mt-5 card p-5">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
              <span className="text-base text-[var(--text-secondary)]">
                활성 템플릿 월별 예상 지출
              </span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-[var(--text-primary)]">
                  {activeTemplates.reduce((sum, t) => sum + t.amount, 0).toLocaleString()}
                </span>
                <span className="text-base text-[var(--text-secondary)]">원</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create Template Modal */}
      <RecurringTemplateFormModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateTemplate}
        title="새 고정 지출 템플릿"
      />
    </div>
  )
}
