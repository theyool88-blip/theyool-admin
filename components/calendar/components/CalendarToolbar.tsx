'use client'

import { memo, useCallback } from 'react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import type { ViewMode, TenantMember } from '../types'

interface CalendarToolbarProps {
  currentDate: Date
  viewMode: ViewMode
  filterType: 'all' | 'court'
  selectedLawyers: string[]
  tenantMembers: TenantMember[]
  showLawyerPopover: boolean
  showMonthPicker: boolean
  pickerYear: number
  onFilterTypeChange: (type: 'all' | 'court') => void
  onViewModeChange: (mode: ViewMode) => void
  onToggleLawyer: (id: string) => void
  onClearLawyers: () => void
  onShowLawyerPopover: (show: boolean) => void
  onGoToPrevious: () => void
  onGoToNext: () => void
  onGoToToday: () => void
  onOpenMonthPicker: () => void
  onCloseMonthPicker: () => void
  onSetPickerYear: (year: number) => void
  onMonthSelect: (month: number) => void
  isValidating?: boolean
}

/**
 * CalendarToolbar - Korean localized calendar toolbar
 * Contains filters, navigation, and view mode toggles
 */
function CalendarToolbarComponent({
  currentDate,
  viewMode,
  filterType,
  selectedLawyers,
  tenantMembers,
  showLawyerPopover,
  showMonthPicker,
  pickerYear,
  onFilterTypeChange,
  onViewModeChange,
  onToggleLawyer,
  onClearLawyers,
  onShowLawyerPopover,
  onGoToPrevious,
  onGoToNext,
  onGoToToday,
  onOpenMonthPicker,
  onCloseMonthPicker,
  onSetPickerYear,
  onMonthSelect,
  isValidating,
}: CalendarToolbarProps) {
  const handleFilterAll = useCallback(() => {
    onFilterTypeChange('all')
    if (viewMode === 'list') onViewModeChange('month')
  }, [onFilterTypeChange, viewMode, onViewModeChange])

  const handleFilterCourt = useCallback(() => {
    onFilterTypeChange('court')
    if (viewMode === 'list') onViewModeChange('month')
  }, [onFilterTypeChange, viewMode, onViewModeChange])

  const handleListView = useCallback(() => {
    onViewModeChange('list')
  }, [onViewModeChange])

  return (
    <div className="relative flex flex-wrap items-center justify-between gap-3 mb-3">
      {/* Left: Filter Controls */}
      <div className="flex items-center gap-2">
        {/* Event Type Filter Toggle */}
        <div className="flex items-center bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg p-0.5">
          <button
            onClick={handleFilterAll}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              filterType === 'all' && viewMode !== 'list'
                ? 'bg-[var(--sage-primary)] text-white'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
            }`}
          >
            전체
          </button>
          <button
            onClick={handleFilterCourt}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              filterType === 'court' && viewMode !== 'list'
                ? 'bg-[var(--sage-primary)] text-white'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
            }`}
          >
            재판만
          </button>
          <button
            onClick={handleListView}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              viewMode === 'list'
                ? 'bg-[var(--sage-primary)] text-white'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
            }`}
          >
            목록
          </button>
        </div>

        {/* Lawyer Filter */}
        {tenantMembers.length > 0 && (
          <div className="relative">
            <button
              onClick={() => onShowLawyerPopover(!showLawyerPopover)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                selectedLawyers.length > 0
                  ? 'border-[var(--sage-primary)] bg-[var(--sage-muted)] text-[var(--sage-primary)]'
                  : 'border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
              }`}
            >
              <span>변호사</span>
              {selectedLawyers.length > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] font-bold bg-[var(--sage-primary)] text-white rounded-full">
                  {selectedLawyers.length}
                </span>
              )}
              <svg className={`w-3.5 h-3.5 transition-transform ${showLawyerPopover ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showLawyerPopover && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => onShowLawyerPopover(false)} />
                <div className="absolute left-0 top-full mt-1 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg shadow-lg p-2 z-50 min-w-[180px]">
                  {selectedLawyers.length > 0 && (
                    <button
                      onClick={onClearLawyers}
                      className="w-full text-left px-2 py-1.5 text-[11px] text-[var(--text-tertiary)] hover:text-[var(--color-danger)] hover:bg-[var(--bg-hover)] rounded transition-colors mb-1"
                    >
                      선택 해제
                    </button>
                  )}
                  {tenantMembers.map(member => (
                    <label
                      key={member.id}
                      className="flex items-center gap-2 px-2 py-1.5 hover:bg-[var(--bg-hover)] rounded cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedLawyers.includes(member.id)}
                        onChange={() => onToggleLawyer(member.id)}
                        className="w-4 h-4 rounded border-[var(--border-default)] text-[var(--sage-primary)] focus:ring-[var(--sage-primary)] focus:ring-offset-0"
                      />
                      <span className="text-xs text-[var(--text-primary)]">{member.display_name}</span>
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Filter Active Indicator */}
        {(filterType !== 'all' || selectedLawyers.length > 0) && (
          <span className="hidden sm:flex items-center gap-1 text-[10px] text-[var(--sage-primary)] bg-[var(--sage-muted)] px-2 py-1 rounded-full">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
            </svg>
            필터
          </span>
        )}
      </div>

      {/* Right: Navigation & View Toggle */}
      <div className="flex items-center gap-2">
        {/* Today Button */}
        <button
          onClick={onGoToToday}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors"
        >
          오늘
        </button>

        {/* Date Navigation */}
        <div className="flex items-center gap-1 relative">
          <button
            onClick={onGoToPrevious}
            className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            aria-label={viewMode === 'week' ? '이전 주' : viewMode === 'day' ? '이전 일' : '이전 달'}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <button
            onClick={onOpenMonthPicker}
            className="px-2 py-1 text-sm font-semibold text-[var(--text-primary)] min-w-[80px] text-center rounded-lg hover:bg-[var(--bg-hover)] transition-colors"
          >
            {format(currentDate, 'yyyy. M.', { locale: ko })}
          </button>

          {/* Month Picker Popup */}
          {showMonthPicker && (
            <>
              <div className="fixed inset-0 z-40" onClick={onCloseMonthPicker} />
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-xl shadow-lg p-3 z-50 min-w-[240px]">
                {/* Year Navigation */}
                <div className="flex items-center justify-between mb-3">
                  <button
                    onClick={() => onSetPickerYear(pickerYear - 1)}
                    className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <span className="text-sm font-semibold text-[var(--text-primary)]">{pickerYear}년</span>
                  <button
                    onClick={() => onSetPickerYear(pickerYear + 1)}
                    className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
                {/* Month Grid */}
                <div className="grid grid-cols-4 gap-1">
                  {[...Array(12)].map((_, i) => {
                    const isCurrentMonth = pickerYear === currentDate.getFullYear() && i === currentDate.getMonth()
                    const isToday = pickerYear === new Date().getFullYear() && i === new Date().getMonth()
                    return (
                      <button
                        key={i}
                        onClick={() => onMonthSelect(i)}
                        className={`py-2 px-1 text-xs font-medium rounded-lg transition-colors ${
                          isCurrentMonth
                            ? 'bg-[var(--sage-primary)] text-white'
                            : isToday
                              ? 'bg-[var(--sage-muted)] text-[var(--sage-primary)] font-bold'
                              : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                        }`}
                      >
                        {i + 1}월
                      </button>
                    )
                  })}
                </div>
                {/* Quick Actions */}
                <div className="mt-3 pt-2 border-t border-[var(--border-subtle)] flex justify-center">
                  <button
                    onClick={() => {
                      const today = new Date()
                      onSetPickerYear(today.getFullYear())
                      onMonthSelect(today.getMonth())
                    }}
                    className="text-xs text-[var(--sage-primary)] hover:underline"
                  >
                    오늘로 이동
                  </button>
                </div>
              </div>
            </>
          )}

          <button
            onClick={onGoToNext}
            className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            aria-label={viewMode === 'week' ? '다음 주' : viewMode === 'day' ? '다음 일' : '다음 달'}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* View Mode Toggle - Desktop */}
        <div className="hidden sm:flex items-center bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg p-0.5">
          <button
            onClick={() => onViewModeChange('month')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              viewMode === 'month'
                ? 'bg-[var(--sage-primary)] text-white'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
            }`}
          >
            월
          </button>
          <button
            onClick={() => onViewModeChange('week')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              viewMode === 'week'
                ? 'bg-[var(--sage-primary)] text-white'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
            }`}
          >
            주
          </button>
          <button
            onClick={() => onViewModeChange('day')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              viewMode === 'day'
                ? 'bg-[var(--sage-primary)] text-white'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
            }`}
          >
            일
          </button>
        </div>

        {/* View Mode Toggle - Mobile */}
        <div className="sm:hidden flex items-center bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg p-0.5">
          <button
            onClick={() => onViewModeChange('month')}
            className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
              viewMode === 'month'
                ? 'bg-[var(--sage-primary)] text-white'
                : 'text-[var(--text-secondary)]'
            }`}
          >
            월
          </button>
          <button
            onClick={() => onViewModeChange('week')}
            className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
              viewMode === 'week'
                ? 'bg-[var(--sage-primary)] text-white'
                : 'text-[var(--text-secondary)]'
            }`}
          >
            주
          </button>
          <button
            onClick={() => onViewModeChange('day')}
            className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
              viewMode === 'day'
                ? 'bg-[var(--sage-primary)] text-white'
                : 'text-[var(--text-secondary)]'
            }`}
          >
            일
          </button>
        </div>
      </div>

      {/* Validating indicator */}
      {isValidating && (
        <div className="absolute top-0 right-0 flex items-center gap-1.5 text-xs text-[var(--text-tertiary)]">
          <div className="w-2 h-2 bg-[var(--sage-primary)] rounded-full animate-pulse" />
          <span>갱신 중...</span>
        </div>
      )}
    </div>
  )
}

export const CalendarToolbar = memo(CalendarToolbarComponent)
export default CalendarToolbar
