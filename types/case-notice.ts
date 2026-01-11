/**
 * 사건 알림 타입 정의
 *
 * 8가지 알림 카테고리:
 * 1. 다음기일 안내
 * 2. 기한 관리 (상소기한, 보정명령 기한)
 * 3. 준비서면 제출 알람
 * 4. 서류 송달 문제
 * 5. 증거신청 회신 미수령
 * 6. 기일 충돌 경고
 * 7. 의뢰인 역할 확인
 * 8. 미등록 관련사건 (관련사건+심급사건 통합)
 */

export type NoticeCategory =
  | 'next_hearing'           // 다음기일
  | 'deadline'               // 기한
  | 'brief_required'         // 준비서면 제출
  | 'document_issue'         // 서류 송달 문제
  | 'evidence_pending'       // 증거회신 대기
  | 'schedule_conflict'      // 기일 충돌
  | 'client_role_confirm'    // 의뢰인 역할 확인
  | 'unlinked_related_case'  // 미등록 관련사건
  | 'unlinked_lower_court'   // 미등록 심급사건

export type NoticeActionType =
  | 'dismiss'            // 삭제 (경고 무시)
  | 'change_lawyer'      // 변호사 변경
  | 'change_date'        // 기일변경 신청
  | 'deputy'             // 복대리인
  | 'view'               // 상세 보기
  | 'edit'               // 수정
  | 'confirm_plaintiff'  // 원고측 확정
  | 'confirm_defendant'  // 피고측 확정
  | 'view_related'       // 관련사건 보기

export interface NoticeAction {
  label: string
  type: NoticeActionType
  metadata?: Record<string, unknown>
}

export interface CaseNotice {
  id: string
  category: NoticeCategory
  title: string
  description: string
  dueDate?: string              // 기한/기일 날짜
  daysRemaining?: number        // D-day 계산 (음수면 초과)
  actions?: NoticeAction[]
  metadata?: {
    deadlineId?: string
    hearingId?: string
    conflictingCaseId?: string
    conflictingHearingId?: string
    documentName?: string
    [key: string]: string | undefined
  }
}

// 카테고리별 아이콘 매핑
export const NOTICE_CATEGORY_ICONS: Record<NoticeCategory, string> = {
  next_hearing: '📅',
  deadline: '⏰',
  brief_required: '📝',
  document_issue: '📋',
  evidence_pending: '📬',
  schedule_conflict: '⚠️',
  client_role_confirm: '👤',
  unlinked_related_case: '🔗',
  unlinked_lower_court: '📊',
}

// 카테고리별 라벨 매핑
export const NOTICE_CATEGORY_LABELS: Record<NoticeCategory, string> = {
  next_hearing: '다음 기일',
  deadline: '기한',
  brief_required: '준비서면',
  document_issue: '서류 송달',
  evidence_pending: '증거 회신',
  schedule_conflict: '기일 충돌',
  client_role_confirm: '역할 확인',
  unlinked_related_case: '관련사건',
  unlinked_lower_court: '심급사건',
}
