# SCOURT 사건 갱신 시스템 (1년 WMONID 기준)

**Last Updated**: 2026-01-10

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
  sync_type TEXT NOT NULL, -- progress, general, full, wmonid_renewal
  priority TEXT NOT NULL DEFAULT 'auto', -- auto, manual
  scheduled_at TIMESTAMPTZ NOT NULL,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'queued', -- queued, running, success, failed, skipped
  attempts INTEGER DEFAULT 0,
  last_error TEXT,
  requested_by UUID, -- 수동 갱신 요청자
  wmonid_id UUID REFERENCES scourt_user_wmonid(id),
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
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

### 3) 전역 설정 (슈퍼어드민)

`scourt_sync_settings` 테이블 또는 `system_settings`에 다음 값을 저장합니다.

- `progress_interval_hours` (기본 6~8시간)
- `general_backoff_hours` (기본 24시간)
- `global_concurrency` (기본 6~10)
- `wmonid_concurrency` (기본 1)
- `request_jitter_seconds` (기본 1~3초)
- `max_cases_per_run` (기본 100~300)
- `auto_sync_enabled` (전체 on/off)

---

## 자동 갱신 흐름

```
Scheduler (5~10분마다)
  -> 활성 사건 필터링
  -> next_progress_sync_at <= now 인 사건을 큐잉
  -> 진행내용 변경 감지 시 general 큐잉
  -> queue 크기와 동시성 제한 준수

Worker
  -> scourt_sync_jobs 가져오기 (FOR UPDATE SKIP LOCKED)
  -> progress/general 호출
  -> 변경 감지 및 스냅샷 저장
  -> next_*_sync_at 갱신
```

### 진행 -> 일반 갱신 조건

- 진행내용 변경 감지 시 **즉시** 일반내용 갱신
- 변경이 없더라도 `last_general_sync_at`이 24시간 경과하면 일반내용 갱신

---

## 수동 갱신 고려

수동 갱신은 **자동 스케줄에 반영**해야 중복 호출을 줄일 수 있습니다.

- 수동 갱신 성공 시:
  - `scourt_last_manual_sync_at` 갱신
  - `scourt_last_*_sync_at` 갱신
  - `next_*_sync_at`를 뒤로 밀기
- 수동 갱신 실패 시:
  - 자동 스케줄은 유지 (재시도 대상)

---

## 활성 사건 필터

다음 조건을 모두 만족하는 사건만 자동 갱신합니다.

- `legal_cases.status IN ('진행중','진행','active')`
- `scourt_sync_enabled = true`
- 종국결과 확정 또는 비활성 표시 시 `scourt_sync_enabled = false` 자동 전환

---

## 호출 분산/과도 호출 방지

- 사건별 해시 슬롯 분산:
  - 예: `hash(case_id) % 1440` 분 단위 슬롯 + 0~30분 지터
- WMONID당 동시 1건, 전역 동시성 제한
- 요청 간 1~3초 랜덤 딜레이
- 실패 시 지수 백오프 (예: 5m -> 15m -> 30m)

---

## WMONID 관리 (1년 기준)

### 만료/갱신 정책

- `expires_at` (Set-Cookie Expires) 기준으로 만료 판단
- 만료 30~45일 전 `wmonid_renewal` 큐 생성
- 갱신 흐름:
  1. 새 WMONID 발급
  2. 사건 재등록(캡챠) -> 새 encCsNo 확보
  3. 기존 WMONID `expired` 처리

### 용량 계산

- 10,000건 / 50건(1 WMONID) = 최소 200 WMONID 필요
- `scourt_user_wmonid.case_count` 기반으로 자동 분배
- 남은 용량 부족 시 슈퍼어드민 경고

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

- [ ] `scourt_sync_jobs` 테이블 생성 및 인덱스 추가
- [ ] 스케줄러(5~10분) + 워커(락 기반) 구현
- [ ] 진행/일반 분리 호출 로직 적용
- [ ] 수동 갱신 API와 자동 스케줄 연동
- [ ] WMONID 만료 갱신 크론 통합
- [ ] 지표/알림 수집
