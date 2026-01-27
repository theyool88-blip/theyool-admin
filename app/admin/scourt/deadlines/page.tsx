'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  DEADLINE_TYPE_LABELS,
  DEADLINE_STATUS_LABELS,
  type CaseDeadline,
  type DeadlineType,
  type DeadlineStatus,
} from '@/types/court-hearing'

interface EditFormState {
  trigger_date: string
  notes: string
  status: DeadlineStatus
}

export default function ScourtDeadlinesPage() {
  // 상태
  const [deadlines, setDeadlines] = useState<CaseDeadline[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')

  // 편집 상태
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<EditFormState>({
    trigger_date: '',
    notes: '',
    status: 'PENDING',
  })
  const [saving, setSaving] = useState(false)

  // 데이터 로드
  const fetchDeadlines = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({ auto_registered: 'true', limit: '100' })
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (typeFilter !== 'all') params.set('deadline_type', typeFilter)

      const res = await fetch(`/api/admin/case-deadlines?${params}`)
      const data = await res.json()

      if (!data.success) {
        throw new Error(data.error || '데이터 로드 실패')
      }

      setDeadlines(data.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : '데이터 로드 실패')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, typeFilter])

  useEffect(() => {
    fetchDeadlines()
  }, [fetchDeadlines])

  // 편집 시작
  const handleEditStart = (deadline: CaseDeadline) => {
    setEditingId(deadline.id)
    setEditForm({
      trigger_date: deadline.trigger_date,
      notes: deadline.notes || '',
      status: deadline.status,
    })
  }

  // 편집 취소
  const handleEditCancel = () => {
    setEditingId(null)
    setEditForm({ trigger_date: '', notes: '', status: 'PENDING' })
  }

  // 수정 저장
  const handleUpdate = async () => {
    if (!editingId) return

    setSaving(true)
    try {
      const res = await fetch(`/api/admin/case-deadlines/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })

      const data = await res.json()
      if (!data.success) {
        throw new Error(data.error || '수정 실패')
      }

      setEditingId(null)
      await fetchDeadlines()
    } catch (err) {
      alert(err instanceof Error ? err.message : '수정 실패')
    } finally {
      setSaving(false)
    }
  }

  // 삭제
  const handleDelete = async (id: string, caseNumber: string) => {
    if (!confirm(`사건 ${caseNumber}의 기한을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) {
      return
    }

    try {
      const res = await fetch(`/api/admin/case-deadlines/${id}`, { method: 'DELETE' })
      const data = await res.json()

      if (!data.success) {
        throw new Error(data.error || '삭제 실패')
      }

      await fetchDeadlines()
    } catch (err) {
      alert(err instanceof Error ? err.message : '삭제 실패')
    }
  }

  // D-day 계산
  const getDday = (deadlineDate: string): { text: string; daysLeft: number } => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const deadline = new Date(deadlineDate)
    deadline.setHours(0, 0, 0, 0)
    const diff = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

    if (diff === 0) return { text: 'D-day', daysLeft: 0 }
    return {
      text: diff > 0 ? `D-${diff}` : `D+${Math.abs(diff)}`,
      daysLeft: diff,
    }
  }

  // D-day 스타일 클래스
  const getDdayClass = (daysLeft: number): string => {
    if (daysLeft < 0) return 'bg-[var(--color-danger-muted)] text-[var(--color-danger)]' // 기한초과
    if (daysLeft <= 3) return 'bg-[var(--color-warning-muted)] text-[var(--color-warning)]' // 임박
    if (daysLeft <= 7) return 'bg-[var(--color-warning-muted)] text-[var(--color-warning)]' // 주의
    return 'bg-[var(--color-success-muted)] text-[var(--color-success)]' // 여유
  }

  // 기한 유형 목록 (필터용)
  const deadlineTypes = Object.entries(DEADLINE_TYPE_LABELS)

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <main className="max-w-7xl mx-auto p-6">
        {/* 필터 섹션 */}
        <div className="card p-4 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            {/* 상태 필터 */}
            <div className="flex items-center gap-2">
              <label className="form-label">상태:</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="form-input py-1.5"
              >
                <option value="all">전체</option>
                <option value="PENDING">대기중</option>
                <option value="COMPLETED">완료</option>
                <option value="OVERDUE">기한초과</option>
              </select>
            </div>

            {/* 기한 유형 필터 */}
            <div className="flex items-center gap-2">
              <label className="form-label">유형:</label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="form-input py-1.5"
              >
                <option value="all">전체</option>
                {deadlineTypes.map(([type, label]) => (
                  <option key={type} value={type}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {/* 새로고침 버튼 */}
            <button
              onClick={() => fetchDeadlines()}
              disabled={loading}
              className="btn btn-secondary ml-auto"
            >
              {loading ? '로딩...' : '새로고침'}
            </button>
          </div>
        </div>

        {/* 에러 표시 */}
        {error && (
          <div className="bg-[var(--color-danger-muted)] text-[var(--color-danger)] p-4 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* 테이블 */}
        <div className="card overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-[var(--text-tertiary)]">
              <svg className="animate-spin h-8 w-8 mx-auto mb-2 text-[var(--sage-primary)]" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              데이터 로딩 중...
            </div>
          ) : deadlines.length === 0 ? (
            <div className="p-8 text-center text-[var(--text-tertiary)]">
              자동등록된 기한이 없습니다.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-[var(--border-default)] text-sm">
                <thead className="bg-[var(--bg-primary)]">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-[var(--text-tertiary)]">사건번호</th>
                    <th className="px-4 py-3 text-left font-medium text-[var(--text-tertiary)]">기한 유형</th>
                    <th className="px-4 py-3 text-left font-medium text-[var(--text-tertiary)]">기산일</th>
                    <th className="px-4 py-3 text-left font-medium text-[var(--text-tertiary)]">만료일</th>
                    <th className="px-4 py-3 text-left font-medium text-[var(--text-tertiary)]">D-day</th>
                    <th className="px-4 py-3 text-left font-medium text-[var(--text-tertiary)]">상태</th>
                    <th className="px-4 py-3 text-left font-medium text-[var(--text-tertiary)]">0시도달</th>
                    <th className="px-4 py-3 text-left font-medium text-[var(--text-tertiary)]">작업</th>
                  </tr>
                </thead>
                <tbody className="bg-[var(--bg-secondary)] divide-y divide-[var(--border-default)]">
                  {deadlines.map((deadline) => {
                    const { text: ddayText, daysLeft } = getDday(deadline.deadline_date)
                    const isEditing = editingId === deadline.id

                    return (
                      <tr key={deadline.id} className={isEditing ? 'bg-[var(--sage-muted)]' : 'hover:bg-[var(--bg-hover)]'}>
                        {/* 사건번호 */}
                        <td className="px-4 py-3 font-mono text-[var(--text-primary)]">
                          {deadline.case_number || '-'}
                        </td>

                        {/* 기한 유형 */}
                        <td className="px-4 py-3 text-[var(--text-secondary)]">
                          {DEADLINE_TYPE_LABELS[deadline.deadline_type as DeadlineType] ||
                            deadline.deadline_type}
                        </td>

                        {/* 기산일 */}
                        <td className="px-4 py-3">
                          {isEditing ? (
                            <input
                              type="date"
                              value={editForm.trigger_date}
                              onChange={(e) =>
                                setEditForm((prev) => ({ ...prev, trigger_date: e.target.value }))
                              }
                              className="form-input py-1"
                            />
                          ) : (
                            <span className="text-[var(--text-primary)]">{deadline.trigger_date}</span>
                          )}
                        </td>

                        {/* 만료일 */}
                        <td className="px-4 py-3 text-[var(--text-primary)]">{deadline.deadline_date}</td>

                        {/* D-day */}
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-medium ${getDdayClass(daysLeft)}`}
                          >
                            {ddayText}
                          </span>
                        </td>

                        {/* 상태 */}
                        <td className="px-4 py-3">
                          {isEditing ? (
                            <select
                              value={editForm.status}
                              onChange={(e) =>
                                setEditForm((prev) => ({
                                  ...prev,
                                  status: e.target.value as DeadlineStatus,
                                }))
                              }
                              className="form-input py-1"
                            >
                              <option value="PENDING">대기중</option>
                              <option value="COMPLETED">완료</option>
                            </select>
                          ) : (
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-medium ${
                                deadline.status === 'COMPLETED'
                                  ? 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'
                                  : deadline.status === 'OVERDUE'
                                    ? 'bg-[var(--color-danger-muted)] text-[var(--color-danger)]'
                                    : 'bg-[var(--color-info-muted)] text-[var(--color-info)]'
                              }`}
                            >
                              {DEADLINE_STATUS_LABELS[deadline.status as DeadlineStatus] ||
                                deadline.status}
                            </span>
                          )}
                        </td>

                        {/* 0시 도달 */}
                        <td className="px-4 py-3 text-center">
                          {(deadline as CaseDeadline & { is_electronic_service?: boolean })
                            .is_electronic_service ? (
                            <span className="text-[var(--sage-primary)]" title="전자송달 의제 (초일산입)">
                              O
                            </span>
                          ) : (
                            <span className="text-[var(--text-muted)]">-</span>
                          )}
                        </td>

                        {/* 작업 버튼 */}
                        <td className="px-4 py-3">
                          {isEditing ? (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={handleUpdate}
                                disabled={saving}
                                className="btn btn-primary px-3 py-1 text-xs"
                              >
                                {saving ? '저장...' : '저장'}
                              </button>
                              <button
                                onClick={handleEditCancel}
                                disabled={saving}
                                className="btn btn-secondary px-3 py-1 text-xs"
                              >
                                취소
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleEditStart(deadline)}
                                className="px-3 py-1 text-xs font-medium text-[var(--sage-primary)] hover:bg-[var(--sage-muted)] rounded transition-colors"
                              >
                                수정
                              </button>
                              <button
                                onClick={() => handleDelete(deadline.id, deadline.case_number || '')}
                                className="px-3 py-1 text-xs font-medium text-[var(--color-danger)] hover:bg-[var(--color-danger-muted)] rounded transition-colors"
                              >
                                삭제
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 통계 요약 */}
        {!loading && deadlines.length > 0 && (
          <div className="mt-4 text-caption text-right">
            총 {deadlines.length}건의 자동등록 기한
          </div>
        )}
      </main>
    </div>
  )
}
