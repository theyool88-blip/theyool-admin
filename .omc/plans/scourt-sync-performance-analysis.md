# SCOURT 동기화 성능 최적화 보고서

## 개요

**분석 대상:** "갱신" 버튼 클릭 시 대법원 나의사건검색(SCOURT) API 동기화 기능
**분석 일시:** 2026-01-29
**상태:** ✅ 완료

---

## 최적화 결과 요약

### 성능 개선 (75% 감소)

| 단계 | 소요 시간 | 적용된 최적화 |
|------|----------|--------------|
| 원본 | 4.4-5.4초 | - |
| XML 캐시 스킵 | 2.7초 | 갱신 시 불필요한 XML 캐시 저장 제거 |
| 기일/당사자 스킵 | 1.5-1.6초 | 일반내역 변경 없을 때 동기화 스킵 |
| 스냅샷/연관사건 스킵 | 1.2초 | 변경 없을 때 저장 스킵 |
| **조기 반환** | **~1.1초** | 일반/진행내역 변경 없으면 전체 스킵 |

**최종 결과:** 4.4초 → 1.1초 (약 75% 감소)

### 테스트 결과 (변경 없을 때)

```
Status: 200
Duration: 1.10 seconds
SKIPPED: 변경 없음
Server Timings:
  1_general_api: 176ms
  2a_init_session: 16ms
  2b_progress_api: 77ms
  6a_get_snapshot: 197ms
  total: 868ms
```

---

## 적용된 최적화

### 1. 조기 반환 (Early Return)

**파일:** `app/api/admin/scourt/sync/route.ts`

일반내역과 진행내역 모두 변경이 없으면 후속 처리를 모두 스킵하고 즉시 반환합니다.

```typescript
const generalChanged = generalHash !== legalCase.scourt_general_hash;

// 변경 없으면 조기 반환 (갱신 시에만, 첫 연동은 제외)
if (!isFirstLink && !generalChanged && !progressChanged) {
  console.log('⏭️ 일반내역/진행내역 변경 없음 - 전체 스킵');

  // scourt_last_sync만 업데이트
  await supabase
    .from('legal_cases')
    .update({ scourt_last_sync: new Date().toISOString() })
    .eq('id', legalCaseId);

  return NextResponse.json({
    success: true,
    skipped: true,
    message: '변경 없음',
    caseNumber,
  });
}
```

**효과:** 변경 없을 때 모든 후속 처리 스킵 (기일/당사자/스냅샷/연관사건)

### 2. XML 캐시 스킵

**파일:** `app/api/admin/scourt/sync/route.ts`

첫 연동 시에만 XML 캐시를 수행하고, 갱신 시에는 이미 캐시되어 있으므로 스킵합니다.

```typescript
// XML 캐시는 첫 연동 시에만 수행 (갱신 시에는 이미 캐시됨)
if (apiResponseForXml && isFirstLink) {
  await ensureXmlCacheForCase(caseType, apiResponseForXml, true);
}
```

**효과:** 갱신 시 ~1.7초 절약

### 3. 기일/당사자 동기화 조건부 실행

**파일:** `app/api/admin/scourt/sync/route.ts`

일반내역이 변경된 경우에만 기일/당사자 동기화를 수행합니다.

```typescript
// 기일 동기화 (일반내역 변경 시에만)
if (generalChanged && shouldUseGeneralData && generalData?.hearings?.length > 0) {
  hearingSyncResult = await syncHearingsToCourtHearings(...);
} else if (!generalChanged) {
  console.log('⏭️ 일반내역 변경 없음 - 기일 동기화 스킵');
}

// 당사자 동기화 (일반내역 변경 시에만)
if (generalChanged && shouldUseGeneralData && ...) {
  partySyncResult = await syncPartiesFromScourtServer(...);
} else if (!generalChanged) {
  console.log('⏭️ 일반내역 변경 없음 - 당사자 동기화 스킵');
}
```

**효과:** 변경 없을 때 ~0.3-0.5초 절약

### 4. 스냅샷 저장 조건부 실행

**파일:** `app/api/admin/scourt/sync/route.ts`

스냅샷 내용이 변경되지 않았으면 업데이트를 스킵합니다.

```typescript
const snapshotChanged = contentHash !== existingSnapshot?.content_hash;

if (existingSnapshot && !snapshotChanged) {
  console.log('⏭️ 스냅샷 변경 없음 - 업데이트 스킵');
  snapshotId = existingSnapshot.id;
} else if (existingSnapshot) {
  // 기존 스냅샷 업데이트
  await supabase.from('scourt_case_snapshots').update(...);
}
```

**효과:** 변경 없을 때 ~0.2초 절약

### 5. 연관사건 연결 조건부 실행

**파일:** `app/api/admin/scourt/sync/route.ts`

일반내역이 변경된 경우에만 연관사건 연결을 수행합니다.

```typescript
if (generalChanged && (lowerCourtData.length > 0 || relatedCasesData.length > 0)) {
  linkResult = await linkRelatedCases(...);
}
```

**효과:** 변경 없을 때 ~0.1-0.2초 절약

---

## 타이밍 측정

API 응답에 `_timings` 객체가 포함되어 각 단계별 소요 시간을 확인할 수 있습니다.

```typescript
{
  "1_general_api": 176,      // 일반내용 API 호출
  "2a_init_session": 16,     // 세션 초기화
  "2b_progress_api": 77,     // 진행내역 API 호출
  "3_hearing_sync": 45,      // 기일 동기화 (변경 시에만)
  "4_party_sync": 32,        // 당사자 동기화 (변경 시에만)
  "5_related_cases": 120,    // 연관사건 연결 (변경 시에만)
  "6a_get_snapshot": 197,    // 스냅샷 조회
  "6b_xml_cache": 1700,      // XML 캐시 (첫 연동 시에만)
  "6c_save_snapshot": 45,    // 스냅샷 저장 (변경 시에만)
  "total": 868               // 총 소요 시간
}
```

---

## 배치 동기화 영향

일일 정기 업데이트(`/api/cron/scourt-batch-sync`)도 동일한 `/api/admin/scourt/sync` API를 호출하므로 **최적화가 자동 적용**됩니다.

- 변경 없는 사건: ~1초 (조기 반환)
- 변경 있는 사건: ~2-3초 (전체 동기화)

---

## 커밋 정보

```
commit 28d8610
Author: [작성자]
Date: 2026-01-29

perf(scourt): optimize sync performance with early return and skip logic

## Performance Improvements (75% reduction: 4.4s → 1.1s)

### Early Return Optimization
- Skip all processing when general/progress data unchanged
- Only update scourt_last_sync timestamp
- Return skipped: true response immediately

### Conditional Processing
- XML cache: Only on first link (already cached on refresh)
- Hearing sync: Skip when general data unchanged
- Party sync: Skip when general data unchanged
- Snapshot save: Skip when content hash unchanged
- Related cases link: Skip when general data unchanged

### Timing Instrumentation
- Add timing measurements for each processing step
- Include _timings in response for debugging
- Log timing summary on completion
```

---

## 향후 개선 가능 사항 (선택적)

아래 항목들은 추가 개선이 필요할 경우 검토할 수 있습니다:

1. **외부 API 병렬 호출**
   - 일반내용과 진행내역 API를 `Promise.all()`로 동시 호출
   - 예상 효과: 추가 0.5-1초 단축
   - 난이도: 중 (세션 관리 리팩토링 필요)

2. **배치 쿼리 최적화**
   - 기일/당사자/연관사건 동기화를 배치 UPSERT로 변경
   - 예상 효과: 추가 0.2-0.3초 단축
   - 난이도: 낮음

3. **백그라운드 동기화**
   - 갱신 요청 시 즉시 응답 후 백그라운드에서 처리
   - WebSocket/SSE로 완료 알림
   - 예상 효과: 체감 즉시 응답
   - 난이도: 높음
