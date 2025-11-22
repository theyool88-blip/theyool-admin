'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  HEARING_TYPES,
  HEARING_TYPE_LABELS,
  HEARING_DETAIL_OPTIONS,
  HearingType
} from '@/types/court-hearing'

interface QuickAddHearingModalProps {
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

export default function QuickAddHearingModal({
  isOpen,
  onClose,
  onSuccess,
  prefilledCaseNumber
}: QuickAddHearingModalProps) {
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [caseOptions, setCaseOptions] = useState<CaseOption[]>([])
  const [showDropdown, setShowDropdown] = useState(false)

  const [formData, setFormData] = useState({
    case_number: '',
    case_name: '',
    hearing_type: '' as HearingType | '',
    hearing_date: '',
    hearing_time: '',
    location: '',
    judge_name: '',
    notes: ''
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const supabase = createClient()

  // 사건번호 자동완성 검색
  useEffect(() => {
    // prefilledCaseNumber가 있으면 자동으로 설정
    if (prefilledCaseNumber && isOpen) {
      setFormData(prev => ({
        ...prev,
        case_number: prefilledCaseNumber
      }))
      setSearchTerm(prefilledCaseNumber)
    }
  }, [prefilledCaseNumber, isOpen])

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
          judge_name: formData.judge_name || null,
          notes: formData.notes || null,
          status: 'SCHEDULED'
        })

      if (error) throw error

      alert('법원 기일이 추가되었습니다.')
      onSuccess()
      handleClose()
    } catch (error: any) {
      console.error('법원 기일 추가 실패:', error)
      alert(`추가 실패: ${error.message}`)
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
      judge_name: '',
      notes: ''
    })
    setSearchTerm('')
    setErrors({})
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">법원 기일 추가</h2>
          <button
            onClick={handleClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* 사건번호 자동완성 */}
          <div className="relative">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              사건번호 <span className="text-red-500">*</span>
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
              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 ${
                errors.case_number ? 'border-red-300' : 'border-gray-300'
              }`}
            />
            {errors.case_number && (
              <p className="mt-1 text-sm text-red-600">{errors.case_number}</p>
            )}

            {/* 드롭다운 */}
            {showDropdown && caseOptions.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {caseOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => handleSelectCase(option)}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0"
                  >
                    <p className="font-semibold text-gray-900">{option.case_number}</p>
                    <p className="text-sm text-gray-600">{option.case_name}</p>
                  </button>
                ))}
              </div>
            )}

            {formData.case_name && (
              <p className="mt-2 text-sm text-green-600 font-medium">
                선택된 사건: {formData.case_name}
              </p>
            )}
          </div>

          {/* 기일 유형 */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              기일 유형 <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.hearing_type}
              onChange={(e) => setFormData(prev => ({ ...prev, hearing_type: e.target.value as HearingType }))}
              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 ${
                errors.hearing_type ? 'border-red-300' : 'border-gray-300'
              }`}
            >
              <option value="">선택하세요</option>
              {Object.entries(HEARING_TYPE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
            {errors.hearing_type && (
              <p className="mt-1 text-sm text-red-600">{errors.hearing_type}</p>
            )}

            {/* 자동 데드라인 생성 안내 */}
            {(formData.hearing_type === 'HEARING_JUDGMENT' || formData.hearing_type === 'HEARING_MEDIATION') && (
              <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  <span className="font-semibold">💡 자동 생성:</span>{' '}
                  {formData.hearing_type === 'HEARING_JUDGMENT'
                    ? '선고일로부터 상소기간(14일) 데드라인이 자동으로 생성됩니다.'
                    : '조정일로부터 조정·화해 이의기간(14일) 데드라인이 자동으로 생성됩니다.'}
                </p>
              </div>
            )}
          </div>

          {/* 날짜 + 시간 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                날짜 <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.hearing_date}
                onChange={(e) => setFormData(prev => ({ ...prev, hearing_date: e.target.value }))}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 ${
                  errors.hearing_date ? 'border-red-300' : 'border-gray-300'
                }`}
              />
              {errors.hearing_date && (
                <p className="mt-1 text-sm text-red-600">{errors.hearing_date}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                시간 <span className="text-red-500">*</span>
              </label>
              <input
                type="time"
                value={formData.hearing_time}
                onChange={(e) => setFormData(prev => ({ ...prev, hearing_time: e.target.value }))}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 ${
                  errors.hearing_time ? 'border-red-300' : 'border-gray-300'
                }`}
              />
              {errors.hearing_time && (
                <p className="mt-1 text-sm text-red-600">{errors.hearing_time}</p>
              )}
            </div>
          </div>

          {/* 법정 */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              법정 (예: 서울가정법원 301호)
            </label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
              placeholder="법정 위치"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
            />
          </div>

          {/* 담당 판사 */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              담당 판사
            </label>
            <input
              type="text"
              value={formData.judge_name}
              onChange={(e) => setFormData(prev => ({ ...prev, judge_name: e.target.value }))}
              placeholder="판사 이름"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
            />
          </div>

          {/* 메모 */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              메모
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              rows={3}
              placeholder="추가 메모"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
            />
          </div>

          {/* 버튼 */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-3 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-3 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? '추가 중...' : '법원 기일 추가'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
