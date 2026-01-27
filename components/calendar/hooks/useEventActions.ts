import { useCallback } from 'react'
import type { BigCalendarEvent } from '../types'
import { formatDateString, formatTimeString } from '../utils/eventTransformers'

interface UseEventActionsOptions {
  onEventUpdate: (event: BigCalendarEvent) => void
  onRefetch: () => Promise<void>
}

interface UseEventActionsReturn {
  handleEventDrop: (args: { event: BigCalendarEvent; start: Date; end: Date }) => Promise<void>
  handleEventResize: (args: { event: BigCalendarEvent; start: Date; end: Date }) => Promise<void>
}

export function useEventActions({
  onEventUpdate,
  onRefetch,
}: UseEventActionsOptions): UseEventActionsReturn {
  // Handle event drop (drag and drop)
  const handleEventDrop = useCallback(async ({
    event,
    start,
    end,
  }: {
    event: BigCalendarEvent
    start: Date
    end: Date
  }) => {
    // Optimistic update
    const updatedEvent = { ...event, start, end }
    onEventUpdate(updatedEvent)

    try {
      const newDate = formatDateString(start)
      const newTime = formatTimeString(start)

      let apiEndpoint: string | null = null
      let updatePayload: Record<string, unknown> = {}

      switch (event.eventType) {
        case 'COURT_HEARING':
          apiEndpoint = `/api/admin/court-hearings/${event.id}`
          updatePayload = { hearing_date: newDate, hearing_time: newTime }
          break
        case 'DEADLINE':
          apiEndpoint = `/api/admin/case-deadlines/${event.id}`
          updatePayload = { deadline_date: newDate }
          break
        case 'CONSULTATION':
          apiEndpoint = `/api/admin/consultations/${event.id}`
          updatePayload = { scheduled_date: newDate, scheduled_time: newTime }
          break
        default:
          console.warn('Unknown event type, skipping API update:', event.eventType)
          return
      }

      if (apiEndpoint) {
        const response = await fetch(apiEndpoint, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatePayload),
        })
        const result = await response.json()
        if (!result.success) {
          throw new Error(result.error || 'Failed to update event')
        }
      }
    } catch (error) {
      console.error('Failed to update event:', error)
      // Revert by refetching
      await onRefetch()
    }
  }, [onEventUpdate, onRefetch])

  // Handle event resize
  const handleEventResize = useCallback(async ({
    event,
    start,
    end,
  }: {
    event: BigCalendarEvent
    start: Date
    end: Date
  }) => {
    // For now, resize is handled the same as drop
    // In the future, we might want to update duration as well
    return handleEventDrop({ event, start, end })
  }, [handleEventDrop])

  return {
    handleEventDrop,
    handleEventResize,
  }
}
