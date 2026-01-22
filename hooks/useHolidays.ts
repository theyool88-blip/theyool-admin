'use client'

import { useState, useEffect, useMemo } from 'react'

interface Holiday {
  id: string
  holiday_date: string
  holiday_name: string
  year: number
}

interface HolidayCacheEntry {
  data: Holiday[]
  fetchedAt: number
}

interface HolidayCache {
  [year: number]: HolidayCacheEntry
}

// Module-level cache (shared across all tenants - holidays are global)
const holidayCache: HolidayCache = {}
const pendingFetches = new Map<number, Promise<Holiday[]>>()
const CACHE_TTL = 24 * 60 * 60 * 1000  // 24 hours

async function fetchHolidaysForYear(year: number): Promise<Holiday[]> {
  // Check cache first
  const cached = holidayCache[year]
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return cached.data
  }

  // Reuse pending fetch to prevent duplicate requests
  const pending = pendingFetches.get(year)
  if (pending) return pending

  // New fetch
  const promise = fetch(`/api/admin/holidays?year=${year}`)
    .then(res => res.json())
    .then(result => {
      const data = result.success ? result.data : []
      holidayCache[year] = { data, fetchedAt: Date.now() }
      pendingFetches.delete(year)
      return data
    })
    .catch(() => {
      pendingFetches.delete(year)
      return []
    })

  pendingFetches.set(year, promise)
  return promise
}

// Helper to check cache status
function getCachedHolidays(years: number[]): Holiday[] | null {
  if (years.length === 0) return []

  const allCached = years.every(year => {
    const cached = holidayCache[year]
    return cached && Date.now() - cached.fetchedAt < CACHE_TTL
  })

  if (allCached) {
    return years.flatMap(year => holidayCache[year].data)
  }
  return null
}

export function useHolidays(years: number[]) {
  // Stable years key for dependency tracking
  const yearsKey = useMemo(() => [...years].sort((a, b) => a - b).join(','), [years])

  // State for fetched data and loading status
  const [state, setState] = useState<{
    holidays: Holiday[]
    isLoading: boolean
    fetchedKey: string
  }>(() => {
    // Initialize with cached data if available
    const cached = getCachedHolidays(years)
    return {
      holidays: cached ?? [],
      isLoading: cached === null && years.length > 0,
      fetchedKey: yearsKey,
    }
  })

  // Trigger fetch when years change
  useEffect(() => {
    // Parse years from yearsKey to avoid dependency on unstable years array
    const yearsToFetch = yearsKey ? yearsKey.split(',').map(Number).filter(Boolean) : []

    // Skip if no years to fetch
    if (yearsToFetch.length === 0) {
      return
    }

    // Check if data is already cached
    const cached = getCachedHolidays(yearsToFetch)
    if (cached !== null) {
      // Already have cached data, no need to fetch
      return
    }

    let isMounted = true

    // Fetch all years in parallel
    Promise.all(yearsToFetch.map(fetchHolidaysForYear))
      .then(results => {
        if (isMounted) {
          setState({
            holidays: results.flat(),
            isLoading: false,
            fetchedKey: yearsKey,
          })
        }
      })

    return () => {
      isMounted = false
    }
  }, [yearsKey]) // Only depend on stable yearsKey string

  // Return cached data if available, otherwise state data
  const cachedData = getCachedHolidays(years)

  return {
    holidays: cachedData ?? state.holidays,
    isLoading: cachedData === null && state.isLoading,
  }
}

// Invalidate cache (for admin operations)
export function invalidateHolidayCache(year?: number) {
  if (year) {
    delete holidayCache[year]
  } else {
    Object.keys(holidayCache).forEach(k => delete holidayCache[Number(k)])
  }
}

// Pre-fetch holidays (useful for SSR or preloading)
export function prefetchHolidays(years: number[]) {
  years.forEach(year => {
    if (!holidayCache[year] && !pendingFetches.has(year)) {
      fetchHolidaysForYear(year)
    }
  })
}
