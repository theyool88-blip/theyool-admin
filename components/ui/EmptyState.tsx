'use client'

import { ReactNode } from 'react'
import {
  FileText,
  Users,
  Calendar,
  Search,
  Filter,
  AlertCircle,
  Inbox,
  type LucideIcon
} from 'lucide-react'

type EmptyStateType = 'noData' | 'noResults' | 'noFilter' | 'error' | 'custom'

interface EmptyStateProps {
  type?: EmptyStateType
  icon?: LucideIcon
  title?: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
  compact?: boolean
  className?: string
  children?: ReactNode
}

const defaultContent: Record<EmptyStateType, { icon: LucideIcon; title: string; description: string }> = {
  noData: {
    icon: Inbox,
    title: '데이터가 없습니다',
    description: '아직 등록된 데이터가 없습니다.',
  },
  noResults: {
    icon: Search,
    title: '검색 결과가 없습니다',
    description: '다른 검색어로 시도해 보세요.',
  },
  noFilter: {
    icon: Filter,
    title: '필터 결과가 없습니다',
    description: '필터 조건을 변경해 보세요.',
  },
  error: {
    icon: AlertCircle,
    title: '오류가 발생했습니다',
    description: '잠시 후 다시 시도해 주세요.',
  },
  custom: {
    icon: Inbox,
    title: '',
    description: '',
  },
}

export default function EmptyState({
  type = 'noData',
  icon,
  title,
  description,
  action,
  compact = false,
  className = '',
  children,
}: EmptyStateProps) {
  const defaults = defaultContent[type]
  const Icon = icon || defaults.icon
  const displayTitle = title || defaults.title
  const displayDescription = description || defaults.description

  return (
    <div className={`empty-state ${compact ? 'compact' : ''} ${className}`}>
      <Icon className="empty-state-icon" />

      {displayTitle && (
        <h3 className="empty-state-title">{displayTitle}</h3>
      )}

      {displayDescription && (
        <p className="empty-state-description">{displayDescription}</p>
      )}

      {children}

      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="empty-state-action"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}

// Specialized empty states
interface EmptyCasesProps {
  onAddCase?: () => void
  className?: string
}

export function EmptyCases({ onAddCase, className = '' }: EmptyCasesProps) {
  return (
    <EmptyState
      icon={FileText}
      title="등록된 사건이 없습니다"
      description="첫 번째 사건을 등록해보세요"
      action={onAddCase ? { label: '+ 사건 추가', onClick: onAddCase } : undefined}
      className={className}
    />
  )
}

interface EmptyClientsProps {
  onAddClient?: () => void
  className?: string
}

export function EmptyClients({ onAddClient, className = '' }: EmptyClientsProps) {
  return (
    <EmptyState
      icon={Users}
      title="등록된 의뢰인이 없습니다"
      description="첫 번째 의뢰인을 등록해보세요"
      action={onAddClient ? { label: '+ 의뢰인 추가', onClick: onAddClient } : undefined}
      className={className}
    />
  )
}

interface EmptySchedulesProps {
  onAddSchedule?: () => void
  className?: string
}

export function EmptySchedules({ onAddSchedule, className = '' }: EmptySchedulesProps) {
  return (
    <EmptyState
      icon={Calendar}
      title="예정된 일정이 없습니다"
      description="새로운 일정을 추가해보세요"
      action={onAddSchedule ? { label: '+ 일정 추가', onClick: onAddSchedule } : undefined}
      className={className}
    />
  )
}

interface EmptySearchResultsProps {
  searchTerm?: string
  onClear?: () => void
  className?: string
}

export function EmptySearchResults({ searchTerm, onClear, className = '' }: EmptySearchResultsProps) {
  return (
    <EmptyState
      type="noResults"
      description={searchTerm ? `"${searchTerm}"에 대한 검색 결과가 없습니다.` : '검색 결과가 없습니다.'}
      action={onClear ? { label: '검색 초기화', onClick: onClear } : undefined}
      className={className}
    />
  )
}
