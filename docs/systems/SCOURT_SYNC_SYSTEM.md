# SCOURT 사건 갱신 시스템 (1년 WMONID 기준)

**Last Updated**: 2026-01-16

대법원 나의사건검색(SCOURT) 데이터를 안정적으로 갱신하기 위한 시스템 설계 문서입니다.

---

## 목표

- 활성 사건만 대상으로 하루 3~4회 갱신
- 1만 건 이상 사건 규모에서 호출 분산
- 과도한 호출로 보이지 않도록 요청 제어
- 슈퍼어드민이 갱신 주기/동시성/긴급 중지 조절
- 즉시 수동 갱신 지원
- 진행내용은 자주, 일반내용은 진행내용 변경 시 또는 하루 1회만 갱신

---

## 핵심 제약

- **WMONID**: `Set-Cookie Expires` 기준 장기 쿠키 (현재 관측 1년)
- **JSESSIONID**: 세션 쿠키 (브라우저 종료 시 삭제)
- **encCsNo**: WMONID에 바인딩, 동일 WMONID에서만 캡챠 없이 재접근 가능
- **활성 사건만**: 확정/비활성 사건은 자동 갱신 제외

---

## 데이터 구분

- **진행내용(progress)**: 송달, 제출, 기일, 판결 등. 하루 3~4회 확인 필요
- **일반내용(general)**: 사건 기본정보, 당사자, 종국결과 등. 진행내용 변경 시에만 갱신, 최소 하루 1회 백오프

---

## 동기화 유형

| 유형 | 설명 | 캡챠 | 빈도 |
|------|------|------|------|
| `progress` | 진행내용만 조회 | 없음 | 하루 3~4회 |
| `general` | 일반내용만 조회 | 없음 | 진행내용 변경 시 + 하루 1회 |
| `full` | 진행 + 일반 + 스냅샷 저장 | 없음 | 수동 갱신/장애 복구 |
| `wmonid_renewal` | WMONID 갱신 및 사건 재등록 | 필요 | 만료 30~45일 전 |

---

## 스케줄링/큐 구조

### 1) 작업 큐 (신규 테이블 권장)

```sql
CREATE TABLE scourt_sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_case_id UUID REFERENCES legal_cases(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  sync_type TEXT NOT NULL, -- progress, general, full, wmonid_renewal
  priority INTEGER NOT NULL DEFAULT 0, -- 0=auto, 10=manual
  scheduled_at TIMESTAMPTZ NOT NULL,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'queued', -- queued, running, success, failed, skipped
  attempts INTEGER DEFAULT 0,
  backoff_until TIMESTAMPTZ,
  last_error TEXT,
  lock_token TEXT,
  dedup_key TEXT,
  requested_by UUID,
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2) 사건별 스케줄 필드 (추가 권장)

`legal_cases`에 아래 필드를 추가하여 분산 스케줄 기준을 명확히 유지합니다.

- `scourt_last_progress_sync_at`
- `scourt_last_general_sync_at`
- `scourt_next_progress_sync_at`
- `scourt_next_general_sync_at`
- `scourt_progress_hash`
- `scourt_general_hash`
- `scourt_sync_enabled` (bool, 기본 true)
- `scourt_last_manual_sync_at`
- `scourt_sync_cooldown_until`
- `scourt_sync_locked_at`
- `scourt_sync_lock_token`

### 3) 전역 설정 (슈퍼어드민)

`app_settings`의 `key = 'scourt_sync_settings'`에 JSON으로 저장합니다.

```json
{
  "autoSyncEnabled": true,
  "progressIntervalHours": 6,
  "progressJitterMinutes": 15,
  "generalBackoffHours": 24,
  "schedulerBatchSize": 300,
  "workerBatchSize": 20,
  "workerConcurrency": 4,
  "requestJitterMs": { "min": 600, "max": 1800 },
  "rateLimitPerMinute": 40,
  "autoCooldownMinutes": 10,
  "manualCooldownMinutes": 30,
  "activeCaseRule": {
    "statusAllowList": ["진행중", "진행", "active"],
    "statusBlockList": ["종결", "종국", "확정", "종료", "완료"],
    "excludeFinalResult": true,
    "requireLinked": true
  },
  "wmonid": {
    "autoRotateEnabled": true,
    "renewalBeforeDays": 45,
    "earlyRotateEnabled": true
  }
}
```

---

## 자동 갱신 흐름

```
Scheduler `/api/cron/scourt-sync-scheduler` (10분마다)
  -> 활성 사건 필터링 + 분산 슬롯 계산
  -> next_progress_sync_at <= now 인 사건을 큐잉
  -> WMONID 만료 임박 건 큐잉

Worker `/api/cron/scourt-sync-worker` (2분마다)
  -> scourt_sync_jobs 가져오기 (FOR UPDATE SKIP LOCKED)
  -> progress/general 호출
  -> 변경 감지 및 스냅샷 저장
  -> 진행 변화 시 general 큐잉 (24시간 백오프)
```

### 진행 -> 일반 갱신 조건

- 진행내용 변경 감지 시 **즉시** 일반내용 갱신 큐 생성
- `last_general_sync_at`이 24시간 미만이면 일반내용은 스킵

---

## 수동 갱신 고려

수동 갱신은 **자동 스케줄에 반영**해야 중복 호출을 줄일 수 있습니다.

- 수동 갱신 성공 시:
  - `scourt_last_manual_sync_at` 갱신
  - `scourt_last_*_sync_at` 갱신
  - `next_*_sync_at`를 뒤로 밀기
  - `scourt_sync_cooldown_until` 설정 (자동 호출 쿨다운)
- 자동 진행 갱신 성공 시:
  - `scourt_sync_cooldown_until`을 `autoCooldownMinutes` 기준으로 설정
- 수동 갱신 실패 시:
  - 자동 스케줄은 유지 (재시도 대상)

---

## 활성 사건 필터

다음 조건을 모두 만족하는 사건만 자동 갱신합니다.

- `scourt_sync_enabled = true`
- `activeCaseRule.statusAllowList`에 포함 (또는 statusBlockList 제외)
- `activeCaseRule.excludeFinalResult = true`일 경우 `case_result`/`case_result_date` 보유 사건 제외
- `activeCaseRule.requireLinked = true`일 경우 encCsNo/WMONID 없는 사건 제외

---

## 호출 분산/과도 호출 방지

- 사건별 해시 슬롯 분산:
  - 예: `hash(case_id) % intervalMinutes` 분 단위 슬롯 + 지터
- 워커 동시성 제한 (`workerConcurrency`)
- 요청 간 랜덤 딜레이 (`requestJitterMs`)
- 분당 호출 제한 (`rateLimitPerMinute`)
- 실패 시 지수 백오프 (예: 5m -> 15m -> 30m)

---

## WMONID 관리 (1년 기준)

### 만료/갱신 정책

- `expires_at` (Set-Cookie Expires) 기준으로 만료 판단
- 만료 30~45일 전 `wmonid_renewal` 큐 생성
- 스케줄러에서 자동 큐잉 + 슈퍼어드민 수동 회전 API 제공
- 갱신 흐름:
  1. 새 WMONID 발급
  2. 사건 재등록(캡챠) -> 새 encCsNo 확보
  3. 기존 WMONID `expired` 처리

### 용량 계산

- 10,000건 / 50건(1 WMONID) = 최소 200 WMONID 필요
- `scourt_user_wmonid.case_count` 기반으로 자동 분배
- 남은 용량 부족 시 슈퍼어드민 경고

---

## 관리 API/크론

- `GET/PUT /api/admin/scourt/sync-settings` (슈퍼어드민)
- `POST /api/admin/scourt/refresh` (슈퍼어드민 수동 큐잉)
- `POST /api/admin/scourt/wmonid/rotate` (슈퍼어드민 수동 회전)
- `GET /api/admin/scourt/queue-status` (슈퍼어드민 대시보드 요약)
- `GET /api/cron/scourt-sync-scheduler?secret=...`
- `GET /api/cron/scourt-sync-worker?secret=...`

---

## 슈퍼어드민 UI

- `/superadmin/scourt`에서 큐/WMONID/설정 요약 확인
- 사건 검색 또는 `case_id` 직접 입력으로 수동 큐 등록
- 최근 작업/로그 확인

---

## 변경 감지/저장

- 최신 스냅샷: `scourt_case_snapshots`
- 변경 이벤트: `scourt_case_updates`
- 진행/일반 변경 비교는 `CaseChangeDetector` 사용
- `content_hash` 또는 `progress_hash`로 빠른 변경 체크

---

## 장애/예외 처리

- 캡챠 실패: `status=failed`, 재시도 스케줄링
- encCsNo 만료: 재검색 플로우로 복구
- WMONID 만료: `wmonid_renewal` 큐로 이동
- 연속 실패: 사건별 자동 동기화 일시 중지 + 알림

---

## 슈퍼어드민 기능

- 전역 갱신 주기/동시성 조절
- 자동 갱신 on/off
- 수동 갱신 트리거 (단건/배치)
- WMONID 풀 현황/만료 임박 모니터링
- 실패율, 큐 적체, 평균 응답시간 대시보드

---

## 구현 체크리스트

- [x] `scourt_sync_jobs` 테이블 생성 및 인덱스 추가
- [x] 스케줄러/워커 크론 구현
- [x] 진행/일반 분리 호출 로직 적용
- [x] 수동 갱신 API와 자동 스케줄 연동
- [x] WMONID 만료 갱신 큐 통합
- [ ] 지표/알림 수집
