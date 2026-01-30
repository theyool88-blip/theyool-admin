/**
 * 당사자 표시 관련 공통 유틸리티
 * "의뢰인 v 상대방" 형식을 일관되게 표시하기 위한 함수들
 */

/**
 * "의뢰인 v 상대방" 형식의 문자열 생성
 * @param clientName 의뢰인명 (없으면 "의뢰인" 기본값)
 * @param opponentName 상대방명 (없으면 표시 안함)
 * @returns 포맷된 문자열 (예: "홍길동 v 김철수")
 */
export function formatPartyVs(
  clientName?: string | null,
  opponentName?: string | null
): string {
  if (!clientName) return ''

  if (opponentName) {
    return `${clientName} v ${opponentName}`
  }

  return clientName
}

/**
 * 사건명 자동 생성 (입력된 필드 기반)
 * - 상대방 있으면: 의뢰인v상대방(사건명)
 * - 상대방 없으면: 의뢰인(사건명)
 * @param clientName 의뢰인명
 * @param opponentName 상대방명
 * @param caseLabel 사건명 또는 사건번호
 */
export function generateCaseTitle(
  clientName: string,
  opponentName?: string | null,
  caseLabel?: string | null
): string {
  const vs = opponentName ? `v${opponentName}` : ''
  const suffix = caseLabel || ''
  return `${clientName}${vs}${suffix ? `(${suffix})` : ''}`
}
