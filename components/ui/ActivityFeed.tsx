'use client'

import Link from 'next/link'
import {
  FileText,
  Calendar,
  CreditCard,
  MessageSquare,
  User,
  Bell,
  Check,
  AlertCircle,
  type LucideIcon,
} from 'lucide-react'

export type ActivityType =
  | 'case'
  | 'schedule'
  | 'payment'
  | 'consultation'
  | 'client'
  | 'notification'
  | 'success'
  | 'warning'

export type ActivityVariant = 'sage' | 'success' | 'warning' | 'danger' | 'info' | 'default'

export interface Activity {
  id: string
  type: ActivityType
  title: string
  description?: string
  timestamp: string | Date
  href?: string
  user?: string
  metadata?: Record<string, string | number>
}

interface ActivityFeedProps {
  activities: Activity[]
  maxItems?: number
  showViewAll?: boolean
  onViewAll?: () => void
  emptyMessage?: string
  className?: string
}

const activityIcons: Record<ActivityType, LucideIcon> = {
  case: FileText,
  schedule: Calendar,
  payment: CreditCard,
  consultation: MessageSquare,
  client: User,
  notification: Bell,
  success: Check,
  warning: AlertCircle,
}

const activityVariants: Record<ActivityType, ActivityVariant> = {
  case: 'sage',
  schedule: 'info',
  payment: 'success',
  consultation: 'info',
  client: 'sage',
  notification: 'warning',
  success: 'success',
  warning: 'warning',
}

function formatTimestamp(timestamp: string | Date): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return '방금 전'
  if (diffMins < 60) return `${diffMins}분 전`
  if (diffHours < 24) return `${diffHours}시간 전`
  if (diffDays < 7) return `${diffDays}일 전`

  return date.toLocaleDateString('ko-KR', {
    month: 'short',
    day: 'numeric',
  })
}

export default function ActivityFeed({
  activities,
  maxItems = 10,
  showViewAll = false,
  onViewAll,
  emptyMessage = '최근 활동이 없습니다',
  className = '',
}: ActivityFeedProps) {
  const displayedActivities = activities.slice(0, maxItems)
  const hasMore = activities.length > maxItems

  if (activities.length === 0) {
    return (
      <div className={`py-8 text-center ${className}`}>
        <p className="text-caption">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className={`activity-feed ${className}`}>
      {displayedActivities.map((activity) => (
        <ActivityItem key={activity.id} activity={activity} />
      ))}

      {(showViewAll || hasMore) && onViewAll && (
        <button
          type="button"
          onClick={onViewAll}
          className="w-full py-3 text-center text-caption font-medium text-[var(--sage-primary)] hover:text-[var(--sage-primary-hover)] transition-colors"
        >
          전체 보기 {hasMore && `(+${activities.length - maxItems})`}
        </button>
      )}
    </div>
  )
}

interface ActivityItemProps {
  activity: Activity
}

function ActivityItem({ activity }: ActivityItemProps) {
  const Icon = activityIcons[activity.type] || Bell
  const variant = activityVariants[activity.type] || 'default'

  const content = (
    <>
      <div className={`activity-icon ${variant}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="activity-content">
        <p className="activity-title">{activity.title}</p>
        <div className="activity-meta">
          <span>{formatTimestamp(activity.timestamp)}</span>
          {activity.user && (
            <>
              <span className="text-[var(--text-muted)]">|</span>
              <span>{activity.user}</span>
            </>
          )}
        </div>
        {activity.description && (
          <p className="text-caption mt-1">{activity.description}</p>
        )}
      </div>
    </>
  )

  if (activity.href) {
    return (
      <Link
        href={activity.href}
        className="activity-item hover:bg-[var(--bg-hover)] -mx-4 px-4 rounded-lg transition-colors"
      >
        {content}
      </Link>
    )
  }

  return <div className="activity-item">{content}</div>
}

// Compact activity list for dashboard
interface ActivityListCompactProps {
  activities: Activity[]
  maxItems?: number
  className?: string
}

export function ActivityListCompact({
  activities,
  maxItems = 5,
  className = '',
}: ActivityListCompactProps) {
  const displayedActivities = activities.slice(0, maxItems)

  return (
    <div className={`space-y-2 ${className}`}>
      {displayedActivities.map((activity) => {
        const Icon = activityIcons[activity.type] || Bell

        return (
          <div
            key={activity.id}
            className="flex items-center gap-3 py-2"
          >
            <Icon className="w-4 h-4 text-[var(--text-tertiary)] flex-shrink-0" />
            <span className="text-body flex-1 truncate">{activity.title}</span>
            <span className="text-caption text-[var(--text-muted)] flex-shrink-0">
              {formatTimestamp(activity.timestamp)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// Single activity notification item
interface ActivityNotificationProps {
  activity: Activity
  onDismiss?: () => void
  className?: string
}

export function ActivityNotification({
  activity,
  onDismiss,
  className = '',
}: ActivityNotificationProps) {
  const Icon = activityIcons[activity.type] || Bell
  const variant = activityVariants[activity.type] || 'default'

  return (
    <div
      className={`flex items-start gap-3 p-4 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-xl ${className}`}
    >
      <div className={`activity-icon ${variant} flex-shrink-0`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-[var(--text-primary)]">{activity.title}</p>
        {activity.description && (
          <p className="text-caption mt-1">{activity.description}</p>
        )}
        <p className="text-caption text-[var(--text-muted)] mt-2">
          {formatTimestamp(activity.timestamp)}
        </p>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  )
}
