'use client'

import { formatPartyVs } from '@/lib/utils/party-display'

interface PartyVsDisplayProps {
  /** 의뢰인명 */
  clientName?: string | null
  /** 상대방명 */
  opponentName?: string | null
  /** 글씨 크기 (기본: base) */
  size?: 'sm' | 'base' | 'lg'
  /** 추가 클래스 */
  className?: string
  /** 상대방 텍스트 색상을 muted로 할지 (기본: true) */
  mutedOpponent?: boolean
  /** truncate 적용 (기본: true) */
  truncate?: boolean
}

const SIZE_CLASSES = {
  sm: 'text-sm',
  base: 'text-base',
  lg: 'text-lg',
} as const

/**
 * 당사자 표시 공통 컴포넌트
 * "의뢰인 v 상대방" 형식을 일관되게 표시
 *
 * @example
 * <PartyVsDisplay clientName="홍길동" opponentName="김철수" size="lg" />
 * // 결과: 홍길동 v 김철수
 */
export function PartyVsDisplay({
  clientName,
  opponentName,
  size = 'base',
  className = '',
  mutedOpponent = true,
  truncate = true,
}: PartyVsDisplayProps) {
  // clientName이 없으면 표시하지 않음
  if (!clientName) return null

  return (
    <span
      className={`${SIZE_CLASSES[size]} text-[var(--text-primary)] ${truncate ? 'truncate' : ''} ${className}`}
    >
      {clientName}
      {opponentName && (
        <span className={mutedOpponent ? 'text-[var(--text-muted)]' : ''}>
          {' '}v {opponentName}
        </span>
      )}
    </span>
  )
}

// 편의를 위한 함수 re-export
export { formatPartyVs } from '@/lib/utils/party-display'
