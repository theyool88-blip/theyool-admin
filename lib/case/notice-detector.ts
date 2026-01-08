/**
 * 사건 알림 감지 로직
 *
 * 6가지 알림 카테고리:
 * 1. 다음기일 안내
 * 2. 기한 관리
 * 3. 준비서면 제출 알람
 * 4. 서류 송달 문제
 * 5. 증거신청 회신 미수령
 * 6. 기일 충돌 경고
 */

import type { CaseNotice, NoticeAction } from '@/types/case-notice'
import type { CourtHearing, CaseDeadline } from '@/types/court-hearing'
import { DEADLINE_TYPE_LABELS, HEARING_TYPE_LABELS } from '@/types/court-hearing'

// SCOURT 문서 타입
interface ScourtDocument {
  ofdocRcptYmd?: string      // 접수일
  content1?: string          // 제출자
  content2?: string          // 서류명
  sbmsnCtt?: string          // 제출내용
  dlvrYmd?: string           // 송달일
  dlvrRchYmd?: string        // 도달일
}

// SCOURT 진행내역 타입
interface ScourtProgress {
  date?: string              // 진행일
  content?: string           // 진행내용
  result?: string            // 결과/도달
  notice?: string            // 고지
}

export interface NoticeDetectorParams {
  caseId: string
  courtName?: string | null
  deadlines: CaseDeadline[]
  hearings: CourtHearing[]
  allHearings: CourtHearing[]  // 모든 사건 기일 (충돌 감지용)
  scourtDocuments?: ScourtDocument[]
  scourtProgress?: ScourtProgress[]
  clientPartyType?: 'plaintiff' | 'defendant' | null
}

/**
 * 사건의 모든 알림을 감지
 */
export function detectCaseNotices(params: NoticeDetectorParams): CaseNotice[] {
  const notices: CaseNotice[] = []

  // 1. 다음기일 안내
  const nextHearingNotice = detectNextHearing(params.hearings)
  if (nextHearingNotice) notices.push(nextHearingNotice)

  // 2. 기한 관리
  const deadlineNotices = detectDeadlines(params.deadlines)
  notices.push(...deadlineNotices)

  // 3. 준비서면 제출 알람
  const briefNotices = detectBriefRequired(
    params.scourtDocuments || [],
    params.hearings,
    params.clientPartyType
  )
  notices.push(...briefNotices)

  // 4. 서류 송달 문제
  const documentNotices = detectDocumentIssues(params.scourtProgress || [])
  notices.push(...documentNotices)

  // 5. 증거신청 회신 미수령
  const evidenceNotices = detectEvidencePending(
    params.scourtDocuments || [],
    params.scourtProgress || [],
    params.hearings
  )
  notices.push(...evidenceNotices)

  // 6. 기일 충돌 경고
  const conflictNotices = detectScheduleConflicts(
    params.caseId,
    params.courtName,
    params.hearings,
    params.allHearings
  )
  notices.push(...conflictNotices)

  return notices
}

// ============================================================================
// 1. 다음기일 안내
// ============================================================================

function detectNextHearing(hearings: CourtHearing[]): CaseNotice | null {
  // 예정된 기일 중 가장 가까운 것
  const scheduled = hearings
    .filter(h => h.status === 'SCHEDULED')
    .sort((a, b) => new Date(a.hearing_date).getTime() - new Date(b.hearing_date).getTime())

  if (scheduled.length === 0) return null

  const next = scheduled[0]
  const hearingDate = new Date(next.hearing_date)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  hearingDate.setHours(0, 0, 0, 0)

  const daysRemaining = Math.ceil((hearingDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  // 이미 지난 기일은 제외
  if (daysRemaining < 0) return null

  const hearingTypeName = HEARING_TYPE_LABELS[next.hearing_type] || next.hearing_type
  const dateStr = formatDate(next.hearing_date)
  const timeStr = formatTime(next.hearing_date)

  let title = `다음 기일: ${hearingTypeName}`
  if (daysRemaining <= 14) {
    title = `${hearingTypeName} D-${daysRemaining}`
  }

  return {
    id: `next_hearing_${next.id}`,
    category: 'next_hearing',
    title,
    description: `${dateStr} ${timeStr} ${next.location || ''}`.trim(),
    dueDate: next.hearing_date,
    daysRemaining,
    metadata: { hearingId: next.id },
  }
}

// ============================================================================
// 2. 기한 관리
// ============================================================================

function detectDeadlines(deadlines: CaseDeadline[]): CaseNotice[] {
  const notices: CaseNotice[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  for (const deadline of deadlines) {
    if (deadline.status === 'COMPLETED') continue

    const deadlineDate = new Date(deadline.deadline_date)
    deadlineDate.setHours(0, 0, 0, 0)
    const daysRemaining = Math.ceil((deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

    const deadlineTypeName = DEADLINE_TYPE_LABELS[deadline.deadline_type] || deadline.deadline_type

    let title: string
    if (daysRemaining < 0) {
      title = `${deadlineTypeName} 기한 초과 (D+${Math.abs(daysRemaining)})`
    } else if (daysRemaining === 0) {
      title = `${deadlineTypeName} 오늘 만료`
    } else {
      title = `${deadlineTypeName} ${daysRemaining}일 남음`
    }

    const triggerDateStr = formatDate(deadline.trigger_date)
    const deadlineDateStr = formatDate(deadline.deadline_date)

    notices.push({
      id: `deadline_${deadline.id}`,
      category: 'deadline',
      title,
      description: `${deadlineDateStr} 까지 (기산일: ${triggerDateStr})`,
      dueDate: deadline.deadline_date,
      daysRemaining,
      metadata: { deadlineId: deadline.id },
    })
  }

  return notices
}

// ============================================================================
// 3. 준비서면 제출 알람
// ============================================================================

function detectBriefRequired(
  documents: ScourtDocument[],
  hearings: CourtHearing[],
  clientPartyType?: 'plaintiff' | 'defendant' | null
): CaseNotice[] {
  const notices: CaseNotice[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // 다음 기일 찾기
  const nextHearing = hearings
    .filter(h => h.status === 'SCHEDULED')
    .sort((a, b) => new Date(a.hearing_date).getTime() - new Date(b.hearing_date).getTime())[0]

  if (!nextHearing) return notices

  const hearingDate = new Date(nextHearing.hearing_date)
  hearingDate.setHours(0, 0, 0, 0)
  const daysUntilHearing = Math.ceil((hearingDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  // 2주(14일) 이내 기일이 아니면 스킵
  if (daysUntilHearing > 14 || daysUntilHearing < 0) return notices

  // 서류 분류 (우리측 / 상대측)
  const briefKeywords = ['준비서면', '답변서', '반박서면', '의견서']
  const ourSide = clientPartyType === 'plaintiff' ? ['원고', '신청인', '채권자'] : ['피고', '피신청인', '채무자']
  const theirSide = clientPartyType === 'plaintiff' ? ['피고', '피신청인', '채무자'] : ['원고', '신청인', '채권자']

  let ourLastBrief: ScourtDocument | null = null
  let theirLastBrief: ScourtDocument | null = null

  for (const doc of documents) {
    const submitter = doc.content1 || ''
    const docName = doc.content2 || doc.sbmsnCtt || ''
    const isBrief = briefKeywords.some(k => docName.includes(k))

    if (!isBrief) continue

    const isOurs = ourSide.some(s => submitter.includes(s))
    const isTheirs = theirSide.some(s => submitter.includes(s))

    if (isOurs) {
      if (!ourLastBrief || (doc.ofdocRcptYmd && doc.ofdocRcptYmd > (ourLastBrief.ofdocRcptYmd || ''))) {
        ourLastBrief = doc
      }
    }
    if (isTheirs) {
      if (!theirLastBrief || (doc.ofdocRcptYmd && doc.ofdocRcptYmd > (theirLastBrief.ofdocRcptYmd || ''))) {
        theirLastBrief = doc
      }
    }
  }

  // 상대방이 서면 제출했는데 우리가 그 이후 제출 안 한 경우
  if (theirLastBrief && (!ourLastBrief || (theirLastBrief.ofdocRcptYmd || '') > (ourLastBrief.ofdocRcptYmd || ''))) {
    const docName = theirLastBrief.content2 || theirLastBrief.sbmsnCtt || '서면'
    const dateStr = theirLastBrief.ofdocRcptYmd ? formatDateFromYYYYMMDD(theirLastBrief.ofdocRcptYmd) : ''

    notices.push({
      id: `brief_response_${theirLastBrief.ofdocRcptYmd || 'unknown'}`,
      category: 'brief_required',
      title: '상대방 서면 제출 → 답변 필요',
      description: `상대방 ${docName} ${dateStr} 접수`,
      dueDate: nextHearing.hearing_date,
      daysRemaining: daysUntilHearing,
    })
  }

  // 기일 2주전인데 서면 제출 없는 경우
  if (!ourLastBrief && daysUntilHearing <= 14) {
    notices.push({
      id: `brief_before_hearing_${nextHearing.id}`,
      category: 'brief_required',
      title: '기일 2주 전 - 준비서면 제출 필요',
      description: `${formatDate(nextHearing.hearing_date)} 기일 예정`,
      dueDate: nextHearing.hearing_date,
      daysRemaining: daysUntilHearing,
    })
  }

  return notices
}

// ============================================================================
// 4. 서류 송달 문제
// ============================================================================

function detectDocumentIssues(progress: ScourtProgress[]): CaseNotice[] {
  const notices: CaseNotice[] = []

  // 송달 반환/불명 감지
  const returnKeywords = ['반환', '반송', '이사불명', '폐문부재', '수취인불명']
  // 보정명령 감지
  const correctionKeywords = ['보정명령', '보정권고']

  let hasCorrection = false
  let correctionDate = ''
  let correctionContent = ''

  for (const item of progress) {
    const content = item.content || ''
    const result = item.result || ''

    // 송달 반환 체크
    if (returnKeywords.some(k => result.includes(k) || content.includes(k))) {
      notices.push({
        id: `document_return_${item.date || 'unknown'}`,
        category: 'document_issue',
        title: '서류 송달 실패',
        description: `${content} - ${result}`,
        dueDate: item.date,
      })
    }

    // 보정명령 체크
    if (correctionKeywords.some(k => content.includes(k))) {
      hasCorrection = true
      correctionDate = item.date || ''
      correctionContent = content
    }
  }

  // 보정명령 후 보정 제출 여부 체크
  if (hasCorrection) {
    const correctionIdx = progress.findIndex(p =>
      correctionKeywords.some(k => (p.content || '').includes(k))
    )

    const hasSubmittedCorrection = progress.slice(correctionIdx + 1).some(p => {
      const content = p.content || ''
      return content.includes('보정') && (content.includes('제출') || content.includes('접수'))
    })

    if (!hasSubmittedCorrection) {
      notices.push({
        id: `correction_pending_${correctionDate}`,
        category: 'document_issue',
        title: '보정명령 미이행',
        description: correctionContent,
        dueDate: correctionDate,
      })
    }
  }

  return notices
}

// ============================================================================
// 5. 증거신청 회신 미수령
// ============================================================================

function detectEvidencePending(
  documents: ScourtDocument[],
  progress: ScourtProgress[],
  hearings: CourtHearing[]
): CaseNotice[] {
  const notices: CaseNotice[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // 다음 기일 찾기
  const nextHearing = hearings
    .filter(h => h.status === 'SCHEDULED')
    .sort((a, b) => new Date(a.hearing_date).getTime() - new Date(b.hearing_date).getTime())[0]

  if (!nextHearing) return notices

  const hearingDate = new Date(nextHearing.hearing_date)
  hearingDate.setHours(0, 0, 0, 0)
  const daysUntilHearing = Math.ceil((hearingDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  // 2주 이내가 아니면 스킵
  if (daysUntilHearing > 14 || daysUntilHearing < 0) return notices

  // 증거신청 키워드
  const evidenceKeywords = ['증거신청', '사실조회', '문서제출명령', '문서송부촉탁', '검증신청']

  // 증거신청 목록 추출
  const evidenceRequests: { name: string; date: string }[] = []

  for (const doc of documents) {
    const docName = doc.content2 || doc.sbmsnCtt || ''
    if (evidenceKeywords.some(k => docName.includes(k))) {
      evidenceRequests.push({
        name: docName,
        date: doc.ofdocRcptYmd || '',
      })
    }
  }

  // 각 증거신청에 대한 회신 여부 체크
  for (const req of evidenceRequests) {
    // 간단한 휴리스틱: 해당 키워드 관련 "회신", "송부", "제출" 등이 있는지
    const hasResponse = progress.some(p => {
      const content = p.content || ''
      const date = p.date || ''

      // 신청 이후 날짜여야 함
      if (date <= req.date) return false

      // 회신 키워드
      return content.includes('회신') ||
        content.includes('송부') ||
        content.includes('회보') ||
        (content.includes('제출') && evidenceKeywords.some(k => content.includes(k)))
    })

    if (!hasResponse) {
      notices.push({
        id: `evidence_pending_${req.date}_${req.name.slice(0, 10)}`,
        category: 'evidence_pending',
        title: '증거신청 회신 미수령',
        description: `${req.name} (${formatDateFromYYYYMMDD(req.date)}) → 회신 대기중`,
        dueDate: nextHearing.hearing_date,
        daysRemaining: daysUntilHearing,
      })
    }
  }

  return notices
}

// ============================================================================
// 6. 기일 충돌 경고
// ============================================================================

function detectScheduleConflicts(
  caseId: string,
  courtName: string | null | undefined,
  hearings: CourtHearing[],
  allHearings: CourtHearing[]
): CaseNotice[] {
  const notices: CaseNotice[] = []

  // 예정된 기일만
  const scheduledHearings = hearings.filter(h => h.status === 'SCHEDULED')

  for (const hearing of scheduledHearings) {
    const hearingDateStr = hearing.hearing_date.split('T')[0] // YYYY-MM-DD

    // 같은 날 다른 사건 기일 찾기
    const conflicts = allHearings.filter(h => {
      if (h.case_id === caseId) return false  // 같은 사건 제외
      if (h.status !== 'SCHEDULED') return false

      const otherDateStr = h.hearing_date.split('T')[0]
      return otherDateStr === hearingDateStr
    })

    for (const conflict of conflicts) {
      // 같은 법원이면 충돌 아님 (이동 필요 없음)
      // 다른 법원이면 충돌
      // courtName은 이 사건의 법원, conflict는 다른 사건이므로 case 정보 필요
      // 여기서는 일단 모든 같은 날 기일을 충돌로 표시하고, 나중에 법원 정보로 필터링

      const conflictActions: NoticeAction[] = [
        { label: '삭제', type: 'dismiss' },
        { label: '변호사 변경', type: 'change_lawyer' },
        { label: '기일변경', type: 'change_date' },
        { label: '복대리인', type: 'deputy' },
      ]

      const hearingTypeName = HEARING_TYPE_LABELS[hearing.hearing_type] || hearing.hearing_type
      const conflictTypeName = HEARING_TYPE_LABELS[conflict.hearing_type] || conflict.hearing_type

      notices.push({
        id: `conflict_${hearing.id}_${conflict.id}`,
        category: 'schedule_conflict',
        title: '기일 충돌',
        description: `${formatDate(hearing.hearing_date)} ${hearingTypeName} vs ${conflictTypeName}`,
        dueDate: hearing.hearing_date,
        actions: conflictActions,
        metadata: {
          hearingId: hearing.id,
          conflictingHearingId: conflict.id,
          conflictingCaseId: conflict.case_id,
        },
      })
    }
  }

  return notices
}

// ============================================================================
// 유틸리티 함수
// ============================================================================

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr)
    return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`
  } catch {
    return dateStr
  }
}

function formatTime(dateStr: string): string {
  try {
    const date = new Date(dateStr)
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  } catch {
    return ''
  }
}

function formatDateFromYYYYMMDD(yyyymmdd: string): string {
  if (!yyyymmdd || yyyymmdd.length !== 8) return yyyymmdd
  return `${yyyymmdd.slice(0, 4)}.${yyyymmdd.slice(4, 6)}.${yyyymmdd.slice(6, 8)}`
}
