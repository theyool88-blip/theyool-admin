# SaaS 3000명 대응 XML 로딩 최적화 계획 (v5 - Critic 피드백 반영)

## Context

### Original Request
법무법인 더윤 SaaS 시스템의 사건 상세 페이지 "일반" 탭에서 XML 레이아웃 파일 로딩 성능 최적화. 3000명 동시 접속 시에도 안정적으로 동작해야 함.

### Critic Feedback History

**v1 REJECT:** 모듈 레벨 상태(`inFlightDownloads`, `scourtSemaphore`)가 Vercel 인스턴스 간 공유되지 않음.

**v2 REJECT:**
1. **pg_advisory_lock + PgBouncer 비호환**: Supabase는 PgBouncer를 트랜잭션 모드로 사용. `pg_advisory_lock`은 세션 스코프인데, 트랜잭션 모드에서는 각 요청마다 다른 연결을 사용할 수 있어 락이 제대로 작동하지 않음.
2. **T2/T3 통합 함수 누락**: 분산 락과 rate limiter를 어떻게 조합하는지 명시 안됨.
3. **RLS 정책 누락**: `scourt_rate_limit` 테이블에 RLS 정책 필요.
4. **로드 테스트 계획 누락**: 3000명 동시 접속 검증 방법 없음.
5. **폴링 비효율**: 500ms 간격 폴링 대신 exponential backoff 필요.

**v3 REJECT:**
1. **무한 재귀 위험 (T4)**: `slotStatus === 'already_cached'`인데 캐시가 없으면 무한 재귀 발생
2. **k6 `textSummary` import 누락 (T5)**: `textSummary`는 k6 내장 함수가 아님
3. **T1 기존 로직 보존 미흡**: 현재 `fetchXmlWithFallback`의 retry-after-POST 로직이 계획에 반영 안됨
4. **에러 클래스 export 누락 (T4)**: `RateLimitExceededError`, `DownloadTimeoutError` export 필요
5. **SECURITY DEFINER vs RLS 주석 오해 (T3)**: SECURITY DEFINER는 RLS를 우회함
6. **Minor**: `request.clone().json()` 두 번 호출, XML_PATHS 배열 불완전

**v4 REJECT:**
1. **CRITICAL - XML_PATHS 파일명 오류 (T5)**: k6 스크립트의 XML_PATHS에서 `F10.xml`, `F11.xml` 사용했으나 실제 파일은 `F01.xml`임 (예: `SSGO101F01.xml`, `SSGO102F01.xml` 등)
2. **HIGH - IF FOUND 논리 오류 (T2)**: `INSERT ... ON CONFLICT DO NOTHING` 후 `IF FOUND`는 conflict 발생해도 TRUE 반환. `GET DIAGNOSTICS v_rows = ROW_COUNT` 사용 필요
3. **LOW - 상수 배치 위치 불명확 (T4)**: xml-fetcher.ts의 기존 Constants 섹션에 추가해야 함을 명시
4. **LOW - import 컨텍스트 명시 필요 (T4)**: `createClient` import가 이미 존재함을 명시

### v5 해결책

| v4 문제 | v5 해결책 |
|---------|----------|
| XML_PATHS 파일명 오류 | **실제 파일명 사용: `SSGO101F01.xml`, `SSGO003F10.xml` 등 (glob 결과 기반 39개 전체)** |
| IF FOUND 논리 오류 | **`GET DIAGNOSTICS v_rows = ROW_COUNT` 사용, `v_rows > 0` 체크** |
| 상수 배치 위치 불명확 | **기존 Constants 섹션 (line 17-25) 바로 아래에 추가 명시** |
| import 컨텍스트 미흡 | **`createClient` import가 이미 존재 (line 7) 명시** |

### Research Findings

#### 현재 아키텍처 분석

**1. 클라이언트 측 (ScourtGeneralInfoXml.tsx)**
- 메모리 캐시: `xmlContentCache` (Map) - 세션 동안 유지
- 중복 요청 방지: `pendingRequests` (Map) - 진행 중인 요청 추적
- 병렬 로딩: `Promise.all` 사용

**2. 로딩 순서 (문제점)**
```
현재: Memory Cache -> DB API -> 대법원 다운로드 -> 정적 파일
이상: Memory Cache -> 정적 파일 -> DB API -> (테이블 락 + rate limit) 대법원 다운로드
```

**3. 정적 파일 현황**
- 위치: `/public/scourt-xml/`
- 파일 수: 39개
- 디렉토리: ssgo003, ssgo101, ssgo102, ssgo105, ssgo106, ssgo107, ssgo108, ssgo10a, ssgo10c, ssgo10g, ssgo10i, ssgo10j
- **커버리지 예상: 80-90%** (대부분의 사건 유형 레이아웃 포함)

**4. DB 캐시 테이블**
- 테이블: `scourt_xml_cache`
- 인덱스: `xml_path`, `case_type`
- RLS: public 읽기, service_role 쓰기

#### 핵심 문제점 (v5 업데이트)

| 문제 | 영향 | 심각도 | v4 해결책 | v5 해결책 |
|------|------|--------|-----------|-----------|
| 정적 파일이 마지막 fallback | 39개 파일이 있어도 DB 쿼리 먼저 실행 | HIGH | 정적 파일 우선 | 동일 (유지) |
| 서버 측 중복 다운로드 방지 없음 | 3000명 동시 접속 시 동일 XML 3000번 다운로드 시도 | CRITICAL | 테이블 기반 락 | 동일 + **IF FOUND 로직 수정** |
| 대법원 rate limit 대응 없음 | IP 차단 또는 서비스 장애 위험 | CRITICAL | Supabase 글로벌 카운터 | 동일 (유지) |
| SCOURT 타임아웃 없음 | 무한 대기 가능 | MEDIUM | 10초 타임아웃 | 동일 (유지) |
| 통합 함수 없음 | 락 + rate limit 조합 불명확 | MEDIUM | `downloadXmlWithProtection()` | 동일 + **상수 위치 명시** |
| 폴링 비효율 | 불필요한 DB 쿼리 | LOW | Exponential backoff | 동일 (유지) |
| 로드 테스트 파일명 오류 | 테스트 불가 | HIGH | k6 스크립트 | **실제 파일명 39개 반영** |

---

## Work Objectives

### Core Objective
3000명 동시 접속 시에도 안정적으로 XML 레이아웃을 로드할 수 있도록:
1. 정적 파일 우선 로딩으로 80-90% 트래픽 커버
2. **테이블 기반 분산 락**으로 인스턴스 간 중복 다운로드 방지 (PgBouncer 호환)
3. Supabase 글로벌 rate limiting으로 대법원 과부하 방지 (RLS 정책 포함)
4. **통합 함수**로 락 + rate limit 명확하게 조합 (무한 재귀 방지)
5. **k6 로드 테스트**로 3000명 시뮬레이션 검증

### Deliverables
1. 클라이언트 측 로딩 순서 변경 (정적 파일 우선) - **80-90% 트래픽 커버, 기존 로직 보존**
2. 서버 측 **테이블 기반 분산 락** (PgBouncer 호환)
3. 글로벌 rate limiting + graceful degradation (RLS 정책 포함)
4. **`downloadXmlWithProtection()` 통합 함수** (무한 재귀 방지)
5. SCOURT 다운로드 10초 타임아웃
6. **k6 로드 테스트 스크립트** (올바른 import, 실제 파일명 39개)

### Definition of Done
- [ ] 정적 파일 존재 시 DB/대법원 요청 없이 즉시 반환 (80-90% 트래픽)
- [ ] 동일 XML에 대한 서버 측 중복 다운로드 요청이 **인스턴스 간에도** 1개로 통합됨
- [ ] 대법원 동시 요청이 **모든 인스턴스 합쳐서** 최대 3개로 제한됨
- [ ] SCOURT 다운로드 10초 타임아웃 적용
- [ ] Rate limit 초과 시 graceful degradation (정적 파일 또는 캐시 반환)
- [ ] `scourt_rate_limit` 테이블에 RLS 정책 적용
- [ ] k6 로드 테스트로 3000명 동시 접속 검증 완료
- [ ] 기존 테스트/기능에 영향 없음
- [ ] 빌드 성공

---

## Guardrails

### Must Have
- 정적 파일 우선 로딩 (Memory -> Static -> DB -> 대법원)
- **기존 retry-after-POST 로직 보존**
- **테이블 기반 분산 락** (PgBouncer 호환, `__DOWNLOADING__` 마커)
- **글로벌** rate limit 보호 (Supabase 카운터, 모든 인스턴스 합산)
- **RLS 정책** (`scourt_rate_limit` 테이블)
- **`downloadXmlWithProtection()` 통합 함수** (무한 재귀 방지 `_retryCount`)
- 대법원 다운로드 10초 타임아웃
- Rate limit 초과 시 graceful degradation
- **Exponential backoff** 폴링
- **k6 로드 테스트 스크립트** (올바른 import, 실제 파일명)
- 기존 API 인터페이스 유지

### Must NOT Have
- DB 스키마 변경 (RPC 함수 및 rate_limit 테이블 추가는 허용)
- 새로운 환경 변수 추가
- 외부 캐시 서비스 (Redis 등) 의존성 추가
- 클라이언트 측 API 호출 시그니처 변경
- ~~모듈 레벨 상태 의존~~ (인스턴스 간 공유 불가)
- ~~pg_advisory_lock~~ (PgBouncer 비호환)

---

## Task Flow

```
[T1: 클라이언트 로딩 순서 변경]
         |
[T2: 테이블 기반 분산 락 구현] ------+
         |                           |
[T3: Supabase 글로벌 Rate Limiter] --+-- T2+T3 통합: downloadXmlWithProtection()
         |                           |
[T4: 통합 함수 및 API 수정] ---------+
         |
[T5: k6 로드 테스트]
         |
[T6: 검증 및 테스트]
```

---

## TODOs

### T1: 클라이언트 측 로딩 순서 변경 (정적 파일 우선, 기존 로직 보존)
**파일:** `/Users/hskim/luseed/components/scourt/ScourtGeneralInfoXml.tsx`
**함수:** `fetchXmlWithFallback` (line 172-263)

**예상 트래픽 커버리지:** 정적 파일 39개가 대부분의 사건 유형 레이아웃을 포함하므로 **80-90%** 트래픽이 정적 파일에서 처리됨. 나머지 10-20%만 DB/대법원 요청 필요.

**변경 전:**
```
1. Memory Cache 확인
2. DB API 호출 (GET /api/scourt/xml-cache)
3. DB 캐시 miss -> POST /api/scourt/xml-cache (대법원 다운로드)
4. POST 성공 후 GET 재시도 (retry-after-POST)
5. 정적 파일 fallback
```

**변경 후:**
```
1. Memory Cache 확인
2. 정적 파일 확인 (/scourt-xml/{path}) <- 80-90% 여기서 종료
3. DB API 호출 (GET /api/scourt/xml-cache)
4. DB 캐시 miss -> POST /api/scourt/xml-cache (테이블 락 + rate-limited 대법원 다운로드)
5. POST 성공 후 GET 재시도 (retry-after-POST, 기존 로직 보존)
```

**전체 수정된 함수 (기존 로직 보존):**
```typescript
async function fetchXmlWithFallback(
  xmlPath: string,
  caseType?: ScourtCaseType
): Promise<string | null> {
  // 1. 모듈 레벨 메모리 캐시 확인 (가장 빠름)
  const cached = xmlContentCache.get(xmlPath);
  if (cached) {
    return cached;
  }

  // 2. 진행 중인 동일 요청이 있으면 그 Promise 반환 (중복 요청 방지)
  const pending = pendingRequests.get(xmlPath);
  if (pending) {
    return pending;
  }

  // 3. 새 요청 시작
  const fetchPromise = (async (): Promise<string | null> => {
    const encodedPath = encodeURIComponent(xmlPath);

    // NEW: 정적 파일 우선 확인 (80-90% 트래픽 여기서 종료)
    try {
      const staticResponse = await fetch(`${XML_BASE_PATH}/${xmlPath}`);
      if (staticResponse.ok) {
        const staticText = await staticResponse.text();
        if (!isInvalidXmlContent(staticText)) {
          xmlContentCache.set(xmlPath, staticText);
          return staticText;
        }
      }
    } catch {
      // 정적 파일 없음 - 다음 단계로
    }

    // DB 캐시에서 조회 시도 (기존 로직 유지)
    try {
      const cacheResponse = await fetch(
        `/api/scourt/xml-cache?path=${encodedPath}`
      );
      let shouldRefresh = cacheResponse.status === 404;
      if (cacheResponse.ok) {
        const cacheData = await cacheResponse.json();
        if (cacheData.xml_content) {
          if (isInvalidXmlContent(cacheData.xml_content)) {
            shouldRefresh = true;
          } else {
            xmlContentCache.set(xmlPath, cacheData.xml_content);
            return cacheData.xml_content;
          }
        }
      }
      if (shouldRefresh) {
        try {
          // POST 요청으로 대법원 다운로드 트리거 (기존 로직 유지)
          const downloadResponse = await fetch("/api/scourt/xml-cache", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ xmlPath, caseType, forceRefresh: true }),
          });

          // POST 성공 후 GET 재시도 (retry-after-POST, 기존 로직 보존)
          if (downloadResponse.ok) {
            const retryResponse = await fetch(
              `/api/scourt/xml-cache?path=${encodedPath}`
            );
            if (retryResponse.ok) {
              const retryData = await retryResponse.json();
              if (retryData.xml_content && !isInvalidXmlContent(retryData.xml_content)) {
                xmlContentCache.set(xmlPath, retryData.xml_content);
                return retryData.xml_content;
              }
            }
          }
        } catch {
          // Download failed - 정적 파일은 이미 위에서 시도함
        }
      }
    } catch {
      // Cache lookup failed - 정적 파일은 이미 위에서 시도함
    }

    // 모든 시도 실패
    return null;
  })();

  // 진행 중인 요청 등록
  pendingRequests.set(xmlPath, fetchPromise);

  try {
    return await fetchPromise;
  } finally {
    // 완료 후 pending 목록에서 제거
    pendingRequests.delete(xmlPath);
  }
}
```

**Acceptance Criteria:**
- [ ] 정적 파일이 존재하면 DB/대법원 요청 없이 반환
- [ ] 정적 파일이 없으면 기존 DB/대법원 로직 수행
- [ ] **기존 retry-after-POST 로직 보존**
- [ ] 빌드 성공

---

### T2: 테이블 기반 분산 락 구현 (PgBouncer 호환, IF FOUND 로직 수정)
**파일:** `/Users/hskim/luseed/lib/scourt/xml-fetcher.ts`

**문제:**
1. 모듈 레벨 `inFlightDownloads` Map은 Vercel 인스턴스 간 공유되지 않음.
2. `pg_advisory_lock`은 세션 스코프인데, Supabase PgBouncer는 트랜잭션 모드로 동작하여 각 요청마다 다른 연결을 사용할 수 있음 -> 락이 제대로 작동하지 않음.
3. **v4 버그**: `INSERT ... ON CONFLICT DO NOTHING` 후 `IF FOUND`는 conflict 발생해도 TRUE 반환.

**해결책:** `scourt_xml_cache` 테이블에 `__DOWNLOADING__` 마커를 삽입하여 락 대체 + **`GET DIAGNOSTICS v_rows = ROW_COUNT` 사용**

**원리:**
1. INSERT ... ON CONFLICT DO NOTHING으로 atomic하게 다운로드 슬롯 획득
2. **`GET DIAGNOSTICS v_rows = ROW_COUNT`로 실제 삽입 여부 확인**
3. 획득 성공 시 다운로드 진행, 완료 후 실제 XML로 UPDATE
4. 획득 실패 시 캐시 폴링 (exponential backoff)
5. 5분 후 stale 마커 자동 정리 (stuck 방지)

**1. Supabase RPC 함수 추가** (마이그레이션 파일)
```sql
-- supabase/migrations/20260127000001_xml_download_lock.sql

-- 다운로드 슬롯 획득 시도 (테이블 기반 락, PgBouncer 호환)
-- Returns: 'acquired' | 'already_cached' | 'downloading'
CREATE OR REPLACE FUNCTION try_acquire_xml_download_slot(p_xml_path text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_existing_content text;
  v_existing_updated timestamptz;
  v_rows integer;
BEGIN
  -- 1. 기존 캐시 확인
  SELECT xml_content, updated_at INTO v_existing_content, v_existing_updated
  FROM scourt_xml_cache
  WHERE xml_path = p_xml_path;

  IF FOUND THEN
    -- 2a. 유효한 캐시 존재 (다운로드 중 아님)
    IF v_existing_content IS NOT NULL AND v_existing_content != '__DOWNLOADING__' THEN
      RETURN 'already_cached';
    END IF;

    -- 2b. 다운로드 중 마커 존재
    IF v_existing_content = '__DOWNLOADING__' THEN
      -- 5분 이상 지났으면 stale -> 재획득 허용
      IF v_existing_updated < now() - interval '5 minutes' THEN
        UPDATE scourt_xml_cache
        SET xml_content = '__DOWNLOADING__', updated_at = now()
        WHERE xml_path = p_xml_path;
        RETURN 'acquired';
      END IF;
      RETURN 'downloading';
    END IF;
  END IF;

  -- 3. 새로 삽입 시도 (atomic)
  INSERT INTO scourt_xml_cache (xml_path, xml_content, updated_at)
  VALUES (p_xml_path, '__DOWNLOADING__', now())
  ON CONFLICT (xml_path) DO NOTHING;

  -- 4. 삽입 성공 여부 확인 (GET DIAGNOSTICS 사용 - IF FOUND는 부정확)
  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows > 0 THEN
    RETURN 'acquired';
  END IF;

  -- 5. 동시 삽입 경쟁에서 패배 -> 다시 상태 확인
  SELECT xml_content INTO v_existing_content
  FROM scourt_xml_cache
  WHERE xml_path = p_xml_path;

  IF v_existing_content = '__DOWNLOADING__' THEN
    RETURN 'downloading';
  ELSE
    RETURN 'already_cached';
  END IF;
END;
$$;

-- 다운로드 완료 후 실제 XML로 업데이트
CREATE OR REPLACE FUNCTION complete_xml_download(
  p_xml_path text,
  p_xml_content text,
  p_case_type text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE scourt_xml_cache
  SET xml_content = p_xml_content,
      case_type = p_case_type,
      updated_at = now()
  WHERE xml_path = p_xml_path
    AND (xml_content = '__DOWNLOADING__' OR xml_content IS NULL);

  RETURN FOUND;
END;
$$;

-- 다운로드 실패 시 마커 제거 (다른 인스턴스가 재시도 가능하도록)
CREATE OR REPLACE FUNCTION abort_xml_download(p_xml_path text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM scourt_xml_cache
  WHERE xml_path = p_xml_path
    AND xml_content = '__DOWNLOADING__';
END;
$$;

-- Stale 다운로드 마커 정리 (cron job 또는 수동 호출)
CREATE OR REPLACE FUNCTION cleanup_stale_xml_downloads()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_count integer;
BEGIN
  DELETE FROM scourt_xml_cache
  WHERE xml_content = '__DOWNLOADING__'
    AND updated_at < now() - interval '5 minutes';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
```

**Acceptance Criteria:**
- [ ] `try_acquire_xml_download_slot` 함수가 atomic하게 슬롯 획득
- [ ] **`GET DIAGNOSTICS v_rows = ROW_COUNT`로 삽입 성공 여부 정확히 확인**
- [ ] `__DOWNLOADING__` 마커가 5분 후 자동 stale 처리
- [ ] PgBouncer 트랜잭션 모드에서 정상 동작

---

### T3: Supabase 글로벌 Rate Limiter 구현 (RLS 정책 포함)
**파일:** `/Users/hskim/luseed/lib/scourt/xml-fetcher.ts`

**문제:** 모듈 레벨 Semaphore는 Vercel 인스턴스 간 공유되지 않음.

**해결책:** Supabase 테이블을 활용한 글로벌 rate limiting + graceful degradation + **RLS 정책**

**1. Supabase RPC 함수 추가** (마이그레이션 파일)
```sql
-- supabase/migrations/20260127000002_scourt_rate_limiter.sql

-- SCOURT 동시 요청 카운터 테이블
CREATE TABLE IF NOT EXISTS scourt_rate_limit (
  id integer PRIMARY KEY DEFAULT 1,
  concurrent_count integer DEFAULT 0,
  last_updated timestamptz DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);

-- 초기 행 삽입
INSERT INTO scourt_rate_limit (id, concurrent_count) VALUES (1, 0)
ON CONFLICT (id) DO NOTHING;

-- RLS 활성화
ALTER TABLE scourt_rate_limit ENABLE ROW LEVEL SECURITY;

-- RLS 정책: 모든 authenticated 사용자가 읽기 가능
CREATE POLICY "scourt_rate_limit_select_authenticated"
ON scourt_rate_limit
FOR SELECT
TO authenticated
USING (true);

-- RLS 정책: service_role만 수정 가능
-- 주의: RPC 함수는 SECURITY DEFINER로 실행되어 RLS를 우회함
CREATE POLICY "scourt_rate_limit_all_service"
ON scourt_rate_limit
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 슬롯 획득 시도 (atomic, returns true if acquired)
-- SECURITY DEFINER: 함수 소유자 권한으로 실행 (RLS 우회)
-- 주의: SECURITY DEFINER 함수는 RLS 정책을 우회하므로 함수 내부에서 권한 검사 필요 시 별도 구현
CREATE OR REPLACE FUNCTION try_acquire_scourt_slot(max_concurrent integer DEFAULT 3)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  acquired boolean := false;
BEGIN
  -- Stale 슬롯 정리 (5분 이상 업데이트 없으면 리셋)
  UPDATE scourt_rate_limit
  SET concurrent_count = 0
  WHERE id = 1
    AND last_updated < now() - interval '5 minutes'
    AND concurrent_count > 0;

  -- 슬롯 획득 시도
  UPDATE scourt_rate_limit
  SET concurrent_count = concurrent_count + 1,
      last_updated = now()
  WHERE id = 1 AND concurrent_count < max_concurrent;

  IF FOUND THEN
    acquired := true;
  END IF;

  RETURN acquired;
END;
$$;

-- 슬롯 해제
-- SECURITY DEFINER: 함수 소유자 권한으로 실행 (RLS 우회)
CREATE OR REPLACE FUNCTION release_scourt_slot()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE scourt_rate_limit
  SET concurrent_count = GREATEST(concurrent_count - 1, 0),
      last_updated = now()
  WHERE id = 1;
END;
$$;

-- 현재 동시 요청 수 조회
-- SECURITY DEFINER: 함수 소유자 권한으로 실행 (RLS 우회)
CREATE OR REPLACE FUNCTION get_scourt_concurrent_count()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT concurrent_count FROM scourt_rate_limit WHERE id = 1;
$$;
```

**Acceptance Criteria:**
- [ ] `scourt_rate_limit` 테이블에 RLS 활성화
- [ ] authenticated 사용자 읽기, service_role 쓰기 정책 적용
- [ ] **RPC 함수가 SECURITY DEFINER로 RLS 우회 (주석 명시)**
- [ ] 슬롯 획득/해제가 atomic하게 동작

---

### T4: 통합 함수 및 API 수정 (무한 재귀 방지, export 명시, 상수 위치 명시)
**파일:** `/Users/hskim/luseed/lib/scourt/xml-fetcher.ts`, `/Users/hskim/luseed/app/api/scourt/xml-cache/route.ts`

**목적:** T2(분산 락)와 T3(rate limiter)를 조합하는 **`downloadXmlWithProtection()`** 통합 함수 제공

**1. xml-fetcher.ts에 통합 함수 추가**

**참고:** 기존 Constants 섹션 (line 17-25) 바로 아래에 추가. `createClient` import는 이미 존재 (line 7).

```typescript
// ============================================================================
// 상수 (신규) - 기존 Constants 섹션 (line 17-25) 바로 아래에 추가
// ============================================================================

const MAX_SCOURT_CONCURRENT = 3; // 전체 인스턴스 합산 최대 동시 요청
const DOWNLOAD_TIMEOUT_MS = 10000; // 10초 타임아웃
const MAX_POLL_ATTEMPTS = 6; // 최대 폴링 횟수
const INITIAL_POLL_DELAY_MS = 100; // 초기 폴링 딜레이 (exponential backoff)
const MAX_RETRY_COUNT = 3; // 무한 재귀 방지 최대 재시도 횟수

// ============================================================================
// 에러 클래스 (export 명시)
// ============================================================================

export class RateLimitExceededError extends Error {
  constructor(public xmlPath: string) {
    super(`Rate limit exceeded for XML download: ${xmlPath}`);
    this.name = 'RateLimitExceededError';
  }
}

export class DownloadTimeoutError extends Error {
  constructor(public xmlPath: string) {
    super(`Download timeout for XML: ${xmlPath}`);
    this.name = 'DownloadTimeoutError';
  }
}

// ============================================================================
// 통합 함수: 분산 락 + Rate Limit + 다운로드 (무한 재귀 방지)
// ============================================================================

/**
 * XML 다운로드 with 분산 락 + 글로벌 Rate Limiting
 *
 * Flow:
 * 1. 분산 락 획득 시도 (테이블 기반)
 *    - 'acquired' -> 다운로드 진행
 *    - 'already_cached' -> 캐시 반환 (무한 재귀 방지: 최대 3회)
 *    - 'downloading' -> 캐시 폴링 (exponential backoff)
 * 2. Rate limit 슬롯 획득 (최대 3개 동시)
 * 3. 10초 타임아웃으로 대법원에서 다운로드
 * 4. 캐시 저장 및 락 해제
 *
 * @param xmlPath XML 파일 경로
 * @param caseType 사건유형 코드 (캐시 저장 시 참고용)
 * @param _retryCount 내부 재시도 카운터 (무한 재귀 방지, 외부에서 호출 시 생략)
 * @returns XML 파일 내용
 * @throws RateLimitExceededError - Rate limit 초과 시
 * @throws DownloadTimeoutError - 다운로드 타임아웃 시
 * @throws Error - 최대 재시도 횟수 초과 시
 */
export async function downloadXmlWithProtection(
  xmlPath: string,
  caseType?: string,
  _retryCount: number = 0
): Promise<string> {
  // 무한 재귀 방지: 최대 재시도 횟수 체크
  if (_retryCount >= MAX_RETRY_COUNT) {
    throw new Error(`Max retry count (${MAX_RETRY_COUNT}) exceeded for XML: ${xmlPath}`);
  }

  // createClient는 이미 import 되어 있음 (line 7)
  const supabase = await createClient();

  // Step 1: 분산 락 획득 시도
  const { data: slotStatus, error: slotError } = await supabase
    .rpc('try_acquire_xml_download_slot', { p_xml_path: xmlPath });

  if (slotError) {
    console.error('[XML] Failed to acquire download slot:', slotError);
    throw new Error(`Failed to acquire download slot: ${slotError.message}`);
  }

  // Step 1a: 이미 캐시됨
  if (slotStatus === 'already_cached') {
    const cached = await getCachedXml(xmlPath);
    if (cached?.xml_content && cached.xml_content !== '__DOWNLOADING__') {
      return cached.xml_content;
    }
    // 캐시가 없거나 무효 -> 다시 시도 (재귀, 카운터 증가)
    console.warn(`[XML] Cache inconsistency for ${xmlPath}, retry ${_retryCount + 1}/${MAX_RETRY_COUNT}`);
    return downloadXmlWithProtection(xmlPath, caseType, _retryCount + 1);
  }

  // Step 1b: 다른 인스턴스가 다운로드 중 -> 캐시 폴링 (exponential backoff)
  if (slotStatus === 'downloading') {
    console.log(`[XML] Another instance downloading, polling cache: ${xmlPath}`);
    return await pollCacheWithExponentialBackoff(xmlPath);
  }

  // Step 1c: 락 획득 성공 -> 다운로드 진행
  console.log(`[XML] Download slot acquired: ${xmlPath}`);

  try {
    // Step 2: Rate limit 슬롯 획득
    const xmlContent = await downloadWithGlobalRateLimit(xmlPath);

    // Step 3: 캐시 저장 (다운로드 완료)
    const { error: completeError } = await supabase.rpc('complete_xml_download', {
      p_xml_path: xmlPath,
      p_xml_content: xmlContent,
      p_case_type: caseType || null,
    });

    if (completeError) {
      console.error('[XML] Failed to complete download:', completeError);
      // 저장 실패해도 XML은 반환
    }

    console.log(`[XML] Download completed and cached: ${xmlPath}`);
    return xmlContent;

  } catch (error) {
    // 다운로드 실패 -> 마커 제거 (다른 인스턴스가 재시도 가능)
    await supabase.rpc('abort_xml_download', { p_xml_path: xmlPath });
    throw error;
  }
}

/**
 * 캐시 폴링 (Exponential Backoff)
 *
 * 100ms -> 200ms -> 400ms -> 800ms -> 1600ms -> 3200ms (총 ~6.3초)
 */
async function pollCacheWithExponentialBackoff(xmlPath: string): Promise<string> {
  let delay = INITIAL_POLL_DELAY_MS;

  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    await new Promise(r => setTimeout(r, delay));

    const cached = await getCachedXml(xmlPath);
    if (cached?.xml_content && cached.xml_content !== '__DOWNLOADING__') {
      console.log(`[XML] Cache poll success after ${attempt + 1} attempts: ${xmlPath}`);
      return cached.xml_content;
    }

    delay *= 2; // Exponential backoff
  }

  throw new DownloadTimeoutError(xmlPath);
}

/**
 * 글로벌 Rate Limiting 적용 다운로드
 */
async function downloadWithGlobalRateLimit(xmlPath: string): Promise<string> {
  const supabase = await createClient();

  // Rate limit 슬롯 획득 시도 (최대 5회, 총 ~5초)
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: slotAcquired, error } = await supabase.rpc('try_acquire_scourt_slot', {
      max_concurrent: MAX_SCOURT_CONCURRENT
    });

    if (error) {
      console.error('[XML] Rate limit check error:', error);
      throw new Error(`Rate limit check failed: ${error.message}`);
    }

    if (slotAcquired) {
      try {
        return await downloadXmlFromScourtWithTimeout(xmlPath, DOWNLOAD_TIMEOUT_MS);
      } finally {
        // 슬롯 해제 (성공/실패 모두)
        await supabase.rpc('release_scourt_slot');
      }
    }

    // 슬롯 획득 실패 -> 대기 후 재시도 (1초 간격)
    console.log(`[XML] Rate limit, retry ${attempt + 1}/5 for ${xmlPath}`);
    await new Promise(r => setTimeout(r, 1000));
  }

  // 5회 시도 후에도 실패 -> RateLimitExceededError
  throw new RateLimitExceededError(xmlPath);
}

/**
 * 타임아웃 포함 대법원 다운로드
 */
async function downloadXmlFromScourtWithTimeout(
  xmlPath: string,
  timeoutMs: number
): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const url = `${SCOURT_XML_BASE_URL}/${xmlPath}`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/xml, text/xml, */*",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Failed to download XML: ${url} (${response.status})`);
    }

    const contentType = response.headers.get("content-type");
    const xmlContent = await response.text();

    if (isHtmlResponse(xmlContent, contentType)) {
      throw new Error(`Unexpected HTML response from: ${url}`);
    }

    if (!isWebSquareXml(xmlContent)) {
      throw new Error(`Invalid XML content from: ${url}`);
    }

    return xmlContent;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new DownloadTimeoutError(xmlPath);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
```

**2. API Route 수정 (graceful degradation, request body 한 번만 파싱)**
**파일:** `/Users/hskim/luseed/app/api/scourt/xml-cache/route.ts`

```typescript
import { RateLimitExceededError, DownloadTimeoutError, downloadXmlWithProtection } from "@/lib/scourt/xml-fetcher";

export async function POST(request: NextRequest) {
  // request body 한 번만 파싱
  let body: { xmlPath?: string; caseType?: string; forceRefresh?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { xmlPath, caseType, forceRefresh = false } = body;

  if (!xmlPath) {
    return NextResponse.json(
      { error: "Missing required field: xmlPath" },
      { status: 400 }
    );
  }

  try {
    // 강제 갱신이 아니면 캐시 확인
    if (!forceRefresh) {
      const cached = await getCachedXml(xmlPath);
      if (cached && cached.xml_content !== '__DOWNLOADING__') {
        return NextResponse.json({
          message: "XML already cached",
          xml_path: cached.xml_path,
          cached_at: cached.created_at,
          from_cache: true,
        });
      }
    }

    // 통합 함수로 다운로드 (분산 락 + rate limit)
    const xmlContent = await downloadXmlWithProtection(xmlPath, caseType);

    return NextResponse.json({
      message: "XML downloaded and cached",
      xml_path: xmlPath,
      xml_content: xmlContent,
      from_cache: false,
    });

  } catch (error) {
    // Graceful Degradation: Rate limit 또는 타임아웃 시
    if (error instanceof RateLimitExceededError || error instanceof DownloadTimeoutError) {
      console.warn(`[XML] Graceful degradation for ${error.xmlPath}: ${error.name}`);

      // 1. 정적 파일 시도
      try {
        const publicPath = path.join(process.cwd(), "public", "scourt-xml", xmlPath);
        const xmlContent = await fs.readFile(publicPath, "utf8");
        return NextResponse.json({
          xml_path: xmlPath,
          xml_content: xmlContent,
          from_static: true,
          degraded: true,
          reason: error.name,
        });
      } catch {
        // 정적 파일 없음
      }

      // 2. 기존 캐시 반환 (stale이라도, __DOWNLOADING__ 제외)
      try {
        const cached = await getCachedXml(xmlPath);
        if (cached && cached.xml_content && cached.xml_content !== '__DOWNLOADING__') {
          return NextResponse.json({
            xml_path: cached.xml_path,
            xml_content: cached.xml_content,
            from_cache: true,
            degraded: true,
            reason: error.name,
          });
        }
      } catch {
        // 캐시 조회 실패
      }

      // 3. 정적 파일/캐시 모두 없으면 503 Service Unavailable
      return NextResponse.json(
        {
          error: "Service temporarily unavailable",
          reason: error.name,
          retry_after: 5,
        },
        { status: 503 }
      );
    }

    // 기타 에러 처리
    console.error("Error caching XML:", error);
    return NextResponse.json(
      {
        error: "Failed to download/cache XML",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
```

**Acceptance Criteria:**
- [ ] `downloadXmlWithProtection()` 함수가 락 획득 -> rate limit -> 다운로드 순서로 동작
- [ ] **`_retryCount` 파라미터로 무한 재귀 방지 (최대 3회)**
- [ ] **에러 클래스 `export` 명시**
- [ ] **상수는 기존 Constants 섹션 (line 17-25) 바로 아래에 추가**
- [ ] **`createClient` import가 이미 존재 (line 7) 확인**
- [ ] Exponential backoff 폴링 (100ms -> 200ms -> 400ms -> ...)
- [ ] Rate limit 초과 시 `RateLimitExceededError` throw
- [ ] 다운로드 타임아웃 시 `DownloadTimeoutError` throw
- [ ] Graceful degradation: 정적 파일 -> 캐시 -> 503
- [ ] **`request.json()` 한 번만 호출**

---

### T5: k6 로드 테스트 (import 수정, 실제 XML 파일명 39개 반영)
**파일:** `/Users/hskim/luseed/scripts/load-test-xml.js` (신규)

**목적:** 3000명 동시 접속 시 시스템 동작 검증

```javascript
// scripts/load-test-xml.js
// k6 로드 테스트 스크립트
// 실행: k6 run scripts/load-test-xml.js

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';

// 커스텀 메트릭
const xmlCacheHits = new Counter('xml_cache_hits');
const xmlStaticHits = new Counter('xml_static_hits');
const xmlDownloads = new Counter('xml_downloads');
const xmlErrors = new Counter('xml_errors');
const xmlLatency = new Trend('xml_latency');

// 테스트 설정
export const options = {
  scenarios: {
    // 시나리오 1: 3000명 동시 접속 시뮬레이션
    concurrent_users: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 100 },   // 30초 동안 100명까지 증가
        { duration: '1m', target: 500 },    // 1분 동안 500명까지 증가
        { duration: '2m', target: 1000 },   // 2분 동안 1000명까지 증가
        { duration: '3m', target: 3000 },   // 3분 동안 3000명까지 증가
        { duration: '5m', target: 3000 },   // 5분 동안 3000명 유지
        { duration: '1m', target: 0 },      // 1분 동안 0명까지 감소
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    // 성공률 99% 이상
    'http_req_failed': ['rate<0.01'],
    // 응답 시간 p95 < 2초
    'http_req_duration': ['p(95)<2000'],
    // XML 에러 1% 미만
    'xml_errors': ['count<100'],
  },
};

// 테스트할 XML 경로 목록 (실제 /public/scourt-xml/ 디렉토리 기반 - 39개 전체)
const XML_PATHS = [
  // ssgo003 (일반) - 28 files
  'ssgo003/SSGO003F10.xml',
  'ssgo003/SSGO003F11.xml',
  'ssgo003/SSGO003F20.xml',
  'ssgo003/SSGO003F30.xml',
  'ssgo003/SSGO003F32.xml',
  'ssgo003/SSGO003F40.xml',
  'ssgo003/SSGO003F50.xml',
  'ssgo003/SSGO003F60.xml',
  'ssgo003/SSGO003F61.xml',
  'ssgo003/SSGO003F62.xml',
  'ssgo003/SSGO003F63.xml',
  'ssgo003/SSGO003F64.xml',
  'ssgo003/SSGO003F65.xml',
  'ssgo003/SSGO003F66.xml',
  'ssgo003/SSGO003F67.xml',
  'ssgo003/SSGO003F68.xml',
  'ssgo003/SSGO003F69.xml',
  'ssgo003/SSGO003F6A.xml',
  'ssgo003/SSGO003F6B.xml',
  'ssgo003/SSGO003F6C.xml',
  'ssgo003/SSGO003F70.xml',
  'ssgo003/SSGO003F71.xml',
  'ssgo003/SSGO003F80.xml',
  'ssgo003/SSGO003F90.xml',
  'ssgo003/SSGO003FA0.xml',
  'ssgo003/SSGO003FF0.xml',
  'ssgo003/SSGO003FG0.xml',
  'ssgo003/SSGO003FH0.xml',
  // ssgo101 (민사 1심) - 1 file
  'ssgo101/SSGO101F01.xml',
  // ssgo102 (민사 항소) - 1 file
  'ssgo102/SSGO102F01.xml',
  // ssgo105 (행정) - 1 file
  'ssgo105/SSGO105F01.xml',
  // ssgo106 (형사) - 1 file
  'ssgo106/SSGO106F01.xml',
  // ssgo107 (가사) - 1 file
  'ssgo107/SSGO107F01.xml',
  // ssgo108 (신청) - 1 file
  'ssgo108/SSGO108F01.xml',
  // ssgo10a (회생/파산) - 1 file
  'ssgo10a/SSGO10AF01.xml',
  // ssgo10c (집행) - 1 file
  'ssgo10c/SSGO10CF01.xml',
  // ssgo10g (지급명령) - 1 file
  'ssgo10g/SSGO10GF01.xml',
  // ssgo10i (조정) - 1 file
  'ssgo10i/SSGO10IF01.xml',
  // ssgo10j (화해) - 1 file
  'ssgo10j/SSGO10JF01.xml',
];

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  // 랜덤 XML 경로 선택
  const xmlPath = XML_PATHS[Math.floor(Math.random() * XML_PATHS.length)];

  // 1. GET 요청 (캐시 조회)
  const startTime = Date.now();
  const getRes = http.get(`${BASE_URL}/api/scourt/xml-cache?path=${encodeURIComponent(xmlPath)}`);
  const latency = Date.now() - startTime;
  xmlLatency.add(latency);

  const success = check(getRes, {
    'status is 200 or 404': (r) => r.status === 200 || r.status === 404,
  });

  if (!success) {
    xmlErrors.add(1);
    return;
  }

  if (getRes.status === 200) {
    const data = getRes.json();
    if (data.from_static) {
      xmlStaticHits.add(1);
    } else {
      xmlCacheHits.add(1);
    }
    return;
  }

  // 2. POST 요청 (다운로드)
  const postRes = http.post(
    `${BASE_URL}/api/scourt/xml-cache`,
    JSON.stringify({ xmlPath }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  const postSuccess = check(postRes, {
    'download status is 200 or 503': (r) => r.status === 200 || r.status === 503,
  });

  if (!postSuccess) {
    xmlErrors.add(1);
  } else if (postRes.status === 200) {
    xmlDownloads.add(1);
  }

  // 사용자 생각 시간 시뮬레이션 (1-3초)
  sleep(1 + Math.random() * 2);
}

export function handleSummary(data) {
  // k6 jslib의 textSummary 사용
  const summary = textSummary(data, { indent: ' ', enableColors: true });

  // 커스텀 메트릭 요약 추가
  const customSummary = `
=== XML Loading Custom Metrics ===

- Cache Hits: ${data.metrics.xml_cache_hits?.values?.count || 0}
- Static Hits: ${data.metrics.xml_static_hits?.values?.count || 0}
- Downloads: ${data.metrics.xml_downloads?.values?.count || 0}
- Errors: ${data.metrics.xml_errors?.values?.count || 0}
- Avg Latency: ${data.metrics.xml_latency?.values?.avg?.toFixed(2) || 0}ms
- P95 Latency: ${data.metrics.xml_latency?.values?.['p(95)']?.toFixed(2) || 0}ms
`;

  return {
    'stdout': summary + customSummary,
    'scripts/load-test-results.json': JSON.stringify(data, null, 2),
  };
}
```

**Acceptance Criteria:**
- [ ] **k6 jslib에서 `textSummary` 올바르게 import**
- [ ] **XML_PATHS에 실제 파일명 39개 전체 포함 (glob 결과 기반)**
- [ ] k6 스크립트 실행 가능
- [ ] 3000명 동시 접속 시뮬레이션 완료
- [ ] 성공률 99% 이상
- [ ] P95 응답 시간 2초 미만
- [ ] 결과 JSON 파일 생성

---

### T6: 검증 및 테스트
**수행 항목:**
1. 빌드 검증: `npm run build`
2. 타입 검증: `npx tsc --noEmit`
3. 마이그레이션 적용: `supabase migration up`
4. 수동 테스트:
   - 사건 상세 페이지 "일반" 탭 로드 확인
   - 네트워크 탭에서 정적 파일 우선 로드 확인
   - 동일 페이지 새로고침 시 캐시 히트 확인
5. k6 로드 테스트 실행 (선택적)

**성공 지표 검증 방법:**

| Metric | Before | After | 검증 방법 |
|--------|--------|-------|----------|
| 정적 파일 로드 시 DB 쿼리 | 1회 | 0회 | 브라우저 Network 탭: `/api/scourt/xml-cache` 요청 없음 확인 |
| 트래픽 커버리지 | 0% | 80-90% | 정적 파일 디렉토리 내 XML 파일 목록과 실제 사용 XML 경로 대조 |
| 동일 XML 동시 다운로드 | N회 | 1회 | `SELECT * FROM scourt_xml_cache WHERE xml_content = '__DOWNLOADING__'` 모니터링 |
| 대법원 동시 요청 | 무제한 | 최대 3개 | `SELECT get_scourt_concurrent_count()` 모니터링 |
| Rate limit 초과 처리 | 에러 | Graceful | 503 대신 정적 파일/캐시 반환 확인 |
| SCOURT 타임아웃 | 없음 | 10초 | 느린 응답 시 10초 후 타임아웃 에러 확인 |
| PgBouncer 호환성 | N/A | 정상 | 테이블 기반 락이 트랜잭션 모드에서 작동 확인 |

**Acceptance Criteria:**
- [ ] 빌드 성공 (에러 0개)
- [ ] 타입 검사 통과
- [ ] 마이그레이션 적용 성공
- [ ] 기존 기능 정상 동작
- [ ] 성공 지표 검증 완료
- [ ] k6 로드 테스트 통과 (선택적)

---

## Commit Strategy

### Commit 1: feat(scourt): reorder XML loading to prioritize static files
- T1 클라이언트 측 로딩 순서 변경
- 정적 파일 우선 로드로 80-90% 트래픽 커버
- **기존 retry-after-POST 로직 보존**

### Commit 2: feat(scourt): add table-based distributed lock for XML download
- T2 Supabase RPC 함수 추가 (테이블 기반 락)
- `__DOWNLOADING__` 마커 기반 중복 방지
- PgBouncer 트랜잭션 모드 호환
- **`GET DIAGNOSTICS v_rows = ROW_COUNT`로 삽입 성공 여부 정확히 확인**

### Commit 3: feat(scourt): add global rate limiting with RLS policies
- T3 Supabase rate limit 테이블 및 RPC 함수 추가
- RLS 정책 적용
- **SECURITY DEFINER 주석 명확화 (RLS 우회)**
- Stale 슬롯 자동 정리

### Commit 4: feat(scourt): add downloadXmlWithProtection integration function
- T4 통합 함수 구현
- **무한 재귀 방지 (`_retryCount`)**
- **에러 클래스 export**
- **request body 한 번만 파싱**
- **상수는 기존 Constants 섹션 바로 아래에 추가**
- Exponential backoff 폴링
- Graceful degradation

### Commit 5: test(scourt): add k6 load test script
- T5 k6 로드 테스트 스크립트 추가
- **k6 jslib에서 textSummary import**
- **실제 XML 파일명 39개 전체 포함**
- 3000명 동시 접속 시뮬레이션

### Commit 6: test(scourt): verify XML loading optimization
- T6 검증 완료 후 빌드 검증

---

## Success Criteria

| Metric | Before | After | Method |
|--------|--------|-------|--------|
| 정적 파일 로드 시 DB 쿼리 | 1회 | 0회 | 네트워크 탭 확인 |
| 정적 파일 트래픽 커버리지 | 0% | 80-90% | XML 파일 목록 대조 |
| 동일 XML 동시 다운로드 (인스턴스 간) | N회 | 1회 | `__DOWNLOADING__` 마커 모니터링 |
| 대법원 동시 요청 (전체 인스턴스) | 무제한 | 최대 3개 | 글로벌 카운터 모니터링 |
| SCOURT 다운로드 타임아웃 | 없음 | 10초 | 타임아웃 에러 확인 |
| Rate limit 초과 시 | 에러 | Graceful degradation | 503 대신 정적/캐시 반환 확인 |
| PgBouncer 호환성 | 실패 | 정상 | 테이블 기반 락 사용 |
| 캐시 폴링 효율 | 비효율 (고정 간격) | Exponential backoff | 폴링 로그 확인 |
| RLS 정책 | 누락 | 적용 | `scourt_rate_limit` RLS 확인 |
| 로드 테스트 | 없음 | 3000명 검증 | k6 결과 확인 |
| 빌드 성공 | - | Yes | npm run build |

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| 정적 파일이 구버전일 수 있음 | DB 캐시에서 최신 버전 확인 가능, 문제 없음 (XML 레이아웃은 거의 변경 안됨) |
| ~~pg_advisory_lock이 PgBouncer에서 작동 안함~~ | **해결: 테이블 기반 락 (`__DOWNLOADING__` 마커) 사용** |
| `__DOWNLOADING__` 마커가 stuck될 수 있음 | 5분 후 자동 stale 처리, `cleanup_stale_xml_downloads()` 함수로 정리 |
| Rate limit 카운터가 stuck될 수 있음 | `try_acquire_scourt_slot()` 함수 내에서 5분 이상 업데이트 없으면 자동 리셋 |
| Supabase RPC 호출 오버헤드 | 락 획득은 빠름 (<50ms), 정적 파일 우선으로 대부분 요청은 RPC 호출 안함 |
| k6 로드 테스트 환경 부재 | 로컬 또는 스테이징 환경에서 실행, 프로덕션은 점진적 롤아웃 |
| **무한 재귀 발생 가능** | **해결: `_retryCount` 파라미터로 최대 3회 제한** |

---

## Notes

- 정적 파일 39개는 대부분의 사건 유형을 커버함 (예상 80-90%)
- 새로운 사건 유형 추가 시 정적 파일도 추가 권장
- **테이블 기반 락**은 PgBouncer 트랜잭션 모드에서도 정상 동작
- `__DOWNLOADING__` 마커는 5분 후 자동 stale 처리됨 (cron job 불필요)
- Rate limit 카운터도 5분 이상 업데이트 없으면 자동 리셋
- **Exponential backoff** (100ms -> 200ms -> 400ms -> 800ms -> 1600ms -> 3200ms)로 총 ~6.3초 폴링
- **RLS 정책**: authenticated 읽기, service_role 쓰기
- **SECURITY DEFINER 함수는 RLS를 우회함** (주석으로 명시)
- **k6 textSummary**: `https://jslib.k6.io/k6-summary/0.0.1/index.js`에서 import
- **무한 재귀 방지**: `_retryCount` 파라미터로 최대 3회 재시도 제한
- Graceful degradation으로 사용자 경험 유지 (503 에러 최소화)
- **T2 SQL 수정**: `INSERT ... ON CONFLICT DO NOTHING` 후 `IF FOUND` 대신 `GET DIAGNOSTICS v_rows = ROW_COUNT` 사용
- **T5 XML_PATHS**: glob 결과 기반 실제 파일명 39개 전체 반영
