'use client'

import { ReactNode } from 'react'

export type BadgeVariant =
  | 'active' | 'progress'
  | 'success' | 'completed'
  | 'warning' | 'pending'
  | 'danger' | 'urgent'
  | 'info'
  | 'neutral' | 'inactive'

interface StatusBadgeProps {
  children: ReactNode
  variant?: BadgeVariant
  showDot?: boolean
  className?: string
}

export default function StatusBadge({
  children,
  variant = 'neutral',
  showDot = true,
  className = '',
}: StatusBadgeProps) {
  return (
    <span className={`status-badge ${variant} ${showDot ? '' : 'no-dot'} ${className}`}>
      {children}
    </span>
  )
}

// Count Badge for notifications/counts
interface CountBadgeProps {
  count: number
  variant?: 'default' | 'danger'
  max?: number
  className?: string
}

export function CountBadge({
  count,
  variant = 'default',
  max = 99,
  className = '',
}: CountBadgeProps) {
  const displayCount = count > max ? `${max}+` : count.toString()

  if (count <= 0) return null

  return (
    <span className={`count-badge ${variant} ${className}`}>
      {displayCount}
    </span>
  )
}

// Urgency Badge with D-day format
interface UrgencyBadgeProps {
  daysUntil: number
  className?: string
}

export function UrgencyBadge({ daysUntil, className = '' }: UrgencyBadgeProps) {
  const getVariant = (): BadgeVariant => {
    if (daysUntil < 0) return 'neutral'
    if (daysUntil === 0) return 'danger'
    if (daysUntil <= 3) return 'danger'
    if (daysUntil <= 7) return 'warning'
    return 'neutral'
  }

  const formatDays = () => {
    if (daysUntil < 0) return `D+${Math.abs(daysUntil)}`
    if (daysUntil === 0) return 'D-Day'
    return `D-${daysUntil}`
  }

  return (
    <StatusBadge variant={getVariant()} showDot={false} className={className}>
      {formatDays()}
    </StatusBadge>
  )
}

// Case Status Badge (Korean labels)
interface CaseStatusBadgeProps {
  status: '진행중' | '종결' | '대기' | string
  className?: string
}

export function CaseStatusBadge({ status, className = '' }: CaseStatusBadgeProps) {
  const getVariant = (): BadgeVariant => {
    switch (status) {
      case '진행중':
        return 'active'
      case '종결':
        return 'neutral'
      case '대기':
        return 'pending'
      default:
        return 'neutral'
    }
  }

  return (
    <StatusBadge variant={getVariant()} className={className}>
      {status}
    </StatusBadge>
  )
}

// Payment Status Badge
interface PaymentStatusBadgeProps {
  status: 'paid' | 'partial' | 'unpaid' | 'overdue' | string
  className?: string
}

export function PaymentStatusBadge({ status, className = '' }: PaymentStatusBadgeProps) {
  const getVariant = (): BadgeVariant => {
    switch (status) {
      case 'paid':
        return 'success'
      case 'partial':
        return 'warning'
      case 'unpaid':
        return 'neutral'
      case 'overdue':
        return 'danger'
      default:
        return 'neutral'
    }
  }

  const getLabel = () => {
    switch (status) {
      case 'paid':
        return '완납'
      case 'partial':
        return '일부입금'
      case 'unpaid':
        return '미입금'
      case 'overdue':
        return '연체'
      default:
        return status
    }
  }

  return (
    <StatusBadge variant={getVariant()} className={className}>
      {getLabel()}
    </StatusBadge>
  )
}

// Consultation Status Badge
interface ConsultationStatusBadgeProps {
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | string
  className?: string
}

export function ConsultationStatusBadge({ status, className = '' }: ConsultationStatusBadgeProps) {
  const getVariant = (): BadgeVariant => {
    switch (status) {
      case 'pending':
        return 'warning'
      case 'confirmed':
        return 'info'
      case 'completed':
        return 'success'
      case 'cancelled':
        return 'neutral'
      default:
        return 'neutral'
    }
  }

  const getLabel = () => {
    switch (status) {
      case 'pending':
        return '대기중'
      case 'confirmed':
        return '확정'
      case 'completed':
        return '완료'
      case 'cancelled':
        return '취소'
      default:
        return status
    }
  }

  return (
    <StatusBadge variant={getVariant()} className={className}>
      {getLabel()}
    </StatusBadge>
  )
}
