'use client'

import { useState, useRef, useEffect } from 'react'

interface Member {
  id: string
  display_name: string | null
  role: string  // 'owner' | 'admin' | 'lawyer' | 'staff'
  title?: string
}

type AssigneeRole = 'lawyer' | 'staff'

interface Assignee {
  member_id: string
  assignee_role?: AssigneeRole
  is_primary?: boolean
}

interface AssigneeMultiSelectProps {
  members: Member[]
  value: Assignee[]
  onChange: (assignees: Assignee[]) => void
  assigneeRole?: AssigneeRole  // 'lawyer' or 'staff' mode
  placeholder?: string
  className?: string
  disabled?: boolean
}

export function AssigneeMultiSelect({
  members,
  value,
  onChange,
  assigneeRole = 'lawyer',
  placeholder,
  className = '',
  disabled = false
}: AssigneeMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // 디버깅 로그
  useEffect(() => {
    console.log('[AssigneeMultiSelect] Render - members:', members.length, 'value:', value, 'assigneeRole:', assigneeRole)
  }, [members, value, assigneeRole])

  // Default placeholder based on role
  const defaultPlaceholder = assigneeRole === 'staff' ? '담당직원 선택' : '담당변호사 선택'
  const displayPlaceholder = placeholder || defaultPlaceholder

  // Filter members based on assigneeRole mode
  // For 'lawyer' mode: show owner, admin, lawyer roles
  // For 'staff' mode: show staff role only
  const filteredMembers = assigneeRole === 'staff'
    ? members.filter(m => m.role === 'staff')
    : members.filter(m => ['owner', 'admin', 'lawyer'].includes(m.role))

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selectedIds = value.map(v => v.member_id)
  // Primary is only applicable for lawyers
  const primaryId = assigneeRole === 'lawyer' ? value.find(v => v.is_primary)?.member_id : undefined

  const handleToggleMember = (memberId: string) => {
    const isSelected = selectedIds.includes(memberId)

    if (isSelected) {
      // Remove member
      const newValue = value.filter(v => v.member_id !== memberId)
      // If removed member was primary and this is lawyer mode, set first remaining as primary
      if (assigneeRole === 'lawyer' && primaryId === memberId && newValue.length > 0) {
        newValue[0].is_primary = true
      }
      onChange(newValue)
    } else {
      // Add member
      const newAssignee: Assignee = {
        member_id: memberId,
        assignee_role: assigneeRole,
        // Staff cannot be primary; for lawyers, first one is primary by default
        is_primary: assigneeRole === 'lawyer' && value.length === 0
      }
      onChange([...value, newAssignee])
    }
  }

  const handleSetPrimary = (memberId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    // Only applicable for lawyer mode
    if (assigneeRole !== 'lawyer') return
    const newValue = value.map(v => ({
      ...v,
      is_primary: v.member_id === memberId
    }))
    onChange(newValue)
  }

  const handleRemove = (memberId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const newValue = value.filter(v => v.member_id !== memberId)
    // If removed member was primary and this is lawyer mode, set first remaining as primary
    if (assigneeRole === 'lawyer' && primaryId === memberId && newValue.length > 0) {
      newValue[0].is_primary = true
    }
    onChange(newValue)
  }

  const getMemberName = (memberId: string) => {
    const member = members.find(m => m.id === memberId)
    return member?.display_name || '이름 없음'
  }

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'owner':
        return '대표'
      case 'admin':
        return '관리자'
      default:
        return null
    }
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Selected items display */}
      <div
        className={`min-h-[42px] p-2 border rounded-lg bg-[var(--bg-secondary)] cursor-pointer flex flex-wrap gap-2 items-center
          ${disabled ? 'bg-[var(--bg-tertiary)] cursor-not-allowed' : 'hover:border-[var(--sage-primary)]'}
          ${isOpen ? 'border-[var(--sage-primary)] ring-1 ring-[var(--sage-primary)]' : 'border-[var(--border-default)]'}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        {value.length === 0 ? (
          <span className="text-[var(--text-muted)] text-sm">{displayPlaceholder}</span>
        ) : (
          value.map(assignee => {
            const member = members.find(m => m.id === assignee.member_id)
            const showPrimary = assigneeRole === 'lawyer' && assignee.is_primary
            return (
              <span
                key={assignee.member_id}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-sm
                  ${showPrimary ? 'bg-[var(--sage-muted)] text-[var(--sage-primary)] border border-[var(--sage-primary)]' : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'}`}
              >
                {showPrimary && (
                  <svg className="w-3 h-3 text-[var(--sage-primary)]" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401z" clipRule="evenodd" />
                  </svg>
                )}
                <span>{member?.display_name || '이름 없음'}</span>
                {member && getRoleBadge(member.role) && (
                  <span className="text-xs text-[var(--text-tertiary)]">({getRoleBadge(member.role)})</span>
                )}
                <button
                  type="button"
                  onClick={(e) => handleRemove(assignee.member_id, e)}
                  className="ml-1 text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            )
          })
        )}
        <div className="ml-auto">
          <svg className={`w-5 h-5 text-[var(--text-muted)] transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Dropdown */}
      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg shadow-lg max-h-60 overflow-auto">
          {filteredMembers.length === 0 ? (
            <div className="p-3 text-sm text-[var(--text-tertiary)] text-center">
              {assigneeRole === 'staff' ? '선택 가능한 직원이 없습니다' : '선택 가능한 변호사가 없습니다'}
            </div>
          ) : (
            filteredMembers.map(member => {
              const isSelected = selectedIds.includes(member.id)
              const isPrimary = primaryId === member.id

              return (
                <div
                  key={member.id}
                  className={`flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-[var(--bg-hover)]
                    ${isSelected ? 'bg-[var(--sage-muted)]' : ''}`}
                  onClick={() => handleToggleMember(member.id)}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      className="w-4 h-4 text-[var(--sage-primary)] border-[var(--border-default)] rounded focus:ring-[var(--sage-primary)]"
                    />
                    <span className={`text-sm ${isSelected ? 'font-medium' : ''}`}>
                      {member.display_name || '이름 없음'}
                    </span>
                    {getRoleBadge(member.role) && (
                      <span className="text-xs px-1.5 py-0.5 bg-[var(--bg-tertiary)] text-[var(--text-secondary)] rounded">
                        {getRoleBadge(member.role)}
                      </span>
                    )}
                  </div>

                  {/* Primary button only shown in lawyer mode */}
                  {isSelected && assigneeRole === 'lawyer' && (
                    <button
                      type="button"
                      onClick={(e) => handleSetPrimary(member.id, e)}
                      className={`text-xs px-2 py-1 rounded transition-colors
                        ${isPrimary
                          ? 'bg-[var(--sage-muted)] text-[var(--sage-primary)] font-medium'
                          : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--sage-muted)] hover:text-[var(--sage-primary)]'
                        }`}
                    >
                      {isPrimary ? '주담당' : '주담당 설정'}
                    </button>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
