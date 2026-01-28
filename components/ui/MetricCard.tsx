'use client'

import { ReactNode } from 'react'
import { TrendingUp, TrendingDown, Minus, type LucideIcon } from 'lucide-react'

export type MetricVariant = 'sage' | 'success' | 'warning' | 'danger' | 'info'
export type TrendDirection = 'up' | 'down' | 'neutral'

interface MetricCardProps {
  label: string
  value: string | number
  icon?: LucideIcon
  variant?: MetricVariant
  trend?: {
    value: number | string
    direction: TrendDirection
    label?: string
  }
  subtitle?: string
  onClick?: () => void
  className?: string
}

const getTrendIcon = (direction: TrendDirection) => {
  switch (direction) {
    case 'up':
      return TrendingUp
    case 'down':
      return TrendingDown
    default:
      return Minus
  }
}

const getTrendClass = (direction: TrendDirection) => {
  switch (direction) {
    case 'up':
      return 'positive'
    case 'down':
      return 'negative'
    default:
      return 'neutral'
  }
}

export default function MetricCard({
  label,
  value,
  icon: Icon,
  variant = 'sage',
  trend,
  subtitle,
  onClick,
  className = '',
}: MetricCardProps) {
  return (
    <div
      className={`metric-card ${onClick ? 'cursor-pointer' : ''} ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
    >
      {Icon && (
        <div className={`metric-card-icon ${variant}`}>
          <Icon className="w-5 h-5" />
        </div>
      )}

      <div className="metric-card-value">{value}</div>
      <div className="metric-card-label">{label}</div>

      {subtitle && (
        <div className="text-caption mt-1">{subtitle}</div>
      )}

      {trend && (
        <div className={`metric-card-trend ${getTrendClass(trend.direction)}`}>
          {(() => {
            const TrendIcon = getTrendIcon(trend.direction)
            return <TrendIcon className="w-3 h-3" />
          })()}
          <span>{typeof trend.value === 'number' ? `${trend.value}%` : trend.value}</span>
          {trend.label && <span className="ml-1 opacity-70">{trend.label}</span>}
        </div>
      )}
    </div>
  )
}

// Compact variant for smaller displays
export function MetricCardCompact({
  label,
  value,
  icon: Icon,
  variant = 'sage',
  onClick,
  className = '',
}: Omit<MetricCardProps, 'trend' | 'subtitle'>) {
  return (
    <div
      className={`metric-card py-4 ${onClick ? 'cursor-pointer' : ''} ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="flex items-center gap-3">
        {Icon && (
          <div className={`metric-card-icon ${variant}`}>
            <Icon className="w-4 h-4" />
          </div>
        )}
        <div>
          <div className="text-lg font-semibold text-[var(--text-primary)]">{value}</div>
          <div className="text-caption">{label}</div>
        </div>
      </div>
    </div>
  )
}

// Grid container for metric cards
interface MetricCardGridProps {
  children: ReactNode
  columns?: 2 | 3 | 4
  className?: string
}

export function MetricCardGrid({
  children,
  columns = 4,
  className = '',
}: MetricCardGridProps) {
  const gridCols = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  }

  return (
    <div className={`grid gap-4 ${gridCols[columns]} ${className}`}>
      {children}
    </div>
  )
}
