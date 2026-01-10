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
import CasePartiesSection from './CasePartiesSection'
import CaseNoticeSection from './case/CaseNoticeSection'
import { detectCaseNotices } from '@/lib/case/notice-detector'
import type { CaseNotice } from '@/types/case-notice'
import ScourtGeneralInfoXml from './scourt/ScourtGeneralInfoXml'
import { getPartyLabels as getPartyLabelsFromSchema, getCaseCategory } from '@/lib/scourt/party-labels'
import { COURTS, getCourtAbbrev } from '@/lib/scourt/court-codes'
import { detectCaseTypeFromApiResponse, detectCaseTypeFromCaseNumber, type ScourtCaseType } from '@/lib/scourt/xml-mapping'
import { normalizeCaseNumber } from '@/lib/scourt/case-number-utils'
import { isMaskedPartyName, normalizePartyLabel } from '@/types/case-party'

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

const PLAINTIFF_SIDE_TYPES = new Set(['plaintiff', 'creditor', 'applicant', 'actor', 'juvenile', 'accused'])
const DEFENDANT_SIDE_TYPES = new Set(['defendant', 'debtor', 'respondent', 'third_debtor'])
const PLAINTIFF_SIDE_LABELS = new Set([
  '원고',
  '채권자',
  '신청인',
  '행위자',
  '보호소년',
  '피고인',
  '피고인명',
  '항소인',
  '상고인',
  '청구인',
].map(label => normalizePartyLabel(label)))
const DEFENDANT_SIDE_LABELS = new Set([
  '피고',
  '채무자',
  '피신청인',
  '제3채무자',
  '피항소인',
  '피상고인',
  '상대방',
  '피청구인',
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
    party_order?: number | null
    is_our_client: boolean
    manual_override?: boolean
    client_id: string | null
    clients?: { id: string; name: string } | null
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
  } | null>(null)
  const [editPartyNameInput, setEditPartyNameInput] = useState('')
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
        setCaseParties(data.parties)
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
        if (showAlert) alert(data.message)
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
  }, [caseData.id, caseData.client_id])

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
    setEditingPartyFromGeneral({ partyId, partyLabel, partyName: currentName })
    setEditPartyNameInput(nameWithoutNumber)
  }, [])

  // 일반 탭 당사자 이름 저장
  const handleSavePartyFromGeneral = useCallback(async () => {
    if (!editingPartyFromGeneral || !editPartyNameInput.trim()) return

    setSavingPartyFromGeneral(true)
    try {
      // 기존 party_name에서 번호 prefix 추출
      const numberPrefixMatch = editingPartyFromGeneral.partyName.match(/^(\d+\.\s*)/)
      const numberPrefix = numberPrefixMatch ? numberPrefixMatch[1] : ''
      const newPartyName = `${numberPrefix}${editPartyNameInput.trim()}`

      const res = await fetch(`/api/admin/cases/${caseData.id}/parties`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partyId: editingPartyFromGeneral.partyId,
          party_name: newPartyName,
        }),
      })

      if (res.ok) {
        await fetchCaseParties()
        setEditingPartyFromGeneral(null)
        setEditPartyNameInput('')
        router.refresh()
      } else {
        const data = await res.json()
        console.error('당사자 수정 실패:', data.error)
      }
    } catch (err) {
      console.error('당사자 수정 중 오류:', err)
    } finally {
      setSavingPartyFromGeneral(false)
    }
  }, [editingPartyFromGeneral, editPartyNameInput, caseData.id, fetchCaseParties, router])

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

  // 알림 감지
  useEffect(() => {
    // SCOURT 문서 데이터를 notice-detector 형식으로 변환
    const scourtDocuments = (scourtSnapshot?.documents || []).map(doc => ({
      ofdocRcptYmd: doc.date,
      content1: doc.submitter,  // 제출자
      content2: doc.content,    // 서류명
    }))

    const notices = detectCaseNotices({
      caseId: caseData.id,
      courtName: caseData.court_name || '',
      deadlines: caseDeadlines,
      hearings: caseHearings,
      allHearings: allHearings,
      // SCOURT 데이터 추가
      scourtProgress: scourtSnapshot?.progress || [],
      scourtDocuments: scourtDocuments,
      clientPartyType: caseData.client_role || null
    })
    setCaseNotices(notices)
  }, [caseData.id, caseData.court_name, caseData.client_role, caseDeadlines, caseHearings, allHearings, scourtSnapshot])

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

  // 당사자 섹션 표시 조건: 의뢰인과 상대방 모두 마스킹 해제된 이름이 있으면 숨김
  const shouldShowPartiesSection = useMemo(() => {
    const parties = caseParties || []

    // 원고측/피고측 구분 헬퍼
    const isPlaintiffSide = (p: typeof parties[0]) =>
      PLAINTIFF_SIDE_TYPES.has(p.party_type) ||
      PLAINTIFF_SIDE_LABELS.has(normalizePartyLabel(p.party_type_label))

    const isDefendantSide = (p: typeof parties[0]) =>
      DEFENDANT_SIDE_TYPES.has(p.party_type) ||
      DEFENDANT_SIDE_LABELS.has(normalizePartyLabel(p.party_type_label))

    // 마스킹 해제된 이름인지 확인 (번호 제거 후 체크)
    const hasUnmaskedName = (p: typeof parties[0]) => !isMaskedPartyName(p.party_name)

    // 원고측에서 마스킹 해제된 당사자 찾기
    const unmaskedPlaintiffSide = parties.find(p => isPlaintiffSide(p) && hasUnmaskedName(p))

    // 피고측에서 마스킹 해제된 당사자 찾기
    const unmaskedDefendantSide = parties.find(p => isDefendantSide(p) && hasUnmaskedName(p))

    // 양측 모두 마스킹 해제된 당사자가 있으면 숨김 (false)
    if (unmaskedPlaintiffSide && unmaskedDefendantSide) {
      return false
    }

    // 그 외에는 표시
    return true
  }, [caseParties])

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
    return info[koreanKey] || (apiKey ? info[apiKey] : undefined)
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

  // 마스킹이 해제된 모든 당사자 (SCOURT 라벨 기반으로 일반탭에 적용)
  const unmaskedPartyOverrides = useMemo(() => {
    return caseParties.filter((party) => {
      return !isMaskedPartyName(party.party_name)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseParties])

  const preferredPartyName = useMemo(() => {
    const normalizePartyName = (name: string) => name.replace(/^\d+\.\s*/, '').trim()
    const unmaskedParties = caseParties.filter(party => !isMaskedPartyName(party.party_name))
    const preferredParty = unmaskedParties.find(party => party.is_our_client) || unmaskedParties[0]

    if (preferredParty) {
      const rawName = preferredParty.clients?.name || preferredParty.party_name
      return normalizePartyName(rawName)
    }

    if (caseData.client?.name) return normalizePartyName(caseData.client.name)
    if (caseData.opponent_name) return normalizePartyName(caseData.opponent_name)
    return ''
  }, [caseParties, caseData.client?.name, caseData.opponent_name])

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
    if (role === 'plaintiff' && caseData.client_role === 'defendant' && caseData.opponent_name) {
      return { name: caseData.opponent_name, isClient: false }
    }
    if (role === 'defendant' && caseData.client_role === 'plaintiff' && caseData.opponent_name) {
      return { name: caseData.opponent_name, isClient: false }
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
    if (caseParties.length === 0) {
      // 당사자 정보 없으면 기존 데이터 사용
      const clientName = caseData.client?.name || '의뢰인'
      const opponentName = caseData.opponent_name || '상대방'
      return `${clientName} v ${opponentName}`
    }

    // 의뢰인 찾기 (is_our_client = true)
    const ourClient = caseParties.find(p => p.is_our_client)
    const ourClientName = ourClient?.clients?.name || ourClient?.party_name || caseData.client?.name || '의뢰인'

    // 상대방 찾기 (의뢰인이 아닌 첫 번째)
    const opponent = caseParties.find(p => !p.is_our_client)
    const opponentName = opponent?.party_name || caseData.opponent_name || '상대방'

    return `${ourClientName} v ${opponentName}`
  }, [caseParties, caseData.client?.name, caseData.opponent_name])

  // 당사자 정보 렌더링 (간소화)
  const renderPartyInfo = () => {
    const partyLabels = getPartyLabels()

    // case_parties 데이터가 있으면 사용
    if (caseParties.length > 0) {
      // "사건본인"으로 시작하는 당사자 제외, party_type_label 기준으로 그룹화
      const labelGroups = new Map<string, typeof caseParties>()

      // 번호 접두사 제거 함수 (예: "1. 정OO" -> "정OO")
      const removeNumberPrefix = (name: string) => name.replace(/^\d+\.\s*/, '')

      // 표준 당사자 라벨 목록 (2026.01.07 보호사건/형사사건 추가)
      const _standardLabels = [
        '원고', '피고', '채권자', '채무자', '신청인', '피신청인',
        '항소인', '피항소인', '상고인', '피상고인',
        // 보호사건
        '행위자', '피해아동', '피해자', '보조인', '보호소년', '조사관',
        // 형사사건
        '피고인', '피고인명',
        // 기타
        '제3채무자', '관련자', '소송관계인'
      ]
      const PARTY_TYPE_LABEL_MAP: Record<string, string> = {
        plaintiff: '원고',
        defendant: '피고',
        creditor: '채권자',
        debtor: '채무자',
        applicant: '신청인',
        respondent: '피신청인',
        third_debtor: '제3채무자',
        // 보호사건 (2026.01.07 추가)
        actor: '행위자',
        victim: '피해아동',
        assistant: '보조인',
        juvenile: '보호소년',
        investigator: '조사관',
        // 형사사건
        accused: '피고인',
        crime_victim: '피해자',
        // 기타
        related: '관련자',
      }

      // 히어로 영역에 표시할 당사자 라벨만 필터링
      // 보호사건: 행위자만, 형사사건: 피고인만, 민사/가사: 원고/피고 등
      const heroPartyLabels = [
        '원고', '피고', '채권자', '채무자', '신청인', '피신청인',
        '항소인', '피항소인', '상고인', '피상고인', '항고인', '상대방',
        '행위자', '보호소년',  // 보호사건 당사자
        '피고인', '피고인명',  // 형사사건 당사자
        '제3채무자'
      ]
      // 소송관계인은 히어로에서 제외 (피해아동, 보조인, 피해자, 조사관 등)

      caseParties
        // 히어로에 표시할 당사자만 필터링 (소송관계인 제외)
        .filter(p => {
          const rawLabel = p.party_type_label || ''
          const normalizedLabel = normalizePartyLabel(rawLabel)
          if (normalizedLabel.startsWith('사건본인')) return false
          // 히어로에 표시할 당사자 타입만
          return heroPartyLabels.includes(normalizedLabel) ||
                 ['plaintiff', 'defendant', 'creditor', 'debtor', 'applicant', 'respondent', 'actor', 'juvenile', 'accused', 'third_debtor'].includes(p.party_type || '')
        })
        .forEach(p => {
          // SCOURT 라벨(party_type_label)을 그대로 사용 (일반탭과 동일)
          const rawLabel = p.party_type_label || ''
          const _normalizedLabel = normalizePartyLabel(rawLabel)
          let label: string

          // party_type_label이 있으면 그대로 사용 (SCOURT 원본 라벨 우선)
          if (rawLabel) {
            label = rawLabel
          }
          // party_type_label이 없으면 party_type 기반 fallback
          else {
            label = PARTY_TYPE_LABEL_MAP[p.party_type || 'plaintiff'] || '기타'
          }

          if (!labelGroups.has(label)) {
            labelGroups.set(label, [])
          }
          labelGroups.get(label)!.push(p)
        })

      // 표시할 그룹 생성
      const groups: { label: string; name: string; isClient: boolean; otherCount: number }[] = []

      labelGroups.forEach((parties, label) => {
        const clientParty = parties.find(p => p.is_our_client)
        const rawName = clientParty
          ? (clientParty.clients?.name || clientParty.party_name)
          : parties[0]?.party_name || '-'
        const displayName = removeNumberPrefix(rawName)
        const otherCount = parties.length - 1

        groups.push({
          label,
          name: displayName,
          isClient: !!clientParty,
          otherCount,
        })
      })

      // 의뢰인을 먼저 정렬
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
                  {group.otherCount > 0 && (
                    <span className="font-normal text-gray-500 ml-1">외 {group.otherCount}</span>
                  )}
                </Link>
              ) : (
                <span className="text-sm font-semibold text-gray-900">
                  {group.name}
                  {group.otherCount > 0 && (
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
                {group.otherCount > 0 && (
                  <span className="text-gray-500 ml-1">외 {group.otherCount}</span>
                )}
              </span>
            </>
          )}
        </div>
      ))
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

            {/* 수정 버튼 */}
            <button
              onClick={() => router.push(`/cases/${caseData.id}/edit`)}
              className="flex items-center gap-2 px-4 py-2.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors text-sm font-medium ml-auto"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              수정
            </button>

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
            {/* 알림 섹션 */}
            <CaseNoticeSection notices={filteredNotices} onDismiss={handleDismissNotice} />

            {/* 심급내용 (원심) - SCOURT */}
            {(() => {
              const linkedCaseIds = new Set((caseData.case_relations || []).map(r => r.related_case_id))
              const linkedCaseNumbers = new Set(
                (caseData.case_relations || [])
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

              return filteredLowerCourt.length > 0 && (
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

            {/* 당사자 - 원고/피고/의뢰인 중 하나라도 없으면 표시 */}
            {shouldShowPartiesSection && (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 flex items-center gap-2">
                  <div className="w-1 h-4 bg-sage-500 rounded-full" />
                  <h3 className="text-sm font-semibold text-gray-900">당사자</h3>
                </div>
                <div className="border-t border-gray-200">
                <CasePartiesSection
                  caseId={caseData.id}
                  courtCaseNumber={caseData.court_case_number}
                  clientId={caseData.client_id}
                  clientName={caseData.client?.name}
                  clientRole={caseData.client_role}
                  opponentName={caseData.opponent_name}
                  onPartiesUpdate={() => {
                    fetchCaseParties()
                    router.refresh()
                  }}
                  scourtParties={(scourtSnapshot?.basicInfo as Record<string, unknown> | undefined)?.parties as Array<{ btprtNm?: string; btprtDvsNm?: string; btprtStndngNm?: string }> || []}
                />
                </div>
              </div>
            )}

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
                clientName={caseData.client?.name}
                opponentName={caseData.opponent_name}
                clientRole={caseData.client_role}
                partyOverrides={unmaskedPartyOverrides}
                representativeOverrides={manualRepresentativeOverrides}
                relatedCaseLinks={relatedCaseLinks}
                onPartyEdit={handlePartyEditFromGeneral}
                caseParties={caseParties}
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
              <h3 className="text-lg font-semibold text-gray-900">당사자 이름 수정</h3>
              <button
                onClick={() => {
                  setEditingPartyFromGeneral(null)
                  setEditPartyNameInput('')
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
            </div>
            <div className="px-6 py-4 bg-gray-50 flex justify-end gap-2">
              <button
                onClick={() => {
                  setEditingPartyFromGeneral(null)
                  setEditPartyNameInput('')
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
