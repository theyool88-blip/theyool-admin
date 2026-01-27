'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { COURTS, getCourtAbbrev } from '@/lib/scourt/court-codes'
import {
  getGroupedCaseTypes,
  getCaseTypeAuto,
  isCriminalCase
} from '@/lib/constants/case-types'
import { AssigneeMultiSelect } from './ui/AssigneeMultiSelect'

interface Client {
  id: string
  name: string
  phone: string | null
}

interface LegalCase {
  id: string
  contract_number: string | null
  case_name: string
  client_id: string
  status: string
  assigned_to: string | null
  contract_date: string | null
  retainer_fee: number | null
  total_received: number | null
  outstanding_balance: number | null
  success_fee_agreement: string | null
  calculated_success_fee: number | null
  court_case_number: string | null
  court_name: string | null
  case_type: string | null
  application_type: string | null
  judge_name: string | null
  notes: string | null
  onedrive_folder_url: string | null
  client_role: 'plaintiff' | 'defendant' | null
  opponent_name: string | null
  scourt_enc_cs_no: string | null
  scourt_case_name: string | null
  client?: Client
  assigned_member?: { id: string; display_name: string | null; role: string } | null
}

interface SimpleCase {
  id: string
  case_name: string
  contract_number: string | null
  status: string
}

interface RelatedCase {
  id: string
  related_case_id: string
  relation_type: string | null
  notes: string | null
  related_case?: {
    id: string
    case_name: string
    contract_number: string | null
  }
}

interface Profile {
  id: string
  name: string
  role: string
}

interface UploadedFile {
  id: string
  file_name: string
  file_path: string
  file_size: number | null
  file_type: string | null
  publicUrl: string
}

interface Assignee {
  member_id: string
  assignee_role?: 'lawyer' | 'staff'
  is_primary?: boolean
}

// 한글 성씨 추출 (첫 글자)
function extractSurname(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return ''
  const firstChar = trimmed.charAt(0)
  if (/[가-힣]/.test(firstChar)) {
    return firstChar
  }
  return ''
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
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[var(--sage-muted)] flex items-center justify-center">
        <span className="text-sm font-semibold text-[var(--sage-primary)]">{number}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h2 className="text-body font-semibold text-[var(--text-primary)]">{title}</h2>
          {optional && (
            <span className="px-2 py-0.5 text-xs font-medium text-[var(--sage-primary)] bg-[var(--sage-muted)] rounded-full">
              선택
            </span>
          )}
        </div>
        {subtitle && (
          <p className="text-caption text-[var(--text-muted)] mt-0.5">{subtitle}</p>
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
    <div className="form-group">
      <label className="form-label">
        {label}
        {required && <span className="text-[var(--color-danger)] ml-0.5">*</span>}
      </label>
      {children}
      {hint && (
        <p className="form-hint">{hint}</p>
      )}
    </div>
  )
}

// 파일 크기 포맷
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

// 금액 포맷 (천단위 콤마)
function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined || value === 0) return ''
  return value.toLocaleString('ko-KR')
}

// 콤마 제거 후 숫자 파싱
function parseMoney(value: string): number {
  const num = parseInt(value.replace(/,/g, ''), 10)
  return isNaN(num) ? 0 : num
}

export default function CaseEditForm({
  profile: _profile,
  caseData,
  allCases,
  relatedCases
}: {
  profile: Profile
  caseData: LegalCase
  allCases: SimpleCase[]
  relatedCases: RelatedCase[]
}) {
  const router = useRouter()
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [formData, setFormData] = useState({
    contract_number: caseData.contract_number || '',
    case_name: caseData.case_name || '',
    client_id: caseData.client_id || '',
    status: caseData.status || '진행중',
    assignees: [] as Assignee[], // 담당변호사 목록 (다중 지정)
    contract_date: caseData.contract_date || '',
    retainer_fee: caseData.retainer_fee || 0,
    total_received: caseData.total_received || 0,
    success_fee_agreement: caseData.success_fee_agreement || '',
    calculated_success_fee: caseData.calculated_success_fee || 0,
    court_case_number: caseData.court_case_number || '',
    court_name: getCourtAbbrev(caseData.court_name || ''),
    case_type: caseData.case_type || '',
    application_type: caseData.application_type || '',
    judge_name: caseData.judge_name || '',
    notes: caseData.notes || '',
    onedrive_folder_url: caseData.onedrive_folder_url || '',
    client_role: caseData.client_role || '' as 'plaintiff' | 'defendant' | '',
    opponent_name: caseData.opponent_name || '',
    scourt_enc_cs_no: caseData.scourt_enc_cs_no || '',
    scourt_case_name: caseData.scourt_case_name || ''
  })

  // 담당자 목록 (변호사)
  const [lawyerMembers, setLawyerMembers] = useState<{id: string, display_name: string | null, role: string}[]>([])

  // 대법원 검색 관련 상태
  const [scourtSearching, setScourtSearching] = useState(false)
  const [scourtSearchError, setScourtSearchError] = useState<string | null>(null)
  const [scourtSearchPartyName, setScourtSearchPartyName] = useState('')

  // 법원 선택 드롭다운
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

  // 대법원 검색 성공 여부
  const [scourtSearchSuccess, setScourtSearchSuccess] = useState(!!caseData.scourt_enc_cs_no)

  // 그룹별 사건 유형 옵션 (메모이제이션)
  const _groupedCaseTypes = useMemo(() => getGroupedCaseTypes(), [])

  // 사건번호 변경 시 자동분류
  const handleAutoClassify = (caseNumber: string) => {
    const autoType = getCaseTypeAuto(caseNumber, '')
    if (autoType && !formData.case_type) {
      setFormData(prev => ({ ...prev, case_type: autoType }))
    }
  }

  const [allClients, setAllClients] = useState<Client[]>([])
  const [loadingClients, setLoadingClients] = useState(true)
  const selectedClientName = useMemo(() => {
    const selectedClient = allClients.find(client => client.id === formData.client_id)
    return selectedClient?.name || ''
  }, [allClients, formData.client_id])
  const clientSurname = extractSurname(selectedClientName)
  const opponentSurname = extractSurname(formData.opponent_name)
  const sameSurname = clientSurname && opponentSurname && clientSurname === opponentSurname
  const [showRoleConfirm, setShowRoleConfirm] = useState(false)
  const [pendingClientRole, setPendingClientRole] = useState<'plaintiff' | 'defendant' | ''>('')
  const [roleTouched, setRoleTouched] = useState(!!caseData.client_role)
  const [roleConfirmError, setRoleConfirmError] = useState('')

  const [relations, setRelations] = useState<RelatedCase[]>(relatedCases)
  const [showAddRelation, setShowAddRelation] = useState(false)
  const [newRelation, setNewRelation] = useState({
    related_case_id: '',
    relation_type: '',
    notes: ''
  })
  const [saving, setSaving] = useState(false)

  // 계약서 파일 관련 상태
  const [contractFiles, setContractFiles] = useState<UploadedFile[]>([])
  const [isUploading, setIsUploading] = useState(false)

  useEffect(() => {
    const fetchClients = async () => {
      try {
        const response = await fetch('/api/admin/clients')
        const result = await response.json()

        if (result.clients) {
          setAllClients(result.clients)
        }
      } catch (error) {
        console.error('의뢰인 목록 로드 실패:', error)
      }
      setLoadingClients(false)
    }
    fetchClients()

    // 담당자 목록 불러오기
    fetch('/api/admin/tenant/members?role=lawyer,admin,owner')
      .then(res => res.json())
      .then(data => {
        if (data.members) {
          setLawyerMembers(data.members)
        }
      })
      .catch(err => console.error('담당자 목록 조회 실패:', err))

    // 담당변호사 목록 불러오기 (case_assignees)
    fetch(`/api/admin/cases/${caseData.id}/assignees`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.assignees) {
          const assignees = data.assignees.map((a: { memberId: string; isPrimary: boolean }) => ({
            member_id: a.memberId,
            is_primary: a.isPrimary
          }))
          setFormData(prev => ({ ...prev, assignees }))
        }
      })
      .catch(err => console.error('담당변호사 목록 조회 실패:', err))

    // 계약서 파일 목록 불러오기
    fetch(`/api/admin/cases/${caseData.id}/contracts`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setContractFiles(data.contracts || [])
        }
      })
      .catch(err => console.error('계약서 목록 조회 실패:', err))
  }, [caseData.id])

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
        body: JSON.stringify({
          caseYear,
          caseType,
          caseSerial,
          courtName,
          partyName,
          legalCaseId: caseData.id
        })
      })

      const result = await response.json()

      if (result.success && result.caseInfo) {
        setFormData(prev => ({
          ...prev,
          court_name: getCourtAbbrev(result.caseInfo.courtName || prev.court_name),
          client_role: result.caseInfo.clientRole || prev.client_role,
          scourt_enc_cs_no: result.caseInfo.encCsNo || prev.scourt_enc_cs_no,
        }))

        setScourtSearchError(null)
        setScourtSearchSuccess(true)
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

  // 파일 업로드 핸들러
  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return

    setIsUploading(true)

    for (const file of Array.from(files)) {
      try {
        const formDataUpload = new FormData()
        formDataUpload.append('file', file)
        formDataUpload.append('legalCaseId', caseData.id)

        const res = await fetch('/api/admin/contracts/upload', {
          method: 'POST',
          body: formDataUpload
        })

        const result = await res.json()
        if (result.success) {
          setContractFiles(prev => [...prev, result.data])
        } else {
          console.error('파일 업로드 실패:', result.error)
          alert(result.error || '파일 업로드에 실패했습니다.')
        }
      } catch (err) {
        console.error('파일 업로드 오류:', err)
      }
    }

    setIsUploading(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // 파일 삭제 핸들러
  const handleFileDelete = async (fileId: string, _filePath: string) => {
    try {
      await fetch(`/api/admin/contracts/upload?id=${fileId}`, {
        method: 'DELETE'
      })
      setContractFiles(prev => prev.filter(f => f.id !== fileId))
    } catch (err) {
      console.error('파일 삭제 오류:', err)
    }
  }

  const submitCaseUpdate = async (clientRoleOverride?: 'plaintiff' | 'defendant') => {
    setSaving(true)

    try {
      // 다중 담당변호사 → 첫 번째 주담당을 assigned_to로도 설정 (하위호환)
      const primaryAssignee = formData.assignees.find(a => a.is_primary)
      const firstAssignee = formData.assignees[0]
      const assignedTo = primaryAssignee?.member_id || firstAssignee?.member_id || null

      const response = await fetch(`/api/admin/cases/${caseData.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contract_number: formData.contract_number || null,
          case_name: formData.case_name,
          client_id: formData.client_id,
          status: formData.status,
          assigned_to: assignedTo,
          contract_date: formData.contract_date || null,
          retainer_fee: formData.retainer_fee,
          total_received: formData.total_received,
          success_fee_agreement: formData.success_fee_agreement || null,
          calculated_success_fee: formData.calculated_success_fee,
          court_case_number: formData.court_case_number || null,
          court_name: formData.court_name || null,
          case_type: formData.case_type || null,
          judge_name: formData.judge_name || null,
          notes: formData.notes || null,
          onedrive_folder_url: formData.onedrive_folder_url || null,
          client_role: clientRoleOverride || formData.client_role || null,
          opponent_name: formData.opponent_name || null,
          scourt_enc_cs_no: formData.scourt_enc_cs_no || null,
          scourt_case_name: formData.scourt_case_name || null
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || '저장에 실패했습니다')
      }

      // 담당변호사 목록 업데이트 (PUT으로 전체 교체)
      // 담당변호사가 없어도 PUT 호출하여 기존 담당자 삭제
      await fetch(`/api/admin/cases/${caseData.id}/assignees`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignees: formData.assignees })
      })

      alert('저장되었습니다')
      router.push(`/cases/${caseData.id}`)
      router.refresh()
    } catch (error) {
      console.error('저장 실패:', error)
      alert(error instanceof Error ? error.message : '저장에 실패했습니다')
    } finally {
      setSaving(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.client_id) {
      alert('의뢰인을 선택해주세요.')
      return
    }

    if (sameSurname && !roleTouched) {
      setPendingClientRole(formData.client_role || '')
      setRoleConfirmError('')
      setShowRoleConfirm(true)
      return
    }

    await submitCaseUpdate()
  }

  const handleRoleConfirm = async () => {
    if (!pendingClientRole) {
      setRoleConfirmError('의뢰인 역할을 선택해주세요.')
      return
    }

    setShowRoleConfirm(false)
    setRoleConfirmError('')
    setRoleTouched(true)
    setFormData(prev => ({ ...prev, client_role: pendingClientRole }))
    await submitCaseUpdate(pendingClientRole)
  }

  const handleAddRelation = async () => {
    if (!newRelation.related_case_id) return

    try {
      const { error: error1 } = await supabase
        .from('case_relations')
        .insert({
          case_id: caseData.id,
          related_case_id: newRelation.related_case_id,
          relation_type: newRelation.relation_type || null,
          notes: newRelation.notes || null
        })

      if (error1) throw error1

      const { error: error2 } = await supabase
        .from('case_relations')
        .insert({
          case_id: newRelation.related_case_id,
          related_case_id: caseData.id,
          relation_type: newRelation.relation_type || null,
          notes: newRelation.notes ? `[역방향] ${newRelation.notes}` : null
        })

      if (error2) throw error2

      alert('관련 사건이 양방향으로 추가되었습니다')
      router.refresh()
    } catch (error) {
      console.error('추가 실패:', error)
      alert('추가에 실패했습니다')
    }
  }

  const handleDeleteRelation = async (relationId: string) => {
    if (!confirm('이 관련 사건을 삭제하시겠습니까?')) return

    try {
      const { data: relation } = await supabase
        .from('case_relations')
        .select('case_id, related_case_id')
        .eq('id', relationId)
        .single()

      if (!relation) throw new Error('관계를 찾을 수 없습니다')

      await supabase.from('case_relations').delete().eq('id', relationId)
      await supabase.from('case_relations').delete()
        .eq('case_id', relation.related_case_id)
        .eq('related_case_id', relation.case_id)

      setRelations(relations.filter(r => r.id !== relationId))
    } catch (error) {
      console.error('삭제 실패:', error)
      alert('삭제에 실패했습니다')
    }
  }

  const inputClassName = "form-input h-11"
  const selectClassName = "form-input h-11 appearance-none cursor-pointer"

  return (
    <>
    <div className="page-container max-w-2xl">
        {/* Page Header */}
        <div className="page-header">
          <div>
            <Link
              href={`/cases/${caseData.id}`}
              className="text-caption text-[var(--text-muted)] hover:text-[var(--text-secondary)] mb-2 inline-block"
            >
              ← 사건 상세
            </Link>
            <h1 className="page-title">사건 정보 수정</h1>
            <p className="page-subtitle">{caseData.case_name}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* ========== 섹션 1: 대법원 사건 연동 ========== */}
          <div className={`card overflow-hidden transition-all ${
            scourtSearchSuccess
              ? 'bg-[var(--sage-muted)] border-[var(--sage-primary)]'
              : ''
          }`}>
            <div className="p-5 border-b border-[var(--border-subtle)]">
              <SectionHeader
                number={1}
                title="대법원 사건 연동"
                subtitle="연동 시 법원, 원고/피고 정보가 자동으로 입력됩니다"
                optional
              />
            </div>

            <div className="p-5">
              {scourtSearchSuccess ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-[var(--sage-primary)]">
                    <svg className="w-5 h-5 text-[var(--color-success)]" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="font-medium text-[var(--text-primary)]">
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
                    className="text-sm text-[var(--sage-primary)] hover:text-[var(--sage-primary-hover)] font-medium"
                  >
                    다시 검색하기
                  </button>
                </div>
              ) : (
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
                          <div className="absolute z-50 w-full mt-1 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg shadow-lg max-h-48 overflow-y-auto">
                            {filteredCourts.map(c => (
                              <div
                                key={c.code}
                                className="px-4 py-3 text-sm cursor-pointer hover:bg-[var(--bg-hover)] text-[var(--text-primary)] border-b border-[var(--border-subtle)] last:border-b-0"
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
                        type="text"
                        value={scourtSearchPartyName}
                        onChange={(e) => setScourtSearchPartyName(e.target.value)}
                        placeholder="의뢰인 이름"
                        className={inputClassName}
                      />
                    </FormField>
                  </div>

                  {scourtSearchError && (
                    <div className="p-3 bg-[var(--color-danger-muted)] border border-[var(--color-danger)]/20 rounded-lg">
                      <p className="text-sm text-[var(--color-danger)]">{scourtSearchError}</p>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleScourtSearch}
                    disabled={scourtSearching}
                    className="btn btn-primary w-full sm:w-auto"
                  >
                    {scourtSearching ? '검색 중...' : '대법원 연동하기'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ========== 섹션 2: 당사자 정보 ========== */}
          <div className="card overflow-hidden">
            <div className="p-5 border-b border-[var(--border-subtle)]">
              <SectionHeader
                number={2}
                title="당사자 정보"
                subtitle={isCriminalCase(formData.case_type, formData.court_case_number)
                  ? "의뢰인(피고인) 정보"
                  : "의뢰인과 상대방 정보"}
              />
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="의뢰인" required>
                  <div className="relative">
                    <select
                      value={formData.client_id}
                      onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                      required
                      disabled={loadingClients}
                      className={selectClassName}
                    >
                      <option value="">의뢰인을 선택하세요</option>
                      {allClients.map(client => (
                        <option key={client.id} value={client.id}>
                          {client.name} {client.phone ? `(${client.phone})` : ''}
                        </option>
                      ))}
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                      <svg className="w-5 h-5 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </FormField>

                <FormField label="의뢰인 역할">
                  <div className="relative">
                    <select
                      value={formData.client_role}
                      onChange={(e) => {
                        const nextRole = e.target.value as 'plaintiff' | 'defendant' | ''
                        setFormData({ ...formData, client_role: nextRole })
                        setRoleTouched(!!nextRole)
                      }}
                      className={selectClassName}
                    >
                      <option value="">선택하세요</option>
                      <option value="plaintiff">원고</option>
                      <option value="defendant">피고</option>
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                      <svg className="w-5 h-5 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </FormField>
              </div>

              {/* 상대방 정보 - 형사사건에서는 표시하지 않음 */}
              {!isCriminalCase(formData.case_type, formData.court_case_number) && (
                <FormField label="상대방 이름" hint="분쟁 상대방이 있는 경우에만 입력하세요">
                  <input
                    type="text"
                    value={formData.opponent_name}
                    onChange={(e) => setFormData({ ...formData, opponent_name: e.target.value })}
                    className={inputClassName}
                    placeholder="상대방 이름 (선택)"
                  />
                </FormField>
              )}
            </div>
          </div>

          {/* ========== 섹션 3: 계약 정보 ========== */}
          <div className="card overflow-hidden">
            <div className="p-5 border-b border-[var(--border-subtle)]">
              <SectionHeader
                number={3}
                title="계약 정보"
                subtitle="계약 및 수임 관련 정보"
              />
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <FormField label="사건명" required>
                  <input
                    type="text"
                    value={formData.case_name}
                    onChange={(e) => setFormData({ ...formData, case_name: e.target.value })}
                    required
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

                <FormField label="담당 변호사" hint="다중 선택 가능, 첫 번째가 주담당">
                  <AssigneeMultiSelect
                    members={lawyerMembers}
                    value={formData.assignees}
                    onChange={(assignees) => setFormData({ ...formData, assignees })}
                    placeholder="담당변호사 선택"
                  />
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

                <FormField label="상태">
                  <div className="relative">
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className={selectClassName}
                    >
                      <option value="진행중">진행중</option>
                      <option value="종결">종결</option>
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                      <svg className="w-5 h-5 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </FormField>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

                <FormField label="발생 성공보수 (원)">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatMoney(formData.calculated_success_fee)}
                    onChange={(e) => setFormData({ ...formData, calculated_success_fee: parseMoney(e.target.value) })}
                    className={inputClassName}
                    placeholder="0"
                  />
                </FormField>
              </div>

              {/* 계약서 업로드 */}
              <div className="pt-4 border-t border-[var(--border-subtle)]">
                <FormField label="계약서" hint="PDF, 이미지, Word 파일 (최대 10MB)">
                  <div
                    className="border-2 border-dashed border-[var(--border-default)] rounded-lg p-6 text-center hover:border-[var(--sage-primary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => {
                      e.preventDefault()
                      e.currentTarget.classList.add('border-[var(--sage-primary)]', 'bg-[var(--sage-muted)]')
                    }}
                    onDragLeave={(e) => {
                      e.currentTarget.classList.remove('border-[var(--sage-primary)]', 'bg-[var(--sage-muted)]')
                    }}
                    onDrop={(e) => {
                      e.preventDefault()
                      e.currentTarget.classList.remove('border-[var(--sage-primary)]', 'bg-[var(--sage-muted)]')
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
                      <div className="flex items-center justify-center gap-2 text-[var(--sage-primary)]">
                        <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        업로드 중...
                      </div>
                    ) : (
                      <>
                        <svg className="mx-auto w-10 h-10 text-[var(--text-muted)] mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <p className="text-sm text-[var(--text-secondary)]">
                          파일을 드래그하거나 클릭하여 업로드
                        </p>
                      </>
                    )}
                  </div>
                </FormField>

                {/* 업로드된 파일 목록 */}
                {contractFiles.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {contractFiles.map((file) => (
                      <div key={file.id} className="flex items-center justify-between p-3 bg-[var(--bg-tertiary)] rounded-lg">
                        <div className="flex items-center gap-2 min-w-0">
                          <svg className="w-5 h-5 text-[var(--sage-primary)] flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                          </svg>
                          <span className="text-sm text-[var(--text-primary)] truncate">{file.file_name}</span>
                          {file.file_size && (
                            <span className="text-xs text-[var(--text-muted)]">({formatFileSize(file.file_size)})</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <a
                            href={file.publicUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-1 text-xs font-medium text-[var(--sage-primary)] hover:text-[var(--sage-primary-hover)]"
                          >
                            다운로드
                          </a>
                          <button
                            type="button"
                            onClick={() => handleFileDelete(file.id, file.file_path)}
                            className="p-1 text-[var(--text-muted)] hover:text-[var(--color-danger)] transition-colors"
                          >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          </button>
                        </div>
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
                  className="form-input resize-none"
                  placeholder="추가 메모 사항"
                />
              </FormField>
            </div>
          </div>

          {/* ========== 섹션 4: 관련 사건 ========== */}
          <div className="card overflow-hidden">
            <div className="p-5 border-b border-[var(--border-subtle)]">
              <div className="flex items-center justify-between">
                <SectionHeader
                  number={4}
                  title="관련 사건"
                  optional
                />
                <button
                  type="button"
                  onClick={() => setShowAddRelation(!showAddRelation)}
                  className="btn btn-sm btn-ghost"
                >
                  + 추가
                </button>
              </div>
            </div>

            <div className="p-5">
              {showAddRelation && (
                <div className="mb-4 p-4 border border-[var(--border-subtle)] rounded-xl bg-[var(--bg-tertiary)]">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <FormField label="사건 선택">
                      <select
                        value={newRelation.related_case_id}
                        onChange={(e) => setNewRelation({ ...newRelation, related_case_id: e.target.value })}
                        className={selectClassName}
                      >
                        <option value="">선택하세요</option>
                        {allCases.filter(c => c.id !== caseData.id).map(c => (
                          <option key={c.id} value={c.id}>
                            {c.case_name} {c.contract_number ? `(${c.contract_number})` : ''}
                          </option>
                        ))}
                      </select>
                    </FormField>
                    <FormField label="관계 유형">
                      <input
                        type="text"
                        value={newRelation.relation_type}
                        onChange={(e) => setNewRelation({ ...newRelation, relation_type: e.target.value })}
                        placeholder="예: 항소, 상고"
                        className={inputClassName}
                      />
                    </FormField>
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={handleAddRelation}
                        className="btn btn-primary w-full h-11"
                      >
                        추가하기
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {relations.map((relation) => (
                  <div key={relation.id} className="flex items-center justify-between p-3 border border-[var(--border-default)] rounded-lg">
                    <div className="flex items-center gap-2">
                      {relation.relation_type && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-[var(--sage-muted)] text-[var(--sage-primary)] rounded">
                          {relation.relation_type}
                        </span>
                      )}
                      <span className="text-sm text-[var(--text-primary)]">
                        {relation.related_case?.case_name || '사건명 없음'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteRelation(relation.id)}
                      className="btn btn-sm btn-danger-ghost"
                    >
                      삭제
                    </button>
                  </div>
                ))}
                {relations.length === 0 && (
                  <p className="text-center text-[var(--text-muted)] text-sm py-6">관련 사건이 없습니다</p>
                )}
              </div>
            </div>
          </div>

          {/* ========== 하단 버튼 ========== */}
          <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4">
            <Link
              href={`/cases/${caseData.id}`}
              className="btn btn-secondary w-full sm:w-auto justify-center"
            >
              취소
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="btn btn-primary w-full sm:w-auto justify-center"
            >
              {saving ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  저장 중...
                </span>
              ) : (
                '저장'
              )}
            </button>
          </div>
        </form>
      </div>

      {showRoleConfirm && (
        <div className="modal-backdrop">
          <div className="modal-content max-w-sm">
            <div className="p-5">
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">의뢰인 역할 확인</h3>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                의뢰인({selectedClientName || '의뢰인'})과 상대방({formData.opponent_name || '상대방'})의 성씨가 동일합니다.
                의뢰인의 소송상 지위를 선택해주세요.
              </p>

              <div className="mt-4 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="client_role_confirm"
                    value="plaintiff"
                    checked={pendingClientRole === 'plaintiff'}
                    onChange={(e) => {
                      setPendingClientRole(e.target.value as 'plaintiff' | 'defendant')
                      setRoleConfirmError('')
                    }}
                    className="w-4 h-4 text-[var(--sage-primary)] border-[var(--border-default)] focus:ring-[var(--sage-primary)]"
                  />
                  <span className="text-sm font-medium text-[var(--text-secondary)]">원고 (채권자)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="client_role_confirm"
                    value="defendant"
                    checked={pendingClientRole === 'defendant'}
                    onChange={(e) => {
                      setPendingClientRole(e.target.value as 'plaintiff' | 'defendant')
                      setRoleConfirmError('')
                    }}
                    className="w-4 h-4 text-[var(--sage-primary)] border-[var(--border-default)] focus:ring-[var(--sage-primary)]"
                  />
                  <span className="text-sm font-medium text-[var(--text-secondary)]">피고 (채무자)</span>
                </label>
              </div>

              {roleConfirmError && (
                <p className="mt-2 text-sm text-[var(--color-danger)]">{roleConfirmError}</p>
              )}

              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowRoleConfirm(false)
                    setRoleConfirmError('')
                  }}
                  className="btn btn-ghost"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleRoleConfirm}
                  className="btn btn-primary"
                >
                  확인
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
