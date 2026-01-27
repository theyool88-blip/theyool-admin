import { useState, useCallback } from 'react'
import { addMonths, subMonths, addWeeks, subWeeks, addDays, subDays } from 'date-fns'
import type { ViewMode } from '../types'

interface UseCalendarNavigationReturn {
  currentDate: Date
  viewMode: ViewMode
  selectedDate: Date | null
  pickerYear: number
  showMonthPicker: boolean
  setCurrentDate: (date: Date) => void
  setViewMode: (mode: ViewMode) => void
  setSelectedDate: (date: Date | null) => void
  goToPrevious: () => void
  goToNext: () => void
  goToToday: () => void
  handleViewChange: (view: 'month' | 'week' | 'day') => void
  openMonthPicker: () => void
  closeMonthPicker: () => void
  setPickerYear: (year: number) => void
  handleMonthSelect: (month: number) => void
}

export function useCalendarNavigation(): UseCalendarNavigationReturn {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<ViewMode>('month')
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [showMonthPicker, setShowMonthPicker] = useState(false)
  const [pickerYear, setPickerYear] = useState(new Date().getFullYear())

  // Navigate to previous period based on view mode
  const goToPrevious = useCallback(() => {
    let newDate: Date
    switch (viewMode) {
      case 'week':
        newDate = subWeeks(currentDate, 1)
        break
      case 'day':
        newDate = subDays(currentDate, 1)
        break
      default: // 'month' or 'list'
        newDate = subMonths(currentDate, 1)
    }
    setCurrentDate(newDate)
  }, [currentDate, viewMode])

  // Navigate to next period based on view mode
  const goToNext = useCallback(() => {
    let newDate: Date
    switch (viewMode) {
      case 'week':
        newDate = addWeeks(currentDate, 1)
        break
      case 'day':
        newDate = addDays(currentDate, 1)
        break
      default: // 'month' or 'list'
        newDate = addMonths(currentDate, 1)
    }
    setCurrentDate(newDate)
  }, [currentDate, viewMode])

  // Navigate to today
  const goToToday = useCallback(() => {
    const today = new Date()
    setCurrentDate(today)
    setSelectedDate(today)
  }, [])

  // Handle view mode change
  const handleViewChange = useCallback((newView: 'month' | 'week' | 'day') => {
    setViewMode(newView)
  }, [])

  // Month picker handlers
  const openMonthPicker = useCallback(() => {
    setPickerYear(currentDate.getFullYear())
    setShowMonthPicker(true)
  }, [currentDate])

  const closeMonthPicker = useCallback(() => {
    setShowMonthPicker(false)
  }, [])

  const handleMonthSelect = useCallback((month: number) => {
    const newDate = new Date(pickerYear, month, 1)
    setCurrentDate(newDate)
    setShowMonthPicker(false)
  }, [pickerYear])

  return {
    currentDate,
    viewMode,
    selectedDate,
    pickerYear,
    showMonthPicker,
    setCurrentDate,
    setViewMode,
    setSelectedDate,
    goToPrevious,
    goToNext,
    goToToday,
    handleViewChange,
    openMonthPicker,
    closeMonthPicker,
    setPickerYear,
    handleMonthSelect,
  }
}
