'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import AdminHeader from './AdminHeader'
import { COURTS, getCourtAbbrev } from '@/lib/scourt/court-codes'
import { getCaseTypeAuto, isCriminalCase } from '@/lib/constants/case-types'

interface Client {
  id: string
  name: string
  phone: string | null
  email: string | null
  bank_account?: string | null
}

interface ExistingCase {
  id: string
  case_name: string
  case_type: string
  status: string
  court_case_number: string | null
  contract_number: string | null
  opponent_name: string | null
}

interface ConflictResult {
  found: boolean
  client: Client | null
  cases: ExistingCase[]
}

interface UploadedFile {
  id?: string
  fileName: string
  filePath: string
  fileSize: number
  fileType: string
  publicUrl: string
}

interface NewCaseFormProps {
  clients: Client[]
  initialCaseNumber?: string
  initialCourtName?: string
  initialClientId?: string
  initialPartyName?: string
  sourceCaseId?: string
  initialClientRole?: 'plaintiff' | 'defendant' | null
  initialOpponentName?: string | null
  sourceRelationType?: string
  sourceRelationEncCsNo?: string
}

interface NewClientPayload {
  name: string
  phone: string | null  // 연락처 선택
  email: string | null
  birth_date: string | null
  address: string | null
  bank_account: string | null
}

interface NewCasePayload {
  case_name: string
  case_type: string
  contract_number?: string | null
  assigned_to?: string | null
  status: string
  contract_date: string
  retainer_fee: number | null
  success_fee_agreement: string | null
  notes: string
  client_id?: string
  new_client?: NewClientPayload
  court_case_number?: string | null
  court_name?: string | null
  judge_name?: string | null
  client_role?: 'plaintiff' | 'defendant' | null
  opponent_name?: string | null
  source_case_id?: string
  source_relation_type?: string
  source_relation_enc_cs_no?: string
}

// 섹션 헤더 컴포넌트
function SectionHeader({
  number,
  title,
  subtitle,
  optional = false,
}: {
  number: number
  title: string
  subtitle?: string
  optional?: boolean
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-sage-100 flex items-center justify-center">
        <span className="text-sm font-semibold text-sage-700">{number}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          {optional && (
            <span className="px-2 py-0.5 text-xs font-medium text-sage-600 bg-sage-50 rounded-full">
              선택
            </span>
          )}
        </div>
        {subtitle && (
          <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>
        )}
      </div>
    </div>
  )
}

// 입력 필드 컴포넌트
function FormField({
  label,
  required = false,
  children,
  hint
}: {
  label: string
  required?: boolean
  children: React.ReactNode
  hint?: string
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label}
        {required && <span className="text-coral-600 ml-0.5">*</span>}
      </label>
      {children}
      {hint && (
        <p className="mt-1 text-xs text-gray-500">{hint}</p>
      )}
    </div>
  )
}

// 전화번호 자동 포맷 (010-1234-5678 형식)
function formatPhoneNumber(value: string): string {
  const numbers = value.replace(/\D/g, '')
  const limited = numbers.slice(0, 11)
  if (limited.length <= 3) {
    return limited
  } else if (limited.length <= 7) {
    return `${limited.slice(0, 3)}-${limited.slice(3)}`
  } else {
    return `${limited.slice(0, 3)}-${limited.slice(3, 7)}-${limited.slice(7)}`
  }
}

// 사건명 자동 생성 (입력된 필드 기반)
// - 상대방 있으면: 의뢰인v상대방(사건명)
// - 상대방 없으면: 의뢰인(사건명)
// - 사건명 우선, 없으면 사건번호 사용
function generateCaseName(
  clientName: string,
  opponentName: string,
  caseLabel: string,
  courtCaseNumber: string | null
): string {
  const vs = opponentName ? `v${opponentName}` : ''
  const suffix = caseLabel || courtCaseNumber || ''
  return `${clientName}${vs}${suffix ? `(${suffix})` : ''}`
}

// 파일 크기 포맷
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

// 금액 포맷 (천단위 콤마)
function formatMoney(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '' || value === 0) return ''
  const num = typeof value === 'string' ? parseInt(value.replace(/,/g, ''), 10) : value
  return isNaN(num) ? '' : num.toLocaleString('ko-KR')
}

// 콤마 제거 후 문자열 반환
function parseMoney(value: string): string {
  return value.replace(/,/g, '')
}

export default function NewCaseForm({
  clients,
  initialCaseNumber,
  initialCourtName,
  initialClientId,
  initialPartyName,
  sourceCaseId,
  initialClientRole,
  initialOpponentName,
  sourceRelationType,
  sourceRelationEncCsNo
}: NewCaseFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isNewClient, setIsNewClient] = useState(!initialClientId)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const resolvedInitialCourtName = getCourtAbbrev(initialCourtName || '')

  // 이해충돌 검색 관련 상태
  const [conflictResult, setConflictResult] = useState<ConflictResult | null>(null)
  const [isSearchingConflict, setIsSearchingConflict] = useState(false)

  // 계약서 업로드 관련 상태
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [isUploading, setIsUploading] = useState(false)

  const [formData, setFormData] = useState({
    client_id: initialClientId || '',
    case_type: '',
    case_label: '', // 사건명 (이혼, 양육권, 손해배상 등)
    contract_number: '', // 관리번호
    assigned_to: '',
    status: '진행중',
    contract_date: new Date().toISOString().split('T')[0],
    retainer_fee: '',
    success_fee_agreement: '',
    notes: '',
    // 대법원 사건 정보
    court_case_number: initialCaseNumber || '',
    court_name: resolvedInitialCourtName,
    judge_name: '',
    client_role: (initialClientRole || '') as 'plaintiff' | 'defendant' | '',
    opponent_name: initialOpponentName || '',
    // 새 의뢰인 정보
    client_name: '',
    client_phone: '',
    client_email: '',
    client_birth_date: '',
    client_address: '',
    client_bank_account: '' // 의뢰인 계좌번호
  })

  // 의뢰인 이름 가져오기
  const getClientName = useCallback(() => {
    if (isNewClient) {
      return formData.client_name
    }
    const selectedClient = clients.find(c => c.id === formData.client_id)
    return selectedClient?.name || ''
  }, [isNewClient, formData.client_name, formData.client_id, clients])

  // URL 파라미터로 전달된 경우 자동 연동 플래그
  const [autoSyncTriggered, setAutoSyncTriggered] = useState(false)

  // 담당자 목록 (변호사)
  const [lawyerMembers, setLawyerMembers] = useState<{id: string, display_name: string | null, role: string}[]>([])

  // 대법원 검색 관련 상태
  const [scourtSearching, setScourtSearching] = useState(false)
  const [scourtSearchError, setScourtSearchError] = useState<string | null>(null)
  const [scourtSearchPartyName, setScourtSearchPartyName] = useState(initialPartyName || '')
  const [showCourtDropdown, setShowCourtDropdown] = useState(false)
  const filteredCourts = COURTS
    .filter(c => {
      const query = formData.court_name.trim()
      if (!query) return true
      const abbrev = getCourtAbbrev(c.name)
      return c.name.includes(query) || abbrev.includes(query)
    })
    .reduce((acc, court) => {
      const abbrev = getCourtAbbrev(court.name)
      if (acc.seen.has(abbrev)) return acc
      acc.seen.add(abbrev)
      acc.items.push(court)
      return acc
    }, { items: [] as typeof COURTS, seen: new Set<string>() })
    .items.slice(0, 15)
  const [scourtSearchSuccess, setScourtSearchSuccess] = useState(false)

  // 사건번호 또는 사건명 변경 시 자동분류
  const handleAutoClassify = (caseNumber: string) => {
    const autoType = getCaseTypeAuto(caseNumber, '')
    if (autoType && !formData.case_type) {
      setFormData(prev => ({ ...prev, case_type: autoType }))
    }
  }

  // 담당자 목록 불러오기
  useEffect(() => {
    fetch('/api/admin/tenant/members?role=lawyer,admin,owner')
      .then(res => res.json())
      .then(data => {
        if (data.members) {
          setLawyerMembers(data.members)
        }
      })
      .catch(err => console.error('담당자 목록 조회 실패:', err))
  }, [])

  // 이해충돌 검색 (디바운스)
  useEffect(() => {
    if (!isNewClient || !formData.client_name) {
      setConflictResult(null)
      return
    }

    // 전화번호가 입력된 경우에만 전화번호 검증 (최소 10자리)
    if (formData.client_phone) {
      const phoneDigits = formData.client_phone.replace(/\D/g, '')
      if (phoneDigits.length > 0 && phoneDigits.length < 10) {
        // 전화번호 입력 중이면 검색하지 않음
        return
      }
    }

    const debounceTimer = setTimeout(async () => {
      setIsSearchingConflict(true)
      try {
        const params = new URLSearchParams({ name: formData.client_name })
        // 전화번호가 완전히 입력된 경우에만 포함
        if (formData.client_phone) {
          const phoneDigits = formData.client_phone.replace(/\D/g, '')
          if (phoneDigits.length >= 10) {
            params.set('phone', formData.client_phone)
          }
        }
        const res = await fetch(`/api/admin/clients/search?${params}`)
        const data = await res.json()
        if (data.success) {
          setConflictResult(data)
        }
      } catch (err) {
        console.error('이해충돌 검색 실패:', err)
      } finally {
        setIsSearchingConflict(false)
      }
    }, 500)

    return () => clearTimeout(debounceTimer)
  }, [isNewClient, formData.client_name, formData.client_phone])

  // 기존 의뢰인으로 전환
  const switchToExistingClient = () => {
    if (conflictResult?.client) {
      setFormData(prev => ({
        ...prev,
        client_id: conflictResult.client!.id
      }))
      setIsNewClient(false)
      setConflictResult(null)
    }
  }

  // 파일 업로드 핸들러
  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return

    setIsUploading(true)
    const newFiles: UploadedFile[] = []

    for (const file of Array.from(files)) {
      try {
        const formDataUpload = new FormData()
        formDataUpload.append('file', file)
        // legalCaseId는 사건 생성 후 연결

        const res = await fetch('/api/admin/contracts/upload', {
          method: 'POST',
          body: formDataUpload
        })

        const result = await res.json()
        if (result.success) {
          newFiles.push(result.data)
        } else {
          console.error('파일 업로드 실패:', result.error)
        }
      } catch (err) {
        console.error('파일 업로드 오류:', err)
      }
    }

    setUploadedFiles(prev => [...prev, ...newFiles])
    setIsUploading(false)

    // 파일 입력 리셋
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // 파일 삭제 핸들러
  const handleFileDelete = async (filePath: string) => {
    try {
      await fetch(`/api/admin/contracts/upload?filePath=${encodeURIComponent(filePath)}`, {
        method: 'DELETE'
      })
      setUploadedFiles(prev => prev.filter(f => f.filePath !== filePath))
    } catch (err) {
      console.error('파일 삭제 오류:', err)
    }
  }

  // URL 파라미터로 전달된 경우 자동 대법원 연동
  useEffect(() => {
    const autoSync = async () => {
      if (!initialCaseNumber || !resolvedInitialCourtName || autoSyncTriggered) return

      setAutoSyncTriggered(true)

      if (initialPartyName) {
        const caseNumberOnly = initialCaseNumber.replace(/^[가-힣\s]+(?=\d)/, '').trim()
        const caseNumberPattern = /^(\d{4})([가-힣]+)(\d+)$/
        const match = caseNumberOnly.match(caseNumberPattern)

        if (!match) {
          setScourtSearchError('사건번호 형식이 올바르지 않습니다.')
          return
        }

        const [, caseYear, caseType, caseSerial] = match

        setScourtSearching(true)
        setScourtSearchError(null)

        try {
          const response = await fetch('/api/admin/scourt/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              caseYear,
              caseType,
              caseSerial,
              courtName: resolvedInitialCourtName,
              partyName: initialPartyName
            })
          })

          const result = await response.json()

          if (result.success && result.caseInfo) {
            try {
              const generalRes = await fetch('/api/admin/scourt/detail', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  caseNumber: result.caseInfo.caseNumber,
                  encCsNo: result.caseInfo.encCsNo
                })
              })

              const generalResult = await generalRes.json()

              if (generalResult.success && generalResult.general) {
                const general = generalResult.general

                let detectedRole: 'plaintiff' | 'defendant' | '' = ''
                const selectedClient = initialClientId ? clients.find(c => c.id === initialClientId) : null
                const clientName = selectedClient?.name || ''

                if (clientName) {
                  const isPlaintiff = general.plaintiffs?.some((p: string) => p.includes(clientName))
                  const isDefendant = general.defendants?.some((d: string) => d.includes(clientName))

                  if (isPlaintiff) detectedRole = 'plaintiff'
                  else if (isDefendant) detectedRole = 'defendant'
                } else {
                  const isPlaintiff = general.plaintiffs?.some((p: string) => p.includes(initialPartyName))
                  const isDefendant = general.defendants?.some((d: string) => d.includes(initialPartyName))

                  if (isPlaintiff) detectedRole = 'plaintiff'
                  else if (isDefendant) detectedRole = 'defendant'
                }

                setFormData(prev => ({
                  ...prev,
                  judge_name: general.judge || result.caseInfo.judgeName || prev.judge_name,
                  court_name: getCourtAbbrev(general.court || prev.court_name),
                  client_role: detectedRole || prev.client_role
                }))
              }
            } catch (generalErr) {
              console.error('일반내용 조회 실패:', generalErr)
            }
            setScourtSearchSuccess(true)
            setScourtSearchError(null)
          } else {
            setScourtSearchError(`자동 연동 실패: ${result.error || '사건을 찾을 수 없습니다'}. 당사자 이름을 수정하고 다시 시도해주세요.`)
          }
        } catch (err) {
          setScourtSearchError(`연동 오류: ${err instanceof Error ? err.message : '알 수 없는 오류'}`)
        } finally {
          setScourtSearching(false)
        }
      } else {
        setScourtSearchError('대법원 연동을 위해 당사자 이름을 입력하고 [연동] 버튼을 눌러주세요.')
        setTimeout(() => {
          const partyInput = document.getElementById('scourt-party-name')
          if (partyInput) {
            partyInput.scrollIntoView({ behavior: 'smooth', block: 'center' })
            partyInput.focus()
          }
        }, 300)
      }
    }

    autoSync()
  }, [initialCaseNumber, resolvedInitialCourtName, initialPartyName, autoSyncTriggered, clients, initialClientId])

  // 대법원 사건 검색
  const handleScourtSearch = async () => {
    const caseNumber = formData.court_case_number.trim()
    const courtName = formData.court_name.trim()
    const partyName = scourtSearchPartyName.trim()

    if (!caseNumber || !courtName || !partyName) {
      setScourtSearchError('사건번호, 법원, 당사자이름을 모두 입력해주세요.')
      return
    }

    const caseNumberOnly = caseNumber.replace(/^[가-힣\s]+(?=\d)/, '').trim()
    const caseNumberPattern = /^(\d{4})([가-힣]+)(\d+)$/
    const match = caseNumberOnly.match(caseNumberPattern)

    if (!match) {
      setScourtSearchError('사건번호 형식이 올바르지 않습니다. 예: 2024드단12345')
      return
    }

    const [, caseYear, caseType, caseSerial] = match

    setScourtSearching(true)
    setScourtSearchError(null)

    try {
      const response = await fetch('/api/admin/scourt/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseYear, caseType, caseSerial, courtName, partyName })
      })

      const result = await response.json()

      if (result.success && result.caseInfo) {
        const generalRes = await fetch('/api/admin/scourt/detail', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            caseNumber: result.caseInfo.caseNumber,
            encCsNo: result.caseInfo.encCsNo
          })
        })

        const generalResult = await generalRes.json()

        if (generalResult.success && generalResult.general) {
          const general = generalResult.general

          let detectedRole: 'plaintiff' | 'defendant' | '' = ''
          const isPlaintiff = general.plaintiffs?.some((p: string) => p.includes(partyName))
          const isDefendant = general.defendants?.some((d: string) => d.includes(partyName))

          if (isPlaintiff) detectedRole = 'plaintiff'
          else if (isDefendant) detectedRole = 'defendant'

          // 사건 유형 자동 감지
          const autoType = getCaseTypeAuto(caseNumber, '')

          setFormData(prev => ({
            ...prev,
            court_name: getCourtAbbrev(general.court || prev.court_name),
            judge_name: general.judge || prev.judge_name,
            client_role: detectedRole || prev.client_role,
            // 자동 입력: 의뢰인 이름, 사건 유형
            client_name: partyName,
            case_type: autoType || prev.case_type,
            case_label: autoType || prev.case_label
          }))
          // 새 의뢰인 모드로 전환
          setIsNewClient(true)
          setScourtSearchSuccess(true)
        } else {
          // 사건 유형 자동 감지
          const autoType = getCaseTypeAuto(caseNumber, '')

          setFormData(prev => ({
            ...prev,
            court_name: getCourtAbbrev(result.caseInfo.courtName || result.caseInfo.court || prev.court_name),
            client_name: partyName,
            case_type: autoType || prev.case_type,
            case_label: autoType || prev.case_label
          }))
          setIsNewClient(true)
          setScourtSearchSuccess(true)
        }
      } else {
        setScourtSearchError(result.error || '사건을 찾을 수 없습니다.')
      }
    } catch (error) {
      console.error('대법원 검색 실패:', error)
      setScourtSearchError('대법원 검색 중 오류가 발생했습니다.')
    } finally {
      setScourtSearching(false)
    }
  }

  const submitCase = async (clientRoleOverride?: 'plaintiff' | 'defendant') => {
    setLoading(true)
    setError(null)

    try {
      const clientName = getClientName()
      if (!clientName) {
        throw new Error('의뢰인 이름이 필요합니다')
      }

      // 사건명 자동 생성 (사용자 입력 우선, 없으면 사건번호)
      const caseName = generateCaseName(
        clientName,
        formData.opponent_name,
        formData.case_label,
        formData.court_case_number || null
      )

      const payload: NewCasePayload = {
        case_name: caseName,
        case_type: formData.case_label || formData.case_type || '기타',
        contract_number: formData.contract_number || null,
        assigned_to: formData.assigned_to || null,
        status: formData.status,
        contract_date: formData.contract_date,
        retainer_fee: formData.retainer_fee ? Number(formData.retainer_fee) : null,
        success_fee_agreement: formData.success_fee_agreement || null,
        notes: formData.notes,
        court_case_number: formData.court_case_number || null,
        court_name: formData.court_name || null,
        judge_name: formData.judge_name || null,
        client_role: clientRoleOverride || formData.client_role || null,
        opponent_name: formData.opponent_name || null
      }

      if (sourceCaseId) {
        payload.source_case_id = sourceCaseId
        if (sourceRelationType) {
          payload.source_relation_type = sourceRelationType
        }
        if (sourceRelationEncCsNo) {
          payload.source_relation_enc_cs_no = sourceRelationEncCsNo
        }
      }

      if (isNewClient) {
        if (!formData.client_name) {
          throw new Error('의뢰인 이름은 필수입니다')
        }
        payload.new_client = {
          name: formData.client_name,
          phone: formData.client_phone || null,  // 연락처 선택
          email: formData.client_email || null,
          birth_date: formData.client_birth_date || null,
          address: formData.client_address || null,
          bank_account: formData.client_bank_account || null
        }
      } else {
        if (!formData.client_id) {
          throw new Error('의뢰인을 선택하세요')
        }
        payload.client_id = formData.client_id
      }

      const response = await fetch('/api/admin/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '사건 등록에 실패했습니다')
      }

      // SCOURT 검색 성공했으면 스냅샷 저장을 위해 sync 호출
      if (scourtSearchSuccess && formData.court_case_number) {
        try {
          console.log('사건 생성 후 SCOURT 동기화 시작...')
          await fetch('/api/admin/scourt/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              legalCaseId: data.data.id,
              caseNumber: formData.court_case_number,
              forceRefresh: true
            })
          })
          console.log('SCOURT 동기화 완료')
        } catch (syncError) {
          console.error('SCOURT 동기화 실패 (사건은 정상 생성됨):', syncError)
        }
      }

      // TODO: 업로드된 계약서 파일을 사건에 연결하는 로직 추가 필요

      router.push(`/cases/${data.data.id}`)
      router.refresh()
    } catch (err) {
      const message = err instanceof Error ? err.message : '사건 등록에 실패했습니다'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await submitCase()
  }

  const inputClassName = "w-full h-11 px-4 text-base border border-sage-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sage-500/20 focus:border-sage-500 transition-colors"
  const selectClassName = "w-full h-11 px-4 text-base border border-sage-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sage-500/20 focus:border-sage-500 transition-colors appearance-none cursor-pointer"

  return (
    <div className="min-h-screen bg-gradient-to-b from-sage-50/50 to-white">
      <AdminHeader title="새 사건 등록" />

      <div className="max-w-2xl mx-auto pt-20 pb-12 px-4">
        {/* 뒤로가기 */}
        <div className="mb-6">
          <Link
            href="/cases"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white rounded-full shadow-sm border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            사건 목록
          </Link>
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-5 h-5 mt-0.5">
                <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* ========== 섹션 1: 대법원 사건 연동 ========== */}
          <div className={`rounded-2xl border transition-all ${
            scourtSearchSuccess
              ? 'bg-sage-50 border-sage-300'
              : 'bg-white border-sage-200 shadow-sm'
          }`}>
            <div className="p-5 border-b border-sage-100">
              <SectionHeader
                number={1}
                title="대법원 사건 연동"
                subtitle="연동 시 의뢰인 이름, 사건 유형이 자동 입력됩니다"
                optional
              />
            </div>

            <div className="p-5">
              {scourtSearchSuccess ? (
                // 연동 성공 상태
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sage-700">
                    <svg className="w-5 h-5 text-sage-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="font-medium">
                      {formData.court_case_number} / {getCourtAbbrev(formData.court_name)}
                      {formData.client_role && ` (${formData.client_role === 'plaintiff' ? '원고' : '피고'})`}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setScourtSearchSuccess(false)
                      setScourtSearchError(null)
                    }}
                    className="text-sm text-sage-600 hover:text-sage-700 font-medium"
                  >
                    다시 검색하기
                  </button>
                </div>
              ) : (
                // 연동 폼
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <FormField label="사건번호">
                      <input
                        type="text"
                        value={formData.court_case_number}
                        onChange={(e) => {
                          const newCaseNumber = e.target.value
                          setFormData({ ...formData, court_case_number: newCaseNumber })
                          if (!formData.case_type) {
                            handleAutoClassify(newCaseNumber)
                          }
                        }}
                        placeholder="2024드단12345"
                        className={inputClassName}
                      />
                    </FormField>

                    <FormField label="법원">
                      <div className="relative">
                        <input
                          type="text"
                          value={formData.court_name}
                          onChange={(e) => {
                            setFormData({ ...formData, court_name: e.target.value })
                            setShowCourtDropdown(true)
                          }}
                          onFocus={() => setShowCourtDropdown(true)}
                          onBlur={() => setTimeout(() => setShowCourtDropdown(false), 150)}
                          placeholder="법원 검색..."
                          className={inputClassName}
                        />
                        {showCourtDropdown && filteredCourts.length > 0 && (
                          <div className="absolute z-50 w-full mt-1 bg-white border border-sage-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                            {filteredCourts.map(c => (
                              <div
                                key={c.code}
                                className="px-4 py-3 text-sm cursor-pointer hover:bg-sage-50 text-gray-900 border-b border-sage-50 last:border-b-0"
                                onMouseDown={() => {
                                  setFormData({ ...formData, court_name: getCourtAbbrev(c.name) })
                                  setShowCourtDropdown(false)
                                }}
                              >
                                {getCourtAbbrev(c.name)}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </FormField>

                    <FormField label="당사자이름">
                      <input
                        id="scourt-party-name"
                        type="text"
                        value={scourtSearchPartyName}
                        onChange={(e) => setScourtSearchPartyName(e.target.value)}
                        placeholder="의뢰인 이름"
                        className={inputClassName}
                      />
                    </FormField>
                  </div>

                  {scourtSearchError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm text-red-600">{scourtSearchError}</p>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleScourtSearch}
                    disabled={scourtSearching}
                    className="w-full sm:w-auto px-6 py-2.5 text-sm font-medium text-white bg-sage-600 rounded-lg hover:bg-sage-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                  >
                    {scourtSearching ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        검색 중...
                      </span>
                    ) : (
                      '대법원 연동하기'
                    )}
                  </button>

                  <p className="text-xs text-gray-500">
                    연동 시 의뢰인 이름, 사건 유형, 원고/피고 정보가 자동으로 입력됩니다.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ========== 섹션 2: 당사자 정보 ========== */}
          <div className="bg-white rounded-2xl border border-sage-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-sage-100">
              <SectionHeader
                number={2}
                title="당사자 정보"
                subtitle={isCriminalCase(formData.case_type || formData.case_label, formData.court_case_number)
                  ? "의뢰인(피고인) 정보를 입력하세요"
                  : "의뢰인과 상대방 정보를 입력하세요"}
              />
            </div>

            <div className="p-5 space-y-4">
              {/* 새 의뢰인/기존 의뢰인 토글 */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewClient(true)}
                  className={`flex-1 py-2.5 px-4 text-sm font-medium rounded-lg transition-all ${
                    isNewClient
                      ? 'bg-sage-600 text-white shadow-sm'
                      : 'bg-sage-50 text-sage-700 hover:bg-sage-100'
                  }`}
                >
                  새 의뢰인
                </button>
                <button
                  type="button"
                  onClick={() => setIsNewClient(false)}
                  className={`flex-1 py-2.5 px-4 text-sm font-medium rounded-lg transition-all ${
                    !isNewClient
                      ? 'bg-sage-600 text-white shadow-sm'
                      : 'bg-sage-50 text-sage-700 hover:bg-sage-100'
                  }`}
                >
                  기존 의뢰인 선택
                </button>
              </div>

              {isNewClient ? (
                <div className="space-y-4 p-4 bg-sage-50/50 rounded-xl border border-sage-100">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField label="이름" required>
                      <input
                        type="text"
                        required={isNewClient}
                        value={formData.client_name}
                        onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                        className={inputClassName}
                        placeholder="홍길동"
                      />
                    </FormField>
                    <FormField label="연락처">
                      <input
                        type="tel"
                        value={formData.client_phone}
                        onChange={(e) => setFormData({ ...formData, client_phone: formatPhoneNumber(e.target.value) })}
                        className={inputClassName}
                        placeholder="010-1234-5678"
                      />
                    </FormField>
                  </div>

                  {/* 이해충돌 경고 */}
                  {isSearchingConflict && (
                    <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                      <p className="text-sm text-gray-600 flex items-center gap-2">
                        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        기존 의뢰인 검색 중...
                      </p>
                    </div>
                  )}

                  {conflictResult?.found && conflictResult.client && (() => {
                    // 연락처 일치 여부 확인
                    const isPhoneMatch = conflictResult.client.phone && formData.client_phone &&
                      conflictResult.client.phone.replace(/-/g, '') === formData.client_phone.replace(/-/g, '')
                    return (
                    <div className={`p-4 border rounded-xl ${isPhoneMatch ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200'}`}>
                      <div className="flex items-start gap-3">
                        <svg className={`w-5 h-5 flex-shrink-0 mt-0.5 ${isPhoneMatch ? 'text-amber-600' : 'text-blue-600'}`} fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        <div className="flex-1">
                          <p className={`text-sm font-semibold mb-1 ${isPhoneMatch ? 'text-amber-800' : 'text-blue-800'}`}>
                            {isPhoneMatch ? '이해충돌 검토 필요' : '동명이인 확인'}
                          </p>
                          <p className={`text-sm mb-2 ${isPhoneMatch ? 'text-amber-700' : 'text-blue-700'}`}>
                            {isPhoneMatch
                              ? '동일한 연락처의 의뢰인이 이미 등록되어 있습니다.'
                              : '동일한 이름의 의뢰인이 있습니다. 확인해주세요.'}
                          </p>
                          <p className={`text-sm font-medium ${isPhoneMatch ? 'text-amber-900' : 'text-blue-900'}`}>
                            기존 의뢰인: {conflictResult.client.name}{conflictResult.client.phone ? ` (${conflictResult.client.phone})` : ''}
                          </p>
                          {conflictResult.cases.length > 0 && (
                            <div className="mt-2">
                              <p className={`text-xs mb-1 ${isPhoneMatch ? 'text-amber-700' : 'text-blue-700'}`}>진행 중 사건:</p>
                              <ul className="space-y-1">
                                {conflictResult.cases.slice(0, 3).map(c => (
                                  <li key={c.id} className={`text-xs ${isPhoneMatch ? 'text-amber-800' : 'text-blue-800'}`}>
                                    - {c.case_name} ({c.case_type})
                                  </li>
                                ))}
                                {conflictResult.cases.length > 3 && (
                                  <li className={`text-xs ${isPhoneMatch ? 'text-amber-600' : 'text-blue-600'}`}>
                                    외 {conflictResult.cases.length - 3}건
                                  </li>
                                )}
                              </ul>
                            </div>
                          )}
                          <div className="flex gap-2 mt-3">
                            <button
                              type="button"
                              onClick={switchToExistingClient}
                              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${isPhoneMatch ? 'text-amber-800 bg-amber-100 hover:bg-amber-200' : 'text-blue-800 bg-blue-100 hover:bg-blue-200'}`}
                            >
                              기존 의뢰인으로 등록
                            </button>
                            <button
                              type="button"
                              onClick={() => setConflictResult(null)}
                              className={`px-3 py-1.5 text-xs font-medium border rounded-lg transition-colors ${isPhoneMatch ? 'text-amber-700 border-amber-300 hover:bg-amber-50' : 'text-blue-700 border-blue-300 hover:bg-blue-50'}`}
                            >
                              새 의뢰인으로 계속
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                    )
                  })()}

                  <FormField label="계좌번호" hint="은행명과 계좌번호를 입력하세요">
                    <input
                      type="text"
                      value={formData.client_bank_account}
                      onChange={(e) => setFormData({ ...formData, client_bank_account: e.target.value })}
                      className={inputClassName}
                      placeholder="예: 국민 123-456-789012"
                    />
                  </FormField>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField label="이메일">
                      <input
                        type="email"
                        value={formData.client_email}
                        onChange={(e) => setFormData({ ...formData, client_email: e.target.value })}
                        className={inputClassName}
                        placeholder="example@email.com"
                      />
                    </FormField>
                    <FormField label="생년월일">
                      <input
                        type="date"
                        value={formData.client_birth_date}
                        onChange={(e) => setFormData({ ...formData, client_birth_date: e.target.value })}
                        className={inputClassName}
                        style={{ colorScheme: 'light' }}
                      />
                    </FormField>
                  </div>
                  <FormField label="주소">
                    <input
                      type="text"
                      value={formData.client_address}
                      onChange={(e) => setFormData({ ...formData, client_address: e.target.value })}
                      className={inputClassName}
                      placeholder="경기도 평택시..."
                    />
                  </FormField>
                </div>
              ) : (
                <FormField label="의뢰인 선택" required>
                  <div className="relative">
                    <select
                      required={!isNewClient}
                      value={formData.client_id}
                      onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                      className={selectClassName}
                    >
                      <option value="">의뢰인을 선택하세요</option>
                      {clients.map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.name} {client.phone ? `(${client.phone})` : ''}
                        </option>
                      ))}
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </FormField>
              )}

              {/* 상대방 정보 - 형사사건에서는 표시하지 않음 */}
              {!isCriminalCase(formData.case_type || formData.case_label, formData.court_case_number) && (
                <div className="pt-4 border-t border-sage-100">
                  <FormField label="상대방 이름" hint="분쟁 상대방이 있는 경우에만 입력하세요">
                    <input
                      type="text"
                      value={formData.opponent_name}
                      onChange={(e) => setFormData({ ...formData, opponent_name: e.target.value })}
                      className={inputClassName}
                      placeholder="상대방 이름 (선택)"
                    />
                  </FormField>
                </div>
              )}
            </div>
          </div>

          {/* ========== 섹션 3: 계약 정보 ========== */}
          <div className="bg-white rounded-2xl border border-sage-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-sage-100">
              <SectionHeader
                number={3}
                title="계약 정보"
                subtitle="계약 및 수임 관련 정보를 입력하세요"
              />
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <FormField label="사건명" hint="예: 이혼, 양육권, 손해배상">
                  <input
                    type="text"
                    value={formData.case_label}
                    onChange={(e) => setFormData({ ...formData, case_label: e.target.value })}
                    className={inputClassName}
                    placeholder="이혼, 양육권 등"
                  />
                </FormField>
                <FormField label="관리번호" hint="사건 관리용 번호">
                  <input
                    type="text"
                    value={formData.contract_number}
                    onChange={(e) => setFormData({ ...formData, contract_number: e.target.value })}
                    className={inputClassName}
                    placeholder="예: 2024-001"
                  />
                </FormField>
                <FormField label="담당 변호사">
                  <div className="relative">
                    <select
                      value={formData.assigned_to}
                      onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                      className={selectClassName}
                    >
                      <option value="">선택하세요</option>
                      {lawyerMembers.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.display_name || '이름 없음'}
                          {member.role === 'owner' && ' (대표)'}
                        </option>
                      ))}
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </FormField>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <FormField label="계약일">
                  <input
                    type="date"
                    value={formData.contract_date}
                    onChange={(e) => setFormData({ ...formData, contract_date: e.target.value })}
                    className={inputClassName}
                    style={{ colorScheme: 'light' }}
                  />
                </FormField>
                <FormField label="착수금 (원)">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatMoney(formData.retainer_fee)}
                    onChange={(e) => setFormData({ ...formData, retainer_fee: parseMoney(e.target.value) })}
                    className={inputClassName}
                    placeholder="0"
                  />
                </FormField>
                <FormField label="성공보수 약정">
                  <input
                    type="text"
                    value={formData.success_fee_agreement}
                    onChange={(e) => setFormData({ ...formData, success_fee_agreement: e.target.value })}
                    className={inputClassName}
                    placeholder="예: 인정액의 5%"
                  />
                </FormField>
              </div>

              {/* 계약서 업로드 */}
              <div className="pt-4 border-t border-sage-100">
                <FormField label="계약서 업로드" hint="PDF, 이미지, Word 파일 (최대 10MB)">
                  <div
                    className="border-2 border-dashed border-sage-200 rounded-lg p-6 text-center hover:border-sage-400 transition-colors cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => {
                      e.preventDefault()
                      e.currentTarget.classList.add('border-sage-400', 'bg-sage-50')
                    }}
                    onDragLeave={(e) => {
                      e.currentTarget.classList.remove('border-sage-400', 'bg-sage-50')
                    }}
                    onDrop={(e) => {
                      e.preventDefault()
                      e.currentTarget.classList.remove('border-sage-400', 'bg-sage-50')
                      handleFileUpload(e.dataTransfer.files)
                    }}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
                      className="hidden"
                      onChange={(e) => handleFileUpload(e.target.files)}
                    />
                    {isUploading ? (
                      <div className="flex items-center justify-center gap-2 text-sage-600">
                        <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        업로드 중...
                      </div>
                    ) : (
                      <>
                        <svg className="mx-auto w-10 h-10 text-sage-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <p className="text-sm text-gray-600">
                          파일을 드래그하거나 클릭하여 업로드
                        </p>
                      </>
                    )}
                  </div>
                </FormField>

                {/* 업로드된 파일 목록 */}
                {uploadedFiles.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {uploadedFiles.map((file, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-sage-50 rounded-lg">
                        <div className="flex items-center gap-2 min-w-0">
                          <svg className="w-5 h-5 text-sage-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                          </svg>
                          <span className="text-sm text-gray-700 truncate">{file.fileName}</span>
                          <span className="text-xs text-gray-500">({formatFileSize(file.fileSize)})</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleFileDelete(file.filePath)}
                          className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <FormField label="메모">
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-3 text-base border border-sage-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sage-500/20 focus:border-sage-500 transition-colors resize-none"
                  placeholder="추가 메모 사항"
                />
              </FormField>
            </div>
          </div>

          {/* ========== 하단 버튼 ========== */}
          <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4">
            <Link
              href="/cases"
              className="w-full sm:w-auto px-6 py-3 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-center"
            >
              취소
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto px-8 py-3 text-sm font-medium text-white bg-sage-600 rounded-xl hover:bg-sage-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  등록 중...
                </span>
              ) : (
                '사건 등록'
              )}
            </button>
          </div>
        </form>
      </div>

    </div>
  )
}
