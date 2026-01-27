'use client'

import { ReactNode } from 'react'
import Link from 'next/link'
import { type LucideIcon } from 'lucide-react'

interface ActionCardProps {
  label: string
  icon: LucideIcon
  href?: string
  onClick?: () => void
  disabled?: boolean
  className?: string
}

export default function ActionCard({
  label,
  icon: Icon,
  href,
  onClick,
  disabled = false,
  className = '',
}: ActionCardProps) {
  const cardContent = (
    <>
      <div className="action-card-icon">
        <Icon className="w-5 h-5" />
      </div>
      <span className="action-card-label">{label}</span>
    </>
  )

  if (href && !disabled) {
    return (
      <Link href={href} className={`action-card ${className}`}>
        {cardContent}
      </Link>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`action-card ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
    >
      {cardContent}
    </button>
  )
}

// Quick Actions Bar - MyCase style
interface QuickActionsBarProps {
  children: ReactNode
  className?: string
}

export function QuickActionsBar({
  children,
  className = '',
}: QuickActionsBarProps) {
  return (
    <div className={`grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 ${className}`}>
      {children}
    </div>
  )
}

// Compact Action Button variant
interface ActionButtonProps {
  label: string
  icon: LucideIcon
  href?: string
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md'
  disabled?: boolean
  className?: string
}

export function ActionButton({
  label,
  icon: Icon,
  href,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled = false,
  className = '',
}: ActionButtonProps) {
  const baseClass = 'inline-flex items-center gap-2 font-medium rounded-lg transition-all'

  const variantClass = {
    primary: 'bg-[var(--sage-primary)] text-white hover:bg-[var(--sage-primary-hover)]',
    secondary: 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-[var(--border-default)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]',
    ghost: 'bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]',
  }

  const sizeClass = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
  }

  const buttonClass = `${baseClass} ${variantClass[variant]} ${sizeClass[size]} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`

  const content = (
    <>
      <Icon className={size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
      <span>{label}</span>
    </>
  )

  if (href && !disabled) {
    return (
      <Link href={href} className={buttonClass}>
        {content}
      </Link>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={buttonClass}
    >
      {content}
    </button>
  )
}
