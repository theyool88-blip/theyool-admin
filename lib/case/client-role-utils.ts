/**
 * 의뢰인 역할 상태 결정 유틸리티
 *
 * client_role_status 값:
 * - 'confirmed': 역할이 확정됨 (명시적 지정, 원본 사건 복사, 성씨가 다른 경우)
 * - 'provisional': 역할 확인 필요 (성씨가 같은 경우 - 이혼 사건 등에서 역할 혼동 가능)
 */

export type ClientRoleStatus = 'provisional' | 'confirmed'

export interface DetermineClientRoleStatusParams {
  /** 명시적으로 지정된 client_role (폼에서 직접 선택) */
  explicitClientRole?: string | null
  /** 원본 사건에서 복사된 client_role */
  sourceClientRole?: string | null
  /** 원본 사건의 client_role_status (심급/관련사건 시 전파) */
  sourceClientRoleStatus?: ClientRoleStatus | null
  /** 의뢰인 이름 */
  clientName?: string | null
  /** 상대방 이름 */
  opponentName?: string | null
}

/**
 * 의뢰인 역할 상태(client_role_status) 결정
 *
 * 결정 로직:
 * 1. 명시적으로 client_role을 지정한 경우 → 'confirmed'
 * 2. 원본 사건에서 복사된 경우 → 원본의 status를 전파 (provisional이면 provisional)
 * 3. 의뢰인/상대방 성씨 동일 → 'provisional' (이혼 사건 등에서 역할 확인 필요)
 * 4. 성씨 다름 또는 비교 불가 → 'confirmed'
 *
 * @example
 * // 명시적 지정
 * determineClientRoleStatus({ explicitClientRole: 'plaintiff' }) // 'confirmed'
 *
 * // 원본 사건에서 복사 (provisional 전파)
 * determineClientRoleStatus({ sourceClientRole: 'plaintiff', sourceClientRoleStatus: 'provisional' }) // 'provisional'
 *
 * // 성씨 같음 (김씨 vs 김씨)
 * determineClientRoleStatus({ clientName: '김철수', opponentName: '김영희' }) // 'provisional'
 *
 * // 성씨 다름 (김씨 vs 이씨)
 * determineClientRoleStatus({ clientName: '김철수', opponentName: '이영희' }) // 'confirmed'
 */
export function determineClientRoleStatus(
  params: DetermineClientRoleStatusParams
): ClientRoleStatus {
  const { explicitClientRole, sourceClientRole, sourceClientRoleStatus, clientName, opponentName } = params

  // 명시적으로 지정된 경우 → confirmed (사용자가 직접 선택)
  if (explicitClientRole) {
    return 'confirmed'
  }

  // 원본 사건에서 복사된 경우 → 원본의 status 전파
  if (sourceClientRole) {
    // 원본이 provisional이면 그대로 전파, 아니면 confirmed
    return sourceClientRoleStatus === 'provisional' ? 'provisional' : 'confirmed'
  }

  // 의뢰인 이름과 상대방 이름이 모두 있을 때 성씨 비교
  if (clientName && opponentName) {
    const clientSurname = clientName.charAt(0)
    const opponentSurname = opponentName.charAt(0)

    // 성씨가 같으면 역할 확인 필요 (이혼 사건 등)
    if (clientSurname === opponentSurname) {
      return 'provisional'
    }
  }

  // 기본값: confirmed
  return 'confirmed'
}
