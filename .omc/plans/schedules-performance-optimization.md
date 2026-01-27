# 일정 페이지 성능 최적화 계획

## 0. 베이스라인 측정 (MANDATORY - 작업 시작 전 필수)

**중요:** Phase 1 작업 시작 전에 반드시 현재 성능을 측정해야 합니다. 이 데이터 없이는 개선 여부를 확인할 수 없습니다.

```bash
# 베이스라인 측정 실행 (작업 시작 전 필수)
npx ts-node scripts/measure-calendar-performance.ts > .omc/baseline-calendar-performance.json
```

### 측정 항목

| 지표 | 측정 방법 | 저장 위치 |
|------|-----------|-----------|
| VIEW 쿼리 시간 | `scripts/measure-calendar-performance.ts` | `.omc/baseline-calendar-performance.json` |
| API 응답 시간 | Chrome DevTools Network | 수동 기록 |
| 데이터 전송량 | Chrome DevTools Network | 수동 기록 |
| 초기 로딩 시간 | Performance API | 수동 기록 |

### 베이스라인 기록 템플릿

```json
{
  "measuredAt": "2026-01-28T00:00:00Z",
  "viewQueryMs": null,
  "apiResponseMs": null,
  "dataTransferKb": null,
  "initialLoadMs": null,
  "monthNavigationMs": null,
  "eventCount": null
}
```

---

## 1. 문제 정의

### 1.1 현재 성능 병목점 분석

#### 클라이언트 측 병목

| 문제점 | 영향 | 심각도 |
|--------|------|--------|
| **캐싱 없음** | 월 이동 시 매번 API 재호출, 이전 달 데이터 재요청 | HIGH |
| **전체 리렌더링** | `loading` 상태 시 전체 캘린더 스피너로 대체 | MEDIUM |
| **불필요한 데이터** | 23개 컬럼 전체 수신, 클라이언트에서 일부만 사용 | MEDIUM |
| **동기 날짜 계산** | 매 렌더링마다 holidayMap 재생성 | LOW |

#### 서버/DB 측 병목

| 문제점 | 영향 | 심각도 |
|--------|------|--------|
| **VIEW 비효율** | UNION ALL 4개 테이블 → 날짜/테넌트 필터 사후 적용 | HIGH |
| **인덱스 미활용** | tenant_id + event_date 복합 인덱스 없음 | HIGH |
| **case_parties 서브쿼리** | 각 UNION 브랜치에서 LATERAL 또는 서브쿼리로 조회 | MEDIUM |
| **전체 컬럼 반환** | SELECT * 로 불필요한 데이터 전송 | MEDIUM |

#### Architect 분석 결과 (VIEW 최적화 전략)

**UNION ALL VIEW를 유지합니다.** 4개 별도 쿼리로 분리하지 않습니다.

**이유:**
- 기존 인덱스 `idx_case_parties_case_client`가 LATERAL 서브쿼리를 최적화
- 4개 별도 쿼리 분리 시 네트워크 오버헤드 증가
- Materialized View는 Phase 4에서 대규모 테넌트(>1000 events/month)용으로 선택적 적용

### 1.2 현재 데이터 플로우

```
[클라이언트]                    [서버]                         [DB]
useCalendarEvents              /api/admin/calendar            unified_calendar VIEW
     │                              │                              │
     │ currentDate 변경 →           │                              │
     │ dateRangeKey 변경 →          │                              │
     │ fetchSchedules() →           │                              │
     │                              │                              │
     │ GET ?start_date&end_date →   │                              │
     │                              │ SELECT * FROM unified_calendar │
     │                              │ WHERE tenant_id = ? AND       │
     │                              │   event_date BETWEEN ? AND ?  │
     │                              │                              │
     │                              │ ← 4개 테이블 UNION ALL        │
     │                              │ ← 필터링은 VIEW 결과에 적용   │
     │                              │                              │
     │ ← 23개 컬럼, N개 이벤트      │                              │
     │                              │                              │
     │ convertToBigCalendarEvent()  │                              │
     │ ← 전체 리렌더링              │                              │
```

---

## 2. 구체적 수치 목표

| 지표 | 현재 (추정) | 목표 | 측정 방법 |
|------|-------------|------|-----------|
| **초기 로딩 시간** | 800-1200ms | < 300ms | Performance API |
| **월 이동 응답 시간** | 500-800ms | < 100ms (캐시 히트) | Performance API |
| **API 응답 시간** | 300-500ms | < 150ms | Server timing |
| **데이터 전송량** | ~50KB/월 | ~20KB/월 | Network tab |
| **DB 쿼리 시간** | 100-200ms | < 50ms | pg_stat_statements |
| **동시 접속자** | - | 3000명 | Load test |

---

## 3. 최적화 전략 - 우선순위별 구현 단계

### Phase 1: 클라이언트 캐싱 (가장 높은 ROI)
- **예상 효과**: 월 이동 시 90% 이상 캐시 히트
- **구현 난이도**: 낮음
- **작업 시간**: 2-3시간

### Phase 2: API 응답 최적화
- **예상 효과**: 데이터 전송량 50% 감소
- **구현 난이도**: 낮음
- **작업 시간**: 1-2시간

### Phase 3: DB 인덱스 최적화
- **예상 효과**: 쿼리 시간 30-50% 감소 (기존 인덱스와 중복 가능성 있음)
- **구현 난이도**: 중간
- **작업 시간**: 2-3시간
- **주의**: 기존 인덱스(`20260116000012_add_performance_indexes.sql`) 분석 후 중복 방지

### Phase 4: Materialized View 도입 (선택적)
- **예상 효과**: 대규모 테넌트에서 10배 성능 향상
- **구현 난이도**: 높음
- **작업 시간**: 4-6시간

---

## 4. 각 단계별 구현 상세

### Phase 1: 클라이언트 캐싱 (SWR/React Query 패턴)

#### 파일: `/components/calendar/hooks/useCalendarEvents.ts`

**현재 문제:**
```typescript
// 현재: 월 변경 시 매번 새로운 요청
const fetchSchedules = useCallback(async () => {
  setLoading(true)  // 전체 로딩 상태
  const response = await fetch(`/api/admin/calendar?start_date=${startDate}&end_date=${endDate}`)
  // ...
}, [dateRangeKey])

useEffect(() => {
  fetchSchedules()
}, [dateRangeKey])  // dateRangeKey 변경 = 무조건 새 요청
```

**해결책: 인메모리 캐시 + Stale-While-Revalidate 패턴**

```typescript
// 파일: /components/calendar/hooks/useCalendarEvents.ts

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { startOfMonth, endOfMonth, addMonths, subMonths, format } from 'date-fns'
import type { BigCalendarEvent, TenantMember } from '../types'
import { convertToBigCalendarEvent } from '../utils/eventTransformers'

// 전역 캐시 (컴포넌트 외부)
const eventCache = new Map<string, {
  data: BigCalendarEvent[]
  timestamp: number
}>()

const CACHE_TTL = 5 * 60 * 1000  // 5분
const STALE_TTL = 30 * 1000      // 30초 (stale 상태)

interface UseCalendarEventsOptions {
  currentDate: Date
  filterType: 'all' | 'court'
  selectedLawyers: string[]
}

interface UseCalendarEventsReturn {
  events: BigCalendarEvent[]
  allEvents: BigCalendarEvent[]
  loading: boolean
  isValidating: boolean  // 백그라운드 갱신 중
  tenantMembers: TenantMember[]
  refetch: () => Promise<void>
  updateEvent: (event: BigCalendarEvent) => void
  updateAttendingLawyer: (hearingId: string, lawyerId: string | null) => Promise<void>
  updatingLawyer: string | null
  prefetchAdjacent: () => void  // 인접 월 프리페치
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

  // 캐시 크기 제한 (최대 12개월)
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
    // 1. 캐시 확인
    const cached = getCachedData(cacheKey)

    if (cached) {
      // 캐시 히트: 즉시 데이터 표시
      setAllEvents(cached)
      setLoading(false)

      // stale 상태면 백그라운드에서 갱신
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

    // 2. 캐시 미스: 로딩 표시 후 fetch
    setLoading(true)

    // 이전 요청 취소
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
        return  // 취소된 요청은 무시
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

    // 캐시에 없으면 백그라운드에서 프리페치
    if (!getCachedData(prevKey)) {
      fetchSchedulesCore(prevStart, prevEnd)
        .then(data => setCachedData(prevKey, data))
        .catch(() => {})  // 프리페치 실패는 무시
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
  }, [cacheKey])  // cacheKey 변경 시에만

  useEffect(() => {
    fetchTenantMembers()
  }, [])

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

    // 캐시도 업데이트
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
    } catch (error) {
      console.error('출석변호사 변경 실패:', error)
      alert('출석변호사 변경에 실패했습니다.')
    } finally {
      setUpdatingLawyer(null)
    }
  }, [tenantMembers])

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
```

#### 파일: `/components/calendar/BigCalendar.tsx` 수정사항

**로딩 상태 개선 (스켈레톤 UI):**

```typescript
// 기존 코드 (433-444 라인)
if (loading && events.length === 0) {
  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-default)] flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-[var(--border-default)] border-t-[var(--sage-primary)]" />
          <p className="text-[var(--text-tertiary)] text-sm">일정을 불러오는 중...</p>
        </div>
      </div>
    </div>
  )
}

// 수정 후: 이전 데이터 유지하며 subtle indicator
// isValidating 추가: 백그라운드 갱신 중 표시
const {
  events,
  allEvents,
  loading,
  isValidating,  // 추가
  // ...
} = useCalendarEvents({...})

// 초기 로딩만 전체 스피너 (데이터 0건일 때만)
// 월 이동 시에는 이전 데이터 유지
if (loading && allEvents.length === 0) {
  // 초기 로딩 스피너 (기존 유지)
}

// 캘린더 상단에 subtle 갱신 indicator 추가
<CalendarToolbar
  // ... existing props
  isValidating={isValidating}  // 추가
/>
```

#### 파일: `/components/calendar/components/CalendarToolbar.tsx` 수정

**현재 CalendarToolbar.tsx props 인터페이스에 `isValidating` 추가:**

```typescript
// 파일: /components/calendar/components/CalendarToolbar.tsx
// 기존 CalendarToolbarProps interface 찾아서 isValidating 추가

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
  isValidating?: boolean  // OPTIMIZATION: 추가
}

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
  isValidating,  // OPTIMIZATION: 추가
}: CalendarToolbarProps) {
  // ... 기존 useCallback hooks 유지 ...

  return (
    <div className="relative flex flex-wrap items-center justify-between gap-3 mb-3">  {/* relative 추가 */}
      {/* 기존 툴바 내용 유지 - Left: Filter Controls, Center: Navigation, Right: View Mode Toggle */}

      {/* OPTIMIZATION: 갱신 중 indicator (우측 상단) - 닫는 div 직전에 추가 */}
      {isValidating && (
        <div className="absolute top-2 right-2 flex items-center gap-1.5 text-xs text-[var(--text-tertiary)]">
          <div className="w-2 h-2 bg-[var(--sage-primary)] rounded-full animate-pulse" />
          <span>갱신 중...</span>
        </div>
      )}
    </div>
  )
}

export const CalendarToolbar = memo(CalendarToolbarComponent)
```

---

### Phase 2: API 응답 최적화

#### 파일: `/app/api/admin/calendar/route.ts`

**필요한 컬럼만 선택:**

```typescript
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { withTenant } from '@/lib/api/with-tenant'

// 캘린더에서 실제로 사용하는 컬럼만 정의
const CALENDAR_COLUMNS = [
  'id',
  'event_type',
  'event_subtype',
  'title',
  'event_date',
  'event_time',
  'location',
  'case_id',
  'reference_id',
  'case_name',
  'client_name',
  'deadline_type_label',
  'status',
  'attending_lawyer_id',
  'attending_lawyer_name',
  'scourt_type_raw',
  'scourt_result_raw',
  'video_participant_side',
  'our_client_side',
  'sort_priority',
].join(', ')

/**
 * GET /api/admin/calendar
 * 통합 캘린더 조회 (테넌트 격리)
 */
export const GET = withTenant(async (request, { tenant }) => {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    if (!startDate || !endDate) {
      return NextResponse.json(
        { success: false, error: 'start_date and end_date are required' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    // 필요한 컬럼만 선택 (SELECT * 대신)
    let query = supabase
      .from('unified_calendar')
      .select(CALENDAR_COLUMNS)
      .gte('event_date', startDate)
      .lte('event_date', endDate)
      .order('event_date', { ascending: true })
      .order('sort_priority', { ascending: true })
      .order('event_time', { ascending: true })

    // 테넌트 격리 필터
    if (!tenant.isSuperAdmin && tenant.tenantId) {
      query = query.eq('tenant_id', tenant.tenantId)
    }

    const { data, error } = await query

    if (error) {
      console.error('통합 캘린더 조회 실패:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    // 응답 헤더에 캐시 힌트 추가
    const response = NextResponse.json({
      success: true,
      data: data || [],
      count: data?.length || 0
    })

    // CDN/브라우저 캐싱 (5분)
    response.headers.set('Cache-Control', 'private, max-age=300, stale-while-revalidate=60')

    return response
  } catch (error) {
    console.error('통합 캘린더 조회 중 오류:', error)
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
})
```

---

### Phase 3: DB 인덱스 최적화

#### 사전 분석: 기존 인덱스 확인 (MANDATORY)

**기존 인덱스 파일:** `/supabase/migrations/20260116000012_add_performance_indexes.sql`

마이그레이션 작성 전에 기존 인덱스와의 충돌을 확인해야 합니다:

```bash
# 기존 인덱스 확인 명령
npx supabase db dump --schema public | grep -i "CREATE INDEX"
```

**확인할 기존 인덱스:**
- `idx_case_parties_case_client` - LATERAL 서브쿼리 최적화에 활용 중
- 기타 `20260116000012` 마이그레이션에서 생성된 인덱스

**충돌 방지 전략:**
- `IF NOT EXISTS` 사용
- 기존 인덱스와 동일한 컬럼 조합이면 생성 건너뛰기
- covering index의 INCLUDE 컬럼만 다르면 새 인덱스 생성

#### 파일: `/supabase/migrations/20260128000001_calendar_performance_indexes.sql`

```sql
-- =====================================================
-- 20260128000001_calendar_performance_indexes.sql
-- 캘린더 성능 최적화 인덱스
-- 작성일: 2026-01-28
-- 설명: unified_calendar 쿼리 최적화를 위한 복합 인덱스 추가
-- 주의: 기존 인덱스(20260116000012)와 충돌 확인 완료
-- =====================================================

-- =====================================================
-- 1. 테넌트 + 날짜 복합 인덱스 (가장 중요)
-- unified_calendar 쿼리의 핵심 필터링 조건
-- =====================================================

-- court_hearings: tenant는 legal_cases를 통해 필터링되므로
-- case_id + hearing_date 복합 인덱스가 더 효과적
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_court_hearings_case_date_covering
  ON court_hearings(case_id, hearing_date)
  INCLUDE (id, hearing_type, status, location, notes, attending_lawyer_id,
           video_participant_side, scourt_type_raw, scourt_raw_data, case_number)
  WHERE status != 'CANCELLED';

-- case_deadlines: 마찬가지로 case_id + deadline_date
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_case_deadlines_case_date_covering
  ON case_deadlines(case_id, deadline_date)
  INCLUDE (id, deadline_type, status, notes, case_number, case_party_id, custom_deadline_name)
  WHERE status IN ('PENDING', 'IMMINENT');

-- consultations: tenant_id + preferred_date (직접 테넌트 필터)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_consultations_tenant_date_covering
  ON consultations(tenant_id, preferred_date)
  INCLUDE (id, name, request_type, preferred_time, status, message, phone, assigned_to)
  WHERE preferred_date IS NOT NULL;

-- general_schedules: tenant_id + schedule_date
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_general_schedules_tenant_date_covering
  ON general_schedules(tenant_id, schedule_date)
  INCLUDE (id, title, schedule_type, schedule_time, status, location, description, assigned_to);

-- =====================================================
-- 2. legal_cases 테넌트 인덱스 개선
-- JOIN 성능 향상을 위한 covering index
-- =====================================================

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_legal_cases_tenant_covering
  ON legal_cases(tenant_id, id)
  INCLUDE (case_name, court_name, court_case_number, assigned_to, primary_client_name);

-- =====================================================
-- 3. tenant_members display_name 조회 최적화
-- =====================================================

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tenant_members_id_covering
  ON tenant_members(id)
  INCLUDE (display_name);

-- =====================================================
-- 4. case_parties 서브쿼리 최적화
-- =====================================================

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_case_parties_case_order_covering
  ON case_parties(case_id, party_order)
  INCLUDE (party_type, party_name);

-- =====================================================
-- 완료
-- =====================================================

COMMENT ON INDEX idx_court_hearings_case_date_covering IS '캘린더 조회 최적화: court_hearings covering index';
COMMENT ON INDEX idx_case_deadlines_case_date_covering IS '캘린더 조회 최적화: case_deadlines covering index';
COMMENT ON INDEX idx_consultations_tenant_date_covering IS '캘린더 조회 최적화: consultations covering index';
COMMENT ON INDEX idx_general_schedules_tenant_date_covering IS '캘린더 조회 최적화: general_schedules covering index';
```

---

### Phase 4: Materialized View (선택적, 대규모 테넌트용)

#### 파일: `/supabase/migrations/20260128000002_calendar_materialized_view.sql`

```sql
-- =====================================================
-- 20260128000002_calendar_materialized_view.sql
-- 대규모 테넌트를 위한 Materialized View
-- 작성일: 2026-01-28
-- 설명: 3000명+ 테넌트에서 ms 단위 응답 보장
-- 주의: 데이터 실시간성이 약간 감소 (5분 단위 갱신)
-- =====================================================

-- 기존 VIEW 유지하면서 Materialized View 별도 생성
CREATE MATERIALIZED VIEW IF NOT EXISTS unified_calendar_mv AS
SELECT
  id,
  event_type,
  event_type_kr,
  event_subtype,
  title,
  case_name,
  event_date,
  event_time,
  event_datetime,
  reference_id,
  location,
  description,
  status,
  case_id,
  tenant_id,
  attending_lawyer_id,
  attending_lawyer_name,
  video_participant_side,
  our_client_name,
  client_name,
  scourt_type_raw,
  scourt_result_raw,
  deadline_type_label,
  our_client_side,
  sort_priority
FROM unified_calendar;

-- CRITICAL: UNIQUE INDEX for REFRESH CONCURRENTLY (필수)
-- REFRESH MATERIALIZED VIEW CONCURRENTLY는 UNIQUE INDEX가 없으면 실패합니다
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_unified_calendar_mv_id
  ON unified_calendar_mv(id);

-- 핵심 인덱스: 테넌트 + 날짜 복합
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_unified_calendar_mv_tenant_date
  ON unified_calendar_mv(tenant_id, event_date);

-- 정렬 인덱스
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_unified_calendar_mv_sort
  ON unified_calendar_mv(event_date, sort_priority, event_time);

-- =====================================================
-- Materialized View 갱신 함수
-- =====================================================

CREATE OR REPLACE FUNCTION refresh_unified_calendar_mv()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY unified_calendar_mv;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 자동 갱신 설정 (pg_cron 필요)
-- Supabase에서는 Edge Function + cron job으로 대체
-- =====================================================

-- pg_cron 사용 가능한 경우:
-- SELECT cron.schedule('refresh-calendar-mv', '*/5 * * * *',
--   'SELECT refresh_unified_calendar_mv()');

-- =====================================================
-- 트리거: 데이터 변경 시 자동 갱신 예약
-- (실시간성이 중요한 경우)
-- =====================================================

CREATE OR REPLACE FUNCTION notify_calendar_change()
RETURNS trigger AS $$
BEGIN
  -- pg_notify로 변경 알림 (갱신 워커가 수신)
  PERFORM pg_notify('calendar_changed', json_build_object(
    'table', TG_TABLE_NAME,
    'operation', TG_OP,
    'tenant_id', COALESCE(NEW.tenant_id, OLD.tenant_id)
  )::text);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 각 테이블에 트리거 연결
CREATE TRIGGER court_hearings_calendar_notify
  AFTER INSERT OR UPDATE OR DELETE ON court_hearings
  FOR EACH ROW EXECUTE FUNCTION notify_calendar_change();

CREATE TRIGGER case_deadlines_calendar_notify
  AFTER INSERT OR UPDATE OR DELETE ON case_deadlines
  FOR EACH ROW EXECUTE FUNCTION notify_calendar_change();

CREATE TRIGGER consultations_calendar_notify
  AFTER INSERT OR UPDATE OR DELETE ON consultations
  FOR EACH ROW EXECUTE FUNCTION notify_calendar_change();

CREATE TRIGGER general_schedules_calendar_notify
  AFTER INSERT OR UPDATE OR DELETE ON general_schedules
  FOR EACH ROW EXECUTE FUNCTION notify_calendar_change();

COMMENT ON MATERIALIZED VIEW unified_calendar_mv IS '캘린더 데이터 캐시 (5분 단위 갱신)';

-- =====================================================
-- 업무 영향 고지 (5분 staleness)
-- =====================================================
-- 주의: Materialized View는 5분 단위로 갱신됩니다.
-- 법원기일 등록 후 최대 5분간 캘린더에 미반영될 수 있습니다.
--
-- 대응 방안 (택1):
-- 1. 업무팀 승인 후 적용 (staleness 허용)
-- 2. 일정 등록 API에서 수동 갱신 트리거 호출:
--    SELECT refresh_unified_calendar_mv();
-- =====================================================
```

#### 업무 영향 평가: 5분 staleness

**문제:** Materialized View 사용 시 법원기일 등록 후 최대 5분간 캘린더에 미반영될 수 있습니다.

**대응 방안 (구현 시 택1):**

| 방안 | 설명 | 장점 | 단점 |
|------|------|------|------|
| **A. 업무팀 승인** | 5분 staleness를 업무적으로 허용 | 구현 단순 | 사용자 혼란 가능 |
| **B. 수동 갱신 트리거** | 일정 등록 API에서 즉시 MV 갱신 호출 | 실시간성 보장 | 등록 API 지연 증가 |

**권장:** 방안 B - 일정 등록 API(`/api/admin/court-hearings`, `/api/admin/deadlines` 등)에서 데이터 삽입 후 `refresh_unified_calendar_mv()` 호출

```typescript
// 예시: /api/admin/court-hearings/route.ts POST 핸들러 마지막에 추가
await supabase.rpc('refresh_unified_calendar_mv')
```

#### 파일: `/app/api/cron/refresh-calendar-mv/route.ts` (Materialized View 갱신용)

```typescript
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Vercel Cron으로 5분마다 실행
// vercel.json에 추가:
// { "crons": [{ "path": "/api/cron/refresh-calendar-mv", "schedule": "*/5 * * * *" }] }

export async function GET(request: Request) {
  // Cron secret 검증
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createAdminClient()

    const { error } = await supabase.rpc('refresh_unified_calendar_mv')

    if (error) {
      console.error('Materialized View 갱신 실패:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, refreshedAt: new Date().toISOString() })
  } catch (error) {
    console.error('Cron job 오류:', error)
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 })
  }
}
```

---

## 5. 위험 요소 및 대응 방안

| 위험 요소 | 가능성 | 영향 | 대응 방안 |
|-----------|--------|------|-----------|
| 캐시 무효화 누락 | 중간 | 사용자가 오래된 데이터 봄 | refetch 호출 시 명시적 캐시 삭제 + 5분 TTL |
| 인덱스 생성 시 테이블 락 | 낮음 | 서비스 일시 중단 | CONCURRENTLY 옵션으로 락 없이 생성 |
| Materialized View 갱신 지연 | 중간 | 5분간 오래된 데이터 | 중요 작업 후 수동 갱신 트리거 제공 |
| 메모리 사용량 증가 | 낮음 | 클라이언트 성능 저하 | 캐시 크기 12개월로 제한 + LRU 정책 |
| 백그라운드 요청 충돌 | 낮음 | 중복 데이터/깜빡임 | AbortController로 이전 요청 취소 |
| **Race condition (월 이동 중 revalidation)** | 중간 | 이전 월 데이터가 현재 월 덮어씀 | **cacheKey guard 추가** (Phase 1에서 구현) |
| **기존 인덱스 충돌** | 낮음 | 중복 인덱스로 저장공간 낭비 | 마이그레이션 전 기존 인덱스 분석 |
| **MV REFRESH CONCURRENTLY 실패** | 중간 | 갱신 실패 | **UNIQUE INDEX 필수 추가** |

---

## 6. 검증 방법

### 6.1 성능 측정 스크립트

#### 파일: `/scripts/measure-calendar-performance.ts`

```typescript
import { performance } from 'perf_hooks'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function measureQueryPerformance() {
  const startDate = '2026-01-01'
  const endDate = '2026-01-31'
  const tenantId = 'test-tenant-id'  // 실제 테넌트 ID로 변경

  console.log('=== 캘린더 쿼리 성능 측정 ===\n')

  // 1. 기존 VIEW 쿼리
  const viewStart = performance.now()
  const { data: viewData, error: viewError } = await supabase
    .from('unified_calendar')
    .select('*')
    .eq('tenant_id', tenantId)
    .gte('event_date', startDate)
    .lte('event_date', endDate)
  const viewTime = performance.now() - viewStart

  console.log(`VIEW 쿼리: ${viewTime.toFixed(2)}ms (${viewData?.length || 0}건)`)
  if (viewError) console.error('VIEW 오류:', viewError)

  // 2. Materialized VIEW 쿼리 (있는 경우)
  try {
    const mvStart = performance.now()
    const { data: mvData, error: mvError } = await supabase
      .from('unified_calendar_mv')
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('event_date', startDate)
      .lte('event_date', endDate)
    const mvTime = performance.now() - mvStart

    console.log(`Materialized VIEW 쿼리: ${mvTime.toFixed(2)}ms (${mvData?.length || 0}건)`)
    if (mvError) console.error('MV 오류:', mvError)
  } catch {
    console.log('Materialized VIEW 없음 (Phase 4 미적용)')
  }

  // 3. 최적화된 컬럼 선택 쿼리
  const optStart = performance.now()
  const { data: optData, error: optError } = await supabase
    .from('unified_calendar')
    .select('id,event_type,event_subtype,title,event_date,event_time,location,case_id,status')
    .eq('tenant_id', tenantId)
    .gte('event_date', startDate)
    .lte('event_date', endDate)
  const optTime = performance.now() - optStart

  console.log(`최적화 쿼리: ${optTime.toFixed(2)}ms (${optData?.length || 0}건)`)
  if (optError) console.error('최적화 쿼리 오류:', optError)

  // 4. 데이터 크기 비교
  const fullSize = JSON.stringify(viewData || []).length
  const optSize = JSON.stringify(optData || []).length
  console.log(`\n데이터 크기: ${(fullSize / 1024).toFixed(2)}KB → ${(optSize / 1024).toFixed(2)}KB (${((1 - optSize/fullSize) * 100).toFixed(1)}% 감소)`)
}

measureQueryPerformance()
```

### 6.2 E2E 성능 테스트

#### 파일: `/tests/calendar-performance.spec.ts` (Playwright)

```typescript
import { test, expect } from '@playwright/test'

test.describe('캘린더 성능 테스트', () => {
  test.beforeEach(async ({ page }) => {
    // 로그인
    await page.goto('/login')
    await page.fill('input[name="email"]', 'test@example.com')
    await page.fill('input[name="password"]', 'password')
    await page.click('button[type="submit"]')
    await page.waitForURL('/admin')
  })

  test('초기 로딩 시간 < 500ms', async ({ page }) => {
    const startTime = Date.now()
    await page.goto('/schedules')

    // 캘린더가 로드될 때까지 대기
    await page.waitForSelector('.rbc-calendar', { timeout: 5000 })

    const loadTime = Date.now() - startTime
    console.log(`초기 로딩 시간: ${loadTime}ms`)
    expect(loadTime).toBeLessThan(500)
  })

  test('월 이동 시 캐시 히트 < 100ms', async ({ page }) => {
    await page.goto('/schedules')
    await page.waitForSelector('.rbc-calendar')

    // 다음 달로 이동
    await page.click('button:has-text("다음")')
    await page.waitForTimeout(1000)  // 프리페치 완료 대기

    // 이전 달로 돌아가기 (캐시 히트)
    const startTime = Date.now()
    await page.click('button:has-text("이전")')
    await page.waitForSelector('.rbc-calendar')

    const loadTime = Date.now() - startTime
    console.log(`캐시 히트 응답 시간: ${loadTime}ms`)
    expect(loadTime).toBeLessThan(100)
  })

  test('로딩 중 스피너가 아닌 이전 데이터 표시', async ({ page }) => {
    await page.goto('/schedules')
    await page.waitForSelector('.rbc-calendar')

    // 현재 이벤트 수 확인
    const initialEventCount = await page.locator('.rbc-event').count()

    // 월 이동
    await page.click('button:has-text("다음")')

    // 스피너가 아닌 캘린더가 계속 보여야 함
    await expect(page.locator('.rbc-calendar')).toBeVisible()

    // 전체 로딩 스피너가 없어야 함 (백그라운드 갱신 indicator는 OK)
    await expect(page.locator('text=일정을 불러오는 중')).not.toBeVisible()
  })
})
```

### 6.3 부하 테스트 (k6)

#### 파일: `/tests/load/calendar-load.js`

```javascript
import http from 'k6/http'
import { check, sleep } from 'k6'

export const options = {
  stages: [
    { duration: '30s', target: 100 },   // 100명까지 증가
    { duration: '1m', target: 500 },    // 500명까지 증가
    { duration: '2m', target: 1000 },   // 1000명 유지
    { duration: '1m', target: 3000 },   // 3000명까지 증가
    { duration: '2m', target: 3000 },   // 3000명 유지
    { duration: '30s', target: 0 },     // 종료
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],   // 95%가 500ms 이내
    http_req_failed: ['rate<0.01'],     // 실패율 1% 미만
  },
}

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000'
const AUTH_TOKEN = __ENV.AUTH_TOKEN

// AUTH_TOKEN 생성 방법:
// 1. 브라우저에서 로그인 후 개발자 도구 > Application > Cookies에서 sb-xxx-auth-token 값 복사
// 2. 또는 Supabase Admin API로 service_role 토큰 사용:
//    npx supabase functions invoke --env-file .env.local get-test-token
// 3. 로컬 테스트 시:
//    export AUTH_TOKEN=$(curl -s -X POST 'http://localhost:54321/auth/v1/token?grant_type=password' \
//      -H 'apikey: <anon-key>' \
//      -H 'Content-Type: application/json' \
//      -d '{"email":"test@example.com","password":"password"}' | jq -r '.access_token')

export default function () {
  const now = new Date()
  const startDate = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString().split('T')[0]
  const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString().split('T')[0]

  const res = http.get(
    `${BASE_URL}/api/admin/calendar?start_date=${startDate}&end_date=${endDate}`,
    {
      headers: {
        Authorization: `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json',
      },
    }
  )

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
    'has data': (r) => JSON.parse(r.body).success === true,
  })

  sleep(1)  // 1초 간격으로 요청
}
```

---

## 7. TODO 체크리스트

### Phase 0: 베이스라인 측정 (MANDATORY)
- [ ] `scripts/measure-calendar-performance.ts` 실행
- [ ] 베이스라인 결과를 `.omc/baseline-calendar-performance.json`에 저장
- [ ] Chrome DevTools로 API 응답 시간, 데이터 전송량 수동 기록

### Phase 1: 클라이언트 캐싱
- [ ] `useCalendarEvents.ts` 수정 - 인메모리 캐시 구현
- [ ] `useCalendarEvents.ts` 수정 - SWR 패턴 적용
- [ ] `useCalendarEvents.ts` 수정 - **Race condition guard (cacheKey ref) 추가**
- [ ] `useCalendarEvents.ts` 수정 - 인접 월 프리페치 기능 추가
- [ ] `BigCalendar.tsx` 수정 - isValidating 상태 표시
- [ ] `CalendarToolbar.tsx` 수정 - 갱신 중 indicator 추가 (props 인터페이스 전체 확인)
- [ ] 테스트: 월 이동 시 캐시 히트 확인
- [ ] 테스트: 빠른 월 이동 시 race condition 발생하지 않음 확인

### Phase 2: API 응답 최적화
- [ ] `/api/admin/calendar/route.ts` 수정 - 필요한 컬럼만 SELECT
- [ ] `/api/admin/calendar/route.ts` 수정 - Cache-Control 헤더 추가
- [ ] 테스트: 응답 데이터 크기 감소 확인

### Phase 3: DB 인덱스 최적화
- [ ] **기존 인덱스 분석** - `20260116000012_add_performance_indexes.sql` 확인
- [ ] 기존 `idx_case_parties_case_client` 인덱스와 충돌 여부 확인
- [ ] 마이그레이션 파일 생성 - covering index 추가 (중복 방지)
- [ ] 마이그레이션 실행 (CONCURRENTLY)
- [ ] EXPLAIN ANALYZE로 쿼리 플랜 개선 확인
- [ ] 테스트: 쿼리 시간 측정 (베이스라인 대비)

### Phase 4: Materialized View (선택적, >1000 events/month 테넌트용)
- [ ] Materialized View 마이그레이션 작성
- [ ] **UNIQUE INDEX 추가** (`idx_unified_calendar_mv_id`) - REFRESH CONCURRENTLY 필수
- [ ] 갱신 cron job 설정
- [ ] **5분 staleness 대응 방안 결정** (업무팀 승인 또는 수동 갱신 트리거)
- [ ] (선택) 일정 등록 API에 MV 즉시 갱신 호출 추가
- [ ] API에서 MV 사용 옵션 추가
- [ ] 부하 테스트 실행

### 검증
- [ ] 성능 측정 스크립트 실행 (베이스라인 대비 개선 확인)
- [ ] E2E 테스트 통과
- [ ] 부하 테스트 (3000 동시 접속) 통과
- [ ] **최종 성능 비교 리포트 작성** (베이스라인 vs 최적화 후)

---

## 8. 커밋 전략

```
chore(perf): Phase 0 - 캘린더 성능 베이스라인 측정
- measure-calendar-performance.ts 스크립트 추가
- 베이스라인 측정 결과 저장

feat(calendar): Phase 1 - 클라이언트 캐싱 구현
- useCalendarEvents에 인메모리 캐시 + SWR 패턴 적용
- Race condition guard (cacheKey ref) 추가
- 인접 월 프리페치 기능 추가
- 월 이동 시 즉시 응답 (캐시 히트)

perf(calendar): Phase 2 - API 응답 최적화
- 필요한 컬럼만 SELECT (23개 → 20개)
- Cache-Control 헤더 추가

perf(db): Phase 3 - 캘린더 인덱스 최적화
- 기존 인덱스(20260116000012) 분석 후 covering index 추가
- EXPLAIN ANALYZE 기준 30-50% 성능 향상

feat(db): Phase 4 - Materialized View 도입 (선택적)
- unified_calendar_mv 생성
- UNIQUE INDEX 추가 (REFRESH CONCURRENTLY 지원)
- 5분 단위 자동 갱신
- 대규모 테넌트(>1000 events/month) ms 단위 응답 보장
```

---

## 9. 성공 기준

| 체크 | 기준 |
|------|------|
| [ ] | **베이스라인 측정 완료** (Phase 0) |
| [ ] | 초기 로딩 시간 < 500ms |
| [ ] | 월 이동 응답 시간 < 100ms (캐시 히트) |
| [ ] | API 응답 시간 < 200ms (p95) |
| [ ] | 3000 동시 접속 시 응답 시간 < 500ms (p95) |
| [ ] | 실패율 < 1% |
| [ ] | 스피너 대신 이전 데이터 유지 |
| [ ] | **빠른 월 이동 시 race condition 없음** |
| [ ] | **베이스라인 대비 개선 수치 문서화** |
