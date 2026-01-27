'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  HEARING_TYPE_LABELS,
  HearingType
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

interface QuickAddHearingModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  prefilledCaseNumber?: string
  prefilledDate?: string
}

interface CaseOption {
  id: string
  case_number: string
  case_name: string
  court?: string | null
}

export default function QuickAddHearingModal({
  isOpen,
  onClose,
  onSuccess,
  prefilledCaseNumber,
  prefilledDate
}: QuickAddHearingModalProps) {
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [caseOptions, setCaseOptions] = useState<CaseOption[]>([])
  const [showDropdown, setShowDropdown] = useState(false)

  const [formData, setFormData] = useState({
    case_number: '',
    case_name: '',
    hearing_type: '' as HearingType | '',
    hearing_date: prefilledDate || '',
    hearing_time: '',
    location: '',
    notes: ''
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const supabase = createClient()

  // prefilledDate가 변경되면 formData 업데이트
  useEffect(() => {
    if (prefilledDate) {
      setFormData(prev => ({
        ...prev,
        hearing_date: prefilledDate
      }))
    }
  }, [prefilledDate])

  // 사건번호 자동완성 검색
  const fetchCaseInfo = useCallback(async (caseNumber: string) => {
    try {
      const { data } = await supabase
        .from('legal_cases')
        .select('case_name, court_name')
        .eq('court_case_number', caseNumber)
        .single()

      setFormData(prev => ({
        ...prev,
        case_number: caseNumber,
        case_name: data?.case_name || '',
        location: data?.court_name || ''
      }))
      setSearchTerm(caseNumber)
    } catch (error) {
      console.error('사건 정보 조회 실패:', error)
      setFormData(prev => ({
        ...prev,
        case_number: caseNumber
      }))
      setSearchTerm(caseNumber)
    }
  }, [supabase])

  useEffect(() => {
    // prefilledCaseNumber가 있으면 자동으로 설정하고 법원 정보도 가져오기
    if (prefilledCaseNumber && isOpen) {
      fetchCaseInfo(prefilledCaseNumber)
    }
  }, [fetchCaseInfo, isOpen, prefilledCaseNumber])

  useEffect(() => {
    if (searchTerm.length < 2) {
      setCaseOptions([])
      setShowDropdown(false)
      return
    }

    const searchCases = async () => {
      try {
        const { data, error } = await supabase
          .from('legal_cases')
          .select('id, court_case_number, case_name, court_name')
          .not('court_case_number', 'is', null)
          .or(`court_case_number.ilike.%${searchTerm}%,case_name.ilike.%${searchTerm}%`)
          .limit(10)

        if (error) throw error

        const options = (data || [])
          .filter(c => c.court_case_number)
          .map(c => ({
            id: c.id,
            case_number: c.court_case_number!,
            case_name: c.case_name,
            court: c.court_name
          }))

        setCaseOptions(options)
        setShowDropdown(options.length > 0)
      } catch (error) {
        console.error('사건 검색 실패:', error)
      }
    }

    const debounce = setTimeout(searchCases, 300)
    return () => clearTimeout(debounce)
  }, [searchTerm, supabase])

  const handleSelectCase = (option: CaseOption) => {
    setFormData(prev => ({
      ...prev,
      case_number: option.case_number,
      case_name: option.case_name,
      location: option.court || prev.location // 법원 정보를 법정 필드에 자동 입력
    }))
    setSearchTerm(option.case_number)
    setShowDropdown(false)
  }

  const validate = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.case_number) newErrors.case_number = '사건번호를 선택하세요'
    if (!formData.hearing_type) newErrors.hearing_type = '기일 유형을 선택하세요'
    if (!formData.hearing_date) newErrors.hearing_date = '날짜를 입력하세요'
    if (!formData.hearing_time) newErrors.hearing_time = '시간을 입력하세요'

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validate()) return

    try {
      setLoading(true)

      // ISO 8601 datetime 생성
      const hearing_datetime = `${formData.hearing_date}T${formData.hearing_time}:00`

      const { error } = await supabase
        .from('court_hearings')
        .insert({
          case_number: formData.case_number,
          hearing_type: formData.hearing_type,
          hearing_date: hearing_datetime,
          location: formData.location || null,
          notes: formData.notes || null,
          status: 'SCHEDULED'
        })

      if (error) throw error

      alert('법원 기일이 추가되었습니다.')
      onSuccess()
      handleClose()
    } catch (error) {
      const message = error instanceof Error ? error.message : '법원 기일 추가에 실패했습니다.'
      console.error('법원 기일 추가 실패:', error)
      alert(`추가 실패: ${message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setFormData({
      case_number: '',
      case_name: '',
      hearing_type: '',
      hearing_date: '',
      hearing_time: '',
      location: '',
      notes: ''
    })
    setSearchTerm('')
    setErrors({})
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--bg-secondary)] rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-[var(--bg-secondary)] border-b border-[var(--border-subtle)] px-6 py-4 flex items-center justify-between rounded-t-xl">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">법원 기일 추가</h2>
            <p className="text-sm text-[var(--text-muted)] mt-1">사건번호를 검색하여 기일을 추가하세요</p>
          </div>
          <button
            onClick={handleClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
            aria-label="닫기"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* 사건번호 자동완성 */}
          <div className="relative form-group">
            <label className="form-label">
              사건번호 <span className="text-[var(--color-danger)]">*</span>
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                setFormData(prev => ({ ...prev, case_number: '', case_name: '' }))
              }}
              onFocus={() => {
                if (caseOptions.length > 0) setShowDropdown(true)
              }}
              placeholder="사건번호 또는 사건명 검색"
              className={`form-input ${errors.case_number ? 'border-[var(--color-danger)] focus:border-[var(--color-danger)] focus:ring-[var(--color-danger)]/20' : ''}`}
            />
            {errors.case_number && (
              <p className="mt-1.5 text-sm text-[var(--color-danger)] flex items-center gap-1">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {errors.case_number}
              </p>
            )}

            {/* 드롭다운 */}
            {showDropdown && caseOptions.length > 0 && (
              <div className="absolute z-10 w-full mt-1.5 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {caseOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => handleSelectCase(option)}
                    className="w-full text-left px-4 py-3 hover:bg-[var(--bg-hover)] transition-colors border-b border-[var(--border-subtle)] last:border-b-0 first:rounded-t-lg last:rounded-b-lg min-h-[44px]"
                  >
                    <p className="font-medium text-[var(--text-primary)]">{option.case_number}</p>
                    <p className="text-sm text-[var(--text-muted)] mt-0.5">{option.case_name}</p>
                  </button>
                ))}
              </div>
            )}

            {formData.case_name && (
              <div className="mt-2.5 p-3 bg-[var(--sage-muted)] border border-[var(--border-subtle)] rounded-lg">
                <p className="text-sm text-[var(--text-secondary)] font-medium flex items-center gap-2">
                  <svg className="w-4 h-4 text-[var(--sage-primary)]" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  선택된 사건: {formData.case_name}
                </p>
              </div>
            )}
          </div>

          {/* 기일 유형 */}
          <div className="form-group">
            <label className="form-label">
              기일 유형 <span className="text-[var(--color-danger)]">*</span>
            </label>
            <select
              value={formData.hearing_type}
              onChange={(e) => setFormData(prev => ({ ...prev, hearing_type: e.target.value as HearingType }))}
              className={`form-input ${errors.hearing_type ? 'border-[var(--color-danger)] focus:border-[var(--color-danger)] focus:ring-[var(--color-danger)]/20' : ''}`}
            >
              <option value="">선택하세요</option>
              {Object.entries(HEARING_TYPE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
            {errors.hearing_type && (
              <p className="mt-1.5 text-sm text-[var(--color-danger)] flex items-center gap-1">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {errors.hearing_type}
              </p>
            )}

            {/* 자동 데드라인 생성 안내 */}
            {(formData.hearing_type === 'HEARING_JUDGMENT' || formData.hearing_type === 'HEARING_MEDIATION') && (
              <div className="mt-3 p-4 bg-[var(--color-info-muted)] border border-[var(--color-info)]/20 rounded-lg">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-[var(--color-info)]/10 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-[var(--color-info)]" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[var(--color-info)] mb-1">자동 데드라인 생성</p>
                    <p className="text-sm text-[var(--text-secondary)]">
                      {formData.hearing_type === 'HEARING_JUDGMENT'
                        ? '선고일로부터 상소기간(14일) 데드라인이 자동으로 생성됩니다.'
                        : '조정일로부터 조정·화해 이의기간(14일) 데드라인이 자동으로 생성됩니다.'}
                    </p>
                  </div>
                </div>
              </div>
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
                className={`form-input ${errors.hearing_date ? 'border-[var(--color-danger)] focus:border-[var(--color-danger)] focus:ring-[var(--color-danger)]/20' : ''}`}
                style={{ colorScheme: 'light' }}
              />
              {errors.hearing_date && (
                <p className="mt-1.5 text-sm text-[var(--color-danger)] flex items-center gap-1">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
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
                className={`form-input ${errors.hearing_time ? 'border-[var(--color-danger)] focus:border-[var(--color-danger)] focus:ring-[var(--color-danger)]/20' : ''}`}
              >
                <option value="">시간 선택</option>
                {TIME_OPTIONS.map(time => (
                  <option key={time} value={time}>{time}</option>
                ))}
              </select>
              {errors.hearing_time && (
                <p className="mt-1.5 text-sm text-[var(--color-danger)] flex items-center gap-1">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {errors.hearing_time}
                </p>
              )}
            </div>
          </div>

          {/* 법정 */}
          <div className="form-group">
            <label className="form-label">
              법정 (예: 서울가정법원 301호)
            </label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
              placeholder="법정 위치"
              className="form-input"
            />
          </div>

          {/* 메모 */}
          <div className="form-group">
            <label className="form-label">
              메모
            </label>
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
              onClick={handleClose}
              className="btn btn-secondary flex-1"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary flex-1"
            >
              {loading ? '추가 중...' : '법원 기일 추가'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
