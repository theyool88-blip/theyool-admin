'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  HEARING_TYPES,
  HEARING_TYPE_LABELS,
  DEADLINE_TYPES,
  DEADLINE_TYPE_LABELS,
  HearingType,
  DeadlineType
} from '@/types/court-hearing'
import type { ConsultationStatus } from '@/types/consultation'
import { PAYMENT_CATEGORIES } from '@/types/payment'
import type { PaymentCategory } from '@/types/payment'

interface UnifiedScheduleModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  prefilledCaseId?: string
  prefilledCaseNumber?: string
  prefilledDate?: string
  editMode?: boolean
  editData?: EditScheduleData
  initialTab?: UnifiedTab
}

interface CaseOption {
  id: string
  case_number: string
  case_name: string
}

type ScheduleCategory = 'court_hearing' | 'deadline' | 'schedule' | 'consultation'
type ScheduleSubtype = HearingType | DeadlineType | 'trial' | 'consultation' | 'meeting' | 'callback' | 'visit' | 'video' | 'info'
type UnifiedTab = 'schedule' | 'payment' | 'expense'

export interface EditScheduleData {
  id: string
  event_type: string
  event_subtype?: string | null
  reference_id?: string | null
  case_name?: string | null
  case_id?: string | null
  event_date?: string
  event_time?: string | null
  location?: string | null
  description?: string | null
  status?: string | null

  // 법원기일 전용 필드
  report?: string | null
  result?: string | null
  judge_name?: string | null

  // 데드라인 전용 필드
  trigger_date?: string | null

  // 상담 전용 필드
  preferred_date?: string | null
  preferred_time?: string | null
  confirmed_date?: string | null
  confirmed_time?: string | null

  // 입금(Payment) 전용 필드
  payment_date?: string | null
  depositor_name?: string | null
  amount?: number | null
  payment_category?: string | null
  office_location?: string | null
  consultation_id?: string | null
  memo?: string | null
  receipt_type?: string | null

  // 지출(Expense) 전용 필드
  expense_date?: string | null
  expense_category?: string | null
  subcategory?: string | null
  vendor_name?: string | null
  payment_method?: string | null
}

const SCHEDULE_LABELS = {
  trial: '변론',
  consultation: '상담',
  meeting: '회의'
}

const CONSULTATION_TYPE_LABELS = {
  callback: '회신요청',
  visit: '방문상담',
  video: '화상상담',
  info: '정보요청'
}

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

export default function UnifiedScheduleModal({
  isOpen,
  onClose,
  onSuccess,
  prefilledCaseId,
  prefilledCaseNumber,
  prefilledDate,
  editMode = false,
  editData,
  initialTab = 'schedule'
}: UnifiedScheduleModalProps) {
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [caseOptions, setCaseOptions] = useState<CaseOption[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [activeTab, setActiveTab] = useState<UnifiedTab>(initialTab)

  const [category, setCategory] = useState<ScheduleCategory>('court_hearing')
  const [formData, setFormData] = useState({
    case_number: '',
    case_name: '',
    case_id: '',
    subtype: '' as ScheduleSubtype | '',
    date: '',
    time: '',
    location: '',
    judge_name: '',
    notes: '',
    // For deadlines
    trigger_date: '',
    // For consultations
    name: '',
    phone: '',
    office_location: '',
    consultation_status: 'pending' as ConsultationStatus,
    create_case: true,
    case_type: '상담',
    case_office: '평택',
    // For court hearings (법원기일 전용)
    report: '',
    result: '' as 'CONTINUED' | 'CONCLUDED' | 'POSTPONED' | 'DISMISSED' | '',
    hearing_status: 'SCHEDULED' as 'SCHEDULED' | 'COMPLETED' | 'POSTPONED' | 'CANCELLED',
    // For deadlines (데드라인 전용)
    deadline_status: 'PENDING' as 'PENDING' | 'COMPLETED' | 'OVERDUE'
  })
  const [paymentForm, setPaymentForm] = useState({
    payment_date: '',
    depositor_name: '',
    amount: '',
    payment_category: '',
    linkage: 'none' as 'none' | 'case' | 'consultation',
    case_id: '',
    case_name: '',
    consultation_id: '',
    memo: '',
    receipt_type: '',
  })
  const [paymentSearchTerm, setPaymentSearchTerm] = useState('')
  const [paymentSearchLoading, setPaymentSearchLoading] = useState(false)
  const [paymentSearchResults, setPaymentSearchResults] = useState<Array<{
    id: string
    name: string
    office?: string | null
    extra?: string | null
  }>>([])
  const [paymentSelectedLabel, setPaymentSelectedLabel] = useState('')
  const [paymentSelectedId, setPaymentSelectedId] = useState('')
  const [expenseForm, setExpenseForm] = useState({
    expense_date: '',
    amount: '',
    expense_category: '',
    subcategory: '',
    vendor_name: '',
    memo: '',
    payment_method: '카드',
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const supabase = createClient()
  const defaultPaymentForm = (date?: string) => ({
    payment_date: date || '',
    depositor_name: '',
    amount: '',
    payment_category: '',
    linkage: 'none' as 'none' | 'case' | 'consultation',
    case_id: '',
    case_name: '',
    consultation_id: '',
    memo: '',
    receipt_type: '',
  })

  const handlePaymentSearch = async () => {
    if (!paymentSearchTerm.trim()) {
      alert('검색어를 입력하세요.')
      return
    }
    setPaymentSearchLoading(true)
    try {
      const url = paymentForm.linkage === 'case'
        ? `/api/admin/cases/search?q=${encodeURIComponent(paymentSearchTerm.trim())}`
        : `/api/admin/consultations/search?q=${encodeURIComponent(paymentSearchTerm.trim())}`
      const res = await fetch(url)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      interface SearchResultItem {
        id: string;
        case_name?: string;
        name?: string;
        office?: string;
        office_location?: string;
        court_case_number?: string;
        contract_number?: string;
        phone?: string;
      }
      const mapped = (json.data || []).map((item: SearchResultItem) => ({
        id: item.id,
        name: paymentForm.linkage === 'case' ? item.case_name : item.name,
        office: paymentForm.linkage === 'case' ? item.office : item.office_location,
        extra: paymentForm.linkage === 'case'
          ? (item.court_case_number || item.contract_number || '')
          : (item.phone || ''),
      }))
      setPaymentSearchResults(mapped)
    } catch (err) {
      console.error(err)
      alert('검색에 실패했습니다.')
    } finally {
      setPaymentSearchLoading(false)
    }
  }

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab)
      if (editMode && editData) {
        // Load data for editing
        const eventType = editData.event_type

        // Payment 편집 모드
        if (eventType === 'PAYMENT') {
          setPaymentForm({
            payment_date: editData.payment_date || '',
            depositor_name: editData.depositor_name || '',
            amount: editData.amount?.toString() || '',
            payment_category: editData.payment_category || '',
            linkage: editData.case_id ? 'case' : editData.consultation_id ? 'consultation' : 'none',
            case_id: editData.case_id || '',
            case_name: editData.case_name || '',
            consultation_id: editData.consultation_id || '',
            memo: editData.memo || '',
            receipt_type: editData.receipt_type || '',
          })
          if (editData.case_name) {
            setPaymentSelectedLabel(editData.case_name)
            setPaymentSelectedId(editData.case_id || '')
          }
          return
        }

        // Expense 편집 모드
        if (eventType === 'EXPENSE') {
          setExpenseForm({
            expense_date: editData.expense_date || '',
            amount: editData.amount?.toString() || '',
            expense_category: editData.expense_category || '',
            subcategory: editData.subcategory || '',
            vendor_name: editData.vendor_name || '',
            memo: editData.memo || '',
            payment_method: editData.payment_method || '카드',
          })
          return
        }

        // Schedule 편집 모드 (기존 로직)
        let cat: ScheduleCategory = 'court_hearing'

        if (eventType === 'DEADLINE') {
          cat = 'deadline'
        } else if (eventType === 'CONSULTATION') {
          cat = 'consultation'
        } else if (eventType === 'COURT_HEARING') {
          cat = 'court_hearing'
        }

        setCategory(cat)
        setFormData({
          case_number: editData.reference_id || '',
          case_name: editData.case_name || '',
          case_id: editData.case_id || '',
          subtype: (editData.event_subtype as ScheduleSubtype) || '' as ScheduleSubtype | '',
          date: editData.event_date || '',
          time: editData.event_time || '',
          location: editData.location || '',
          judge_name: editData.judge_name || '',
          notes: editData.description || '',
          trigger_date: editData.trigger_date || '',
          name: editData.case_name || '',
          phone: editData.reference_id || '',
          office_location: editData.location || '',
          consultation_status: (editData.status as ConsultationStatus) || 'confirmed',
          create_case: true,
          case_type: '상담',
          case_office: '평택',
          // 법원기일 전용 필드 (court hearing specific fields)
          report: editData.report || '',
          result: (editData.result as 'CONTINUED' | 'CONCLUDED' | 'POSTPONED' | 'DISMISSED' | '') || '',
          hearing_status: (editData.status as 'SCHEDULED' | 'COMPLETED' | 'POSTPONED' | 'CANCELLED') || 'SCHEDULED',
          // 데드라인 전용 필드
          deadline_status: (editData.status as 'PENDING' | 'COMPLETED' | 'OVERDUE') || 'PENDING'
        })
        setSearchTerm(editData.reference_id || '')
      } else {
        // New schedule
        if (prefilledCaseId) {
          // prefilledCaseId가 있으면 사건 정보 조회
          const fetchCaseInfo = async () => {
            try {
              const res = await fetch(`/api/admin/cases/${prefilledCaseId}`)
              if (res.ok) {
                const json = await res.json()
                const caseInfo = json.data
                setFormData(prev => ({
                  ...prev,
                  case_id: prefilledCaseId,
                  case_number: caseInfo.court_case_number || '',
                  case_name: caseInfo.case_name || ''
                }))
                // 사건번호가 있으면 사건번호, 없으면 사건명으로 표시
                setSearchTerm(caseInfo.court_case_number || caseInfo.case_name || '')
              }
            } catch (err) {
              console.error('Failed to fetch case info:', err)
              // 실패 시 기존 값 사용
              setFormData(prev => ({
                ...prev,
                case_id: prefilledCaseId,
                case_number: prefilledCaseNumber || ''
              }))
              setSearchTerm(prefilledCaseNumber || '')
            }
          }
          fetchCaseInfo()
        } else if (prefilledCaseNumber) {
          setFormData(prev => ({
            ...prev,
            case_number: prefilledCaseNumber
          }))
          setSearchTerm(prefilledCaseNumber)
        }
        const today = new Date().toISOString().split('T')[0]
        const dateToUse = prefilledDate || today
        setFormData(prev => ({
          ...prev,
          date: prefilledDate ? prefilledDate : prev.date
        }))
        setPaymentForm(defaultPaymentForm(dateToUse))
        setExpenseForm(prev => ({ ...prev, expense_date: dateToUse }))
      }
    } else {
      // Reset form when modal closes
      setFormData({
        case_number: '',
        case_name: '',
        case_id: '',
        subtype: '' as ScheduleSubtype | '',
        date: '',
        time: '',
        location: '',
        judge_name: '',
        notes: '',
        trigger_date: '',
        name: '',
        phone: '',
        office_location: '',
        consultation_status: 'pending' as ConsultationStatus,
        create_case: true,
        case_type: '상담',
        case_office: '평택',
        // 법원기일 전용 필드
        report: '',
        result: '' as 'CONTINUED' | 'CONCLUDED' | 'POSTPONED' | 'DISMISSED' | '',
        hearing_status: 'SCHEDULED' as 'SCHEDULED' | 'COMPLETED' | 'POSTPONED' | 'CANCELLED',
        // 데드라인 전용 필드
        deadline_status: 'PENDING' as 'PENDING' | 'COMPLETED' | 'OVERDUE'
      })
      setPaymentForm(defaultPaymentForm(''))
      setExpenseForm({
        expense_date: '',
        amount: '',
        expense_category: '',
        subcategory: '',
        vendor_name: '',
        memo: '',
        payment_method: '카드',
      })
      setSearchTerm('')
      setCategory('court_hearing')
      setErrors({})
    }
  }, [isOpen, prefilledCaseId, prefilledCaseNumber, prefilledDate, editMode, editData, initialTab])

  // Auto-complete case search
  useEffect(() => {
    if (searchTerm.length < 2) {
      setCaseOptions([])
      setShowDropdown(false)
      return
    }

    const searchCases = async () => {
      try {
        const res = await fetch(`/api/admin/cases/search?q=${encodeURIComponent(searchTerm.trim())}`)
        const json = await res.json()
        if (json.error) throw new Error(json.error)
        interface CaseSearchResult {
          id: string;
          court_case_number?: string;
          contract_number?: string;
          case_name?: string;
        }
        const options = (json.data || []).map((c: CaseSearchResult) => ({
          id: c.id,
          case_number: c.court_case_number || c.contract_number || '',
          case_name: c.case_name || '',
        })).filter((o: CaseOption) => o.case_number || o.case_name)
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
      case_id: option.id
    }))
    setSearchTerm(option.case_number)
    setShowDropdown(false)
  }

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (category === 'consultation') {
      if (!formData.name) {
        newErrors.name = '이름을 입력해주세요'
      }
      if (!formData.phone) {
        newErrors.phone = '전화번호를 입력해주세요'
      }
      if (!formData.subtype) {
        newErrors.subtype = '상담 유형을 선택해주세요'
      }
    } else {
      // case_id 또는 case_number 중 하나는 필수
      if (!formData.case_id && !formData.case_number) {
        newErrors.case_number = '사건을 선택해주세요'
      }
      if (!formData.subtype) {
        newErrors.subtype = '유형을 선택해주세요'
      }
    }

    if (category === 'deadline') {
      if (!formData.trigger_date) {
        newErrors.trigger_date = '기산일을 입력해주세요'
      }
    } else {
      if (!formData.date) {
        newErrors.date = '날짜를 입력해주세요'
      }
      if (category !== 'consultation' && !formData.time) {
        newErrors.time = '시간을 입력해주세요'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!paymentForm.payment_date || !paymentForm.depositor_name || !paymentForm.amount || !paymentForm.payment_category) {
      setErrors({ payment: '필수 항목을 입력하세요.' })
      return
    }

    // 환불인 경우 음수 허용, 그 외에는 양수만
    const isRefund = paymentForm.payment_category === '환불'
    const amountStr = paymentForm.amount.toString().replace(/[^0-9]/g, '')
    const parsedAmount = parseInt(amountStr, 10)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setErrors({ payment: '유효한 금액을 입력하세요.' })
      return
    }
    const finalAmount = isRefund ? -Math.abs(parsedAmount) : parsedAmount

    setLoading(true)
    setErrors({})
    try {
      const payload = {
        payment_date: paymentForm.payment_date,
        depositor_name: paymentForm.depositor_name,
        amount: finalAmount,
        payment_category: paymentForm.payment_category as PaymentCategory,
        case_id: paymentForm.linkage === 'case' ? paymentForm.case_id || null : null,
        consultation_id: paymentForm.linkage === 'consultation' ? paymentForm.consultation_id || null : null,
        case_name: paymentForm.linkage === 'case' ? (paymentForm.case_name || paymentSelectedLabel || null) : null,
        memo: paymentForm.memo || null,
        receipt_type: paymentForm.receipt_type || null,
        is_confirmed: true,
      }

      // 편집 모드인 경우 PUT 요청
      if (editMode && editData?.id) {
        const res = await fetch(`/api/admin/payments/${editData.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const json = await res.json()
        if (!res.ok) {
          throw new Error(json.error || '입금 수정 실패')
        }
        alert('입금이 수정되었습니다.')
      } else {
        // 생성 모드인 경우 POST 요청
        const res = await fetch('/api/admin/payments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const json = await res.json()
        if (!res.ok) {
          throw new Error(json.error || '입금 추가 실패')
        }
        alert('입금이 추가되었습니다.')
      }
      onSuccess()
      onClose()
    } catch (error) {
      console.error(editMode ? '입금 수정 실패:' : '입금 추가 실패:', error)
      setErrors({ payment: error instanceof Error ? error.message : (editMode ? '입금 수정 실패' : '입금 추가 실패') })
    } finally {
      setLoading(false)
    }
  }

  const handleExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!expenseForm.expense_date || !expenseForm.amount || !expenseForm.expense_category) {
      setErrors({ expense: '필수 항목을 입력하세요.' })
      return
    }
    const parsedAmount = parseInt(expenseForm.amount.toString().replace(/[^0-9]/g, ''), 10)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setErrors({ expense: '유효한 금액을 입력하세요.' })
      return
    }
    setLoading(true)
    setErrors({})
    try {
      const payload = {
        ...expenseForm,
        amount: parsedAmount,
      }

      // 편집 모드인 경우 PUT 요청
      if (editMode && editData?.id) {
        const res = await fetch(`/api/admin/expenses/${editData.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const json = await res.json()
        if (!res.ok) {
          throw new Error(json.error || '지출 수정 실패')
        }
        alert('지출이 수정되었습니다.')
      } else {
        // 생성 모드인 경우 POST 요청
        const res = await fetch('/api/admin/expenses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const json = await res.json()
        if (!res.ok) {
          throw new Error(json.error || '지출 추가 실패')
        }
        alert('지출이 추가되었습니다.')
      }
      onSuccess()
      onClose()
    } catch (error) {
      console.error(editMode ? '지출 수정 실패:' : '지출 추가 실패:', error)
      setErrors({ expense: error instanceof Error ? error.message : (editMode ? '지출 수정 실패' : '지출 추가 실패') })
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!editMode || !editData?.id) {
      alert('삭제할 일정 정보가 없습니다.')
      return
    }

    if (!confirm('이 일정을 삭제하시겠습니까?')) {
      return
    }

    setLoading(true)

    try {
      const supabase = createClient()
      let tableName = ''

      // event_type에 따라 삭제할 테이블 결정
      switch (editData.event_type) {
        case 'COURT_HEARING':
          tableName = 'court_hearings'
          break
        case 'DEADLINE':
          tableName = 'case_deadlines'
          break
        case 'CONSULTATION':
          tableName = 'consultations'
          break
        default:
          tableName = 'general_schedules'
          break
      }

      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', editData.id)

      if (error) throw error

      alert('일정이 삭제되었습니다.')
      onSuccess()
      onClose()
    } catch (error) {
      console.error('일정 삭제 실패:', error)
      const message = error instanceof Error ? error.message : '삭제 중 오류가 발생했습니다.'
      alert(`삭제 실패: ${message}`)
    } finally {
      setLoading(false)
    }
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
      } else if (category === 'consultation') {
        await handleConsultationSubmit()
      }

      alert(editMode ? '일정이 수정되었습니다.' : '일정이 추가되었습니다.')
      onSuccess()
    } catch (error) {
      console.error(editMode ? '일정 수정 실패:' : '일정 추가 실패:', error)
      const message = error instanceof Error
        ? error.message || '요청 처리 중 오류가 발생했습니다.'
        : typeof error === 'string'
          ? error
          : '요청 처리 중 오류가 발생했습니다.'
      alert(`${editMode ? '수정' : '추가'} 실패: ${message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleCourtHearingSubmit = async () => {
    const datetime = `${formData.date}T${formData.time}:00`

    // 편집 모드: UPDATE (상담 패턴과 동일)
    if (editMode && editData?.id) {
      const { error } = await supabase
        .from('court_hearings')
        .update({
          hearing_type: formData.subtype as HearingType,
          hearing_date: datetime,
          location: formData.location || null,
          judge_name: formData.judge_name || null,
          notes: formData.notes || null,
          status: formData.hearing_status,
          report: formData.report || null,
          result: formData.result || null
        })
        .eq('id', editData.id)

      if (error) throw error
      return  // 중요: 여기서 리턴하여 신규 생성 로직 실행 방지
    }

    // 생성 모드 (case_id 기반)
    const { error } = await supabase
      .from('court_hearings')
      .insert({
        case_id: formData.case_id || null,
        case_number: formData.case_number || null,
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
    // 편집 모드: UPDATE (상담 패턴과 동일)
    if (editMode && editData?.id) {
      const { error } = await supabase
        .from('case_deadlines')
        .update({
          deadline_type: formData.subtype as DeadlineType,
          trigger_date: formData.trigger_date,
          notes: formData.notes || null,
          status: formData.deadline_status || 'PENDING'
        })
        .eq('id', editData.id)

      if (error) throw error
      return  // 중요: 여기서 리턴하여 신규 생성 로직 실행 방지
    }

    // 생성 모드 (case_id 기반)
    const { error } = await supabase
      .from('case_deadlines')
      .insert({
        case_id: formData.case_id || null,
        case_number: formData.case_number || null,
        deadline_type: formData.subtype as DeadlineType,
        trigger_date: formData.trigger_date,
        notes: formData.notes || null,
        status: 'PENDING'
      })

    if (error) throw error
  }

  const handleScheduleSubmit = async () => {
    const caseNumber = formData.case_number?.trim()
    let caseId = formData.case_id
    if (!caseId) {
      if (!caseNumber) {
        throw new Error('사건번호를 입력하세요.')
      }
      const res = await fetch(`/api/admin/cases/search?q=${encodeURIComponent(caseNumber)}`)
      const json = await res.json()
      const first = json.data?.[0]
      if (!first?.id) throw new Error('사건을 찾을 수 없습니다')
      caseId = first.id
    }

    const title = SCHEDULE_LABELS[formData.subtype as keyof typeof SCHEDULE_LABELS] || formData.subtype

    const { error } = await supabase
      .from('case_schedules')
      .insert({
        title: `${title} - ${formData.case_name || formData.case_number}`,
        scheduled_date: formData.date,
        scheduled_time: formData.time,
        schedule_type: formData.subtype,
        location: formData.location || null,
        case_id: caseId,
        description: formData.notes || null,
        status: 'scheduled'
      })

    if (error) throw error
  }

  const handleConsultationSubmit = async () => {
    let adminNotes = ''
    if (editMode && editData?.description) {
      adminNotes = editData.description
    }

    // 완료 시 사건 생성 옵션 처리 (수임 전환)
    let linkedCaseId: string | null = editData?.case_id || null
    if (formData.consultation_status === 'completed' && formData.create_case) {
      const response = await fetch('/api/admin/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          case_name: formData.case_name || `${formData.name} 상담`,
          case_type: formData.case_type || '상담',
          status: '진행중',
          new_client: {
            name: formData.name,
            phone: formData.phone,
            email: null
          },
          notes: `상담에서 수임 (상담명: ${formData.name})`,
        })
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || '사건 생성에 실패했습니다.')
      }

      linkedCaseId = data.data?.id || null
      adminNotes = `${adminNotes ? `${adminNotes}\n` : ''}Linked case (new): ${linkedCaseId || ''}`
    }

    if (editMode && editData?.id) {
      const updates: Record<string, string | null> = {
        name: formData.name,
        phone: formData.phone,
        request_type: formData.subtype || null,
        preferred_date: formData.date || null,
        preferred_time: formData.time || null,
        office_location: formData.office_location || null,
        message: formData.notes || null,
        status: formData.consultation_status,
        admin_notes: adminNotes || null
      }

      // 확정 상태면 확정 일정도 설정
      if (formData.consultation_status === 'confirmed') {
        updates.confirmed_date = formData.date || null
        updates.confirmed_time = formData.time || null
      } else {
        updates.confirmed_date = null
        updates.confirmed_time = null
      }

      if (formData.consultation_status === 'cancelled') {
        updates.cancelled_at = new Date().toISOString()
      }

      const { error } = await supabase
        .from('consultations')
        .update(updates)
        .eq('id', editData.id)

      if (error) throw error
      return
    }

    const { error } = await supabase
      .from('consultations')
      .insert({
        name: formData.name,
        phone: formData.phone,
        request_type: formData.subtype,
        preferred_date: formData.date || null,
        preferred_time: formData.time || null,
        office_location: formData.office_location || null,
        message: formData.notes || null,
        status: formData.consultation_status,
        admin_notes: adminNotes || null,
      })

    if (error) throw new Error(error.message || '상담 추가 실패')
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
    } else if (category === 'consultation') {
      return Object.keys(CONSULTATION_TYPE_LABELS).map(key => ({
        value: key,
        label: CONSULTATION_TYPE_LABELS[key as keyof typeof CONSULTATION_TYPE_LABELS]
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
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-sage-200 px-6 py-4 flex items-center justify-between rounded-t-xl">
          <h2 className="text-lg font-semibold text-sage-800">{editMode ? '일정 수정' : '통합 추가'}</h2>
          <button
            onClick={onClose}
            className="text-sage-400 hover:text-sage-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 pt-4">
          <div className="grid grid-cols-3 gap-2">
            {[
              { key: 'schedule', label: '일정 추가' },
              { key: 'payment', label: '입금 추가' },
              { key: 'expense', label: '지출 추가' },
            ].map(tab => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key as UnifiedTab)}
                className={`min-h-[44px] rounded-lg border text-sm font-medium transition-colors ${
                  activeTab === tab.key
                    ? 'bg-sage-600 text-white border-sage-600'
                    : 'bg-white text-sage-700 border-sage-300 hover:border-sage-400 hover:bg-sage-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Schedule Tab */}
        {activeTab === 'schedule' && (
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Category Selection */}
          <div>
            <label className="block text-sm font-medium text-sage-700 mb-2">
              일정 종류 <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => {
                  setCategory('court_hearing')
                  setFormData(prev => ({ ...prev, subtype: '' }))
                }}
                className={`min-h-[44px] px-3 rounded-lg border text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                  category === 'court_hearing'
                    ? 'border-sage-600 bg-sage-50 text-sage-800'
                    : 'border-sage-200 text-sage-700 hover:border-sage-300 hover:bg-sage-50'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                </svg>
                법원기일
              </button>
              <button
                type="button"
                onClick={() => {
                  setCategory('deadline')
                  setFormData(prev => ({ ...prev, subtype: '' }))
                }}
                className={`min-h-[44px] px-3 rounded-lg border text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                  category === 'deadline'
                    ? 'border-sage-600 bg-sage-50 text-sage-800'
                    : 'border-sage-200 text-sage-700 hover:border-sage-300 hover:bg-sage-50'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                데드라인
              </button>
              <button
                type="button"
                onClick={() => {
                  setCategory('consultation')
                  setFormData(prev => ({ ...prev, subtype: '' }))
                }}
                className={`min-h-[44px] px-3 rounded-lg border text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                  category === 'consultation'
                    ? 'border-sage-600 bg-sage-50 text-sage-800'
                    : 'border-sage-200 text-sage-700 hover:border-sage-300 hover:bg-sage-50'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                상담
              </button>
              <button
                type="button"
                onClick={() => {
                  setCategory('schedule')
                  setFormData(prev => ({ ...prev, subtype: '' }))
                }}
                className={`min-h-[44px] px-3 rounded-lg border text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                  category === 'schedule'
                    ? 'border-sage-600 bg-sage-50 text-sage-800'
                    : 'border-sage-200 text-sage-700 hover:border-sage-300 hover:bg-sage-50'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                일반일정
              </button>
            </div>
          </div>

          {/* Case Number Search or Consultation Name */}
          {category === 'consultation' ? (
            <div>
              <label className="block text-sm font-medium text-sage-700 mb-2">
                이름 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="상담 신청자 이름"
                className={`w-full px-4 py-2 border rounded-lg text-sm focus:outline-none transition-colors ${
                  errors.name
                    ? 'border-red-300 focus:border-red-500 focus:ring-1 focus:ring-red-500'
                    : 'border-sage-200 focus:border-sage-500 focus:ring-1 focus:ring-sage-500'
                }`}
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-600">{errors.name}</p>
              )}
            </div>
          ) : (
            <div className="relative">
              <label className="block text-sm font-medium text-sage-700 mb-2">
                사건번호 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="사건번호 또는 사건명 검색..."
                className={`w-full px-4 py-2 border rounded-lg text-sm focus:outline-none transition-colors ${
                  errors.case_number
                    ? 'border-red-300 focus:border-red-500 focus:ring-1 focus:ring-red-500'
                    : 'border-sage-200 focus:border-sage-500 focus:ring-1 focus:ring-sage-500'
                }`}
              />
              {errors.case_number && (
                <p className="mt-1 text-sm text-red-600">{errors.case_number}</p>
              )}

              {/* Link to case detail page in edit mode */}
              {editMode && formData.case_id && (
                <div className="mt-2">
                  <Link
                    href={`/cases/${formData.case_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm font-medium text-sage-600 hover:text-sage-800 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    사건 상세보기
                  </Link>
                </div>
              )}

              {/* Dropdown */}
              {showDropdown && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-sage-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {caseOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => handleSelectCase(option)}
                      className="w-full px-4 py-3 text-left hover:bg-sage-50 border-b border-sage-100 last:border-b-0 transition-colors"
                    >
                      <div className="font-medium text-sage-800">{option.case_number}</div>
                      <div className="text-sm text-sage-600">{option.case_name}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Phone Number for Consultations */}
          {category === 'consultation' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-sage-700 mb-2">
                  전화번호 <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="010-1234-5678"
                  className={`w-full px-4 py-2 border rounded-lg text-sm focus:outline-none transition-colors ${
                    errors.phone
                      ? 'border-red-300 focus:border-red-500 focus:ring-1 focus:ring-red-500'
                      : 'border-sage-200 focus:border-sage-500 focus:ring-1 focus:ring-sage-500'
                  }`}
                />
                {errors.phone && (
                  <p className="mt-1 text-sm text-red-600">{errors.phone}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-sage-700 mb-2">
                  상담 상태
                </label>
                <select
                  value={formData.consultation_status}
                  onChange={(e) => setFormData(prev => ({ ...prev, consultation_status: e.target.value as ConsultationStatus }))}
                  className="w-full px-4 py-2 border border-sage-200 rounded-lg text-sm focus:border-sage-500 focus:ring-1 focus:ring-sage-500 focus:outline-none transition-colors"
                >
                  <option value="pending">대기</option>
                  <option value="confirmed">확정</option>
                  <option value="completed">완료</option>
                  <option value="cancelled">취소</option>
                </select>
              </div>
            </div>
          )}

          {/* Selected Case Display */}
          {category !== 'consultation' && formData.case_number && (
            <div className="bg-sage-50 border border-sage-200 rounded-lg p-4">
              <p className="text-sm font-medium text-sage-800">선택된 사건</p>
              <p className="text-sm text-sage-600 mt-1">
                {formData.case_number} {formData.case_name && `- ${formData.case_name}`}
              </p>
            </div>
          )}

          {category === 'consultation' && formData.consultation_status === 'completed' && (
            <div className="border border-sage-200 rounded-lg p-4 bg-sage-50 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-sage-800">수임 처리 시 사건 생성</p>
                  <p className="text-xs text-sage-600">신규 사건을 자동 생성하고 상담 메모에 링크를 남깁니다.</p>
                </div>
                <label className="flex items-center gap-2 text-sm font-medium text-sage-700">
                  <input
                    type="checkbox"
                    checked={formData.create_case}
                    onChange={(e) => setFormData(prev => ({ ...prev, create_case: e.target.checked }))}
                    className="rounded border-sage-300 text-sage-600 focus:ring-sage-500"
                  />
                  사건 생성
                </label>
              </div>

              {formData.create_case && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-sage-700 mb-1">사건명</label>
                    <input
                      type="text"
                      value={formData.case_name}
                      onChange={(e) => setFormData(prev => ({ ...prev, case_name: e.target.value }))}
                      className="w-full px-4 py-2 border border-sage-200 rounded-lg text-sm focus:border-sage-500 focus:ring-1 focus:ring-sage-500 focus:outline-none transition-colors"
                      placeholder="예: 김OO 상담 사건"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-sage-700 mb-1">사건유형</label>
                    <input
                      type="text"
                      value={formData.case_type}
                      onChange={(e) => setFormData(prev => ({ ...prev, case_type: e.target.value }))}
                      className="w-full px-4 py-2 border border-sage-200 rounded-lg text-sm focus:border-sage-500 focus:ring-1 focus:ring-sage-500 focus:outline-none transition-colors"
                      placeholder="상담"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Subtype Selection */}
          <div>
            <label className="block text-sm font-medium text-sage-700 mb-2">
              {category === 'court_hearing' ? '기일 유형' : category === 'deadline' ? '데드라인 유형' : category === 'consultation' ? '상담 유형' : '일정 유형'}{' '}
              <span className="text-red-500">*</span>
            </label>
            {category === 'schedule' ? (
              // 일반일정: 자유입력 가능 (input + datalist)
              <>
                <input
                  type="text"
                  list="schedule-type-options"
                  value={formData.subtype}
                  onChange={(e) => setFormData(prev => ({ ...prev, subtype: e.target.value as ScheduleSubtype }))}
                  placeholder="일정 유형 (선택 또는 직접 입력)"
                  className={`w-full px-4 py-2 border rounded-lg text-sm focus:outline-none transition-colors ${
                    errors.subtype
                      ? 'border-red-300 focus:border-red-500 focus:ring-1 focus:ring-red-500'
                      : 'border-sage-200 focus:border-sage-500 focus:ring-1 focus:ring-sage-500'
                  }`}
                />
                <datalist id="schedule-type-options">
                  <option value="변론" />
                  <option value="상담" />
                  <option value="회의" />
                  <option value="출장" />
                  <option value="미팅" />
                  <option value="접견" />
                  <option value="기타" />
                </datalist>
              </>
            ) : (
              // 법원기일, 데드라인, 상담: 기존 select
              <select
                value={formData.subtype}
                onChange={(e) => setFormData(prev => ({ ...prev, subtype: e.target.value as ScheduleSubtype }))}
                className={`w-full px-4 py-2 border rounded-lg text-sm focus:outline-none transition-colors ${
                  errors.subtype
                    ? 'border-red-300 focus:border-red-500 focus:ring-1 focus:ring-red-500'
                    : 'border-sage-200 focus:border-sage-500 focus:ring-1 focus:ring-sage-500'
                }`}
              >
                <option value="">선택하세요</option>
                {getSubtypeOptions().map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            )}
            {errors.subtype && (
              <p className="mt-1 text-sm text-red-600">{errors.subtype}</p>
            )}
          </div>

          {/* Date/Time or Trigger Date based on category */}
          {category === 'deadline' ? (
            <div>
              <label className="block text-sm font-medium text-sage-700 mb-2">
                기산일 <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.trigger_date}
                onChange={(e) => setFormData(prev => ({ ...prev, trigger_date: e.target.value }))}
                className={`w-full px-4 py-2 border rounded-lg text-sm focus:outline-none transition-colors ${
                  errors.trigger_date
                    ? 'border-red-300 focus:border-red-500 focus:ring-1 focus:ring-red-500'
                    : 'border-sage-200 focus:border-sage-500 focus:ring-1 focus:ring-sage-500'
                }`}
              />
              {errors.trigger_date && (
                <p className="mt-1 text-sm text-red-600">{errors.trigger_date}</p>
              )}
              <p className="mt-1 text-xs text-sage-500">
                만료일은 기산일과 데드라인 유형에 따라 자동으로 계산됩니다.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-sage-700 mb-2">
                  날짜 <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                  className={`w-full px-4 py-2 border rounded-lg text-sm focus:outline-none transition-colors ${
                    errors.date
                      ? 'border-red-300 focus:border-red-500 focus:ring-1 focus:ring-red-500'
                      : 'border-sage-200 focus:border-sage-500 focus:ring-1 focus:ring-sage-500'
                  }`}
                />
                {errors.date && (
                  <p className="mt-1 text-sm text-red-600">{errors.date}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-sage-700 mb-2">
                  시간 <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.time}
                  onChange={(e) => setFormData(prev => ({ ...prev, time: e.target.value }))}
                  className={`w-full px-4 py-2 border rounded-lg text-sm focus:outline-none transition-colors ${
                    errors.time
                      ? 'border-red-300 focus:border-red-500 focus:ring-1 focus:ring-red-500'
                      : 'border-sage-200 focus:border-sage-500 focus:ring-1 focus:ring-sage-500'
                  }`}
                >
                  <option value="">시간 선택</option>
                  {TIME_OPTIONS.map(time => (
                    <option key={time} value={time}>{time}</option>
                  ))}
                </select>
                {errors.time && (
                  <p className="mt-1 text-sm text-red-600">{errors.time}</p>
                )}
              </div>
            </div>
          )}

          {/* Location (not for deadlines) */}
          {category !== 'deadline' && (
            <div>
              <label className="block text-sm font-medium text-sage-700 mb-2">
                {category === 'court_hearing' ? '법정' : category === 'consultation' ? '상담 장소' : '장소'}
              </label>
              <input
                type="text"
                value={category === 'consultation' ? formData.office_location : formData.location}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  [category === 'consultation' ? 'office_location' : 'location']: e.target.value
                }))}
                placeholder={
                  category === 'court_hearing' ? '예: 서울가정법원 301호' :
                  category === 'consultation' ? '예: 본 사무소' : '예: 사무실 회의실'
                }
                className="w-full px-4 py-2 border border-sage-200 rounded-lg text-sm focus:border-sage-500 focus:ring-1 focus:ring-sage-500 focus:outline-none transition-colors"
              />
            </div>
          )}

          {/* Judge Name (only for court hearings) */}
          {category === 'court_hearing' && (
            <div>
              <label className="block text-sm font-medium text-sage-700 mb-2">
                담당 판사
              </label>
              <input
                type="text"
                value={formData.judge_name}
                onChange={(e) => setFormData(prev => ({ ...prev, judge_name: e.target.value }))}
                placeholder="예: 홍길동"
                className="w-full px-4 py-2 border border-sage-200 rounded-lg text-sm focus:border-sage-500 focus:ring-1 focus:ring-sage-500 focus:outline-none transition-colors"
              />
            </div>
          )}

          {/* Court Hearing Report (edit mode only) */}
          {editMode && category === 'court_hearing' && (
            <div>
              <label className="block text-sm font-medium text-sage-700 mb-2">
                재판기일 보고서
              </label>
              <textarea
                value={formData.report}
                onChange={(e) => setFormData(prev => ({ ...prev, report: e.target.value }))}
                rows={6}
                placeholder="재판 진행 내용, 결과, 다음 절차 등을 기록하세요"
                className="w-full px-4 py-2 border border-sage-200 rounded-lg text-sm focus:border-sage-500 focus:ring-1 focus:ring-sage-500 focus:outline-none transition-colors resize-none"
              />
            </div>
          )}

          {/* Hearing Result (edit mode only) */}
          {editMode && category === 'court_hearing' && (
            <div>
              <label className="block text-sm font-medium text-sage-700 mb-2">
                변론기일 결과
              </label>
              <select
                value={formData.result}
                onChange={(e) => setFormData(prev => ({ ...prev, result: e.target.value as 'CONTINUED' | 'CONCLUDED' | 'POSTPONED' | 'DISMISSED' | '' }))}
                className="w-full px-4 py-2 border border-sage-200 rounded-lg text-sm focus:border-sage-500 focus:ring-1 focus:ring-sage-500 focus:outline-none transition-colors"
              >
                <option value="">선택 안 함</option>
                <option value="CONTINUED">속행 (변론이 계속 진행)</option>
                <option value="CONCLUDED">종결 (변론 종결)</option>
                <option value="POSTPONED">연기 (다음 기일로 연기)</option>
                <option value="DISMISSED">취하 (사건 취하)</option>
              </select>
            </div>
          )}

          {/* Hearing Status (edit mode only) */}
          {editMode && category === 'court_hearing' && (
            <div>
              <label className="block text-sm font-medium text-sage-700 mb-2">
                기일 상태
              </label>
              <select
                value={formData.hearing_status}
                onChange={(e) => setFormData(prev => ({ ...prev, hearing_status: e.target.value as 'SCHEDULED' | 'COMPLETED' | 'POSTPONED' | 'CANCELLED' }))}
                className="w-full px-4 py-2 border border-sage-200 rounded-lg text-sm focus:border-sage-500 focus:ring-1 focus:ring-sage-500 focus:outline-none transition-colors"
              >
                <option value="SCHEDULED">예정</option>
                <option value="COMPLETED">완료</option>
                <option value="POSTPONED">연기</option>
                <option value="CANCELLED">취소</option>
              </select>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-sage-700 mb-2">
              메모
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              rows={3}
              placeholder="추가 메모사항을 입력하세요"
              className="w-full px-4 py-2 border border-sage-200 rounded-lg text-sm focus:border-sage-500 focus:ring-1 focus:ring-sage-500 focus:outline-none transition-colors resize-none"
            />
          </div>

          {/* Submit Buttons */}
          <div className="flex gap-3 pt-4 border-t border-sage-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 min-h-[44px] px-4 py-2 text-sage-700 bg-white border border-sage-300 rounded-lg hover:bg-sage-50 transition-colors font-medium text-sm"
            >
              취소
            </button>
            {editMode && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={loading}
                className="flex-1 min-h-[44px] px-4 py-2 text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? '삭제 중...' : '일정 삭제'}
              </button>
            )}
            <button
              type="submit"
              disabled={loading}
              className="flex-1 min-h-[44px] px-4 py-2 text-white bg-sage-600 hover:bg-sage-700 rounded-lg transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (editMode ? '수정 중...' : '추가 중...') : (editMode ? '일정 수정' : '일정 추가')}
            </button>
          </div>
        </form>
        )}

        {/* Payment Tab */}
        {activeTab === 'payment' && (
          <form onSubmit={handlePaymentSubmit} className="p-6 space-y-5">
            <h3 className="text-lg font-semibold text-sage-800">{editMode ? '입금 수정' : '입금 추가'}</h3>
            {errors.payment && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {errors.payment}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-sage-700 mb-1">입금일</label>
                <input
                  type="date"
                  value={paymentForm.payment_date}
                  onChange={(e) => setPaymentForm(prev => ({ ...prev, payment_date: e.target.value }))}
                  className="w-full px-4 py-2 border border-sage-200 rounded-lg text-sm focus:border-sage-500 focus:ring-1 focus:ring-sage-500 focus:outline-none transition-colors"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-sage-700 mb-1">입금인</label>
                <input
                  type="text"
                  value={paymentForm.depositor_name}
                  onChange={(e) => setPaymentForm(prev => ({ ...prev, depositor_name: e.target.value }))}
                  className="w-full px-4 py-2 border border-sage-200 rounded-lg text-sm focus:border-sage-500 focus:ring-1 focus:ring-sage-500 focus:outline-none transition-colors"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-sage-700 mb-1">금액</label>
                <input
                  type="text"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm(prev => ({ ...prev, amount: e.target.value }))}
                  className="w-full px-4 py-2 border border-sage-200 rounded-lg text-sm focus:border-sage-500 focus:ring-1 focus:ring-sage-500 focus:outline-none transition-colors"
                  placeholder="1,000,000"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-sage-700 mb-1">명목</label>
                <select
                  value={paymentForm.payment_category}
                  onChange={(e) => setPaymentForm(prev => ({ ...prev, payment_category: e.target.value }))}
                  className="w-full px-4 py-2 border border-sage-200 rounded-lg text-sm focus:border-sage-500 focus:ring-1 focus:ring-sage-500 focus:outline-none transition-colors"
                  required
                >
                  <option value="">선택</option>
                  {Object.values(PAYMENT_CATEGORIES).map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-sage-700 mb-1">결제/영수증</label>
                <select
                  value={paymentForm.receipt_type}
                  onChange={(e) => setPaymentForm(prev => ({ ...prev, receipt_type: e.target.value }))}
                  className="w-full px-4 py-2 border border-sage-200 rounded-lg text-sm focus:border-sage-500 focus:ring-1 focus:ring-sage-500 focus:outline-none transition-colors"
                >
                  <option value="">선택 안 함</option>
                  <option value="카드결제">카드결제</option>
                  <option value="현금">현금</option>
                  <option value="현금영수증">현금영수증</option>
                  <option value="세금계산서">세금계산서</option>
                  <option value="네이버페이">네이버페이</option>
                  <option value="자진발급">자진발급</option>
                </select>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium text-sage-700">연결 유형</p>
              <div className="flex gap-2">
                {[
                  { value: 'none', label: '미연결' },
                  { value: 'case', label: '사건' },
                  { value: 'consultation', label: '상담' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      setPaymentForm(prev => ({
                        ...prev,
                        linkage: opt.value as 'none' | 'case' | 'consultation',
                        case_id: opt.value === 'case' ? prev.case_id : '',
                        consultation_id: opt.value === 'consultation' ? prev.consultation_id : '',
                      }))
                      setPaymentSelectedLabel('')
                      setPaymentSearchResults([])
                      setPaymentSearchTerm('')
                    }}
                    className={`min-h-[44px] px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      paymentForm.linkage === opt.value
                        ? 'bg-sage-600 text-white border-sage-600'
                        : 'border-sage-300 text-sage-700 hover:bg-sage-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {paymentForm.linkage !== 'none' && (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-sage-700">
                  {paymentForm.linkage === 'case' ? '사건 검색 (사건명/번호/계약번호)' : '상담 검색 (이름/전화/요청유형)'}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={paymentSearchTerm}
                    onChange={(e) => setPaymentSearchTerm(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handlePaymentSearch()
                      }
                    }}
                    className="flex-1 px-4 py-2 border border-sage-200 rounded-lg text-sm focus:border-sage-500 focus:ring-1 focus:ring-sage-500 focus:outline-none transition-colors"
                    placeholder={paymentForm.linkage === 'case' ? '사건명 / 사건번호 / 계약번호' : '이름 / 전화번호 / 요청유형'}
                  />
                  <button
                    type="button"
                    onClick={handlePaymentSearch}
                    className="min-h-[44px] px-4 py-2 bg-sage-600 text-white rounded-lg hover:bg-sage-700 transition-colors text-sm font-medium"
                  >
                    {paymentSearchLoading ? '검색중...' : '검색'}
                  </button>
                </div>
                {paymentSelectedLabel && (
                  <p className="text-xs text-sage-600">선택됨: {paymentSelectedLabel}</p>
                )}
                <div className="max-h-48 overflow-y-auto border border-sage-200 rounded-lg">
                {paymentSearchResults.length === 0 ? (
                  <p className="text-xs text-sage-500 p-3">검색 결과가 없습니다.</p>
                ) : (
                  <ul className="divide-y divide-sage-100">
                    {paymentSearchResults.map(item => (
                      <li
                        key={item.id}
                        className={`p-3 flex items-center justify-between ${paymentSelectedId === item.id ? 'bg-sage-50' : ''}`}
                      >
                        <div className="text-sm">
                          <p className="font-medium text-sage-800">{item.name}</p>
                          <p className="text-xs text-sage-600">
                            {item.extra || '-'}{item.office ? ` / ${item.office}` : ''}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setPaymentForm(prev => ({
                              ...prev,
                              case_id: paymentForm.linkage === 'case' ? item.id : '',
                              case_name: paymentForm.linkage === 'case' ? item.name : prev.case_name,
                              consultation_id: paymentForm.linkage === 'consultation' ? item.id : '',
                            }))
                            setPaymentSelectedLabel(item.extra ? `${item.name} (${item.extra})` : item.name)
                            setPaymentSelectedId(item.id)
                          }}
                          className="text-xs px-3 py-1 bg-sage-600 text-white rounded-lg hover:bg-sage-700 transition-colors"
                        >
                          선택
                        </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-sage-700 mb-1">메모</label>
              <textarea
                value={paymentForm.memo}
                onChange={(e) => setPaymentForm(prev => ({ ...prev, memo: e.target.value }))}
                className="w-full px-4 py-2 border border-sage-200 rounded-lg text-sm focus:border-sage-500 focus:ring-1 focus:ring-sage-500 focus:outline-none transition-colors resize-none"
                rows={2}
              />
            </div>

            <div className="flex gap-3 pt-4 border-t border-sage-200">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 min-h-[44px] px-4 py-2 text-sage-700 bg-white border border-sage-300 rounded-lg hover:bg-sage-50 transition-colors font-medium text-sm"
              >
                취소
              </button>
              {editMode && (
                <button
                  type="button"
                  onClick={async () => {
                    if (!editData?.id) {
                      alert('삭제할 입금 정보가 없습니다.')
                      return
                    }
                    if (!confirm('이 입금을 삭제하시겠습니까?')) {
                      return
                    }
                    setLoading(true)
                    try {
                      const res = await fetch(`/api/admin/payments/${editData.id}`, {
                        method: 'DELETE',
                      })
                      const json = await res.json()
                      if (!res.ok) {
                        throw new Error(json.error || '입금 삭제 실패')
                      }
                      alert('입금이 삭제되었습니다.')
                      onSuccess()
                      onClose()
                    } catch (error) {
                      console.error('입금 삭제 실패:', error)
                      alert(`삭제 실패: ${error instanceof Error ? error.message : '삭제 중 오류가 발생했습니다.'}`)
                    } finally {
                      setLoading(false)
                    }
                  }}
                  disabled={loading}
                  className="flex-1 min-h-[44px] px-4 py-2 text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? '삭제 중...' : '입금 삭제'}
                </button>
              )}
              <button
                type="submit"
                disabled={loading}
                className="flex-1 min-h-[44px] px-4 py-2 text-white bg-sage-600 hover:bg-sage-700 rounded-lg transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? '저장 중...' : (editMode ? '입금 수정' : '입금 추가')}
              </button>
            </div>
          </form>
        )}

        {/* Expense Tab */}
        {activeTab === 'expense' && (
          <form onSubmit={handleExpenseSubmit} className="p-6 space-y-5">
            <h3 className="text-lg font-semibold text-sage-800">{editMode ? '지출 수정' : '지출 추가'}</h3>
            {errors.expense && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {errors.expense}
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-sage-700 mb-1">지출일</label>
                <input
                  type="date"
                  value={expenseForm.expense_date}
                  onChange={(e) => setExpenseForm(prev => ({ ...prev, expense_date: e.target.value }))}
                  className="w-full px-4 py-2 border border-sage-200 rounded-lg text-sm focus:border-sage-500 focus:ring-1 focus:ring-sage-500 focus:outline-none transition-colors"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-sage-700 mb-1">금액</label>
                <input
                  type="text"
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm(prev => ({ ...prev, amount: e.target.value }))}
                  className="w-full px-4 py-2 border border-sage-200 rounded-lg text-sm focus:border-sage-500 focus:ring-1 focus:ring-sage-500 focus:outline-none transition-colors"
                  placeholder="100,000"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-sage-700 mb-1">카테고리</label>
                <select
                  value={expenseForm.expense_category}
                  onChange={(e) => setExpenseForm(prev => ({ ...prev, expense_category: e.target.value }))}
                  className="w-full px-4 py-2 border border-sage-200 rounded-lg text-sm focus:border-sage-500 focus:ring-1 focus:ring-sage-500 focus:outline-none transition-colors"
                  required
                >
                  <option value="">선택</option>
                  {['임대료', '인건비', '필수운영비', '마케팅비', '광고비', '세금', '식대', '구독료', '기타'].map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-sage-700 mb-1">세부 카테고리</label>
                <input
                  type="text"
                  value={expenseForm.subcategory}
                  onChange={(e) => setExpenseForm(prev => ({ ...prev, subcategory: e.target.value }))}
                  className="w-full px-4 py-2 border border-sage-200 rounded-lg text-sm focus:border-sage-500 focus:ring-1 focus:ring-sage-500 focus:outline-none transition-colors"
                  placeholder="예: 사무실 임대료"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-sage-700 mb-1">결제수단</label>
                <select
                  value={expenseForm.payment_method}
                  onChange={(e) => setExpenseForm(prev => ({ ...prev, payment_method: e.target.value }))}
                  className="w-full px-4 py-2 border border-sage-200 rounded-lg text-sm focus:border-sage-500 focus:ring-1 focus:ring-sage-500 focus:outline-none transition-colors"
                >
                  {['카드', '현금', '계좌이체', '자동이체', '기타'].map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-sage-700 mb-1">공급업체</label>
                <input
                  type="text"
                  value={expenseForm.vendor_name}
                  onChange={(e) => setExpenseForm(prev => ({ ...prev, vendor_name: e.target.value }))}
                  className="w-full px-4 py-2 border border-sage-200 rounded-lg text-sm focus:border-sage-500 focus:ring-1 focus:ring-sage-500 focus:outline-none transition-colors"
                  placeholder="예: 네이버"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-sage-700 mb-1">메모</label>
                <textarea
                  value={expenseForm.memo}
                  onChange={(e) => setExpenseForm(prev => ({ ...prev, memo: e.target.value }))}
                  className="w-full px-4 py-2 border border-sage-200 rounded-lg text-sm focus:border-sage-500 focus:ring-1 focus:ring-sage-500 focus:outline-none transition-colors resize-none"
                  rows={2}
                />
              </div>
            </div>
            <div className="flex gap-3 pt-4 border-t border-sage-200">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 min-h-[44px] px-4 py-2 text-sage-700 bg-white border border-sage-300 rounded-lg hover:bg-sage-50 transition-colors font-medium text-sm"
              >
                취소
              </button>
              {editMode && (
                <button
                  type="button"
                  onClick={async () => {
                    if (!editData?.id) {
                      alert('삭제할 지출 정보가 없습니다.')
                      return
                    }
                    if (!confirm('이 지출을 삭제하시겠습니까?')) {
                      return
                    }
                    setLoading(true)
                    try {
                      const res = await fetch(`/api/admin/expenses/${editData.id}`, {
                        method: 'DELETE',
                      })
                      const json = await res.json()
                      if (!res.ok) {
                        throw new Error(json.error || '지출 삭제 실패')
                      }
                      alert('지출이 삭제되었습니다.')
                      onSuccess()
                      onClose()
                    } catch (error) {
                      console.error('지출 삭제 실패:', error)
                      alert(`삭제 실패: ${error instanceof Error ? error.message : '삭제 중 오류가 발생했습니다.'}`)
                    } finally {
                      setLoading(false)
                    }
                  }}
                  disabled={loading}
                  className="flex-1 min-h-[44px] px-4 py-2 text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? '삭제 중...' : '지출 삭제'}
                </button>
              )}
              <button
                type="submit"
                disabled={loading}
                className="flex-1 min-h-[44px] px-4 py-2 text-white bg-sage-600 hover:bg-sage-700 rounded-lg transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? '저장 중...' : (editMode ? '지출 수정' : '지출 추가')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
