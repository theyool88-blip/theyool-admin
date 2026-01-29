'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  DeadlineType,
  DeadlineTypeMaster,
  PartySide,
  PARTY_SIDE_LABELS
} from '@/types/court-hearing'
import type { PartyType } from '@/types/case-party'

interface PartyOption {
  id: string
  party_name: string
  party_type: PartyType
  party_type_label: string | null
}
import {
  calculateLegalDeadline,
  isNonBusinessDay
} from '@/lib/utils/korean-legal-dates'

interface QuickAddDeadlineModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  prefilledCaseNumber?: string
}

interface CaseOption {
  id: string
  case_number: string
  case_name: string
}

export default function QuickAddDeadlineModal({
  isOpen,
  onClose,
  onSuccess,
  prefilledCaseNumber
}: QuickAddDeadlineModalProps) {
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [caseOptions, setCaseOptions] = useState<CaseOption[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [deadlineTypes, setDeadlineTypes] = useState<DeadlineTypeMaster[]>([])
  const [caseParties, setCaseParties] = useState<PartyOption[]>([])

  const [formData, setFormData] = useState({
    case_id: '', // 사건 ID (필수)
    case_number: '',
    case_name: '',
    deadline_type: '' as DeadlineType | '',
    trigger_date: '',
    notes: '',
    is_electronic_service: false, // 전자송달(0시 의제) 여부
    party_id: '' as string, // 당사자 ID (선택)
    party_side: null as PartySide // 당사자 측 (자동 설정)
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [preview, setPreview] = useState({
    days: 0,
    deadline_date: '',
    deadline_datetime: '',
    wasExtended: false // 민법 제161조로 연장되었는지 여부
  })

  const supabase = createClient()

  // prefilledCaseNumber가 있으면 자동으로 설정
  useEffect(() => {
    if (prefilledCaseNumber && isOpen) {
      setFormData(prev => ({
        ...prev,
        case_number: prefilledCaseNumber
      }))
      setSearchTerm(prefilledCaseNumber)
    }
  }, [prefilledCaseNumber, isOpen])

  // 불변기간 타입 로드
  useEffect(() => {
    const loadDeadlineTypes = async () => {
      try {
        const { data, error } = await supabase
          .from('deadline_types')
          .select('*')
          .order('days', { ascending: false })

        if (error) throw error
        setDeadlineTypes(data || [])
      } catch (error) {
        console.error('불변기간 타입 로드 실패:', error)
      }
    }

    loadDeadlineTypes()
  }, [supabase])

  // 사건번호 자동완성 검색
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
          .select('id, court_case_number, case_name')
          .not('court_case_number', 'is', null)
          .or(`court_case_number.ilike.%${searchTerm}%,case_name.ilike.%${searchTerm}%`)
          .limit(10)

        if (error) throw error

        const options = (data || [])
          .filter(c => c.court_case_number)
          .map(c => ({
            id: c.id,
            case_number: c.court_case_number!,
            case_name: c.case_name
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

  // 미리보기 계산 (민법 제157조, 제161조 적용)
  useEffect(() => {
    if (formData.deadline_type && formData.trigger_date) {
      const selectedType = deadlineTypes.find(t => t.type === formData.deadline_type)
      if (selectedType) {
        const triggerDate = new Date(formData.trigger_date + 'T00:00:00')

        // 민법 제157조, 제161조 적용
        // 전자송달(0시 의제)인 경우 초일산입 적용 (1일 단축)
        const deadlineDate = calculateLegalDeadline(
          triggerDate,
          selectedType.days,
          formData.is_electronic_service // 전자송달 여부 전달
        )

        // 연장 여부 확인: 원래 날짜가 비영업일이었는지 체크
        const effectiveDays = formData.is_electronic_service
          ? selectedType.days - 1
          : selectedType.days
        const originalDeadline = new Date(triggerDate)
        originalDeadline.setDate(originalDeadline.getDate() + effectiveDays)
        const wasExtended = isNonBusinessDay(originalDeadline)

        // 로컬 날짜 형식으로 변환 (타임존 문제 방지)
        const year = deadlineDate.getFullYear()
        const month = String(deadlineDate.getMonth() + 1).padStart(2, '0')
        const day = String(deadlineDate.getDate()).padStart(2, '0')
        const deadlineDateStr = `${year}-${month}-${day}`

        const deadlineDatetime = new Date(deadlineDate)
        deadlineDatetime.setHours(23, 59, 59, 999) // 당일 자정 직전

        setPreview({
          days: selectedType.days,
          deadline_date: deadlineDateStr,
          deadline_datetime: deadlineDatetime.toISOString(),
          wasExtended
        })
      }
    } else {
      setPreview({ days: 0, deadline_date: '', deadline_datetime: '', wasExtended: false })
    }
  }, [formData.deadline_type, formData.trigger_date, formData.is_electronic_service, deadlineTypes])

  const handleSelectCase = async (option: CaseOption) => {
    setFormData(prev => ({
      ...prev,
      case_id: option.id,
      case_number: option.case_number,
      case_name: option.case_name,
      party_id: '',
      party_side: null
    }))
    setSearchTerm(option.case_number)
    setShowDropdown(false)

    // 해당 사건의 당사자 목록 조회
    try {
      const { data: parties, error } = await supabase
        .from('case_parties')
        .select('id, party_name, party_type, party_type_label')
        .eq('case_id', option.id)
        .order('party_order', { ascending: true })

      if (error) throw error
      setCaseParties(parties || [])
    } catch (error) {
      console.error('당사자 조회 실패:', error)
      setCaseParties([])
    }
  }

  // 당사자 선택 시 party_side 자동 설정
  const handleSelectParty = (partyId: string) => {
    const selectedParty = caseParties.find(p => p.id === partyId)
    let partySide: PartySide = null

    if (selectedParty) {
      const plaintiffTypes = ['plaintiff', 'creditor', 'applicant', 'actor', 'investigator', 'accused']
      const defendantTypes = ['defendant', 'debtor', 'respondent', 'third_debtor', 'victim', 'juvenile', 'crime_victim', 'assistant']

      if (plaintiffTypes.includes(selectedParty.party_type)) {
        partySide = 'plaintiff_side'
      } else if (defendantTypes.includes(selectedParty.party_type)) {
        partySide = 'defendant_side'
      }
    }

    setFormData(prev => ({
      ...prev,
      party_id: partyId,
      party_side: partySide
    }))
  }

  const validate = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.case_id) newErrors.case_number = '사건을 목록에서 선택하세요'
    else if (!formData.case_number) newErrors.case_number = '사건번호를 선택하세요'
    if (!formData.deadline_type) newErrors.deadline_type = '데드라인 유형을 선택하세요'
    if (!formData.trigger_date) newErrors.trigger_date = '기산일을 입력하세요'

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validate()) return

    try {
      setLoading(true)

      const { error } = await supabase
        .from('case_deadlines')
        .insert({
          case_id: formData.case_id, // 필수 필드
          case_number: formData.case_number,
          deadline_type: formData.deadline_type,
          trigger_date: formData.trigger_date,
          is_electronic_service: formData.is_electronic_service,
          notes: formData.notes || null,
          status: 'PENDING',
          party_id: formData.party_id || null,
          party_side: formData.party_side
        })

      if (error) throw error

      alert('데드라인이 추가되었습니다.')
      onSuccess()
      handleClose()
    } catch (error) {
      const message = error instanceof Error ? error.message : '데드라인 추가에 실패했습니다.'
      console.error('데드라인 추가 실패:', error)
      alert(`추가 실패: ${message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setFormData({
      case_id: '',
      case_number: '',
      case_name: '',
      deadline_type: '',
      trigger_date: '',
      notes: '',
      is_electronic_service: false,
      party_id: '',
      party_side: null
    })
    setSearchTerm('')
    setErrors({})
    setPreview({ days: 0, deadline_date: '', deadline_datetime: '', wasExtended: false })
    setCaseParties([])
    onClose()
  }

  const formatDateKR = (dateStr: string) => {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    return `${String(d.getFullYear()).slice(2)}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
  }

  const _formatDatetimeKR = (datetimeStr: string) => {
    if (!datetimeStr) return ''
    const d = new Date(datetimeStr)
    return `${String(d.getFullYear()).slice(2)}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--bg-secondary)] rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-[var(--bg-secondary)] border-b border-[var(--border-subtle)] px-6 py-4 flex items-center justify-between rounded-t-xl">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">데드라인 추가</h2>
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
                setFormData(prev => ({ ...prev, case_id: '', case_number: '', case_name: '' }))
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

          {/* 데드라인 유형 */}
          <div className="form-group">
            <label className="form-label">
              데드라인 유형 <span className="text-[var(--color-danger)]">*</span>
            </label>
            <select
              value={formData.deadline_type}
              onChange={(e) => setFormData(prev => ({ ...prev, deadline_type: e.target.value as DeadlineType }))}
              className={`form-input ${errors.deadline_type ? 'border-[var(--color-danger)] focus:border-[var(--color-danger)] focus:ring-[var(--color-danger)]/20' : ''}`}
            >
              <option value="">선택하세요</option>
              {deadlineTypes.map((type) => (
                <option key={type.type} value={type.type}>
                  {type.name} ({type.days}일)
                </option>
              ))}
            </select>
            {errors.deadline_type && (
              <p className="mt-1.5 text-sm text-[var(--color-danger)] flex items-center gap-1">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {errors.deadline_type}
              </p>
            )}
          </div>

          {/* 당사자 선택 (선택 사항) */}
          {caseParties.length > 0 && (
            <div className="form-group">
              <label className="form-label">
                당사자 지정 <span className="text-[var(--text-muted)]">(선택)</span>
              </label>
              <select
                value={formData.party_id}
                onChange={(e) => handleSelectParty(e.target.value)}
                className="form-input"
              >
                <option value="">전체 사건 (당사자 무관)</option>
                {caseParties.map((party) => (
                  <option key={party.id} value={party.id}>
                    {party.party_type_label || party.party_type} - {party.party_name}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-sm text-[var(--text-muted)]">
                특정 당사자의 송달일 기준으로 기한을 관리하려면 선택하세요.
              </p>
              {formData.party_side && (
                <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 bg-[var(--sage-muted)] text-[var(--sage-primary)] text-xs font-medium rounded-full">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                  </svg>
                  {PARTY_SIDE_LABELS[formData.party_side]}
                </div>
              )}
            </div>
          )}

          {/* 기산일 (트리거 날짜) */}
          <div className="form-group">
            <label className="form-label">
              기산일 <span className="text-[var(--color-danger)]">*</span>
            </label>
            <input
              type="date"
              value={formData.trigger_date}
              onChange={(e) => setFormData(prev => ({ ...prev, trigger_date: e.target.value }))}
              className={`form-input ${errors.trigger_date ? 'border-[var(--color-danger)] focus:border-[var(--color-danger)] focus:ring-[var(--color-danger)]/20' : ''}`}
              style={{ colorScheme: 'light' }}
            />
            {errors.trigger_date && (
              <p className="mt-1.5 text-sm text-[var(--color-danger)] flex items-center gap-1">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
                {errors.trigger_date}
              </p>
            )}
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              불변기간 계산의 시작일입니다 (예: 판결선고일, 송달일 등)
            </p>
          </div>

          {/* 전자송달 여부 */}
          <div className="flex items-start gap-3 p-3 bg-[var(--color-warning-muted)] border border-[var(--color-warning)]/20 rounded-lg">
            <input
              type="checkbox"
              id="is_electronic_service"
              checked={formData.is_electronic_service}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                is_electronic_service: e.target.checked
              }))}
              className="mt-0.5 w-4 h-4 text-[var(--color-warning)] border-[var(--color-warning)]/30 rounded focus:ring-[var(--color-warning)]"
            />
            <div>
              <label htmlFor="is_electronic_service" className="text-sm font-medium text-[var(--color-warning)] cursor-pointer">
                전자송달 (0시 의제)
              </label>
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                전자소송에서 미열람 7일 후 자정(0시)에 송달 의제된 경우 체크하세요.
                민법 제157조 단서에 따라 초일산입 적용되어 기한이 1일 단축됩니다.
              </p>
            </div>
          </div>

          {/* 자동 계산 미리보기 */}
          {preview.deadline_date && (
            <div className="p-4 bg-[var(--sage-muted)] border border-[var(--border-subtle)] rounded-lg">
              <h3 className="text-sm font-medium text-[var(--text-primary)] mb-3">자동 계산 결과</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-[var(--text-muted)] font-medium">기간</p>
                  <p className="text-[var(--text-primary)] font-semibold">{preview.days}일</p>
                </div>
                <div>
                  <p className="text-[var(--text-muted)] font-medium">만료일</p>
                  <p className="text-[var(--text-primary)] font-semibold">{formatDateKR(preview.deadline_date)}</p>
                  {preview.wasExtended && (
                    <p className="text-xs text-[var(--color-warning)] mt-0.5">* 토/공휴일로 연장됨</p>
                  )}
                </div>
                <div className="col-span-2">
                  <p className="text-[var(--text-muted)] font-medium">만료 일시</p>
                  <p className="text-[var(--text-primary)] font-semibold">{formatDateKR(preview.deadline_date)} 23:59</p>
                </div>
              </div>
              <div className="mt-3 space-y-1">
                {formData.is_electronic_service && (
                  <p className="text-xs text-[var(--color-warning)] flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    전자송달(0시 의제) 적용: 초일산입으로 1일 단축됨
                  </p>
                )}
                <p className="text-xs text-[var(--text-muted)]">
                  민법 제161조에 따라 말일이 토요일 또는 공휴일이면 익일로 연장됩니다.
                </p>
              </div>
            </div>
          )}

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
              {loading ? '추가 중...' : '데드라인 추가'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
