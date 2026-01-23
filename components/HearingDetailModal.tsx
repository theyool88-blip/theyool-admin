'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  HEARING_TYPE_LABELS,
  HEARING_STATUS_LABELS,
  HEARING_RESULT_LABELS,
  HearingType,
  HearingStatus,
  HearingResult,
  CourtHearing
} from '@/types/court-hearing'

// 10분 단위 시간 옵션 생성 (09:00 ~ 18:00)
const generateTimeOptions = () => {
  const options = []
  for (let hour = 9; hour <= 18; hour++) {
    for (let minute = 0; minute < 60; minute += 10) {
      const h = hour.toString().padStart(2, '0')
      const m = minute.toString().padStart(2, '0')
      options.push(`${h}:${m}`)
    }
  }
  return options
}

const TIME_OPTIONS = generateTimeOptions()

interface HearingDetailModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  hearing: CourtHearing | null
}

export default function HearingDetailModal({
  isOpen,
  onClose,
  onSuccess,
  hearing
}: HearingDetailModalProps) {
  const [loading, setLoading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState({
    hearing_type: '' as HearingType | '',
    hearing_date: '',
    hearing_time: '',
    location: '',
    report: '',
    result: '' as HearingResult | '',
    notes: '',
    status: '' as HearingStatus | ''
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const supabase = createClient()

  useEffect(() => {
    if (hearing && isOpen) {
      const hearingDateTime = new Date(hearing.hearing_date)
      const dateStr = hearingDateTime.toISOString().split('T')[0]
      const timeStr = hearingDateTime.toTimeString().slice(0, 5)

      setFormData({
        hearing_type: hearing.hearing_type,
        hearing_date: dateStr,
        hearing_time: timeStr,
        location: hearing.location || '',
        report: hearing.report || '',
        result: hearing.result || '',
        notes: hearing.notes || '',
        status: hearing.status
      })
      setIsEditing(false)
    }
  }, [hearing, isOpen])

  const validate = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.hearing_type) newErrors.hearing_type = '기일 유형을 선택하세요'
    if (!formData.hearing_date) newErrors.hearing_date = '날짜를 입력하세요'
    if (!formData.hearing_time) newErrors.hearing_time = '시간을 입력하세요'
    if (!formData.status) newErrors.status = '상태를 선택하세요'

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validate() || !hearing) return

    try {
      setLoading(true)

      const hearing_datetime = `${formData.hearing_date}T${formData.hearing_time}:00`

      const { error } = await supabase
        .from('court_hearings')
        .update({
          hearing_type: formData.hearing_type,
          hearing_date: hearing_datetime,
          location: formData.location || null,
          report: formData.report || null,
          result: formData.result || null,
          notes: formData.notes || null,
          status: formData.status
        })
        .eq('id', hearing.id)

      if (error) throw error

      alert('법원 기일이 수정되었습니다.')
      setIsEditing(false)
      onSuccess()
    } catch (error) {
      console.error('법원 기일 수정 실패:', error)
      const message = error instanceof Error ? error.message : '수정 중 오류가 발생했습니다.'
      alert(`수정 실패: ${message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!hearing) return

    if (!confirm('이 법원 기일을 삭제하시겠습니까?')) return

    try {
      setLoading(true)

      const { error } = await supabase
        .from('court_hearings')
        .delete()
        .eq('id', hearing.id)

      if (error) throw error

      alert('법원 기일이 삭제되었습니다.')
      onSuccess()
      handleClose()
    } catch (error) {
      console.error('법원 기일 삭제 실패:', error)
      const message = error instanceof Error ? error.message : '삭제 중 오류가 발생했습니다.'
      alert(`삭제 실패: ${message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setIsEditing(false)
    setErrors({})
    onClose()
  }

  const formatDateTime = (datetime: string) => {
    const d = new Date(datetime)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const hour = String(d.getHours()).padStart(2, '0')
    const minute = String(d.getMinutes()).padStart(2, '0')
    return `${year}.${month}.${day} ${hour}:${minute}`
  }

  const getStatusBadgeColor = (status: HearingStatus) => {
    switch (status) {
      case 'SCHEDULED':
        return 'bg-[var(--color-info-muted)] text-[var(--color-info)] border-[var(--color-info)]/20'
      case 'COMPLETED':
        return 'bg-[var(--color-success-muted)] text-[var(--color-success)] border-[var(--color-success)]/20'
      case 'POSTPONED':
        return 'bg-[var(--color-warning-muted)] text-[var(--color-warning)] border-[var(--color-warning)]/20'
      case 'CANCELLED':
        return 'bg-[var(--bg-tertiary)] text-[var(--text-muted)] border-[var(--border-default)]'
      default:
        return 'bg-[var(--bg-tertiary)] text-[var(--text-muted)] border-[var(--border-default)]'
    }
  }

  if (!isOpen || !hearing) return null

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--bg-secondary)] rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-[var(--bg-secondary)] border-b border-[var(--border-subtle)] px-6 py-4 rounded-t-xl">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">법원 기일 상세</h2>
              {('case_id' in hearing && hearing.case_id) ? (
                <Link
                  href={`/cases/${(hearing as CourtHearing & { case_id?: string }).case_id}`}
                  className="text-xl font-bold text-[var(--text-primary)] hover:text-[var(--sage-primary)] underline-offset-4 hover:underline mt-1 inline-block"
                >
                  {hearing.case_number}
                </Link>
              ) : (
                <h3 className="text-xl font-bold text-[var(--text-primary)] mt-1">{hearing.case_number}</h3>
              )}
            </div>
            <button
              onClick={handleClose}
              className="p-2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6">
          {!isEditing ? (
            // 보기 모드
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="text-xs text-[var(--text-muted)]">기일 유형</label>
                  <p className="mt-1 text-sm text-[var(--text-primary)] font-medium">
                    {HEARING_TYPE_LABELS[hearing.hearing_type]}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-[var(--text-muted)]">상태</label>
                  <div className="mt-1">
                    <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-lg border ${getStatusBadgeColor(hearing.status)}`}>
                      {HEARING_STATUS_LABELS[hearing.status]}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs text-[var(--text-muted)]">일시</label>
                <p className="mt-1 text-sm text-[var(--text-primary)]">
                  {formatDateTime(hearing.hearing_date)}
                </p>
              </div>

              {hearing.location && (
                <div>
                  <label className="text-xs text-[var(--text-muted)]">법정</label>
                  <p className="mt-1 text-sm text-[var(--text-primary)]">{hearing.location}</p>
                </div>
              )}

              {hearing.report && (
                <div>
                  <label className="text-xs text-[var(--text-muted)]">재판기일 보고서</label>
                  <div className="mt-1 p-4 bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] rounded-lg">
                    <p className="text-sm text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed">{hearing.report}</p>
                  </div>
                </div>
              )}

              {hearing.result && (
                <div>
                  <label className="text-xs text-[var(--text-muted)]">변론기일 결과</label>
                  <div className="mt-1">
                    <span className={`inline-block px-3 py-1.5 rounded-lg text-xs font-medium ${
                      hearing.result === 'settled' || hearing.result === 'judgment' ? 'bg-purple-100 text-purple-700 border border-purple-200' :
                      hearing.result === 'continued' ? 'bg-[var(--color-info-muted)] text-[var(--color-info)] border border-[var(--color-info)]/20' :
                      hearing.result === 'adjourned' ? 'bg-[var(--color-warning-muted)] text-[var(--color-warning)] border border-[var(--color-warning)]/20' :
                      'bg-[var(--bg-tertiary)] text-[var(--text-muted)] border border-[var(--border-default)]'
                    }`}>
                      {HEARING_RESULT_LABELS[hearing.result as HearingResult]}
                    </span>
                  </div>
                </div>
              )}

              {hearing.notes && (
                <div>
                  <label className="text-xs text-[var(--text-muted)]">메모</label>
                  <p className="mt-1 text-sm text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed">{hearing.notes}</p>
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t border-[var(--border-subtle)]">
                <button
                  onClick={() => setIsEditing(true)}
                  className="btn btn-primary flex-1"
                >
                  수정
                </button>
                <button
                  onClick={handleDelete}
                  disabled={loading}
                  className="btn btn-danger-ghost"
                >
                  삭제
                </button>
              </div>
            </div>
          ) : (
            // 수정 모드
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* 기일 유형 */}
              <div className="form-group">
                <label className="form-label">
                  기일 유형 <span className="text-[var(--color-danger)]">*</span>
                </label>
                <select
                  value={formData.hearing_type}
                  onChange={(e) => setFormData(prev => ({ ...prev, hearing_type: e.target.value as HearingType }))}
                  className={`form-input ${errors.hearing_type ? 'border-[var(--color-danger)] focus:border-[var(--color-danger)] focus:ring-[var(--color-danger)]' : ''}`}
                >
                  <option value="">선택하세요</option>
                  {Object.entries(HEARING_TYPE_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
                {errors.hearing_type && (
                  <p className="mt-1.5 text-xs text-[var(--color-danger)] flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {errors.hearing_type}
                  </p>
                )}
              </div>

              {/* 날짜 + 시간 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="form-label">
                    날짜 <span className="text-[var(--color-danger)]">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.hearing_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, hearing_date: e.target.value }))}
                    className={`form-input ${errors.hearing_date ? 'border-[var(--color-danger)] focus:border-[var(--color-danger)] focus:ring-[var(--color-danger)]' : ''}`}
                    style={{ colorScheme: 'light' }}
                  />
                  {errors.hearing_date && (
                    <p className="mt-1.5 text-xs text-[var(--color-danger)] flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      {errors.hearing_date}
                    </p>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">
                    시간 <span className="text-[var(--color-danger)]">*</span>
                  </label>
                  <select
                    value={formData.hearing_time}
                    onChange={(e) => setFormData(prev => ({ ...prev, hearing_time: e.target.value }))}
                    className={`form-input ${errors.hearing_time ? 'border-[var(--color-danger)] focus:border-[var(--color-danger)] focus:ring-[var(--color-danger)]' : ''}`}
                  >
                    <option value="">시간 선택</option>
                    {TIME_OPTIONS.map(time => (
                      <option key={time} value={time}>{time}</option>
                    ))}
                  </select>
                  {errors.hearing_time && (
                    <p className="mt-1.5 text-xs text-[var(--color-danger)] flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      {errors.hearing_time}
                    </p>
                  )}
                </div>
              </div>

              {/* 법정 */}
              <div className="form-group">
                <label className="form-label">법정</label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                  placeholder="예: 서울가정법원 301호"
                  className="form-input"
                />
              </div>

              {/* 상태 */}
              <div className="form-group">
                <label className="form-label">
                  상태 <span className="text-[var(--color-danger)]">*</span>
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as HearingStatus }))}
                  className={`form-input ${errors.status ? 'border-[var(--color-danger)] focus:border-[var(--color-danger)] focus:ring-[var(--color-danger)]' : ''}`}
                >
                  <option value="">선택하세요</option>
                  {Object.entries(HEARING_STATUS_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
                {errors.status && (
                  <p className="mt-1.5 text-xs text-[var(--color-danger)] flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {errors.status}
                  </p>
                )}
              </div>

              {/* 재판기일 보고서 */}
              <div className="form-group">
                <label className="form-label">재판기일 보고서</label>
                <textarea
                  value={formData.report}
                  onChange={(e) => setFormData(prev => ({ ...prev, report: e.target.value }))}
                  rows={5}
                  placeholder="재판 진행 내용, 결과, 다음 절차 등을 기록하세요"
                  className="form-input resize-none"
                />
              </div>

              {/* 변론기일 결과 */}
              <div className="form-group">
                <label className="form-label">변론기일 결과</label>
                <select
                  value={formData.result}
                  onChange={(e) => setFormData(prev => ({ ...prev, result: e.target.value as HearingResult }))}
                  className="form-input"
                >
                  <option value="">선택 안 함</option>
                  {Object.entries(HEARING_RESULT_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
                <p className="form-hint">
                  속행: 변론이 계속 진행 | 종결: 변론 종결 | 연기: 다음 기일로 연기 | 추정: 사건 추정
                </p>
              </div>

              {/* 메모 */}
              <div className="form-group">
                <label className="form-label">메모</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                  placeholder="추가 메모"
                  className="form-input resize-none"
                />
              </div>

              {/* 버튼 */}
              <div className="flex gap-3 pt-4 border-t border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="btn btn-secondary flex-1"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary flex-1"
                >
                  {loading ? '저장 중...' : '저장'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
