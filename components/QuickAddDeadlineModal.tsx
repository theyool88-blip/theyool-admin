'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  DeadlineType,
  DeadlineTypeMaster
} from '@/types/court-hearing'

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

  const [formData, setFormData] = useState({
    case_number: '',
    case_name: '',
    deadline_type: '' as DeadlineType | '',
    trigger_date: '',
    notes: ''
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [preview, setPreview] = useState({
    days: 0,
    deadline_date: '',
    deadline_datetime: ''
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

  // 미리보기 계산
  useEffect(() => {
    if (formData.deadline_type && formData.trigger_date) {
      const selectedType = deadlineTypes.find(t => t.type === formData.deadline_type)
      if (selectedType) {
        const triggerDate = new Date(formData.trigger_date)
        triggerDate.setHours(0, 0, 0, 0)

        const deadlineDate = new Date(triggerDate)
        deadlineDate.setDate(deadlineDate.getDate() + selectedType.days)

        const deadlineDatetime = new Date(deadlineDate)
        deadlineDatetime.setHours(24, 0, 0, 0) // 자정

        setPreview({
          days: selectedType.days,
          deadline_date: deadlineDate.toISOString().split('T')[0],
          deadline_datetime: deadlineDatetime.toISOString()
        })
      }
    } else {
      setPreview({ days: 0, deadline_date: '', deadline_datetime: '' })
    }
  }, [formData.deadline_type, formData.trigger_date, deadlineTypes])

  const handleSelectCase = (option: CaseOption) => {
    setFormData(prev => ({
      ...prev,
      case_number: option.case_number,
      case_name: option.case_name
    }))
    setSearchTerm(option.case_number)
    setShowDropdown(false)
  }

  const validate = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.case_number) newErrors.case_number = '사건번호를 선택하세요'
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
          case_number: formData.case_number,
          deadline_type: formData.deadline_type,
          trigger_date: formData.trigger_date,
          notes: formData.notes || null,
          status: 'PENDING'
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
      case_number: '',
      case_name: '',
      deadline_type: '',
      trigger_date: '',
      notes: ''
    })
    setSearchTerm('')
    setErrors({})
    setPreview({ days: 0, deadline_date: '', deadline_datetime: '' })
    onClose()
  }

  const formatDateKR = (dateStr: string) => {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    return `${String(d.getFullYear()).slice(2)}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
  }

  const formatDatetimeKR = (datetimeStr: string) => {
    if (!datetimeStr) return ''
    const d = new Date(datetimeStr)
    return `${String(d.getFullYear()).slice(2)}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-sage-200 px-6 py-4 flex items-center justify-between rounded-t-xl">
          <h2 className="text-lg font-semibold text-sage-800">데드라인 추가</h2>
          <button
            onClick={handleClose}
            className="p-2 text-sage-400 hover:text-sage-600 hover:bg-sage-50 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="닫기"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* 사건번호 자동완성 */}
          <div className="relative">
            <label className="block text-sm font-medium text-sage-700 mb-2">
              사건번호 <span className="text-coral-600">*</span>
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
              className={`w-full px-3 py-2 text-sm border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-0 ${
                errors.case_number
                  ? 'border-coral-500 focus:border-coral-500 focus:ring-coral-200'
                  : 'border-sage-200 focus:border-sage-500 focus:ring-sage-500'
              }`}
            />
            {errors.case_number && (
              <p className="mt-1.5 text-sm text-coral-600 flex items-center gap-1">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {errors.case_number}
              </p>
            )}

            {/* 드롭다운 */}
            {showDropdown && caseOptions.length > 0 && (
              <div className="absolute z-10 w-full mt-1.5 bg-white border border-sage-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {caseOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => handleSelectCase(option)}
                    className="w-full text-left px-4 py-3 hover:bg-sage-50 transition-colors border-b border-sage-100 last:border-b-0 first:rounded-t-lg last:rounded-b-lg min-h-[44px]"
                  >
                    <p className="font-medium text-sage-800">{option.case_number}</p>
                    <p className="text-sm text-sage-600 mt-0.5">{option.case_name}</p>
                  </button>
                ))}
              </div>
            )}

            {formData.case_name && (
              <div className="mt-2.5 p-3 bg-sage-50 border border-sage-200 rounded-lg">
                <p className="text-sm text-sage-700 font-medium flex items-center gap-2">
                  <svg className="w-4 h-4 text-sage-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  선택된 사건: {formData.case_name}
                </p>
              </div>
            )}
          </div>

          {/* 데드라인 유형 */}
          <div>
            <label className="block text-sm font-medium text-sage-700 mb-2">
              데드라인 유형 <span className="text-coral-600">*</span>
            </label>
            <select
              value={formData.deadline_type}
              onChange={(e) => setFormData(prev => ({ ...prev, deadline_type: e.target.value as DeadlineType }))}
              className={`w-full px-3 py-2 text-sm border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-0 ${
                errors.deadline_type
                  ? 'border-coral-500 focus:border-coral-500 focus:ring-coral-200'
                  : 'border-sage-200 focus:border-sage-500 focus:ring-sage-500'
              }`}
            >
              <option value="">선택하세요</option>
              {deadlineTypes.map((type) => (
                <option key={type.type} value={type.type}>
                  {type.name} ({type.days}일)
                </option>
              ))}
            </select>
            {errors.deadline_type && (
              <p className="mt-1.5 text-sm text-coral-600 flex items-center gap-1">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {errors.deadline_type}
              </p>
            )}
          </div>

          {/* 기산일 (트리거 날짜) */}
          <div>
            <label className="block text-sm font-medium text-sage-700 mb-2">
              기산일 <span className="text-coral-600">*</span>
            </label>
            <input
              type="date"
              value={formData.trigger_date}
              onChange={(e) => setFormData(prev => ({ ...prev, trigger_date: e.target.value }))}
              className={`w-full px-3 py-2 text-sm border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-0 ${
                errors.trigger_date
                  ? 'border-coral-500 focus:border-coral-500 focus:ring-coral-200'
                  : 'border-sage-200 focus:border-sage-500 focus:ring-sage-500'
              }`}
              style={{ colorScheme: 'light' }}
            />
            {errors.trigger_date && (
              <p className="mt-1.5 text-sm text-coral-600 flex items-center gap-1">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
                {errors.trigger_date}
              </p>
            )}
            <p className="mt-2 text-sm text-sage-600">
              불변기간 계산의 시작일입니다 (예: 판결선고일, 송달일 등)
            </p>
          </div>

          {/* 자동 계산 미리보기 */}
          {preview.deadline_date && (
            <div className="p-4 bg-sage-50 border border-sage-200 rounded-lg">
              <h3 className="text-sm font-medium text-sage-800 mb-3">자동 계산 결과</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-sage-600 font-medium">기간</p>
                  <p className="text-sage-800 font-semibold">{preview.days}일</p>
                </div>
                <div>
                  <p className="text-sage-600 font-medium">만료일</p>
                  <p className="text-sage-800 font-semibold">{formatDateKR(preview.deadline_date)}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-sage-600 font-medium">만료 일시 (자정)</p>
                  <p className="text-sage-800 font-semibold">{formatDatetimeKR(preview.deadline_datetime)}</p>
                </div>
              </div>
              <p className="mt-3 text-xs text-sage-500">
                데드라인은 자동으로 계산되어 저장됩니다.
              </p>
            </div>
          )}

          {/* 메모 */}
          <div>
            <label className="block text-sm font-medium text-sage-700 mb-2">
              메모
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              rows={3}
              placeholder="추가 메모"
              className="w-full px-3 py-2 text-sm border border-sage-200 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-0 focus:border-sage-500 focus:ring-sage-500 resize-none"
            />
          </div>

          {/* 버튼 */}
          <div className="flex gap-3 pt-4 border-t border-sage-200">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 min-h-[44px] px-4 text-sm font-medium text-sage-700 bg-white border border-sage-300 rounded-lg hover:bg-sage-50 transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 min-h-[44px] px-4 text-sm font-medium text-white bg-sage-600 rounded-lg hover:bg-sage-700 disabled:bg-sage-300 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? '추가 중...' : '데드라인 추가'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
