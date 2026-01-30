'use client'

import { useState } from 'react'
import type { BigCalendarEvent, TenantMember } from '../types'

interface AttendingLawyerModalProps {
  event: BigCalendarEvent
  tenantMembers: TenantMember[]
  updateAttendingLawyer: (hearingId: string, lawyerId: string | null) => Promise<void>
  updatingLawyer: string | null
  onClose: () => void
}

export function AttendingLawyerModal({
  event,
  tenantMembers,
  updateAttendingLawyer,
  updatingLawyer,
  onClose,
}: AttendingLawyerModalProps) {
  const [selectedLawyerId, setSelectedLawyerId] = useState<string>(event.attendingLawyerId || '')

  // isSubmitting is derived from updatingLawyer state from hook
  const isSubmitting = updatingLawyer === event.id

  const handleSubmit = async () => {
    if (!selectedLawyerId) {
      return
    }

    try {
      await updateAttendingLawyer(event.id, selectedLawyerId)
      onClose()
    } catch (err) {
      // Error is already handled by the hook (shows alert)
      console.error('출석변호사 변경 실패:', err)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-default)] shadow-2xl w-full max-w-md mx-4 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-subtle)]">
          <h3 className="font-semibold text-[var(--text-primary)]">출석변호사 변경</h3>
          <button
            onClick={onClose}
            className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          <p className="text-sm text-[var(--text-secondary)] mb-4">
            {event.title}
          </p>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {tenantMembers.map((member) => (
              <label
                key={member.id}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedLawyerId === member.id
                    ? 'border-[var(--sage-primary)] bg-[var(--sage-muted)]'
                    : 'border-[var(--border-default)] hover:bg-[var(--bg-hover)]'
                }`}
              >
                <input
                  type="radio"
                  name="lawyer"
                  value={member.id}
                  checked={selectedLawyerId === member.id}
                  onChange={(e) => setSelectedLawyerId(e.target.value)}
                  className="sr-only"
                />
                <div className="w-8 h-8 rounded-full bg-[var(--sage-muted)] flex items-center justify-center">
                  <span className="text-sm font-medium text-[var(--sage-primary)]">
                    {member.display_name.charAt(0)}
                  </span>
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-[var(--text-primary)]">
                    {member.display_name}
                  </div>
                  <div className="text-xs text-[var(--text-muted)]">
                    {member.role === 'admin' ? '관리자' : member.role === 'lawyer' ? '변호사' : '직원'}
                  </div>
                </div>
                {selectedLawyerId === member.id && (
                  <svg className="w-5 h-5 text-[var(--sage-primary)]" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                )}
              </label>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 p-4 border-t border-[var(--border-subtle)] bg-[var(--bg-tertiary)]">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 px-4 py-2 text-sm font-medium text-[var(--text-secondary)] bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !selectedLawyerId}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-[var(--sage-primary)] rounded-lg hover:bg-[var(--sage-primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? '저장 중...' : '변경'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default AttendingLawyerModal
