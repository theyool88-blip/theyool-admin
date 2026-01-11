'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { CourtHearing, CaseDeadline } from '@/types/court-hearing'
import {
  HEARING_TYPE_LABELS,
  DEADLINE_TYPE_LABELS,
  HearingType,
  DeadlineType,
} from '@/types/court-hearing'
import UnifiedScheduleModal from './UnifiedScheduleModal'
import AdminHeader from './AdminHeader'
import HearingDetailModal from './HearingDetailModal'
import CasePaymentsModal from './CasePaymentsModal'
import CaseNoticeSection from './case/CaseNoticeSection'
import { detectCaseNotices } from '@/lib/case/notice-detector'
import type { CaseNotice } from '@/types/case-notice'
import ScourtGeneralInfoXml from './scourt/ScourtGeneralInfoXml'
import {
  getPartyLabels as getPartyLabelsFromSchema,
  getCaseCategory,
  isMaskedPartyName,
  normalizePartyLabel,
  normalizePartyNameForMatch,
  PARTY_TYPE_LABELS,
  preservePrefix,
} from '@/types/case-party'
import { COURTS, getCourtAbbrev } from '@/lib/scourt/court-codes'
import { detectCaseTypeFromApiResponse, detectCaseTypeFromCaseNumber, type ScourtCaseType } from '@/lib/scourt/xml-mapping'
import { normalizeCaseNumber } from '@/lib/scourt/case-number-utils'

/**
 * 당사자 유형 정렬 순서 (법적 표시 순서)
 * 원고측/검찰측 → 피고측 순서로 표시
 */
const PARTY_TYPE_ORDER: Record<string, number> = {
  // 원고측 (민사), 검찰측 (형사)
  'plaintiff': 1,
  'creditor': 2,
  'applicant': 3,
  'actor': 4,        // 피해자 (형사)
  // 피고측 (민사), 피고인측 (형사)
  'defendant': 10,
  'debtor': 11,
  'respondent': 12,
  'accused': 13,     // 피고인 (형사) - 피고측
  'juvenile': 14,    // 소년부 - 피고측
  'third_debtor': 15, // 제3채무자
}

interface Client {
  id: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
  birth_date: string | null
  gender: string | null
  notes: string | null
}

interface RelatedCase {
  id: string
  case_id: string
  related_case_id: string
  relation_type: string | null
  relation_type_code?: string | null
  notes: string | null
  related_case?: {
    id: string
    case_name: string
    contract_number: string | null
    status: string
    court_case_number?: string | null
    case_level?: string | null
    case_result?: string | null
  }
}

// 주사건 정보
interface MainCase {
  id: string
  case_name: string
  court_case_number: string | null
  case_level?: string | null
}

interface LegalCase {
  id: string
  contract_number: string | null
  case_name: string
  client_id: string
  status: '진행중' | '종결'
  office: string | null
  contract_date: string | null
  retainer_fee: number | null
  total_received: number | null
  outstanding_balance: number | null
  success_fee_agreement: string | null
  calculated_success_fee: number | null
  court_case_number: string | null
  court_name: string | null
  case_type: string | null
  judge_name: string | null
  notes: string | null
  onedrive_folder_url: string | null
  created_at: string
  updated_at: string
  client?: Client
  case_relations?: RelatedCase[]
  // 주사건 연결
  main_case_id?: string | null
  main_case?: MainCase | null
  case_level?: string | null
  // SCOURT 연동 관련
  enc_cs_no?: string | null
  scourt_wmonid?: string | null
  scourt_case_name?: string | null
  client_role?: 'plaintiff' | 'defendant' | null
  opponent_name?: string | null
  case_result?: string | null
}

interface Schedule {
  id: string
  title: string
  scheduled_date: string
  scheduled_time: string | null
  schedule_type: 'trial' | 'consultation' | 'meeting'
  location: string | null
  description: string | null
}

// 대법원 진행사항 관련 인터페이스
interface ScourtProgressItem {
  date: string
  content: string
  result?: string | null
  // SCOURT 진행구분 코드: 0=법원(검정), 1=기일(파랑), 2=명령(녹색), 3=제출(진빨강), 4=송달(주황)
  progCttDvs?: string
}

interface ScourtHearingItem {
  date: string
  time?: string
  type: string
  location?: string
  result?: string
}

interface ScourtSnapshot {
  id: string
  scrapedAt: string
  caseType?: string
  basicInfo: Record<string, string>
  hearings: ScourtHearingItem[]
  progress: ScourtProgressItem[]
  documents: { date: string; content: string; submitter?: string }[]
  lowerCourt: { courtName?: string; court?: string; caseNo: string; result?: string; resultDate?: string; linkedCaseId?: string | null }[]
  relatedCases: { caseNo: string; caseName?: string; relation?: string; linkedCaseId?: string | null }[]
  rawData?: Record<string, unknown>  // XML 렌더링용 원본 API 데이터
}

interface ScourtSyncStatus {
  lastSync: string | null
  status: string | null
  caseNumber: string | null
  isLinked: boolean
  profileId: string | null
}

interface UnifiedScheduleItem {
  id: string
  type: 'court_hearing' | 'deadline' | 'schedule'
  title: string
  date: string
  datetime?: string
  location?: string | null
  status?: string
  days_until?: number
  subtype?: string
  source: CourtHearing | CaseDeadline | Schedule
}

// 탭 타입 정의
type TabType = 'notice' | 'general' | 'progress'

const PLAINTIFF_SIDE_TYPES = new Set(['plaintiff', 'creditor', 'applicant', 'actor'])
const DEFENDANT_SIDE_TYPES = new Set(['defendant', 'debtor', 'respondent', 'third_debtor', 'accused', 'juvenile'])
const PLAINTIFF_SIDE_LABELS = new Set([
  '원고',
  '채권자',
  '신청인',
  '항고인',
  '항소인',
  '상고인',
  '행위자',
  '청구인',
].map(label => normalizePartyLabel(label)))
const DEFENDANT_SIDE_LABELS = new Set([
  '피고',
  '채무자',
  '피신청인',
  '상대방',
  '피항고인',
  '피항소인',
  '피상고인',
  '보호소년',
  '피고인',
  '피고인명',
  '제3채무자',
  '피청구인',
  '피해아동',
  '피해자',
].map(label => normalizePartyLabel(label)))

export default function CaseDetail({ caseData }: { caseData: LegalCase }) {
  const [_unifiedSchedules, setUnifiedSchedules] = useState<UnifiedScheduleItem[]>([])
  const [_loading, setLoading] = useState(false)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [selectedHearing, setSelectedHearing] = useState<CourtHearing | null>(null)
  const [showHearingModal, setShowHearingModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [reportModal, setReportModal] = useState<{ title: string; report: string; court?: string | null; caseNumber?: string | null; date?: string | null } | null>(null)
  const [paymentTotal, setPaymentTotal] = useState<number | null>(null)

  // 대법원 진행사항 관련 상태
  const [scourtSnapshot, setScourtSnapshot] = useState<ScourtSnapshot | null>(null)
  const [scourtSyncStatus, setScourtSyncStatus] = useState<ScourtSyncStatus | null>(null)
  const [scourtLoading, setScourtLoading] = useState(false)
  const [scourtSyncing, setScourtSyncing] = useState(false)
  const [_scourtOpening, setScourtOpening] = useState(false)
  const [showProgressDetail, setShowProgressDetail] = useState(false)

  // 탭 상태 - Apple 스타일 Segmented Control
  const [activeTab, setActiveTab] = useState<TabType>('notice')

  // 진행내용 필터 상태
  const [progressFilter, setProgressFilter] = useState<'all' | 'hearing' | 'order' | 'submit' | 'delivery' | 'court'>('all')

  // 대법원 연동 모달 상태
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [linkCourtName, setLinkCourtName] = useState('')
  const [linkCaseNumber, setLinkCaseNumber] = useState('')
  const [linkPartyName, setLinkPartyName] = useState('')
  const [showCourtDropdown, setShowCourtDropdown] = useState(false)

  // 심급/관련사건 연동 상태 (사건번호별 로딩 상태)
  const [linkingCases, setLinkingCases] = useState<Set<string>>(new Set())
  const [isLinkingAll, setIsLinkingAll] = useState(false)


  // 법원 필터링
  const filteredCourts = COURTS
    .filter(c => {
      const query = linkCourtName.trim()
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
    .items.slice(0, 10)

  // 나의사건 연동 상태
  const isLinked = !!caseData.enc_cs_no || scourtSyncStatus?.isLinked
  const resolvedScourtCaseType =
    detectCaseTypeFromApiResponse(scourtSnapshot?.rawData || {}) ||
    (scourtSnapshot?.caseType as ScourtCaseType | undefined) ||
    detectCaseTypeFromCaseNumber(caseData.court_case_number || '')

  // 당사자 정보 (사건개요 표시용)
  const [caseParties, setCaseParties] = useState<{
    id: string
    party_name: string
    party_type: string
    party_type_label: string | null
    scourt_label_raw?: string | null
    scourt_name_raw?: string | null
    party_order?: number | null
    is_our_client: boolean
    is_primary?: boolean
    manual_override?: boolean
    client_id: string | null
    clients?: { id: string; name: string } | null
    scourt_party_index?: number | null
  }[]>([])

  const [caseRepresentatives, setCaseRepresentatives] = useState<{
    id: string
    representative_name: string
    representative_type_label: string | null
    law_firm_name: string | null
    is_our_firm: boolean
    manual_override?: boolean
  }[]>([])

  // 변호사 목록 (출석변호사 선택용)
  const [_tenantMembers, setTenantMembers] = useState<{
    id: string
    display_name: string
    role: string
  }[]>([])

  // 출석변호사 변경 중인 기일 ID
  const [_editingLawyerHearingId, setEditingLawyerHearingId] = useState<string | null>(null)

  // 알림 관련 상태
  const [caseNotices, setCaseNotices] = useState<CaseNotice[]>([])
  const [dismissedNoticeIds, setDismissedNoticeIds] = useState<Set<string>>(new Set())
  const [dismissedRelatedCases, setDismissedRelatedCases] = useState<Set<string>>(new Set())

  // 계약서 파일 관련 상태
  const [contractFiles, setContractFiles] = useState<{
    id: string
    file_name: string
    file_path: string
    file_size: number | null
    file_type: string | null
    publicUrl: string
  }[]>([])

  // 일반 탭 당사자 이름 수정 모달 상태
  const [editingPartyFromGeneral, setEditingPartyFromGeneral] = useState<{
    partyId: string
    partyLabel: string
    partyName: string
    isPrimary: boolean
  } | null>(null)
  const [editPartyNameInput, setEditPartyNameInput] = useState('')
  const [editPartyPrimaryInput, setEditPartyPrimaryInput] = useState(false)
  const [pendingPartyEdits, setPendingPartyEdits] = useState<Record<string, {
    partyId: string
    partyLabel: string
    originalName: string
    nextName: string
    isPrimary: boolean
  }>>({})
  const [savingPartyFromGeneral, setSavingPartyFromGeneral] = useState(false)
  const [allHearings, setAllHearings] = useState<CourtHearing[]>([])
  const [caseDeadlines, setCaseDeadlines] = useState<CaseDeadline[]>([])
  const [caseHearings, setCaseHearings] = useState<CourtHearing[]>([])

  const router = useRouter()
  const supabase = createClient()
  const clientDisplayName = caseData.client?.name ? `${caseData.client.name}님` : '의뢰인님'

  // 대법원 스냅샷 조회
  const fetchScourtSnapshot = useCallback(async () => {
    if (!caseData.court_case_number) return

    setScourtLoading(true)
    try {
      const res = await fetch(`/api/admin/scourt/snapshot?caseId=${caseData.id}`)
      const data = await res.json()

      if (data.success) {
        setScourtSnapshot(data.snapshot)
        setScourtSyncStatus(data.syncStatus)
      }
    } catch (error) {
      console.error('스냅샷 조회 실패:', error)
    } finally {
      setScourtLoading(false)
    }
  }, [caseData.id, caseData.court_case_number])

  // 당사자 목록 조회 (사건개요 표시용)
  const fetchCaseParties = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/cases/${caseData.id}/parties`)
      const data = await res.json()
      if (data.parties) {
        // 법적 표시 순서로 정렬 (원고측 → 피고측)
        const sortedParties = [...data.parties].sort((a: typeof data.parties[0], b: typeof data.parties[0]) => {
          const orderA = PARTY_TYPE_ORDER[a.party_type] ?? 99
          const orderB = PARTY_TYPE_ORDER[b.party_type] ?? 99
          if (orderA !== orderB) return orderA - orderB
          return (a.party_order ?? 0) - (b.party_order ?? 0)
        })
        setCaseParties(sortedParties)
      }
      setCaseRepresentatives(data.representatives || [])
    } catch (error) {
      console.error('당사자 조회 실패:', error)
    }
  }, [caseData.id])

  // 심급/관련사건 연동 핸들러
  const handleLinkRelatedCase = useCallback(async (caseInfo: {
    caseNo: string;
    courtName: string;
    relationType: string;
    encCsNo?: string;
  }, showAlert = true): Promise<boolean> => {
    if (!caseInfo.caseNo) {
      if (showAlert) alert('사건번호가 없습니다')
      return false
    }

    // 해당 사건번호를 로딩 상태에 추가
    setLinkingCases(prev => new Set(prev).add(caseInfo.caseNo))
    try {
      // 1. 기존 사건 검색 (정확한 사건번호 매칭)
      const searchRes = await fetch(
        `/api/admin/cases/search?q=${encodeURIComponent(caseInfo.caseNo)}&limit=10`
      )
      const searchData = await searchRes.json()
      // 정확히 일치하는 사건번호 찾기
      const existingCase = (searchData.data || []).find(
        (c: { id?: string; court_case_number?: string }) => c.court_case_number === caseInfo.caseNo
      )

      // 2. link-related API 호출
      const res = await fetch('/api/admin/scourt/link-related', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceCaseId: caseData.id,
          relatedCaseInfo: {
            caseNumber: caseInfo.caseNo,
            courtName: caseInfo.courtName,
            relationType: caseInfo.relationType,
            encCsNo: caseInfo.encCsNo,
          },
          action: existingCase ? 'link_existing' : 'create',
          existingCaseId: existingCase?.id,
          clientId: caseData.client_id,
        }),
      })
      const data = await res.json()

      if (data.success) {
        if (showAlert) {
          alert(data.message)
          // 스냅샷 새로고침하여 linkedCaseId 업데이트 → 알림 자동 제거
          fetchScourtSnapshot()
        }
        return true
      } else {
        if (showAlert) alert(data.error || '연동 실패')
        return false
      }
    } catch (error) {
      console.error('연동 오류:', error)
      if (showAlert) alert('연동 중 오류가 발생했습니다')
      return false
    } finally {
      // 해당 사건번호를 로딩 상태에서 제거
      setLinkingCases(prev => {
        const next = new Set(prev)
        next.delete(caseInfo.caseNo)
        return next
      })
    }
  }, [caseData.id, caseData.client_id, fetchScourtSnapshot])

  // 모두 연결 핸들러
  const handleLinkAllRelatedCases = useCallback(async (cases: Array<{
    caseNo: string;
    courtName: string;
    relationType: string;
    encCsNo?: string;
  }>) => {
    if (cases.length === 0) {
      alert('연결할 사건이 없습니다')
      return
    }

    if (!confirm(`${cases.length}개의 사건을 모두 연결하시겠습니까?`)) {
      return
    }

    setIsLinkingAll(true)
    let successCount = 0
    let failCount = 0

    for (const caseInfo of cases) {
      const success = await handleLinkRelatedCase(caseInfo, false)
      if (success) {
        successCount++
      } else {
        failCount++
      }
    }

    setIsLinkingAll(false)
    router.refresh()
    fetchScourtSnapshot()

    if (failCount === 0) {
      alert(`${successCount}개 사건 연결 완료`)
    } else {
      alert(`연결 완료: ${successCount}개, 실패: ${failCount}개`)
    }
  }, [handleLinkRelatedCase, router, fetchScourtSnapshot])

  // 일반 탭에서 당사자 이름 수정 시작
  const handlePartyEditFromGeneral = useCallback((partyId: string, partyLabel: string, currentName: string) => {
    // 번호 prefix 제거하고 편집 가능한 부분만 추출
    const nameWithoutNumber = currentName.replace(/^\d+\.\s*/, '')
    const existingParty = caseParties.find(party => party.id === partyId)
    const isPrimary = existingParty?.is_primary || false
    setEditingPartyFromGeneral({ partyId, partyLabel, partyName: currentName, isPrimary })
    setEditPartyNameInput(nameWithoutNumber)
    setEditPartyPrimaryInput(isPrimary)
  }, [caseParties])

  // 일반 탭 당사자 이름 저장 (대기열에 추가)
  const handleSavePartyFromGeneral = useCallback(() => {
    if (!editingPartyFromGeneral || !editPartyNameInput.trim()) return

    // 기존 party_name에서 번호 prefix 추출
    const numberPrefixMatch = editingPartyFromGeneral.partyName.match(/^(\d+\.\s*)/)
    const numberPrefix = numberPrefixMatch ? numberPrefixMatch[1] : ''
    const newPartyName = `${numberPrefix}${editPartyNameInput.trim()}`

    setPendingPartyEdits(prev => ({
      ...prev,
      [editingPartyFromGeneral.partyId]: {
        partyId: editingPartyFromGeneral.partyId,
        partyLabel: editingPartyFromGeneral.partyLabel,
        originalName: editingPartyFromGeneral.partyName,
        nextName: newPartyName,
        isPrimary: editPartyPrimaryInput,
      }
    }))

    setEditingPartyFromGeneral(null)
    setEditPartyNameInput('')
    setEditPartyPrimaryInput(false)
  }, [editingPartyFromGeneral, editPartyNameInput, editPartyPrimaryInput])

  const pendingPartyEditList = useMemo(
    () => Object.values(pendingPartyEdits),
    [pendingPartyEdits]
  )

  const handleSaveAllPartyEdits = useCallback(async () => {
    if (pendingPartyEditList.length === 0) return

    setSavingPartyFromGeneral(true)
    try {
      const res = await fetch(`/api/admin/cases/${caseData.id}/parties`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partyUpdates: pendingPartyEditList.map(edit => ({
            partyId: edit.partyId,
            party_name: edit.nextName,
            is_primary: edit.isPrimary,
          })),
        }),
      })

      if (res.ok) {
        setPendingPartyEdits({})
        await fetchCaseParties()
        router.refresh()
      } else {
        const data = await res.json()
        console.error('당사자 일괄 저장 실패:', data.error)
      }
    } catch (err) {
      console.error('당사자 일괄 저장 중 오류:', err)
    } finally {
      setSavingPartyFromGeneral(false)
    }
  }, [pendingPartyEditList, caseData.id, fetchCaseParties, router])

  // 변호사 목록 조회 (출석변호사 선택용)
  const fetchTenantMembers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('tenant_members')
        .select('id, display_name, role')
        .in('role', ['owner', 'lawyer'])
        .order('display_name')

      if (error) throw error
      setTenantMembers(data || [])
    } catch (error) {
      console.error('변호사 목록 조회 실패:', error)
    }
  }, [supabase])

  // 출석변호사 변경
  const _updateAttendingLawyer = async (hearingId: string, lawyerId: string | null) => {
    try {
      const { error } = await supabase
        .from('court_hearings')
        .update({ attending_lawyer_id: lawyerId })
        .eq('id', hearingId)

      if (error) throw error

      // 일정 목록 새로고침
      await fetchAllSchedules()
      setEditingLawyerHearingId(null)
    } catch (error) {
      console.error('출석변호사 변경 실패:', error)
      alert('출석변호사 변경에 실패했습니다.')
    }
  }

  // 대법원 연동 모달 열기
  const openLinkModal = () => {
    setLinkCourtName(getCourtAbbrev(caseData.court_name || ''))
    setLinkCaseNumber(caseData.court_case_number || '')
    setLinkPartyName(preferredPartyName)
    setShowLinkModal(true)
  }

  // 대법원 동기화 실행
  const handleScourtSync = async (params?: { courtName: string; caseNumber: string; partyName: string }) => {
    // 첫 연동 시 모달 표시
    if (!isLinked) {
      if (!params) {
        openLinkModal()
        return
      }
    }

    // 갱신 시에는 기존 데이터 사용
    const courtName = params?.courtName || caseData.court_name
    const caseNumber = params?.caseNumber || caseData.court_case_number
    const partyName = params?.partyName || preferredPartyName || ''

    if (!courtName || !caseNumber) {
      openLinkModal()
      return
    }

    setScourtSyncing(true)
    try {
      const res = await fetch('/api/admin/scourt/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          legalCaseId: caseData.id,
          caseNumber,
          courtName,
          partyName,
          forceRefresh: true,
        }),
      })
      const data = await res.json()

      if (data.success) {
        // 동기화 성공 후 전체 페이지 새로고침
        setShowLinkModal(false)
        // router.refresh()는 클라이언트 상태를 유지하므로 전체 reload 필요
        window.location.reload()
      } else if (data.skipped) {
        // 최근 동기화됨
      } else {
        // 실패 시 모달 재표시
        console.error('동기화 실패:', data.error)
        if (!isLinked) {
          alert(data.error || '연동 실패: 입력 정보를 확인해주세요.')
        } else {
          alert(data.error || '동기화 실패')
        }
      }
    } catch (error) {
      console.error('동기화 실패:', error)
      alert('동기화 중 오류가 발생했습니다.')
    } finally {
      setScourtSyncing(false)
    }
  }

  // 연동 모달에서 확인 클릭
  const handleLinkConfirm = () => {
    if (!linkCaseNumber.trim()) {
      alert('사건번호를 입력해주세요.')
      return
    }
    if (!linkCourtName.trim()) {
      alert('법원명을 입력해주세요.')
      return
    }
    if (!linkPartyName.trim()) {
      alert('당사자명을 입력해주세요.')
      return
    }
    setShowLinkModal(false)
    handleScourtSync({
      courtName: linkCourtName.trim(),
      caseNumber: linkCaseNumber.trim(),
      partyName: linkPartyName.trim(),
    })
  }

  // 종결 처리
  const handleFinalize = async () => {
    if (!confirm('사건을 종결 상태로 변경하시겠습니까?\n종결 후에는 자동 갱신이 중단됩니다.')) return

    try {
      const res = await fetch(`/api/admin/cases/${caseData.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: '종결' })
      })

      if (res.ok) {
        router.refresh()
      } else {
        const data = await res.json()
        alert(data.error || '종결 처리에 실패했습니다.')
      }
    } catch (error) {
      console.error('종결 처리 실패:', error)
      alert('종결 처리 중 오류가 발생했습니다.')
    }
  }

  // 삭제 처리
  const handleDelete = async () => {
    if (!confirm('정말로 이 사건을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.')) return

    try {
      const res = await fetch(`/api/admin/cases/${caseData.id}`, {
        method: 'DELETE'
      })

      if (res.ok) {
        router.push('/cases')
      } else {
        const data = await res.json()
        alert(data.error || '삭제에 실패했습니다.')
      }
    } catch (error) {
      console.error('삭제 실패:', error)
      alert('삭제 중 오류가 발생했습니다.')
    }
  }

  // SCOURT 사건 일반내용 탭 열기 (Puppeteer)
  const _handleOpenScourtCase = async () => {
    if (!caseData.court_case_number) {
      alert('사건번호가 없습니다.')
      return
    }

    setScourtOpening(true)
    try {
      const res = await fetch('/api/admin/scourt/open-case', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseId: caseData.id,
          caseNumber: caseData.court_case_number,
        }),
      })
      const data = await res.json()

      if (!data.success) {
        alert(data.error || '사건 열기 실패')
      }
      // 성공 시 Puppeteer 브라우저 창이 자동으로 열림
    } catch (error) {
      console.error('사건 열기 실패:', error)
      alert('사건 열기 중 오류가 발생했습니다.')
    } finally {
      setScourtOpening(false)
    }
  }

  const fetchAllSchedules = useCallback(async () => {
    // case_id로 조회 - 사건번호 없어도 동작
    if (!caseData.id) return

    try {
      setLoading(true)
      const unified: UnifiedScheduleItem[] = []

      const { data: hearings, error: hearingError } = await supabase
        .from('court_hearings')
        .select(`
          *,
          attending_lawyer:attending_lawyer_id(id, display_name)
        `)
        .eq('case_id', caseData.id)
        .order('hearing_date', { ascending: true })

      if (hearingError) throw hearingError

      const { data: deadlines, error: deadlineError } = await supabase
        .from('case_deadlines')
        .select('*')
        .eq('case_id', caseData.id)
        .order('deadline_date', { ascending: true })

      if (deadlineError) throw deadlineError

      // 알림용 데이터 저장
      setCaseHearings(hearings as CourtHearing[] || [])
      setCaseDeadlines(deadlines as CaseDeadline[] || [])

      // 기일 충돌 감지를 위한 모든 사건 기일 조회 (향후 30일)
      const today = new Date()
      const thirtyDaysLater = new Date(today)
      thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30)

      const { data: allHearingsData } = await supabase
        .from('court_hearings')
        .select(`
          *,
          legal_case:case_id(case_name, court_name)
        `)
        .gte('hearing_date', today.toISOString())
        .lte('hearing_date', thirtyDaysLater.toISOString())
        .eq('status', 'SCHEDULED')
        .order('hearing_date', { ascending: true })

      setAllHearings(allHearingsData as CourtHearing[] || [])

      const { data: schedules } = await supabase
        .from('general_schedules')
        .select('*')
        .eq('case_id', caseData.id)
        .order('schedule_date', { ascending: true })

      if (hearings && hearings.length > 0) {
        hearings.forEach(hearing => {
          const date = new Date(hearing.hearing_date)
          const today = new Date()
          today.setHours(0, 0, 0, 0)
          date.setHours(0, 0, 0, 0)
          const daysUntil = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

          unified.push({
            id: hearing.id,
            type: 'court_hearing',
            title: HEARING_TYPE_LABELS[hearing.hearing_type as HearingType],
            date: hearing.hearing_date.split('T')[0],
            datetime: hearing.hearing_date,
            location: hearing.location,
            status: hearing.status,
            days_until: daysUntil,
            subtype: hearing.hearing_type,
            source: hearing
          })
        })
      }

      if (deadlines) {
        deadlines.forEach(deadline => {
          const date = new Date(deadline.deadline_date)
          const today = new Date()
          today.setHours(0, 0, 0, 0)
          date.setHours(0, 0, 0, 0)
          const daysUntil = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

          unified.push({
            id: deadline.id,
            type: 'deadline',
            title: DEADLINE_TYPE_LABELS[deadline.deadline_type as DeadlineType],
            date: deadline.deadline_date,
            datetime: `${deadline.deadline_date}T00:00:00`,
            status: deadline.status,
            days_until: daysUntil,
            subtype: deadline.deadline_type,
            source: deadline
          })
        })
      }

      if (schedules && schedules.length > 0) {
        schedules.forEach(schedule => {
          const date = new Date(schedule.schedule_date)
          const today = new Date()
          today.setHours(0, 0, 0, 0)
          date.setHours(0, 0, 0, 0)
          const daysUntil = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

          unified.push({
            id: schedule.id,
            type: 'schedule',
            title: schedule.title,
            date: schedule.schedule_date,
            datetime: schedule.schedule_time ? `${schedule.schedule_date}T${schedule.schedule_time}` : undefined,
            location: schedule.location,
            days_until: daysUntil,
            subtype: schedule.schedule_type,
            source: schedule
          })
        })
      }

      unified.sort((a, b) => a.date.localeCompare(b.date))
      setUnifiedSchedules(unified)
    } catch (error) {
      console.error('일정 조회 실패:', error)
      setUnifiedSchedules([])
    } finally {
      setLoading(false)
    }
  }, [caseData.id, supabase])

  useEffect(() => {
    fetchAllSchedules()
  }, [fetchAllSchedules])

  // 대법원 스냅샷 조회
  useEffect(() => {
    fetchScourtSnapshot()
  }, [fetchScourtSnapshot])

  // 당사자 목록 조회
  useEffect(() => {
    fetchCaseParties()
  }, [fetchCaseParties])

  // 변호사 목록 조회
  useEffect(() => {
    fetchTenantMembers()
  }, [fetchTenantMembers])

  useEffect(() => {
    const fetchPayments = async () => {
      const { data, error } = await supabase
        .from('payments')
        .select('amount')
        .eq('case_id', caseData.id)

      if (!error && data) {
        const total = data.reduce((sum, p) => sum + p.amount, 0)
        setPaymentTotal(total)
      }
    }
    fetchPayments()
  }, [caseData.id, supabase])

  // 삭제된 알림 조회
  useEffect(() => {
    const fetchDismissedNotices = async () => {
      try {
        const res = await fetch(`/api/admin/cases/${caseData.id}/notices`)
        const data = await res.json()
        if (data.success && data.dismissedNotices) {
          setDismissedNoticeIds(new Set(data.dismissedNotices))
        }
      } catch (error) {
        console.error('Failed to fetch dismissed notices:', error)
      }
    }
    fetchDismissedNotices()
  }, [caseData.id])

  // 연동안함 관련사건 조회
  useEffect(() => {
    const fetchDismissedRelatedCases = async () => {
      try {
        const res = await fetch(`/api/admin/cases/${caseData.id}/related-cases`)
        const data = await res.json()
        if (data.success && data.dismissedRelatedCases) {
          const dismissedSet = new Set<string>(
            data.dismissedRelatedCases.map((d: { related_case_no: string; related_case_type: string }) =>
              `${d.related_case_type}:${d.related_case_no}`
            )
          )
          setDismissedRelatedCases(dismissedSet)
        }
      } catch (error) {
        console.error('Failed to fetch dismissed related cases:', error)
      }
    }
    fetchDismissedRelatedCases()
  }, [caseData.id])

  // 당사자 표시용 데이터 - 알림 감지에서 사용하므로 먼저 정의
  const displayCaseParties = useMemo(() => {
    if (caseParties.length === 0) return caseParties

    const clientFallbackName = caseData.client?.name?.trim() || ''

    const hasClientFallback = !!clientFallbackName && !isMaskedPartyName(clientFallbackName)

    if (!hasClientFallback) return caseParties

    const clientFirstChar = hasClientFallback
      ? normalizePartyNameForMatch(clientFallbackName).charAt(0)
      : ''

    const charMatchedClient = clientFirstChar
      ? caseParties.filter(p => {
          const rawName = p.party_name || ''
          if (!isMaskedPartyName(rawName)) return false
          const firstChar = normalizePartyNameForMatch(rawName).charAt(0)
          return firstChar && firstChar === clientFirstChar
        })
      : []

    const clientCharMatchId =
      charMatchedClient.length === 1 ? charMatchedClient[0].id : null

    const shouldIgnoreCharMatch = false

    let usedClientFallback = false
    let updated = false

    const resolvePartySide = (party: (typeof caseParties)[number]) => {
      const label = normalizePartyLabel(party.party_type_label || '')
      if (label) {
        if (PLAINTIFF_SIDE_LABELS.has(label)) return 'plaintiff'
        if (DEFENDANT_SIDE_LABELS.has(label)) return 'defendant'
      }
      if (PLAINTIFF_SIDE_TYPES.has(party.party_type)) return 'plaintiff'
      if (DEFENDANT_SIDE_TYPES.has(party.party_type)) return 'defendant'
      return null
    }

    const next = caseParties.map((party) => {
      const clientName = party.clients?.name?.trim()
      if (clientName && !isMaskedPartyName(clientName)) return party
      if (party.party_name && !isMaskedPartyName(party.party_name)) return party

      const side = resolvePartySide(party)
      let fallbackName: string | null = null

      if (!usedClientFallback && hasClientFallback) {
        if (party.is_our_client || (caseData.client_id && party.client_id === caseData.client_id)) {
          fallbackName = clientFallbackName
          usedClientFallback = true
        } else if (caseData.client_role && side === caseData.client_role) {
          fallbackName = clientFallbackName
          usedClientFallback = true
        } else if (!caseData.client_role && !shouldIgnoreCharMatch && clientCharMatchId === party.id) {
          fallbackName = clientFallbackName
          usedClientFallback = true
        }
      }

      if (!fallbackName) return party

      updated = true
      return {
        ...party,
        party_name: preservePrefix(party.party_name || '', fallbackName),
      }
    })

    return updated ? next : caseParties
  }, [caseParties, caseData.client?.name, caseData.client_role, caseData.client_id])

  const casePartiesForDisplay = useMemo(() => {
    const scourtParties = displayCaseParties.filter(
      p => p.scourt_party_index !== null && p.scourt_party_index !== undefined
    )
    return scourtParties.length > 0 ? scourtParties : displayCaseParties
  }, [displayCaseParties])

  const getPartySideFromType = (partyType?: string | null) => {
    if (!partyType) return null
    if (PLAINTIFF_SIDE_TYPES.has(partyType)) return 'plaintiff'
    if (DEFENDANT_SIDE_TYPES.has(partyType)) return 'defendant'
    return null
  }

  const getUnmaskedPartyName = (party?: { party_name?: string | null; clients?: { name?: string | null } | null }) => {
    if (!party) return null
    const clientName = party.clients?.name?.trim() || ''
    if (clientName && !isMaskedPartyName(clientName)) return clientName
    const partyName = party.party_name?.trim() || ''
    if (partyName && !isMaskedPartyName(partyName)) {
      return partyName.replace(/^\d+\.\s*/, '').trim()
    }
    return null
  }

  const primaryParties = useMemo(() => {
    const parties = casePartiesForDisplay
    if (parties.length === 0) {
      return { clientParty: null, opponentParty: null, clientSide: null }
    }

    const primaryBySide = new Map<string, typeof parties[number]>()
    parties.forEach(p => {
      const side = getPartySideFromType(p.party_type)
      if (!side) return
      if (p.is_primary && !primaryBySide.has(side)) {
        primaryBySide.set(side, p)
      }
    })

    let clientSide: 'plaintiff' | 'defendant' | null = caseData.client_role || null
    if (!clientSide) {
      const clientParty = parties.find(p => p.is_our_client)
      clientSide = clientParty ? getPartySideFromType(clientParty.party_type) : null
    }

    const pickSideParty = (side: 'plaintiff' | 'defendant') => {
      return primaryBySide.get(side) || parties.find(p => getPartySideFromType(p.party_type) === side) || null
    }

    const clientParty = clientSide ? pickSideParty(clientSide) : (parties.find(p => p.is_our_client) || parties[0])
    const opponentSide = clientSide ? (clientSide === 'plaintiff' ? 'defendant' : 'plaintiff') : null
    const opponentParty = opponentSide ? pickSideParty(opponentSide) : parties.find(p => !p.is_our_client) || null

    return { clientParty, opponentParty, clientSide }
  }, [casePartiesForDisplay, caseData.client_role])

  // 알림 감지
  useEffect(() => {
    // SCOURT 문서 데이터를 notice-detector 형식으로 변환
    const scourtDocuments = (scourtSnapshot?.documents || []).map(doc => ({
      ofdocRcptYmd: doc.date,
      content1: doc.submitter,  // 제출자
      content2: doc.content,    // 서류명
    }))

    // 미등록 관련사건/심급사건 (linkedCaseId가 없는 것만)
    const unlinkedRelatedCases = (scourtSnapshot?.relatedCases || []).filter(
      (c: { linkedCaseId?: string | null }) => !c.linkedCaseId
    )
    const unlinkedLowerCourt = (scourtSnapshot?.lowerCourt || []).filter(
      (c: { linkedCaseId?: string | null }) => !c.linkedCaseId
    )

    const notices = detectCaseNotices({
      caseId: caseData.id,
      courtName: caseData.court_name || '',
      deadlines: caseDeadlines,
      hearings: caseHearings,
      allHearings: allHearings,
      // SCOURT 데이터 추가
      scourtProgress: scourtSnapshot?.progress || [],
      scourtDocuments: scourtDocuments,
      clientPartyType: caseData.client_role || null,
      // 의뢰인 역할 확인용
      clientRoleStatus: (caseData as { client_role_status?: 'provisional' | 'confirmed' }).client_role_status || null,
      clientName: caseData.client?.name || null,
      opponentName: getUnmaskedPartyName(primaryParties.opponentParty ?? undefined),
      // 미등록 관련사건/심급사건
      unlinkedRelatedCases,
      unlinkedLowerCourt,
    })
    setCaseNotices(notices)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseData.id, caseData.court_name, caseData.client_role, (caseData as { client_role_status?: string }).client_role_status, caseData.client?.name, primaryParties.opponentParty, caseDeadlines, caseHearings, allHearings, scourtSnapshot])

  // 계약서 파일 조회
  useEffect(() => {
    const fetchContractFiles = async () => {
      try {
        const res = await fetch(`/api/admin/cases/${caseData.id}/contracts`)
        const data = await res.json()
        if (data.success) {
          setContractFiles(data.contracts || [])
        }
      } catch (error) {
        console.error('Failed to fetch contract files:', error)
      }
    }
    fetchContractFiles()
  }, [caseData.id])

  // 알림 삭제 핸들러
  const handleDismissNotice = async (notice: CaseNotice) => {
    try {
      const res = await fetch(`/api/admin/cases/${caseData.id}/notices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noticeId: notice.id })
      })
      const data = await res.json()
      if (data.success) {
        setDismissedNoticeIds(prev => new Set([...prev, notice.id]))
      }
    } catch (error) {
      console.error('Failed to dismiss notice:', error)
    }
  }

  // 알림 액션 핸들러 (역할 확정 등)
  const handleNoticeAction = async (notice: CaseNotice, actionType: string, metadata?: { opponentName?: string }) => {
    // 의뢰인 역할 확정 처리
    if (actionType === 'confirm_plaintiff' || actionType === 'confirm_defendant') {
      const newRole = actionType === 'confirm_plaintiff' ? 'plaintiff' : 'defendant'

      try {
        const res = await fetch(`/api/admin/cases/${caseData.id}/client-role`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_role: newRole,
            status: 'confirmed',
          })
        })

        const data = await res.json()
        if (data.success) {
          // 페이지 새로고침으로 업데이트된 데이터 반영
          router.refresh()
        } else {
          console.error('Failed to confirm client role:', data.error)
        }
      } catch (error) {
        console.error('Failed to confirm client role:', error)
      }
      return
    }

    // 기일 충돌 등 다른 액션은 여기서 처리
    console.log('Notice action:', notice.id, actionType)
  }

  // 관련사건 연동안함 핸들러
  const handleDismissRelatedCase = async (caseNo: string, caseType: 'lower_court' | 'related_case') => {
    try {
      const res = await fetch(`/api/admin/cases/${caseData.id}/related-cases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          relatedCaseNo: caseNo,
          relatedCaseType: caseType
        })
      })
      const data = await res.json()
      if (data.success) {
        setDismissedRelatedCases(prev => new Set([...prev, `${caseType}:${caseNo}`]))
      }
    } catch (error) {
      console.error('Failed to dismiss related case:', error)
    }
  }

  // 삭제되지 않은 알림만 필터링
  const filteredNotices = caseNotices.filter(n => !dismissedNoticeIds.has(n.id))

  // 등록되지 않은 의뢰인 감지: 의뢰인 지정됐지만 clients 테이블에 없음
  const isUnregisteredClient = useMemo(() => {
    return caseData.client_id === null && caseParties.some(p => p.is_our_client)
  }, [caseData.client_id, caseParties])

  const formatCurrency = (amount: number | null) => {
    if (!amount) return '-'
    return `${amount.toLocaleString('ko-KR')}원`
  }

  const calculateOutstandingBalance = () => {
    const retainer = caseData.retainer_fee || 0
    const successFee = caseData.calculated_success_fee || 0
    const received = (paymentTotal ?? caseData.total_received) || 0
    return retainer + successFee - received
  }

  const formatDate = (date: string | null) => {
    if (!date) return '-'
    const d = new Date(date)
    const year = String(d.getFullYear()).slice(2)
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}.${month}.${day}`
  }

  const _formatDateTime = (datetime: string) => {
    const d = new Date(datetime)
    const year = String(d.getFullYear()).slice(2)
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const hour = String(d.getHours()).padStart(2, '0')
    const minute = String(d.getMinutes()).padStart(2, '0')
    return `${year}.${month}.${day} ${hour}:${minute}`
  }

  // 진행내용 일자 포맷 (YYYYMMDD -> YY.MM.DD)
  const formatProgressDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    // YYYYMMDD 형식
    if (dateStr.length === 8 && /^\d{8}$/.test(dateStr)) {
      return `${dateStr.slice(2,4)}.${dateStr.slice(4,6)}.${dateStr.slice(6,8)}`
    }
    // YYYY-MM-DD 형식
    if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
      return `${dateStr.slice(2,4)}.${dateStr.slice(5,7)}.${dateStr.slice(8,10)}`
    }
    // YYYY.MM.DD 형식
    if (/^\d{4}\.\d{2}\.\d{2}/.test(dateStr)) {
      return `${dateStr.slice(2,4)}.${dateStr.slice(5,7)}.${dateStr.slice(8,10)}`
    }
    // "YYYY.MM.DD 도달" 같은 형식
    const match = dateStr.match(/(\d{4})\.(\d{2})\.(\d{2})/)
    if (match) {
      return dateStr.replace(match[0], `${match[1].slice(2)}.${match[2]}.${match[3]}`)
    }
    return dateStr
  }

  // basicInfo 필드 조회 헬퍼 (한글/API 필드명 모두 지원)
  const getBasicInfo = (koreanKey: string, apiKey?: string): string | number | undefined => {
    if (!scourtSnapshot?.basicInfo) return undefined
    const info = scourtSnapshot.basicInfo as Record<string, unknown>
    const value = info[koreanKey] || (apiKey ? info[apiKey] : undefined)
    if (typeof value === 'string' || typeof value === 'number') return value
    return undefined
  }

  // 사건 카테고리에 따른 당사자 라벨 결정 (스키마 기반)
  const getPartyLabels = (): { plaintiff: string; defendant: string; isCriminal: boolean } => {
    const courtCaseNum = caseData.court_case_number || ''
    return getPartyLabelsFromSchema(courtCaseNum)
  }

  const relatedCaseLinks = useMemo(() => {
    const linkMap: Record<string, string> = {}
    const relations = caseData.case_relations || []
    relations.forEach((relation) => {
      const relatedNumber = relation.related_case?.court_case_number
      if (!relatedNumber) return
      const normalized = normalizeCaseNumber(relatedNumber)
      if (normalized) {
        linkMap[normalized] = relation.related_case_id
      }
      linkMap[relatedNumber] = relation.related_case_id
    })
    return linkMap
  }, [caseData.case_relations])

  const preferredPartyName = useMemo(() => {
    const normalizePartyName = (name: string) => name.replace(/^\d+\.\s*/, '').trim()
    const unmaskedParties = casePartiesForDisplay.filter(party => !isMaskedPartyName(party.party_name))
    const preferredParty = unmaskedParties.find(party => party.is_our_client) || unmaskedParties[0]

    if (preferredParty) {
      const rawName = preferredParty.clients?.name || preferredParty.party_name
      return normalizePartyName(rawName)
    }

    if (caseData.client?.name) return normalizePartyName(caseData.client.name)
    return ''
  }, [casePartiesForDisplay, caseData.client?.name])

  const manualRepresentativeOverrides = useMemo(() => {
    return caseRepresentatives.filter((rep) => rep.manual_override)
  }, [caseRepresentatives])

  // 진행내용 카테고리 분류 (SCOURT progCttDvs 필드 기반)
  // progCttDvs: 0=법원(검정), 1=기일(파랑), 2=명령(녹색), 3=제출(진빨강), 4=송달(주황)
  const getProgressCategory = (item: ScourtProgressItem): 'hearing' | 'order' | 'submit' | 'delivery' | 'court' => {
    // SCOURT progCttDvs 필드가 있으면 우선 사용
    if (item.progCttDvs !== undefined) {
      switch (item.progCttDvs) {
        case '1': return 'hearing'   // 기일
        case '2': return 'order'     // 명령
        case '3': return 'submit'    // 제출
        case '4': return 'delivery'  // 송달
        case '0':
        default: return 'court'      // 법원/기타
      }
    }

    // progCttDvs 없을 때 폴백: 내용 기반 분류 (기존 데이터 호환)
    const content = item.content || ''
    if (content.includes('송달')) return 'delivery'
    if (content.includes('기일')) return 'hearing'
    if (content.includes('명령')) return 'order'
    if (content.includes('제출')) return 'submit'
    return 'court'
  }

  // 진행내용 색상 결정 (SCOURT와 동일한 색상) - 5색 분류 유지
  // - Blue (#003399): 기일 (progCttDvs=1)
  // - Green (#336633): 명령 (progCttDvs=2)
  // - Dark Red (#660000): 제출 (progCttDvs=3)
  // - Orange (#CC6600): 송달 (progCttDvs=4)
  // - Black (#000000): 법원/기타 (progCttDvs=0)
  const getProgressColor = (item: ScourtProgressItem): string => {
    const category = getProgressCategory(item)
    switch (category) {
      case 'delivery': return '#CC6600'  // 송달
      case 'hearing': return '#003399'   // 기일
      case 'order': return '#336633'     // 명령
      case 'submit': return '#660000'    // 제출
      case 'court': return '#000000'     // 법원/기타
      default: return '#000000'
    }
  }

  // 진행내용 필터링
  const filterProgress = (items: ScourtProgressItem[]) => {
    if (progressFilter === 'all') return items
    return items.filter(item => getProgressCategory(item) === progressFilter)
  }

  // 당사자 이름 조회 (의뢰인 여부 포함)
  const getPartyName = (role: 'plaintiff' | 'defendant', scourtName?: string) => {
    // 1. client_role이 설정된 경우
    const isClient = caseData.client_role === role
    if (isClient && caseData.client?.name) {
      return { name: caseData.client.name, isClient: true }
    }

    // 2. client_role이 없는 경우 - SCOURT 익명화 이름과 의뢰인 이름 매칭 시도
    // 단, parties 배열에서 유일하게 매칭되는 경우에만 적용
    if (!caseData.client_role && caseData.client?.name && scourtName) {
      const clientFirstChar = caseData.client.name.charAt(0)
      // "1. 이OO" 형식에서 이름 추출
      const cleanedScourtName = scourtName.replace(/^\d+\.\s*/, '').trim()
      const scourtFirstChar = cleanedScourtName.charAt(0)

      // parties 배열에서 매칭되는 당사자 수 확인
      interface PartyItem { btprNm?: string }
      const basicInfo = scourtSnapshot?.basicInfo as { parties?: PartyItem[] } | undefined
      const partiesArr = basicInfo?.parties || []
      const matchingParties = partiesArr.filter((p: PartyItem) => {
        const cleaned = (p.btprNm || '').replace(/^\d+\.\s*/, '').trim()
        return cleaned.charAt(0) === clientFirstChar && isMaskedPartyName(cleaned)
      })

      // 유일하게 매칭되는 경우에만 의뢰인으로 표시
      if (matchingParties.length === 1 && clientFirstChar === scourtFirstChar && isMaskedPartyName(cleanedScourtName)) {
        return { name: caseData.client.name, isClient: true }
      }
    }

    if (scourtName) {
      return { name: scourtName, isClient: false }
    }
    return { name: '-', isClient: false }
  }

  // 사건 상태 결정 (SCOURT 데이터 기반)
  const getCaseStatusInfo = () => {
    // 종국결과가 있으면 null 반환 (결과 배지가 별도로 표시되므로 "선고" 불필요)
    if (getBasicInfo('종국결과', 'endRslt') || caseData.case_result) {
      return null
    }
    // 기본 상태
    return caseData.status === '진행중'
      ? { label: '진행중', style: 'bg-sage-50 text-sage-700' }
      : { label: caseData.status, style: 'bg-gray-100 text-gray-500' }
  }

  // 당사자 정보에서 "의뢰인 v 상대방" 문자열 생성
  const _getPartyVsString = useCallback(() => {
    if (casePartiesForDisplay.length === 0) {
      // 당사자 정보 없으면 기존 데이터 사용
      const clientName = caseData.client?.name || '의뢰인'
      const opponentName = '상대방'
      return `${clientName} v ${opponentName}`
    }

    // 의뢰인 찾기 (is_our_client = true)
    const ourClient = casePartiesForDisplay.find(p => p.is_our_client)
    const ourClientName = ourClient?.clients?.name || ourClient?.party_name || caseData.client?.name || '의뢰인'

    // 상대방 찾기 (의뢰인이 아닌 첫 번째)
    const opponent = casePartiesForDisplay.find(p => !p.is_our_client)
    const opponentName = opponent?.party_name || '상대방'

    return `${ourClientName} v ${opponentName}`
  }, [casePartiesForDisplay, caseData.client?.name])

  // 당사자 정보 렌더링 (간소화)
  // 우선순위: case_parties (DB, SCOURT 라벨 반영) > 기존 fallback
  const renderPartyInfo = () => {
    const partyLabels = getPartyLabels()

    // 번호 접두사 제거 함수 (예: "1. 정OO" -> "정OO")
    const removeNumberPrefix = (name: string) => name.replace(/^\d+\.\s*/, '')
    const PARTY_NAME_SUFFIX_REGEX = /\s*외\s*\d+\s*(?:명)?\s*$/

    const resolveCasePartyName = (party: (typeof casePartiesForDisplay)[number]) => {
      const clientName = party.clients?.name?.trim()
      if (clientName && !isMaskedPartyName(clientName)) return clientName
      const partyName = party.party_name?.trim()
      if (partyName && !isMaskedPartyName(partyName)) return removeNumberPrefix(partyName)
      return null
    }

    const applyDisplayName = (originalName: string, fullName: string) => {
      const combined = originalName ? preservePrefix(originalName, fullName) : fullName
      return removeNumberPrefix(combined)
    }

    const getSideFromLabel = (label: string): 'plaintiff' | 'defendant' | null => {
      const normalized = normalizePartyLabel(label)
      if (PLAINTIFF_SIDE_LABELS.has(normalized)) return 'plaintiff'
      if (DEFENDANT_SIDE_LABELS.has(normalized)) return 'defendant'
      return null
    }

    const getCasePartyLabel = (party: (typeof casePartiesForDisplay)[number]) => (
      normalizePartyLabel(
        party.scourt_label_raw ||
        party.party_type_label ||
        PARTY_TYPE_LABELS[party.party_type as keyof typeof PARTY_TYPE_LABELS] ||
        ''
      )
    )

    const getCasePartySide = (party: (typeof casePartiesForDisplay)[number]) => {
      const labelSide = getSideFromLabel(getCasePartyLabel(party))
      if (labelSide) return labelSide
      if (PLAINTIFF_SIDE_TYPES.has(party.party_type)) return 'plaintiff'
      if (DEFENDANT_SIDE_TYPES.has(party.party_type)) return 'defendant'
      return null
    }

    const heroPartyLabels = new Set([
      '원고', '피고', '채권자', '채무자', '신청인', '피신청인',
      '항소인', '피항소인', '상고인', '피상고인', '항고인', '피항고인', '상대방',
      '행위자', '보호소년',
      '피고인', '피고인명',
      '피해아동', '피해자',
      '제3채무자'
    ].map(label => normalizePartyLabel(label)))

    // 1. scourtSnapshot에서 당사자 정보 추출
    //    rawData.dlt_btprtCttLst: 원본 당사자 목록 (btprDvsNm/btprtStndngNm이 실제 라벨)
    //    basicInfo.titRprsPtnr/titRprsRqstr: 대표 라벨 (신청인/피신청인 등)
    interface RawPartyItem {
      btprDvsNm?: string      // 당사자 유형 (basicInfo.parties)
      btprtDvsNm?: string     // 당사자 유형 (rawData.data.dlt_btprtCttLst)
      btprtStndngNm?: string  // 당사자 구분 (대안 필드)
      btprNm?: string         // 이름 (basicInfo.parties)
      btprtNm?: string        // 이름 (rawData.data.dlt_btprtCttLst)
    }
    interface BasicInfoWithLabelsAndParties {
      parties?: RawPartyItem[]
      titRprsPtnr?: string
      titRprsRqstr?: string
    }
    interface RawDataWithParties {
      data?: {
        dlt_btprtCttLst?: RawPartyItem[]
      }
      dlt_btprtCttLst?: RawPartyItem[]
    }
    const scourtBasicInfo = scourtSnapshot?.basicInfo as BasicInfoWithLabelsAndParties | undefined
    const scourtRawData = scourtSnapshot?.rawData as RawDataWithParties | undefined

    // 원본 당사자 목록: rawData.data에서 먼저 시도, 없으면 rawData 직접, 없으면 basicInfo.parties 사용
    const rawParties = scourtRawData?.data?.dlt_btprtCttLst || scourtRawData?.dlt_btprtCttLst || scourtBasicInfo?.parties || []

    const scourtLabelByIndex = new Map<number, string>()
    const scourtLabelByNormalized = new Map<string, string>()

    rawParties.forEach((p, index) => {
      const rawLabel = p.btprtDvsNm || p.btprDvsNm || p.btprtStndngNm || ''
      const normalizedLabel = normalizePartyLabel(rawLabel)
      if (!normalizedLabel || normalizedLabel.startsWith('사건본인')) return
      const displayLabel = rawLabel.trim() || normalizedLabel
      scourtLabelByIndex.set(index, displayLabel)
      if (!scourtLabelByNormalized.has(normalizedLabel)) {
        scourtLabelByNormalized.set(normalizedLabel, displayLabel)
      }
    })

    const heroPartyTypes = new Set([
      'plaintiff',
      'defendant',
      'creditor',
      'debtor',
      'applicant',
      'respondent',
      'actor',
      'juvenile',
      'accused',
      'third_debtor',
    ])

    const getFallbackLabel = (party: (typeof casePartiesForDisplay)[number]) => (
      party.scourt_label_raw ||
      party.party_type_label ||
      PARTY_TYPE_LABELS[party.party_type as keyof typeof PARTY_TYPE_LABELS] ||
      ''
    )

    const getDisplayLabelForParty = (party: (typeof casePartiesForDisplay)[number]) => {
      const fallbackLabel = getFallbackLabel(party)
      const normalizedLabel = normalizePartyLabel(fallbackLabel)
      if (party.scourt_party_index !== null && party.scourt_party_index !== undefined) {
        const scourtLabel = scourtLabelByIndex.get(party.scourt_party_index)
        if (scourtLabel) return scourtLabel
      }
      if (normalizedLabel && scourtLabelByNormalized.has(normalizedLabel)) {
        return scourtLabelByNormalized.get(normalizedLabel) || fallbackLabel
      }
      return fallbackLabel
    }

    if (casePartiesForDisplay.length > 0) {
      const sideGroups: Record<'plaintiff' | 'defendant', (typeof casePartiesForDisplay)[number][]> = {
        plaintiff: [],
        defendant: [],
      }

      casePartiesForDisplay.forEach(party => {
        const displayLabel = getDisplayLabelForParty(party)
        if (!displayLabel) return

        const normalizedLabel = normalizePartyLabel(displayLabel)
        if (normalizedLabel.startsWith('사건본인')) return

        if (!heroPartyLabels.has(normalizedLabel) && !heroPartyTypes.has(party.party_type || '')) {
          return
        }

        const side = getSideFromLabel(displayLabel) || getCasePartySide(party)
        if (!side) return
        sideGroups[side].push(party)
      })

      const resolveSideLabel = (
        side: 'plaintiff' | 'defendant',
        parties: (typeof casePartiesForDisplay)[number][]
      ) => {
        const scourtLabel = side === 'plaintiff'
          ? scourtBasicInfo?.titRprsPtnr?.trim()
          : scourtBasicInfo?.titRprsRqstr?.trim()
        if (scourtLabel) return scourtLabel

        const labelFromParties = parties
          .map(p => getDisplayLabelForParty(p))
          .find(label => !!label)
        if (labelFromParties) return labelFromParties

        return side === 'plaintiff' ? partyLabels.plaintiff : partyLabels.defendant
      }

      const buildSideGroup = (side: 'plaintiff' | 'defendant') => {
        const parties = sideGroups[side]
        if (parties.length === 0) return null

        const label = resolveSideLabel(side, parties)
        if (!label) return null

        const isClientSide = primaryParties.clientSide ? side === primaryParties.clientSide : parties.some(p => p.is_our_client)
        const primaryParty = parties.find(p => p.is_primary)
        const clientParty = parties.find(
          p => p.is_our_client || (caseData.client_id && p.client_id === caseData.client_id)
        )
        const preferredParty = primaryParty || clientParty || parties.find(p => resolveCasePartyName(p)) || parties[0]
        const baseName = preferredParty?.party_name || ''

        let displayName = preferredParty?.party_name || '-'
        if (isClientSide && caseData.client?.name && !isMaskedPartyName(caseData.client.name)) {
          displayName = applyDisplayName(baseName, caseData.client.name)
        } else {
          const resolvedName = preferredParty ? resolveCasePartyName(preferredParty) : null
          if (resolvedName) {
            displayName = applyDisplayName(baseName, resolvedName)
          } else if (preferredParty?.party_name) {
            displayName = removeNumberPrefix(preferredParty.party_name)
          }
        }

        const uniqueNames = new Set<string>()
        parties.forEach(party => {
          let nameForCount = party.party_name || ''
          if (party.is_our_client || (caseData.client_id && party.client_id === caseData.client_id)) {
            if (caseData.client?.name && !isMaskedPartyName(caseData.client.name)) {
              nameForCount = caseData.client.name
            }
          }
          const resolvedName = resolveCasePartyName(party)
          if (resolvedName) {
            nameForCount = resolvedName
          }
          const normalized = normalizePartyNameForMatch(nameForCount)
          if (normalized) uniqueNames.add(normalized)
        })
        const uniqueCount = uniqueNames.size
        const otherCount = Math.max(0, (uniqueCount || parties.length) - 1)

        if (otherCount === 0) {
          displayName = displayName.replace(PARTY_NAME_SUFFIX_REGEX, '').trim() || displayName
        }

        const hasOtherSuffix = PARTY_NAME_SUFFIX_REGEX.test(displayName)

        return {
          label,
          name: displayName,
          isClient: isClientSide,
          otherCount,
          hasOtherSuffix,
        }
      }

      const groups = [buildSideGroup('plaintiff'), buildSideGroup('defendant')]
        .filter((group): group is NonNullable<typeof group> => Boolean(group))

      if (groups.length > 0) {
        groups.sort((a, b) => {
          if (a.isClient && !b.isClient) return -1
          if (!a.isClient && b.isClient) return 1
          return 0
        })

        return groups.map((group, idx) => (
          <div key={idx} className="flex items-center gap-2">
            {group.isClient ? (
              <>
                <span className="text-xs px-2 py-0.5 bg-sage-100 text-sage-700 rounded font-medium">
                  의뢰인 {group.label}
                </span>
                {caseData.client_id ? (
                  <Link
                    href={`/clients/${caseData.client_id}`}
                    className="text-sm font-semibold text-gray-900 hover:text-sage-600 hover:underline"
                  >
                    {group.name}
                    {caseData.client?.phone && (
                      <span className="ml-2 font-normal text-gray-500">{caseData.client.phone}</span>
                    )}
                    {group.otherCount > 0 && !group.hasOtherSuffix && (
                      <span className="font-normal text-gray-500 ml-1">외 {group.otherCount}</span>
                    )}
                  </Link>
                ) : (
                  <span className="text-sm font-semibold text-gray-900">
                    {group.name}
                    {group.otherCount > 0 && !group.hasOtherSuffix && (
                      <span className="font-normal text-gray-500 ml-1">외 {group.otherCount}</span>
                    )}
                  </span>
                )}
              </>
            ) : (
              <>
                <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">{group.label}</span>
                <span className="text-sm text-gray-700">
                  {group.name}
                  {group.otherCount > 0 && !group.hasOtherSuffix && (
                    <span className="text-gray-500 ml-1">외 {group.otherCount}</span>
                  )}
                </span>
              </>
            )}
          </div>
        ))
      }
    }

    // case_parties 데이터가 없으면 기존 로직 사용 (형사사건 포함)
    if (partyLabels.isCriminal) {
      const defendantName = String(getBasicInfo('피고인명', 'dfndtNm') || getBasicInfo('피고', 'rspNm') || '-')
      const isClient = caseData.client_role === 'defendant'
      return (
        <div className="flex items-center gap-2">
          {isClient ? (
            <>
              <span className="text-xs px-2 py-0.5 bg-sage-100 text-sage-700 rounded font-medium">
                의뢰인 {partyLabels.defendant}
              </span>
              <span className="text-sm font-semibold text-gray-900">
                {caseData.client?.name || defendantName}
              </span>
            </>
          ) : (
            <>
              <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">{partyLabels.defendant}</span>
              <span className="text-sm text-gray-700">{defendantName}</span>
            </>
          )}
        </div>
      )
    }

    // SCOURT 스냅샷 기반 fallback
    interface ScourtParty { btprDvsNm?: string; btprNm?: string }
    const partiesBasicInfo = scourtSnapshot?.basicInfo as { parties?: ScourtParty[] } | undefined
    const partiesArray = partiesBasicInfo?.parties || []
    const plaintiffSideLabels = ['원고', '채권자', '신청인', '항고인', '항소인', '상고인']
    const defendantSideLabels = ['피고', '채무자', '피신청인', '상대방', '피항고인', '피항소인', '피상고인']

    // SCOURT 스냅샷에서 당사자 찾기 (라벨과 이름 함께 반환)
    const findPartyByType = (types: string[]): { label: string; name: string } | null => {
      const found = partiesArray.find((p: ScourtParty) =>
        types.some(t => p.btprDvsNm?.includes(t))
      )
      if (found) {
        return { label: found.btprDvsNm || '', name: found.btprNm || '' }
      }
      return null
    }

    const getPlaintiffInfo = (): { label: string; name: string } => {
      // SCOURT 스냅샷에서 원고측 당사자 찾기
      const fromParties = findPartyByType(plaintiffSideLabels)
      if (fromParties?.name) {
        return { label: fromParties.label, name: fromParties.name }
      }
      // basicInfo fallback
      const fromBasicInfo =
        getBasicInfo('채권자', 'crdtNm') ||
        getBasicInfo('신청인', 'aplcNm') ||
        getBasicInfo('원고', 'aplNm')
      if (fromBasicInfo) {
        return { label: partyLabels.plaintiff, name: String(fromBasicInfo) }
      }
      // 첫 번째 당사자 fallback
      if (partiesArray[0]) {
        return { label: partiesArray[0].btprDvsNm || partyLabels.plaintiff, name: partiesArray[0].btprNm || '-' }
      }
      return { label: partyLabels.plaintiff, name: '-' }
    }

    const getDefendantInfo = (): { label: string; name: string } => {
      // SCOURT 스냅샷에서 피고측 당사자 찾기
      const fromParties = findPartyByType(defendantSideLabels)
      if (fromParties?.name) {
        return { label: fromParties.label, name: fromParties.name }
      }
      // basicInfo fallback
      const fromBasicInfo =
        getBasicInfo('채무자', 'dbtNm') ||
        getBasicInfo('피신청인', 'rspNm') ||
        getBasicInfo('피고', 'rspNm')
      if (fromBasicInfo) {
        return { label: partyLabels.defendant, name: String(fromBasicInfo) }
      }
      // 두 번째 당사자 fallback
      if (partiesArray[1]) {
        return { label: partiesArray[1].btprDvsNm || partyLabels.defendant, name: partiesArray[1].btprNm || '-' }
      }
      return { label: partyLabels.defendant, name: '-' }
    }

    const plaintiffData = getPlaintiffInfo()
    const defendantData = getDefendantInfo()
    const plaintiffInfo = getPartyName('plaintiff', plaintiffData.name)
    const defendantInfo = getPartyName('defendant', defendantData.name)

    const parties = [
      { role: 'plaintiff', label: plaintiffData.label, info: plaintiffInfo },
      { role: 'defendant', label: defendantData.label, info: defendantInfo }
    ]

    parties.sort((a, b) => {
      if (a.info.isClient && !b.info.isClient) return -1
      if (!a.info.isClient && b.info.isClient) return 1
      return 0
    })

    return parties.map((party) => (
      <div key={party.role} className="flex items-center gap-2">
        {party.info.isClient ? (
          <>
            <span className="text-xs px-2 py-0.5 bg-sage-100 text-sage-700 rounded font-medium">
              의뢰인 {party.label}
            </span>
            {caseData.client_id ? (
              <Link
                href={`/clients/${caseData.client_id}`}
                className="text-sm font-semibold text-gray-900 hover:text-sage-600 hover:underline"
              >
                {party.info.name}
                {caseData.client?.phone && (
                  <span className="ml-2 font-normal text-gray-500">{caseData.client.phone}</span>
                )}
              </Link>
            ) : (
              <span className="text-sm font-semibold text-gray-900">
                {party.info.name}
              </span>
            )}
          </>
        ) : (
          <>
            <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">{party.label}</span>
            <span className="text-sm text-gray-700">{party.info.name}</span>
          </>
        )}
      </div>
    ))
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader title="사건 상세" subtitle={caseData.case_name} />

      <div className="max-w-4xl mx-auto pt-20 pb-8 px-4">
        {/* Hero Section - Apple 스타일 심플 디자인 */}
        <div className="bg-white rounded-2xl border border-gray-200 p-8 mb-6 shadow-sm">
          {/* 상단: 상태 뱃지들 */}
          <div className="flex items-center gap-2 mb-4">
            {caseData.office && (
              <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
                {caseData.office}
              </span>
            )}
            {(() => {
              const statusInfo = getCaseStatusInfo()
              if (!statusInfo) return null
              return (
                <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${statusInfo.style}`}>
                  {statusInfo.label}
                </span>
              )
            })()}
            {/* 심급 표시 */}
            {(() => {
              const category = getCaseCategory(caseData.court_case_number || '')
              const isApplicationCase = ['신청', '집행', '가사신청'].includes(category)
              if (isApplicationCase || !caseData.case_level || ['신청', '기타'].includes(caseData.case_level)) {
                return null
              }
              return (
                <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
                  {caseData.case_level}
                </span>
              )
            })()}
            {/* 병합구분 표시 */}
            {(() => {
              const mrgrDvs = scourtSnapshot?.basicInfo?.['병합구분'] || scourtSnapshot?.basicInfo?.mrgrDvs
              return mrgrDvs && mrgrDvs !== '없음' && (
                <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
                  {mrgrDvs}
                </span>
              )
            })()}
            {/* 종국결과/확정 뱃지 */}
            {(getBasicInfo('종국결과', 'endRslt') || caseData.case_result) && (
              <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-amber-50 text-amber-700">
                {getBasicInfo('종국결과', 'endRslt') || caseData.case_result}
                {getBasicInfo('종국일', 'endDt') && (
                  <span className="ml-1 opacity-75">({formatProgressDate(String(getBasicInfo('종국일', 'endDt')))})</span>
                )}
              </span>
            )}
            {getBasicInfo('확정일', 'cfrmDt') && (
              <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
                {formatProgressDate(String(getBasicInfo('확정일', 'cfrmDt')))} 확정
              </span>
            )}
          </div>

          {/* 메인 타이틀: 법원 사건번호 */}
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {getCourtAbbrev(caseData.court_name)} {caseData.court_case_number}
          </h1>

          {/* 사건명 */}
          <p className="text-lg text-gray-600 mb-5">
            {getBasicInfo('사건명', 'csNm') || caseData.scourt_case_name || caseData.case_name}
          </p>

          {/* 당사자 정보 - 간소화 */}
          <div className="flex flex-wrap gap-4 mb-6">
            {renderPartyInfo()}
          </div>

          {/* Quick Actions Bar - Apple 스타일 */}
          <div className="flex items-center gap-3 pt-5 border-t border-gray-100">
            {/* 서류 폴더 */}
            {caseData.onedrive_folder_url && (
              <a
                href={caseData.onedrive_folder_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors text-sm font-medium"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M7.71 3.5l1.6 1.5h5.36a1.5 1.5 0 0 1 1.5 1.5v1h2.33a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5H5.5A1.5 1.5 0 0 1 4 17V5a1.5 1.5 0 0 1 1.5-1.5h2.21z"/>
                </svg>
                서류 폴더
              </a>
            )}

            {/* 대법원 갱신/연동 */}
            {isLinked ? (
              <button
                onClick={() => handleScourtSync()}
                disabled={scourtSyncing}
                className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors text-sm font-medium disabled:opacity-50"
              >
                {scourtSyncing ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                )}
                {scourtSyncing ? '갱신 중...' : '갱신'}
              </button>
            ) : (
              <button
                onClick={() => handleScourtSync()}
                disabled={scourtSyncing}
                className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors text-sm font-medium disabled:opacity-50"
              >
                {scourtSyncing ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                  </svg>
                )}
                {scourtSyncing ? '연동 중...' : '대법원 연동'}
              </button>
            )}

            {/* 우측 버튼 그룹 */}
            <div className="flex items-center gap-2 ml-auto">
              {/* 종결 버튼 (진행중일 때만) */}
              {caseData.status === '진행중' && (
                <button
                  onClick={handleFinalize}
                  className="flex items-center gap-2 px-4 py-2.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors text-sm font-medium"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  종결
                </button>
              )}

              {/* 삭제 버튼 */}
              <button
                onClick={handleDelete}
                className="flex items-center gap-2 px-4 py-2.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-xl transition-colors text-sm font-medium"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                삭제
              </button>

              {/* 수정 버튼 */}
              <button
                onClick={() => router.push(`/cases/${caseData.id}/edit`)}
                className="flex items-center gap-2 px-4 py-2.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors text-sm font-medium"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                수정
              </button>
            </div>

            {/* 최종 갱신 시각 */}
            {scourtSyncStatus?.lastSync && (
              <span className="text-xs text-gray-400">
                {(() => {
                  const d = new Date(scourtSyncStatus.lastSync)
                  const now = new Date()
                  const diffMs = now.getTime() - d.getTime()
                  const diffMins = Math.floor(diffMs / 60000)
                  const diffHours = Math.floor(diffMs / 3600000)
                  const diffDays = Math.floor(diffMs / 86400000)

                  if (diffMins < 1) return '방금 전'
                  if (diffMins < 60) return `${diffMins}분 전`
                  if (diffHours < 24) return `${diffHours}시간 전`
                  if (diffDays < 7) return `${diffDays}일 전`
                  return `${d.getMonth() + 1}/${d.getDate()}`
                })()}
              </span>
            )}
          </div>
        </div>

        {/* Segmented Control - Apple 스타일 탭 */}
        <div className="bg-gray-100 p-1 rounded-xl mb-6 inline-flex w-full">
          {[
            { key: 'notice', label: '알림' },
            { key: 'general', label: '일반' },
            { key: 'progress', label: '진행' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as TabType)}
              className={`flex-1 py-2.5 px-4 text-sm font-medium rounded-lg transition-all ${
                activeTab === tab.key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
              {tab.key === 'general' && scourtSnapshot?.rawData && (
                <span className={`ml-1.5 text-xs ${activeTab === tab.key ? 'text-sage-600' : 'text-gray-400'}`}>
                  ●
                </span>
              )}
              {tab.key === 'progress' && scourtSnapshot?.progress && scourtSnapshot.progress.length > 0 && (
                <span className={`ml-1.5 text-xs ${activeTab === tab.key ? 'text-sage-600' : 'text-gray-400'}`}>
                  {scourtSnapshot.progress.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* 탭 콘텐츠 */}
        {/* 알림 탭 */}
        {activeTab === 'notice' && (
          <div className="space-y-4">
            {/* 의뢰인 연락처 미입력 알림 */}
            {caseData.client && !caseData.client.phone && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-amber-800">의뢰인 연락처가 등록되지 않았습니다</p>
                    <p className="text-xs text-amber-600 mt-0.5">알림톡/SMS 발송을 위해 연락처를 입력해주세요</p>
                  </div>
                  <button
                    onClick={() => router.push(`/cases/${caseData.id}/edit`)}
                    className="px-3 py-1.5 bg-amber-600 text-white text-xs font-medium rounded-lg hover:bg-amber-700 transition-colors whitespace-nowrap"
                  >
                    입력하기
                  </button>
                </div>
              </div>
            )}

            {/* 알림 섹션 */}
            <CaseNoticeSection notices={filteredNotices} onAction={handleNoticeAction} onDismiss={handleDismissNotice} />

            {/* 심급내용 (원심) - SCOURT + case_relations */}
            {(() => {
              // case_relations에서 심급 관계 (appeal 타입) 추출
              const appealRelations = (caseData.case_relations || []).filter(
                r => r.relation_type_code === 'appeal'
              )
              const linkedCaseIds = new Set(appealRelations.map(r => r.related_case_id))
              const linkedCaseNumbers = new Set(
                appealRelations
                  .map(r => r.related_case?.court_case_number)
                  .filter(Boolean)
              )
              interface LowerCourtItem { linkedCaseId?: string; caseNo?: string; courtName?: string; court?: string; encCsNo?: string; result?: string; resultDate?: string }
              const filteredLowerCourt = ((scourtSnapshot?.lowerCourt || []) as LowerCourtItem[]).filter(
                (item: LowerCourtItem) => {
                  // 이미 연동됨 → 제외
                  if (item.linkedCaseId && linkedCaseIds.has(item.linkedCaseId)) return false
                  if (item.caseNo && linkedCaseNumbers.has(item.caseNo)) return false
                  // 연동안함 처리됨 → 제외
                  if (item.caseNo && dismissedRelatedCases.has(`lower_court:${item.caseNo}`)) return false
                  return true
                }
              )

              // 미연동 심급사건 목록 (모두연결용)
              const unlinkdLowerCourt = filteredLowerCourt.filter((item: LowerCourtItem) => !item.linkedCaseId)

              // 스냅샷이 비어있어도 case_relations에 심급 관계가 있으면 표시
              const hasAppealData = filteredLowerCourt.length > 0 || appealRelations.length > 0

              return hasAppealData && (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-1 h-4 bg-sage-500 rounded-full" />
                      <h3 className="text-sm font-semibold text-gray-900">심급</h3>
                    </div>
                    {unlinkdLowerCourt.length > 1 && (
                      <button
                        onClick={() => handleLinkAllRelatedCases(
                          unlinkdLowerCourt.map((item: LowerCourtItem) => ({
                            caseNo: item.caseNo || '',
                            courtName: item.courtName || item.court || '',
                            relationType: '하심사건',
                            encCsNo: item.encCsNo,
                          }))
                        )}
                        disabled={isLinkingAll || linkingCases.size > 0}
                        className="text-xs px-3 py-1 bg-sage-600 text-white hover:bg-sage-700 rounded transition-colors disabled:opacity-50"
                      >
                        {isLinkingAll ? '연동 중...' : `모두연결 (${unlinkdLowerCourt.length})`}
                      </button>
                    )}
                  </div>
                  <table className="w-full border-t border-gray-200">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50">
                        <th className="px-5 py-2 text-xs font-medium text-gray-500 text-left">법원</th>
                        <th className="px-5 py-2 text-xs font-medium text-gray-500 text-left">사건번호</th>
                        <th className="px-5 py-2 text-xs font-medium text-gray-500 text-left">결과</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {/* case_relations에서 가져온 이미 연결된 심급사건 */}
                      {appealRelations.map((rel) => (
                        <tr key={`appeal-rel-${rel.id}`} className="hover:bg-gray-50 bg-sage-50/30">
                          <td className="px-5 py-3 text-sm text-gray-700">
                            {rel.related_case?.case_level || rel.relation_type || '-'}
                          </td>
                          <td className="px-5 py-3 text-sm">
                            <button
                              onClick={() => router.push(`/cases/${rel.related_case_id}`)}
                              className="text-sage-600 hover:text-sage-700 font-medium flex items-center gap-1"
                            >
                              {rel.related_case?.court_case_number || rel.related_case?.case_name || '-'}
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.172 13.828a4 4 0 015.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                              </svg>
                            </button>
                          </td>
                          <td className="px-5 py-3 text-sm text-gray-600">
                            {rel.related_case?.case_result || rel.related_case?.status || '-'}
                          </td>
                        </tr>
                      ))}
                      {/* 스냅샷에서 가져온 미연결 심급사건 */}
                      {filteredLowerCourt.map((item: LowerCourtItem, idx: number) => (
                        <tr key={`lower-${idx}`} className="hover:bg-gray-50">
                          <td className="px-5 py-3 text-sm text-gray-700">{item.courtName || item.court || '-'}</td>
                          <td className="px-5 py-3 text-sm">
                            {item.linkedCaseId ? (
                              <button
                                onClick={() => router.push(`/cases/${item.linkedCaseId}`)}
                                className="text-sage-600 hover:text-sage-700 font-medium flex items-center gap-1"
                              >
                                {item.caseNo || '-'}
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.172 13.828a4 4 0 015.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                </svg>
                              </button>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="text-gray-900">{item.caseNo || '-'}</span>
                                <button
                                  onClick={() => handleLinkRelatedCase({
                                    caseNo: item.caseNo || '',
                                    courtName: item.courtName || item.court || '',
                                    relationType: '하심사건',
                                    encCsNo: item.encCsNo,
                                  })}
                                  disabled={linkingCases.has(item.caseNo || '') || isLinkingAll}
                                  className="text-xs px-2 py-0.5 bg-sage-100 text-sage-700 hover:bg-sage-200 rounded transition-colors disabled:opacity-50"
                                >
                                  {linkingCases.has(item.caseNo || '') ? '연동 중...' : '등록'}
                                </button>
                                <button
                                  onClick={() => handleDismissRelatedCase(item.caseNo || '', 'lower_court')}
                                  disabled={isLinkingAll}
                                  className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 hover:bg-gray-200 rounded transition-colors disabled:opacity-50"
                                >
                                  연동안함
                                </button>
                              </div>
                            )}
                          </td>
                          <td className="px-5 py-3 text-sm text-gray-600">
                            {item.resultDate ? `${formatProgressDate(item.resultDate)} ` : ''}
                            {item.result || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            })()}

            {/* 관련사건 - SCOURT */}
            {(() => {
              const linkedCaseIds = new Set((caseData.case_relations || []).map(r => r.related_case_id))
              const linkedCaseNumbers = new Set(
                (caseData.case_relations || [])
                  .map(r => r.related_case?.court_case_number)
                  .filter(Boolean)
              )
              interface RelatedCaseItem { linkedCaseId?: string; caseNo?: string; case_number?: string; caseName?: string; court_name?: string; relation?: string; relation_type?: string; encCsNo?: string }
              const filteredRelatedCases = ((scourtSnapshot?.relatedCases || []) as RelatedCaseItem[]).filter(
                (item: RelatedCaseItem) => {
                  // 이미 연동됨 → 제외
                  if (item.linkedCaseId && linkedCaseIds.has(item.linkedCaseId)) return false
                  if (item.caseNo && linkedCaseNumbers.has(item.caseNo)) return false
                  // 연동안함 처리됨 → 제외
                  const caseNo = item.caseNo || item.case_number
                  if (caseNo && dismissedRelatedCases.has(`related_case:${caseNo}`)) return false
                  return true
                }
              )

              // 미연동 관련사건 목록 (모두연결용)
              const unlinkedRelatedCases = filteredRelatedCases.filter((item: RelatedCaseItem) => !item.linkedCaseId)

              return filteredRelatedCases.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-1 h-4 bg-sage-500 rounded-full" />
                      <h3 className="text-sm font-semibold text-gray-900">관련사건</h3>
                    </div>
                    {unlinkedRelatedCases.length > 1 && (
                      <button
                        onClick={() => handleLinkAllRelatedCases(
                          unlinkedRelatedCases.map((item: RelatedCaseItem) => ({
                            caseNo: item.caseNo || item.case_number || '',
                            courtName: item.caseName || item.court_name || '',
                            relationType: item.relation || item.relation_type || '관련사건',
                            encCsNo: item.encCsNo,
                          }))
                        )}
                        disabled={isLinkingAll || linkingCases.size > 0}
                        className="text-xs px-3 py-1 bg-sage-600 text-white hover:bg-sage-700 rounded transition-colors disabled:opacity-50"
                      >
                        {isLinkingAll ? '연동 중...' : `모두연결 (${unlinkedRelatedCases.length})`}
                      </button>
                    )}
                  </div>
                  <table className="w-full border-t border-gray-200">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50">
                        <th className="px-5 py-2 text-xs font-medium text-gray-500 text-left w-24">구분</th>
                        <th className="px-5 py-2 text-xs font-medium text-gray-500 text-left">법원</th>
                        <th className="px-5 py-2 text-xs font-medium text-gray-500 text-left">사건번호</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredRelatedCases.map((item: RelatedCaseItem, idx: number) => (
                        <tr key={`related-${idx}`} className="hover:bg-gray-50">
                          <td className="px-5 py-3 text-sm text-sage-600 font-medium">{item.relation || item.relation_type || '관련사건'}</td>
                          <td className="px-5 py-3 text-sm text-gray-700">{item.caseName || item.court_name || '-'}</td>
                          <td className="px-5 py-3 text-sm">
                              {item.linkedCaseId ? (
                                <button
                                  onClick={() => router.push(`/cases/${item.linkedCaseId}`)}
                                  className="text-sage-600 hover:text-sage-700 font-medium flex items-center gap-1"
                                >
                                  {item.caseNo || item.case_number || '-'}
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.172 13.828a4 4 0 015.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                  </svg>
                                </button>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <span className="text-gray-900">{item.caseNo || item.case_number || '-'}</span>
                                  <button
                                    onClick={() => handleLinkRelatedCase({
                                      caseNo: item.caseNo || item.case_number || '',
                                      courtName: item.caseName || item.court_name || '',
                                      relationType: item.relation || item.relation_type || '관련사건',
                                      encCsNo: item.encCsNo,
                                    })}
                                    disabled={linkingCases.has(item.caseNo || item.case_number || '') || isLinkingAll}
                                    className="text-xs px-2 py-0.5 bg-sage-100 text-sage-700 hover:bg-sage-200 rounded transition-colors disabled:opacity-50"
                                  >
                                    {linkingCases.has(item.caseNo || item.case_number || '') ? '연동 중...' : '등록'}
                                  </button>
                                  <button
                                    onClick={() => handleDismissRelatedCase(item.caseNo || item.case_number || '', 'related_case')}
                                    disabled={isLinkingAll}
                                    className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 hover:bg-gray-200 rounded transition-colors disabled:opacity-50"
                                  >
                                    연동안함
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                </div>
              )
            })()}

            {/* 계약 */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* 헤더 */}
              <div className="px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-4 bg-sage-500 rounded-full" />
                  <h3 className="text-sm font-semibold text-gray-900">계약</h3>
                  <span className="text-xs text-gray-500">({caseData.contract_number || '관리번호 없음'})</span>
                </div>
                <button
                  onClick={() => setShowPaymentModal(true)}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-sage-600 hover:bg-sage-700 rounded-lg"
                >
                  입금 관리
                </button>
              </div>

              {/* 등록되지 않은 의뢰인 알림 */}
              {isUnregisteredClient && (
                <div className="border-t border-gray-200 px-4 py-3 bg-gray-50">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-600">등록되지 않은 의뢰인입니다</p>
                    <button
                      onClick={() => setShowPaymentModal(true)}
                      className="text-sm text-sage-600 hover:text-sage-700 font-medium"
                    >
                      계약 추가하기+
                    </button>
                  </div>
                </div>
              )}

              {/* 테이블 */}
              <div className="border-t border-gray-200 text-sm">
                <div className="grid grid-cols-4 border-b border-gray-100">
                  <div className="px-4 py-2 bg-gray-50 text-gray-500 text-xs">계약일</div>
                  <div className="px-4 py-2">{formatDate(caseData.contract_date)}</div>
                  <div className="px-4 py-2 bg-gray-50 text-gray-500 text-xs">의뢰인</div>
                  <div className="px-4 py-2">
                    <button className="text-sage-600 hover:underline" onClick={() => caseData.client && router.push(`/clients/${caseData.client_id}`)}>
                      {caseData.client?.name || '-'}
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-4 border-b border-gray-100">
                  <div className="px-4 py-2 bg-gray-50 text-gray-500 text-xs">착수금</div>
                  <div className="px-4 py-2 font-medium">{formatCurrency(caseData.retainer_fee)}</div>
                  <div className="px-4 py-2 bg-gray-50 text-gray-500 text-xs">성공보수</div>
                  <div className="px-4 py-2 font-medium">{formatCurrency(caseData.calculated_success_fee)}</div>
                </div>
                <div className="grid grid-cols-4 border-b border-gray-100">
                  <div className="px-4 py-2 bg-gray-50 text-gray-500 text-xs">입금액</div>
                  <div className="px-4 py-2 font-medium">{formatCurrency(paymentTotal ?? caseData.total_received)}</div>
                  <div className={`px-4 py-2 text-gray-500 text-xs ${calculateOutstandingBalance() > 0 ? 'bg-coral-50' : 'bg-gray-50'}`}>미수금</div>
                  <div className={`px-4 py-2 font-medium ${calculateOutstandingBalance() > 0 ? 'bg-coral-50 text-coral-600' : ''}`}>
                    {formatCurrency(calculateOutstandingBalance())}
                  </div>
                </div>
                {caseData.success_fee_agreement && (
                  <div className="grid grid-cols-4 border-b border-gray-100">
                    <div className="px-4 py-2 bg-gray-50 text-gray-500 text-xs">성공보수약정</div>
                    <div className="px-4 py-2 col-span-3">{caseData.success_fee_agreement}</div>
                  </div>
                )}
                {contractFiles.length > 0 && (
                  <div className="grid grid-cols-4">
                    <div className="px-4 py-2 bg-gray-50 text-gray-500 text-xs">계약서</div>
                    <div className="px-4 py-2 col-span-3 space-y-1">
                      {contractFiles.map((file) => (
                        <a
                          key={file.id}
                          href={file.publicUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-sage-600 hover:underline"
                        >
                          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                          </svg>
                          {file.file_name}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 메모 */}
            {caseData.notes && (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 flex items-center gap-2">
                  <div className="w-1 h-4 bg-sage-500 rounded-full" />
                  <h3 className="text-sm font-semibold text-gray-900">메모</h3>
                </div>
                <div className="px-4 pb-4">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{caseData.notes}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 일반 탭 - SCOURT 일반내용 (XML 기반) */}
        {activeTab === 'general' && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            {pendingPartyEditList.length > 0 && (
              <div className="mb-4 rounded-lg border border-sage-100 bg-sage-50 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm text-sage-700">
                  당사자 수정 대기 {pendingPartyEditList.length}건
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPendingPartyEdits({})}
                    disabled={savingPartyFromGeneral}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-sage-200 text-sage-700 hover:bg-sage-100 disabled:opacity-50"
                  >
                    비우기
                  </button>
                  <button
                    onClick={handleSaveAllPartyEdits}
                    disabled={savingPartyFromGeneral}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-sage-600 text-white hover:bg-sage-700 disabled:opacity-50"
                  >
                    {savingPartyFromGeneral ? '저장 중...' : '모두 저장'}
                  </button>
                </div>
              </div>
            )}
            {!caseData.court_case_number ? (
              <div className="py-12 text-center text-gray-400">
                사건번호를 먼저 등록해주세요
              </div>
            ) : scourtLoading ? (
              <div className="py-12 text-center text-gray-400">로딩 중...</div>
            ) : !(isLinked || scourtSyncStatus?.isLinked) ? (
              <div className="py-12 text-center">
                <p className="text-gray-400 mb-4">대법원 연동이 필요합니다</p>
              </div>
            ) : !scourtSnapshot?.rawData ? (
              <div className="py-12 text-center">
                <p className="text-gray-400 mb-4">일반내용 데이터가 없습니다</p>
                <p className="text-gray-400 text-sm">사건을 다시 동기화해주세요</p>
              </div>
            ) : (
              <ScourtGeneralInfoXml
                apiData={scourtSnapshot.rawData}
                caseType={resolvedScourtCaseType}
                caseNumber={caseData.court_case_number || undefined}
                representativeOverrides={manualRepresentativeOverrides}
                relatedCaseLinks={relatedCaseLinks}
                onPartyEdit={handlePartyEditFromGeneral}
                caseParties={casePartiesForDisplay}
              />
            )}
          </div>
        )}

        {/* 진행 탭 - 5색 분류 유지 */}
        {activeTab === 'progress' && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            {!caseData.court_case_number ? (
              <div className="py-12 text-center text-gray-400">
                사건번호를 먼저 등록해주세요
              </div>
            ) : scourtLoading ? (
              <div className="py-12 text-center text-gray-400">로딩 중...</div>
            ) : !(isLinked || scourtSyncStatus?.isLinked) ? (
              <div className="py-12 text-center">
                <p className="text-gray-400 mb-4">대법원 연동이 필요합니다</p>
                <button
                  onClick={() => handleScourtSync()}
                  disabled={scourtSyncing}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-sage-600 text-white rounded-lg hover:bg-sage-700 transition-colors text-sm font-medium disabled:opacity-50"
                >
                  대법원 연동하기
                </button>
              </div>
            ) : !scourtSnapshot || !scourtSnapshot.progress || scourtSnapshot.progress.length === 0 ? (
              <div className="py-12 text-center text-gray-400">
                진행내용이 없습니다
              </div>
            ) : (
              <>
                {/* 필터 탭 */}
                <div className="flex flex-wrap gap-2 mb-5">
                  {[
                    { key: 'all', label: '전체' },
                    { key: 'hearing', label: '기일', color: '#003399' },
                    { key: 'order', label: '명령', color: '#336633' },
                    { key: 'submit', label: '제출', color: '#660000' },
                    { key: 'delivery', label: '송달', color: '#CC6600' },
                    { key: 'court', label: '법원', color: '#000000' },
                  ].map(tab => {
                    const isActive = progressFilter === tab.key
                    const count = tab.key === 'all'
                      ? scourtSnapshot.progress.length
                      : scourtSnapshot.progress.filter(item => getProgressCategory(item) === tab.key).length

                    if (tab.key !== 'all' && count === 0) return null

                    return (
                      <button
                        key={tab.key}
                        onClick={() => {
                          setProgressFilter(tab.key as typeof progressFilter)
                          setShowProgressDetail(false)
                        }}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                          isActive
                            ? 'text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                        style={isActive && tab.color ? { backgroundColor: tab.color } : isActive ? { backgroundColor: '#87A96B' } : {}}
                      >
                        {tab.label}
                        <span className={`ml-1 ${isActive ? 'opacity-80' : 'text-gray-400'}`}>
                          {count}
                        </span>
                      </button>
                    )
                  })}
                </div>

                {/* 진행내용 테이블 */}
                {(() => {
                  const filteredItems = filterProgress(scourtSnapshot.progress)
                  const displayItems = showProgressDetail ? filteredItems : filteredItems.slice(0, 15)

                  return filteredItems.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200">
                            <th className="py-2 px-3 text-left text-gray-500 font-medium w-24">일자</th>
                            <th className="py-2 px-3 text-left text-gray-500 font-medium">내용</th>
                            <th className="py-2 px-3 text-left text-gray-500 font-medium w-24">결과</th>
                          </tr>
                        </thead>
                        <tbody>
                          {displayItems.map((item, idx) => {
                            const textColor = getProgressColor(item)
                            return (
                              <tr key={idx} className="border-b border-gray-100 last:border-0">
                                <td className="py-2.5 px-3 font-medium whitespace-nowrap" style={{ color: textColor }}>{formatProgressDate(item.date)}</td>
                                <td className="py-2.5 px-3 leading-relaxed" style={{ color: textColor }}>{item.content || '-'}</td>
                                <td className="py-2.5 px-3" style={{ color: textColor }}>{item.result ? formatProgressDate(item.result) : '-'}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                      {!showProgressDetail && filteredItems.length > 15 && (
                        <button
                          onClick={() => setShowProgressDetail(true)}
                          className="w-full py-3 text-sm text-sage-600 hover:text-sage-700 hover:bg-gray-50 transition-colors mt-2 border-t border-gray-100 font-medium"
                        >
                          + {filteredItems.length - 15}건 더보기
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="py-8 text-center text-gray-400 text-sm">
                      해당 카테고리의 진행내용이 없습니다.
                    </div>
                  )
                })()}
              </>
            )}
          </div>
        )}

      </div>

      {/* Unified Schedule Modal */}
      <UnifiedScheduleModal
        isOpen={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        onSuccess={() => {
          fetchAllSchedules()
          setShowScheduleModal(false)
        }}
        prefilledCaseId={caseData.id}
        prefilledCaseNumber={caseData.court_case_number || undefined}
      />

      <HearingDetailModal
        isOpen={showHearingModal}
        onClose={() => {
          setShowHearingModal(false)
          setSelectedHearing(null)
        }}
        onSuccess={() => {
          fetchAllSchedules()
        }}
        hearing={selectedHearing}
      />

      {/* Report Modal */}
      {reportModal && (
        <div className="fixed inset-0 z-[20050] flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl border border-gray-200 overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="relative px-6 pt-4 pb-3 flex items-center justify-center border-b border-gray-100">
              <Image
                src="/images/logo-horizontal.png"
                alt="법무법인 더율 로고"
                width={110}
                height={22}
                className="h-5 w-auto"
                priority
              />
              <button
                onClick={() => setReportModal(null)}
                className="absolute top-3 right-3 p-1 text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="닫기"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-8 py-8 text-sm text-gray-900 leading-relaxed space-y-4">
              <div className="text-center">
                <p className="text-lg font-bold">변론기일진행보고서</p>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex gap-4">
                  <span className="w-14 text-gray-500">수신</span>
                  <span>{clientDisplayName}</span>
                </div>
                <div className="flex gap-4">
                  <span className="w-14 text-gray-500">발신</span>
                  <span>법무법인 더율 담당 변호사</span>
                </div>
                <div className="flex gap-4">
                  <span className="w-14 text-gray-500">사안</span>
                  <span>{`${reportModal.court || '해당법원'} ${reportModal.caseNumber || '해당사건번호'}`}</span>
                </div>
                <div className="flex gap-4">
                  <span className="w-14 text-gray-500">변론기일</span>
                  <span>{reportModal.date ? (() => {
                    const d = new Date(reportModal.date)
                    return `${String(d.getFullYear()).slice(2)}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
                  })() : '-'}</span>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4 space-y-3">
                <p>
                  {clientDisplayName.replace('님', '')}님이 의뢰하신 위 사건에 대하여 다음과 같이 변론기일보고를 드립니다.
                </p>

                <p className="text-center font-semibold">다음</p>

                <div className="whitespace-pre-wrap min-h-[160px]">
                  {reportModal.report || '등록된 보고서가 없습니다.'}
                </div>

                <p className="text-center text-gray-500">
                  {reportModal.date ? (() => {
                    const d = new Date(reportModal.date)
                    return `${String(d.getFullYear()).slice(2)}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
                  })() : ''}
                </p>

                <div className="text-right mt-6 space-y-1">
                  <div className="inline-flex items-center justify-end gap-2">
                    <p className="font-bold">법무법인 더율</p>
                    <Image
                      src="/images/stamp-lawfirm.svg"
                      alt="법무법인 더율 법인인감"
                      width={48}
                      height={48}
                      className="h-12 w-12"
                    />
                  </div>
                  <p className="text-xs text-gray-500">담당 변호사</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Case Payments Modal */}
      <CasePaymentsModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        caseId={caseData.id}
        caseName={caseData.case_name}
        clientName={caseData.client?.name}
      />

      {/* 대법원 연동 모달 */}
      {showLinkModal && (
        <div className="fixed inset-0 z-[20050] flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white w-full max-w-md rounded-2xl border border-gray-200 overflow-hidden shadow-xl">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">대법원 연동</h3>
              <button
                onClick={() => setShowLinkModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* 사건번호 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  사건번호 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={linkCaseNumber}
                  onChange={(e) => setLinkCaseNumber(e.target.value)}
                  placeholder="2024드단12345"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-transparent"
                />
              </div>

              {/* 법원명 */}
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  법원 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={linkCourtName}
                  onChange={(e) => {
                    setLinkCourtName(e.target.value)
                    setShowCourtDropdown(true)
                  }}
                  onFocus={() => setShowCourtDropdown(true)}
                  onBlur={() => setTimeout(() => setShowCourtDropdown(false), 150)}
                  placeholder="검색 또는 선택..."
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-transparent"
                />
                {showCourtDropdown && filteredCourts.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                    {filteredCourts.map(c => (
                      <div
                        key={c.code}
                        className="px-3 py-2 text-sm cursor-pointer hover:bg-sage-50 text-gray-900"
                        onMouseDown={() => {
                          setLinkCourtName(getCourtAbbrev(c.name))
                          setShowCourtDropdown(false)
                        }}
                      >
                        {getCourtAbbrev(c.name)}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 당사자명 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  당사자명 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={linkPartyName}
                  onChange={(e) => setLinkPartyName(e.target.value)}
                  placeholder="원고 또는 피고 이름"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-transparent"
                  onKeyDown={(e) => e.key === 'Enter' && handleLinkConfirm()}
                />
                <p className="mt-1.5 text-xs text-gray-500">
                  대법원 나의사건검색에서 사건을 찾기 위한 당사자명입니다.
                </p>
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 flex justify-end gap-2">
              <button
                onClick={() => setShowLinkModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleLinkConfirm}
                disabled={scourtSyncing || !linkCaseNumber.trim() || !linkCourtName.trim() || !linkPartyName.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-sage-600 rounded-xl hover:bg-sage-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {scourtSyncing && (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                {scourtSyncing ? '연동 중...' : '연동하기'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 일반 탭 당사자 이름 수정 모달 */}
      {editingPartyFromGeneral && (
        <div className="fixed inset-0 z-[20050] flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white w-full max-w-md rounded-2xl border border-gray-200 overflow-hidden shadow-xl">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">당사자 수정</h3>
              <button
                onClick={() => {
                  setEditingPartyFromGeneral(null)
                  setEditPartyNameInput('')
                  setEditPartyPrimaryInput(false)
                }}
                className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {editingPartyFromGeneral.partyLabel}
                </label>
                <p className="text-xs text-gray-500 mb-2">
                  현재: {editingPartyFromGeneral.partyName}
                </p>
                <input
                  type="text"
                  value={editPartyNameInput}
                  onChange={(e) => setEditPartyNameInput(e.target.value)}
                  placeholder="실제 이름을 입력하세요"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-transparent"
                  autoFocus
                />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <input
                    id="party-primary"
                    type="checkbox"
                    checked={editPartyPrimaryInput}
                    onChange={(e) => setEditPartyPrimaryInput(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-sage-600 focus:ring-sage-500"
                  />
                  <label htmlFor="party-primary" className="text-sm text-gray-700">
                    대표로 표시
                  </label>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  같은 측의 대표 당사자로 표시됩니다.
                </p>
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 flex justify-end gap-2">
              <button
                onClick={() => {
                  setEditingPartyFromGeneral(null)
                  setEditPartyNameInput('')
                  setEditPartyPrimaryInput(false)
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleSavePartyFromGeneral}
                disabled={savingPartyFromGeneral || !editPartyNameInput.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-sage-600 rounded-xl hover:bg-sage-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {savingPartyFromGeneral && (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                {savingPartyFromGeneral ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
