# Learnings - 일정 페이지 성능 최적화

## Phase 1: 클라이언트 캐싱 구현 완료 (2026-01-27)

### 구현 내역

파일: `/Users/hskim/luseed/components/calendar/hooks/useCalendarEvents.ts`

#### 1. 전역 캐시 추가
- `eventCache` Map 구조로 인메모리 캐싱
- `CACHE_TTL`: 5분 (완전 만료)
- `STALE_TTL`: 30초 (백그라운드 갱신 트리거)
- 최대 12개월 캐시 제한 (LRU 정책)

#### 2. 캐시 유틸리티 함수
- `getCacheKey(startDate, endDate)`: 캐시 키 생성
- `getCachedData(key)`: TTL 체크 후 캐시 반환
- `isStale(key)`: stale 여부 확인 (30초 경과)
- `setCachedData(key, data)`: 캐시 저장 및 크기 제한

#### 3. SWR 패턴 구현
- **캐시 히트**: 즉시 캐시 데이터 반환 → stale이면 백그라운드 revalidation
- **캐시 미스**: loading=true → fetch → 캐시 저장
- `isValidating` 상태: 백그라운드 갱신 진행 여부 추적

#### 4. Race Condition 방지 (Critical!)
```typescript
const currentCacheKeyRef = useRef(cacheKey)
useEffect(() => {
  currentCacheKeyRef.current = cacheKey
}, [cacheKey])

// revalidation 완료 후:
if (currentCacheKeyRef.current === revalidatingCacheKey) {
  setAllEvents(freshData)  // 현재 월과 일치할 때만 업데이트
}
```

#### 5. AbortController로 이전 요청 취소
- 빠른 월 이동 시 이전 fetch 자동 취소
- AbortError는 무시

#### 6. 인접 월 프리페치
- 현재 월 로드 후 500ms 지연
- 이전/다음 월을 백그라운드에서 프리페치
- 캐시 미스일 때만 실행

#### 7. 새로운 return 인터페이스
```typescript
interface UseCalendarEventsReturn {
  events: BigCalendarEvent[]
  allEvents: BigCalendarEvent[]
  loading: boolean
  isValidating: boolean       // NEW: 백그라운드 갱신 중
  tenantMembers: TenantMember[]
  refetch: () => Promise<void>
  updateEvent: (event: BigCalendarEvent) => void
  updateAttendingLawyer: (hearingId: string, lawyerId: string | null) => Promise<void>
  updatingLawyer: string | null
  prefetchAdjacent: () => void  // NEW: 인접 월 프리페치
}
```

### 기존 기능 유지
- 이벤트 필터링 (court/all, lawyer 선택)
- 법원기일 출석변호사 업데이트
- Optimistic UI 업데이트
- 데드라인 우선 정렬

### TypeScript 컴파일 결과
- 에러 없음 확인 완료
- 기존 타입 시스템과 완벽 호환

### 다음 단계
- Phase 2: API 응답 최적화 (컬럼 선택, Cache-Control 헤더)
- BigCalendar.tsx에서 `isValidating` 상태 활용
- CalendarToolbar에 갱신 indicator 추가
