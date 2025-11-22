'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  HEARING_TYPES,
  HEARING_TYPE_LABELS,
  DEADLINE_TYPES,
  DEADLINE_TYPE_LABELS,
  HearingType,
  DeadlineType
} from '@/types/court-hearing'

interface UnifiedScheduleModalProps {
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

type ScheduleCategory = 'court_hearing' | 'deadline' | 'schedule'
type ScheduleSubtype = HearingType | DeadlineType | 'trial' | 'consultation' | 'meeting'

const SCHEDULE_LABELS = {
  trial: '변론',
  consultation: '상담',
  meeting: '회의'
}

export default function UnifiedScheduleModal({
  isOpen,
  onClose,
  onSuccess,
  prefilledCaseNumber
}: UnifiedScheduleModalProps) {
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [caseOptions, setCaseOptions] = useState<CaseOption[]>([])
  const [showDropdown, setShowDropdown] = useState(false)

  const [category, setCategory] = useState<ScheduleCategory>('court_hearing')
  const [formData, setFormData] = useState({
    case_number: '',
    case_name: '',
    subtype: '' as ScheduleSubtype | '',
    date: '',
    time: '',
    location: '',
    judge_name: '',
    notes: '',
    // For deadlines
    trigger_date: ''
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const supabase = createClient()

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      if (prefilledCaseNumber) {
        setFormData(prev => ({
          ...prev,
          case_number: prefilledCaseNumber
        }))
        setSearchTerm(prefilledCaseNumber)
      }
    } else {
      // Reset form when modal closes
      setFormData({
        case_number: '',
        case_name: '',
        subtype: '',
        date: '',
        time: '',
        location: '',
        judge_name: '',
        notes: '',
        trigger_date: ''
      })
      setSearchTerm('')
      setCategory('court_hearing')
      setErrors({})
    }
  }, [isOpen, prefilledCaseNumber])

  // Auto-complete case search
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
  }, [searchTerm])

  const handleSelectCase = (option: CaseOption) => {
    setFormData(prev => ({
      ...prev,
      case_number: option.case_number,
      case_name: option.case_name
    }))
    setSearchTerm(option.case_number)
    setShowDropdown(false)
  }

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.case_number) {
      newErrors.case_number = '사건번호를 입력해주세요'
    }

    if (!formData.subtype) {
      newErrors.subtype = '유형을 선택해주세요'
    }

    if (category === 'deadline') {
      if (!formData.trigger_date) {
        newErrors.trigger_date = '기산일을 입력해주세요'
      }
    } else {
      if (!formData.date) {
        newErrors.date = '날짜를 입력해주세요'
      }
      if (!formData.time) {
        newErrors.time = '시간을 입력해주세요'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validate()) return

    setLoading(true)

    try {
      if (category === 'court_hearing') {
        await handleCourtHearingSubmit()
      } else if (category === 'deadline') {
        await handleDeadlineSubmit()
      } else if (category === 'schedule') {
        await handleScheduleSubmit()
      }

      alert('일정이 추가되었습니다.')
      onSuccess()
    } catch (error: any) {
      console.error('일정 추가 실패:', error)
      alert(`추가 실패: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleCourtHearingSubmit = async () => {
    const datetime = `${formData.date}T${formData.time}:00`

    const { error } = await supabase
      .from('court_hearings')
      .insert({
        case_number: formData.case_number,
        hearing_type: formData.subtype as HearingType,
        hearing_date: datetime,
        location: formData.location || null,
        judge_name: formData.judge_name || null,
        notes: formData.notes || null,
        status: 'SCHEDULED'
      })

    if (error) throw error
  }

  const handleDeadlineSubmit = async () => {
    const { error } = await supabase
      .from('case_deadlines')
      .insert({
        case_number: formData.case_number,
        deadline_type: formData.subtype as DeadlineType,
        trigger_date: formData.trigger_date,
        notes: formData.notes || null,
        status: 'PENDING'
      })

    if (error) throw error
  }

  const handleScheduleSubmit = async () => {
    // First, get the case_id from case_number
    const { data: caseData, error: caseError } = await supabase
      .from('legal_cases')
      .select('id')
      .eq('court_case_number', formData.case_number)
      .single()

    if (caseError) throw caseError
    if (!caseData) throw new Error('사건을 찾을 수 없습니다')

    const title = SCHEDULE_LABELS[formData.subtype as keyof typeof SCHEDULE_LABELS] || formData.subtype

    const { error } = await supabase
      .from('case_schedules')
      .insert({
        title: `${title} - ${formData.case_name || formData.case_number}`,
        scheduled_date: formData.date,
        scheduled_time: formData.time,
        schedule_type: formData.subtype,
        location: formData.location || null,
        case_id: caseData.id,
        description: formData.notes || null,
        status: 'scheduled'
      })

    if (error) throw error
  }

  const getSubtypeOptions = () => {
    if (category === 'court_hearing') {
      return Object.keys(HEARING_TYPES).map(key => ({
        value: key,
        label: HEARING_TYPE_LABELS[key as HearingType]
      }))
    } else if (category === 'deadline') {
      return Object.keys(DEADLINE_TYPES).map(key => ({
        value: key,
        label: DEADLINE_TYPE_LABELS[key as DeadlineType]
      }))
    } else {
      return [
        { value: 'trial', label: '변론' },
        { value: 'consultation', label: '상담' },
        { value: 'meeting', label: '회의' }
      ]
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">일정 추가</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Category Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              일정 종류 <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => {
                  setCategory('court_hearing')
                  setFormData(prev => ({ ...prev, subtype: '' }))
                }}
                className={`px-4 py-3 rounded-lg border-2 transition-all ${
                  category === 'court_hearing'
                    ? 'border-blue-500 bg-blue-50 text-blue-700 font-semibold'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                법원기일
              </button>
              <button
                type="button"
                onClick={() => {
                  setCategory('deadline')
                  setFormData(prev => ({ ...prev, subtype: '' }))
                }}
                className={`px-4 py-3 rounded-lg border-2 transition-all ${
                  category === 'deadline'
                    ? 'border-orange-500 bg-orange-50 text-orange-700 font-semibold'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                데드라인
              </button>
              <button
                type="button"
                onClick={() => {
                  setCategory('schedule')
                  setFormData(prev => ({ ...prev, subtype: '' }))
                }}
                className={`px-4 py-3 rounded-lg border-2 transition-all ${
                  category === 'schedule'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700 font-semibold'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                일반일정
              </button>
            </div>
          </div>

          {/* Case Number Search */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              사건번호 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="사건번호 또는 사건명 검색..."
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.case_number ? 'border-red-300' : 'border-gray-300'
              }`}
            />
            {errors.case_number && (
              <p className="mt-1 text-sm text-red-600">{errors.case_number}</p>
            )}

            {/* Dropdown */}
            {showDropdown && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {caseOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => handleSelectCase(option)}
                    className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                  >
                    <div className="font-semibold text-gray-900">{option.case_number}</div>
                    <div className="text-sm text-gray-600">{option.case_name}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Selected Case Display */}
          {formData.case_number && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm font-medium text-blue-900">선택된 사건</p>
              <p className="text-sm text-blue-700 mt-1">
                {formData.case_number} {formData.case_name && `- ${formData.case_name}`}
              </p>
            </div>
          )}

          {/* Subtype Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {category === 'court_hearing' ? '기일 유형' : category === 'deadline' ? '데드라인 유형' : '일정 유형'}{' '}
              <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.subtype}
              onChange={(e) => setFormData(prev => ({ ...prev, subtype: e.target.value as ScheduleSubtype }))}
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.subtype ? 'border-red-300' : 'border-gray-300'
              }`}
            >
              <option value="">선택하세요</option>
              {getSubtypeOptions().map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {errors.subtype && (
              <p className="mt-1 text-sm text-red-600">{errors.subtype}</p>
            )}
          </div>

          {/* Date/Time or Trigger Date based on category */}
          {category === 'deadline' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                기산일 <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.trigger_date}
                onChange={(e) => setFormData(prev => ({ ...prev, trigger_date: e.target.value }))}
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.trigger_date ? 'border-red-300' : 'border-gray-300'
                }`}
              />
              {errors.trigger_date && (
                <p className="mt-1 text-sm text-red-600">{errors.trigger_date}</p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                만료일은 기산일과 데드라인 유형에 따라 자동으로 계산됩니다.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  날짜 <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.date ? 'border-red-300' : 'border-gray-300'
                  }`}
                />
                {errors.date && (
                  <p className="mt-1 text-sm text-red-600">{errors.date}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  시간 <span className="text-red-500">*</span>
                </label>
                <input
                  type="time"
                  value={formData.time}
                  onChange={(e) => setFormData(prev => ({ ...prev, time: e.target.value }))}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.time ? 'border-red-300' : 'border-gray-300'
                  }`}
                />
                {errors.time && (
                  <p className="mt-1 text-sm text-red-600">{errors.time}</p>
                )}
              </div>
            </div>
          )}

          {/* Location (not for deadlines) */}
          {category !== 'deadline' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {category === 'court_hearing' ? '법정' : '장소'}
              </label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                placeholder={category === 'court_hearing' ? '예: 서울가정법원 301호' : '예: 사무실 회의실'}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {/* Judge Name (only for court hearings) */}
          {category === 'court_hearing' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                담당 판사
              </label>
              <input
                type="text"
                value={formData.judge_name}
                onChange={(e) => setFormData(prev => ({ ...prev, judge_name: e.target.value }))}
                placeholder="예: 홍길동"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              메모
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              rows={3}
              placeholder="추가 메모사항을 입력하세요"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Submit Buttons */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`flex-1 px-4 py-2.5 text-sm font-semibold text-white rounded-lg transition-colors ${
                category === 'court_hearing'
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : category === 'deadline'
                  ? 'bg-orange-600 hover:bg-orange-700'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {loading ? '추가 중...' : '일정 추가'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
