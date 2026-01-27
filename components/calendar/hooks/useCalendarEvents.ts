import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { startOfMonth, endOfMonth, addMonths, subMonths, format } from 'date-fns'
import type { BigCalendarEvent, TenantMember } from '../types'
import { convertToBigCalendarEvent } from '../utils/eventTransformers'

// Global cache (outside component)
const eventCache = new Map<string, {
  data: BigCalendarEvent[]
  timestamp: number
}>()

const CACHE_TTL = 5 * 60 * 1000  // 5 minutes
const STALE_TTL = 30 * 1000      // 30 seconds (stale state)

interface UseCalendarEventsOptions {
  currentDate: Date
  filterType: 'all' | 'court'
  selectedLawyers: string[]
}

interface UseCalendarEventsReturn {
  events: BigCalendarEvent[]
  allEvents: BigCalendarEvent[]
  loading: boolean
  isValidating: boolean  // Background revalidation
  tenantMembers: TenantMember[]
  refetch: () => Promise<void>
  updateEvent: (event: BigCalendarEvent) => void
  updateAttendingLawyer: (hearingId: string, lawyerId: string | null) => Promise<void>
  updatingLawyer: string | null
  prefetchAdjacent: () => void  // Prefetch adjacent months
}

function getCacheKey(startDate: string, endDate: string): string {
  return `${startDate}_${endDate}`
}

function getCachedData(key: string): BigCalendarEvent[] | null {
  const cached = eventCache.get(key)
  if (!cached) return null
  if (Date.now() - cached.timestamp > CACHE_TTL) {
    eventCache.delete(key)
    return null
  }
  return cached.data
}

function isStale(key: string): boolean {
  const cached = eventCache.get(key)
  if (!cached) return true
  return Date.now() - cached.timestamp > STALE_TTL
}

function setCachedData(key: string, data: BigCalendarEvent[]): void {
  eventCache.set(key, { data, timestamp: Date.now() })

  // Cache size limit (max 12 months)
  if (eventCache.size > 12) {
    const oldestKey = eventCache.keys().next().value
    if (oldestKey) eventCache.delete(oldestKey)
  }
}

export function useCalendarEvents({
  currentDate,
  filterType,
  selectedLawyers,
}: UseCalendarEventsOptions): UseCalendarEventsReturn {
  const [allEvents, setAllEvents] = useState<BigCalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [isValidating, setIsValidating] = useState(false)
  const [tenantMembers, setTenantMembers] = useState<TenantMember[]>([])
  const [updatingLawyer, setUpdatingLawyer] = useState<string | null>(null)

  const abortControllerRef = useRef<AbortController | null>(null)

  // Calculate date range for current view
  const monthStart = useMemo(() => startOfMonth(currentDate), [currentDate])
  const monthEnd = useMemo(() => endOfMonth(currentDate), [currentDate])

  // Stable date range key
  const startDate = useMemo(() => format(monthStart, 'yyyy-MM-dd'), [monthStart])
  const endDate = useMemo(() => format(monthEnd, 'yyyy-MM-dd'), [monthEnd])
  const cacheKey = useMemo(() => getCacheKey(startDate, endDate), [startDate, endDate])

  // Fetch tenant members (unchanged)
  const fetchTenantMembers = useCallback(async () => {
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { data } = await supabase
        .from('tenant_members')
        .select('id, display_name, role')
        .in('role', ['owner', 'lawyer'])
        .order('display_name')
      if (data) setTenantMembers(data)
    } catch (error) {
      console.error('테넌트 멤버 조회 실패:', error)
    }
  }, [])

  // Core fetch function
  const fetchSchedulesCore = useCallback(async (
    start: string,
    end: string,
    signal?: AbortSignal
  ): Promise<BigCalendarEvent[]> => {
    const response = await fetch(
      `/api/admin/calendar?start_date=${start}&end_date=${end}`,
      { signal }
    )
    const result = await response.json()

    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch schedules')
    }

    const bigCalendarEvents = (result.data || []).map(convertToBigCalendarEvent)

    // Sort deadlines to top
    return [...bigCalendarEvents].sort((a, b) => {
      const aDate = format(a.start, 'yyyy-MM-dd')
      const bDate = format(b.start, 'yyyy-MM-dd')
      if (aDate === bDate) {
        if (a.eventType === 'DEADLINE' && b.eventType !== 'DEADLINE') return -1
        if (a.eventType !== 'DEADLINE' && b.eventType === 'DEADLINE') return 1
      }
      return 0
    })
  }, [])

  // OPTIMIZATION: currentCacheKey ref to prevent race condition
  const currentCacheKeyRef = useRef(cacheKey)
  useEffect(() => {
    currentCacheKeyRef.current = cacheKey
  }, [cacheKey])

  // Main fetch with SWR pattern
  const fetchSchedules = useCallback(async () => {
    // 1. Check cache
    const cached = getCachedData(cacheKey)

    if (cached) {
      // Cache hit: immediately show data
      setAllEvents(cached)
      setLoading(false)

      // If stale, revalidate in background
      if (isStale(cacheKey)) {
        setIsValidating(true)
        // OPTIMIZATION: capture cacheKey for race condition guard
        const revalidatingCacheKey = cacheKey
        try {
          const freshData = await fetchSchedulesCore(startDate, endDate)
          setCachedData(revalidatingCacheKey, freshData)
          // CRITICAL: Race condition guard - only update if still on same month
          if (currentCacheKeyRef.current === revalidatingCacheKey) {
            setAllEvents(freshData)
          }
        } catch (error) {
          console.error('Background revalidation failed:', error)
        } finally {
          setIsValidating(false)
        }
      }
      return
    }

    // 2. Cache miss: show loading and fetch
    setLoading(true)

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    abortControllerRef.current = new AbortController()

    try {
      const data = await fetchSchedulesCore(
        startDate,
        endDate,
        abortControllerRef.current.signal
      )
      setCachedData(cacheKey, data)
      setAllEvents(data)
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return  // Cancelled request, ignore
      }
      console.error('Failed to load schedules:', error)
    } finally {
      setLoading(false)
    }
  }, [cacheKey, startDate, endDate, fetchSchedulesCore])

  // Prefetch adjacent months
  const prefetchAdjacent = useCallback(() => {
    const prevMonth = subMonths(currentDate, 1)
    const nextMonth = addMonths(currentDate, 1)

    const prevStart = format(startOfMonth(prevMonth), 'yyyy-MM-dd')
    const prevEnd = format(endOfMonth(prevMonth), 'yyyy-MM-dd')
    const nextStart = format(startOfMonth(nextMonth), 'yyyy-MM-dd')
    const nextEnd = format(endOfMonth(nextMonth), 'yyyy-MM-dd')

    const prevKey = getCacheKey(prevStart, prevEnd)
    const nextKey = getCacheKey(nextStart, nextEnd)

    // Prefetch in background if not cached
    if (!getCachedData(prevKey)) {
      fetchSchedulesCore(prevStart, prevEnd)
        .then(data => setCachedData(prevKey, data))
        .catch(() => {})  // Ignore prefetch errors
    }

    if (!getCachedData(nextKey)) {
      fetchSchedulesCore(nextStart, nextEnd)
        .then(data => setCachedData(nextKey, data))
        .catch(() => {})
    }
  }, [currentDate, fetchSchedulesCore])

  // Initial fetch
  useEffect(() => {
    fetchSchedules()
  }, [fetchSchedules])  // fetchSchedules includes cacheKey in its dependencies

  useEffect(() => {
    fetchTenantMembers()
  }, [fetchTenantMembers])

  // Prefetch when idle
  useEffect(() => {
    const timeoutId = setTimeout(prefetchAdjacent, 500)
    return () => clearTimeout(timeoutId)
  }, [prefetchAdjacent])

  // Filtered events
  const events = useMemo(() => {
    let filtered = allEvents

    if (filterType === 'court') {
      filtered = filtered.filter(e => e.eventType !== 'CONSULTATION')
    }

    if (selectedLawyers.length > 0) {
      filtered = filtered.filter(e => e.attendingLawyerId && selectedLawyers.includes(e.attendingLawyerId))
    }

    return filtered
  }, [allEvents, filterType, selectedLawyers])

  // Update single event (for optimistic UI after drag/drop)
  const updateEvent = useCallback((updatedEvent: BigCalendarEvent) => {
    setAllEvents(prev => prev.map(e => e.id === updatedEvent.id ? updatedEvent : e))

    // Also update cache
    const cached = eventCache.get(cacheKey)
    if (cached) {
      cached.data = cached.data.map(e => e.id === updatedEvent.id ? updatedEvent : e)
    }
  }, [cacheKey])

  // Update attending lawyer
  const updateAttendingLawyer = useCallback(async (hearingId: string, lawyerId: string | null) => {
    setUpdatingLawyer(hearingId)
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { error } = await supabase
        .from('court_hearings')
        .update({ attending_lawyer_id: lawyerId })
        .eq('id', hearingId)
      if (error) throw error

      const lawyerName = lawyerId
        ? tenantMembers.find(m => m.id === lawyerId)?.display_name
        : undefined

      setAllEvents(prev =>
        prev.map(e =>
          e.id === hearingId
            ? { ...e, attendingLawyerId: lawyerId || undefined, attendingLawyerName: lawyerName }
            : e
        )
      )

      // 캐시도 업데이트 (updateEvent와 일관성 유지)
      const cached = eventCache.get(cacheKey)
      if (cached) {
        cached.data = cached.data.map(e =>
          e.id === hearingId
            ? { ...e, attendingLawyerId: lawyerId || undefined, attendingLawyerName: lawyerName }
            : e
        )
      }
    } catch (error) {
      console.error('출석변호사 변경 실패:', error)
      alert('출석변호사 변경에 실패했습니다.')
    } finally {
      setUpdatingLawyer(null)
    }
  }, [tenantMembers, cacheKey])

  // Force refetch (cache invalidation)
  const refetch = useCallback(async () => {
    eventCache.delete(cacheKey)
    await fetchSchedules()
  }, [cacheKey, fetchSchedules])

  return {
    events,
    allEvents,
    loading,
    isValidating,
    tenantMembers,
    refetch,
    updateEvent,
    updateAttendingLawyer,
    updatingLawyer,
    prefetchAdjacent,
  }
}
