# 법원 기일 관리 시스템 구현 가이드

**작성일**: 2025-11-22
**프로젝트**: 법무법인 더율 관리 시스템
**목적**: 이혼사건 법원 기일 및 불변기간 데드라인 관리

---

## 목차
1. [시스템 개요](#시스템-개요)
2. [데이터베이스 설계](#데이터베이스-설계)
3. [설치 및 마이그레이션](#설치-및-마이그레이션)
4. [API 사용법](#api-사용법)
5. [프론트엔드 통합](#프론트엔드-통합)
6. [고급 기능](#고급-기능)
7. [문제 해결](#문제-해결)

---

## 시스템 개요

### 주요 기능
- **법원 기일 관리**: 변론기일, 조정기일, 선고기일 등 6가지 유형의 법원 기일 등록 및 추적
- **불변기간 데드라인 자동 계산**: 상소기간(14일), 항소이유서 제출(40일) 등 법정 기한 자동 산출
- **알림 시스템**: D-3, D-7 알림으로 기한 경과 방지
- **통계 대시보드**: 사건별 기일 현황 및 데드라인 현황 파악

### 기술 스택
- **Database**: Supabase PostgreSQL
- **Backend**: Next.js 16 API Routes
- **Frontend**: React 19, TypeScript
- **Security**: Row Level Security (RLS)

---

## 데이터베이스 설계

### 1. 핵심 테이블

#### `deadline_types` (불변기간 마스터)
불변기간 정의 및 기준일수 관리

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID | Primary Key |
| type | deadline_type (ENUM) | 데드라인 유형 |
| name | VARCHAR(100) | 한글 명칭 (예: "상소기간") |
| days_count | INTEGER | 기한 일수 (예: 14) |
| trigger_event | VARCHAR(200) | 트리거 이벤트 설명 |

**초기 데이터 (5가지)**:
- `DL_APPEAL`: 상소기간 (14일)
- `DL_MEDIATION_OBJ`: 조정·화해 이의기간 (14일)
- `DL_IMM_APPEAL`: 즉시항고기간 (7일)
- `DL_APPEAL_BRIEF`: 항소이유서 제출 (40일)
- `DL_RETRIAL`: 재심의 소 제기 (30일)

#### `court_hearings` (법원 기일)
실제 법원 출석 기일 관리

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID | Primary Key |
| case_id | UUID | 사건 ID (FK) |
| hearing_type | hearing_type (ENUM) | 대표 기일 유형 (6가지) |
| hearing_detail | VARCHAR(200) | 세부 기일명 (예: "증인신문기일") |
| scheduled_date | DATE | 기일 날짜 |
| scheduled_time | TIME | 기일 시간 |
| court_name | VARCHAR(200) | 법원명 |
| courtroom | VARCHAR(100) | 법정 번호 |
| lawyer_attendance_required | BOOLEAN | 변호사 출석 필요 여부 |
| client_attendance_required | BOOLEAN | 당사자 출석 필요 여부 |
| status | hearing_status | 상태 (예정/완료/연기/취소) |
| notes | TEXT | 준비사항 메모 |
| result | TEXT | 기일 결과 |

**hearing_type (6가지)**:
- `HEARING_MAIN`: 변론기일 (변론기일, 변론준비기일, 증인신문기일 등)
- `HEARING_INTERIM`: 사전·보전처분 심문기일
- `HEARING_MEDIATION`: 조정기일
- `HEARING_INVESTIGATION`: 조사기일
- `HEARING_PARENTING`: 상담·교육·프로그램 기일
- `HEARING_JUDGMENT`: 선고기일

#### `case_deadlines` (사건 데드라인)
불변기간 기반 자동 계산 데드라인

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID | Primary Key |
| case_id | UUID | 사건 ID (FK) |
| deadline_type | deadline_type (ENUM) | 데드라인 유형 |
| related_hearing_id | UUID | 관련 기일 ID (Optional) |
| trigger_date | DATE | 트리거 기준일 |
| deadline_date | DATE | 실제 데드라인 (자동 계산) |
| days_count | INTEGER | 계산 일수 (자동 채움) |
| status | deadline_status | 상태 (대기/완료/초과) |
| reminder_enabled | BOOLEAN | 알림 활성화 여부 |
| reminder_days_before | INTEGER | 사전 알림 일수 (기본 3일) |

### 2. 자동화 기능

#### 데드라인 자동 계산 트리거
`case_deadlines` INSERT 시 자동으로 `deadline_date` 계산:

```sql
CREATE TRIGGER auto_calculate_deadline_trigger
  BEFORE INSERT ON case_deadlines
  FOR EACH ROW
  EXECUTE FUNCTION auto_calculate_deadline();
```

**동작 원리**:
1. 사용자가 `trigger_date`와 `deadline_type`만 입력
2. 트리거가 `deadline_types` 테이블에서 `days_count` 조회
3. `deadline_date = trigger_date + days_count` 자동 계산

#### 예시
```sql
INSERT INTO case_deadlines (case_id, deadline_type, trigger_date)
VALUES ('uuid-123', 'DL_APPEAL', '2025-11-20');
-- 결과: deadline_date = '2025-12-04' (14일 후)
```

### 3. 유용한 View

#### `upcoming_hearings` (다가오는 기일 - 7일 이내)
```sql
SELECT ch.*, lc.case_name, lc.case_number
FROM court_hearings ch
JOIN legal_cases lc ON ch.case_id = lc.id
WHERE ch.status = 'SCHEDULED'
  AND ch.scheduled_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days';
```

#### `urgent_deadlines` (긴급 데드라인 - 3일 이내)
```sql
SELECT cd.*, dt.name, lc.case_name
FROM case_deadlines cd
JOIN deadline_types dt ON cd.deadline_type = dt.type
WHERE cd.status = 'PENDING'
  AND cd.deadline_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '3 days';
```

### 4. RLS 정책

모든 테이블에 Row Level Security 적용:

- **변호사**: 본인이 담당한 사건의 기일/데드라인만 조회/수정
- **관리자**: 모든 데이터 접근 가능

```sql
-- 예시: court_hearings 조회 정책
CREATE POLICY "court_hearings_select_own_cases"
  ON court_hearings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM legal_cases
      WHERE legal_cases.id = court_hearings.case_id
        AND legal_cases.assigned_lawyer_id = auth.uid()
    )
  );
```

---

## 설치 및 마이그레이션

### 1. 마이그레이션 실행

```bash
# 스크립트 실행 (Node.js 환경)
node scripts/run-court-hearings-migration.js
```

**예상 출력**:
```
🚀 법원 기일 관리 시스템 마이그레이션 시작...
📄 마이그레이션 파일 로드 완료
⚙️  SQL 실행 중...
✅ 10/50 실행 완료...
✅ 20/50 실행 완료...
...
📊 마이그레이션 결과:
   ✅ 성공: 48개
   ❌ 실패: 0개

🔍 생성된 테이블 확인 중...
   ✅ deadline_types: 정상 생성됨
   ✅ court_hearings: 정상 생성됨
   ✅ case_deadlines: 정상 생성됨

✅ 마이그레이션 완료!
```

### 2. Supabase 대시보드 확인

1. **Table Editor** → `deadline_types` 확인
   - 5개의 초기 레코드 존재 여부 확인

2. **Authentication** → RLS 정책 확인
   - `court_hearings`, `case_deadlines` 정책 활성화 확인

3. **SQL Editor**에서 수동 테스트:
```sql
-- 데드라인 타입 조회
SELECT * FROM deadline_types ORDER BY days_count DESC;

-- 데드라인 계산 함수 테스트
SELECT calculate_deadline_date('2025-11-20'::DATE, 'DL_APPEAL'::deadline_type);
-- 예상 결과: 2025-12-04
```

---

## API 사용법

### 1. 법원 기일 API

#### 기일 목록 조회
```http
GET /api/admin/court-hearings?case_id={uuid}&status=SCHEDULED
Authorization: Cookie (admin session)

Response:
{
  "success": true,
  "data": [
    {
      "id": "uuid-123",
      "case_id": "uuid-456",
      "hearing_type": "HEARING_MAIN",
      "hearing_detail": "증인신문기일",
      "scheduled_date": "2025-12-15",
      "scheduled_time": "14:00:00",
      "court_name": "수원지방법원 가정법원",
      "courtroom": "402호 법정",
      "lawyer_attendance_required": true,
      "client_attendance_required": true,
      "status": "SCHEDULED",
      "notes": "양육권 관련 증거자료 준비 필요"
    }
  ],
  "count": 1
}
```

#### 기일 생성
```http
POST /api/admin/court-hearings
Content-Type: application/json

{
  "case_id": "uuid-456",
  "hearing_type": "HEARING_MAIN",
  "hearing_detail": "변론기일",
  "scheduled_date": "2025-12-15",
  "scheduled_time": "14:00",
  "court_name": "수원지방법원 가정법원",
  "courtroom": "402호 법정",
  "lawyer_attendance_required": true,
  "client_attendance_required": true,
  "notes": "양육권 쟁점 집중 심리"
}

Response:
{
  "success": true,
  "data": { /* 생성된 기일 데이터 */ },
  "message": "법원 기일이 생성되었습니다."
}
```

#### 기일 수정
```http
PATCH /api/admin/court-hearings/{id}
Content-Type: application/json

{
  "status": "COMPLETED",
  "result": "다음 기일 지정됨 (2026-01-20)"
}
```

#### 기일 삭제
```http
DELETE /api/admin/court-hearings/{id}
```

### 2. 데드라인 API

#### 데드라인 생성 (자동 계산)
```http
POST /api/admin/case-deadlines
Content-Type: application/json

{
  "case_id": "uuid-456",
  "deadline_type": "DL_APPEAL",
  "trigger_date": "2025-11-20",
  "notes": "판결문 정본 수령, 항소 검토 중"
}

Response:
{
  "success": true,
  "data": {
    "id": "uuid-789",
    "case_id": "uuid-456",
    "deadline_type": "DL_APPEAL",
    "trigger_date": "2025-11-20",
    "deadline_date": "2025-12-04",  // 자동 계산 (14일 후)
    "days_count": 14,
    "status": "PENDING",
    "reminder_enabled": true,
    "reminder_days_before": 3
  },
  "message": "데드라인이 생성되었습니다."
}
```

#### 긴급 데드라인 조회 (3일 이내)
```http
GET /api/admin/case-deadlines?urgent_only=true

Response:
{
  "success": true,
  "data": [
    {
      "id": "uuid-789",
      "deadline_date": "2025-11-25",
      "deadline_type": "DL_APPEAL",
      "status": "PENDING",
      "days_remaining": 2  // 계산된 필드
    }
  ]
}
```

#### 데드라인 완료 처리
```http
POST /api/admin/case-deadlines/{id}/complete
Content-Type: application/json

{
  "completion_notes": "항소장 제출 완료 (2025-11-22)"
}

Response:
{
  "success": true,
  "data": {
    "status": "COMPLETED",
    "completed_at": "2025-11-22T10:30:00Z",
    "completion_notes": "항소장 제출 완료 (2025-11-22)"
  },
  "message": "데드라인이 완료 처리되었습니다."
}
```

---

## 프론트엔드 통합

### 1. TypeScript 타입 사용

```typescript
import type {
  CourtHearing,
  CaseDeadline,
  HearingType,
  DeadlineType,
  HEARING_TYPE_LABELS,
  DEADLINE_TYPE_LABELS
} from '@/types/court-hearing';

// 기일 유형 라벨 표시
const hearing: CourtHearing = { hearing_type: 'HEARING_MAIN', ... };
console.log(HEARING_TYPE_LABELS[hearing.hearing_type]); // "변론기일"
```

### 2. Supabase 헬퍼 함수 사용

```typescript
import {
  getCourtHearings,
  getUpcomingHearingsByCase,
  createCourtHearing
} from '@/lib/supabase/court-hearings';

import {
  getCaseDeadlines,
  getUrgentDeadlines,
  createCaseDeadline
} from '@/lib/supabase/case-deadlines';

// 예시: 특정 사건의 다가오는 기일 조회
async function loadUpcomingHearings(caseId: string) {
  const hearings = await getUpcomingHearingsByCase(caseId);
  console.log(`다가오는 기일: ${hearings.length}개`);
}

// 예시: 긴급 데드라인 조회
async function loadUrgentDeadlines() {
  const deadlines = await getUrgentDeadlines();
  deadlines.forEach(d => {
    console.log(`${d.deadline_name}: D-${d.days_remaining}`);
  });
}
```

### 3. 관리자 페이지 예시 구조

```typescript
// app/admin/court-hearings/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { getCourtHearings } from '@/lib/supabase/court-hearings';
import type { CourtHearing } from '@/types/court-hearing';

export default function CourtHearingsPage() {
  const [hearings, setHearings] = useState<CourtHearing[]>([]);

  useEffect(() => {
    loadHearings();
  }, []);

  async function loadHearings() {
    const data = await getCourtHearings({ status: 'SCHEDULED' });
    setHearings(data);
  }

  return (
    <div>
      <h1>법원 기일 관리</h1>
      <table>
        <thead>
          <tr>
            <th>기일 유형</th>
            <th>날짜</th>
            <th>법원</th>
            <th>상태</th>
          </tr>
        </thead>
        <tbody>
          {hearings.map(h => (
            <tr key={h.id}>
              <td>{h.hearing_detail || h.hearing_type}</td>
              <td>{h.scheduled_date} {h.scheduled_time}</td>
              <td>{h.court_name}</td>
              <td>{h.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

---

## 고급 기능

### 1. Cron Job: 기한 초과 데드라인 자동 업데이트

```typescript
// app/api/cron/update-overdue-deadlines/route.ts
import { NextResponse } from 'next/server';
import { updateOverdueDeadlines } from '@/lib/supabase/case-deadlines';

export async function GET() {
  try {
    const updatedCount = await updateOverdueDeadlines();
    return NextResponse.json({
      success: true,
      message: `${updatedCount}개의 데드라인이 OVERDUE로 변경되었습니다.`
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

**Vercel Cron 설정** (`vercel.json`):
```json
{
  "crons": [{
    "path": "/api/cron/update-overdue-deadlines",
    "schedule": "0 0 * * *"
  }]
}
```

### 2. 알림 시스템 통합

```typescript
// 데드라인 D-3 알림 발송
import { getDeadlinesForReminder } from '@/lib/supabase/case-deadlines';

async function sendReminderNotifications() {
  const deadlines = await getDeadlinesForReminder(3); // D-3

  for (const deadline of deadlines) {
    // 이메일/SMS 발송 로직
    await sendEmail({
      to: deadline.legal_cases.assigned_lawyer_email,
      subject: `[긴급] 데드라인 D-3: ${deadline.deadline_name}`,
      body: `사건 ${deadline.legal_cases.case_name}의 ${deadline.deadline_name} 기한이 3일 남았습니다.`
    });
  }
}
```

### 3. 통계 대시보드

```typescript
// 사건별 기일/데드라인 통계
import {
  getHearingStatsByCase,
  getDeadlineStatsByCase
} from '@/lib/supabase/court-hearings';

async function getCaseStatistics(caseId: string) {
  const hearingStats = await getHearingStatsByCase(caseId);
  const deadlineStats = await getDeadlineStatsByCase(caseId);

  return {
    hearings: {
      total: hearingStats.total,
      scheduled: hearingStats.scheduled,
      completed: hearingStats.completed
    },
    deadlines: {
      total: deadlineStats.total,
      urgent: deadlineStats.urgent,
      overdue: deadlineStats.overdue
    }
  };
}
```

---

## 문제 해결

### 1. 마이그레이션 실패 시

**증상**: 테이블이 생성되지 않음

**해결책**:
```sql
-- Supabase SQL Editor에서 직접 실행
-- 1. 기존 테이블 삭제 (주의!)
DROP TABLE IF EXISTS case_deadlines CASCADE;
DROP TABLE IF EXISTS court_hearings CASCADE;
DROP TABLE IF EXISTS deadline_types CASCADE;
DROP TYPE IF EXISTS hearing_type CASCADE;
DROP TYPE IF EXISTS deadline_type CASCADE;

-- 2. 마이그레이션 SQL 전체 복사 후 실행
```

### 2. RLS 정책 오류

**증상**: `permission denied for table court_hearings`

**해결책**:
```sql
-- RLS 일시 비활성화 (테스트용)
ALTER TABLE court_hearings DISABLE ROW LEVEL SECURITY;

-- 또는 Service Role Key 사용
-- .env.local에서 SUPABASE_SERVICE_ROLE_KEY 확인
```

### 3. 데드라인 자동 계산 실패

**증상**: `deadline_date`가 NULL로 저장됨

**해결책**:
```sql
-- 트리거 존재 확인
SELECT tgname FROM pg_trigger WHERE tgname = 'auto_calculate_deadline_trigger';

-- 함수 존재 확인
SELECT proname FROM pg_proc WHERE proname = 'auto_calculate_deadline';

-- 수동 재생성
-- (마이그레이션 SQL의 트리거 부분만 다시 실행)
```

### 4. 날짜 형식 오류

**증상**: `invalid input syntax for type date`

**해결책**:
```typescript
// 올바른 형식: YYYY-MM-DD
const triggerDate = new Date().toISOString().split('T')[0];
// 결과: "2025-11-22"

// 잘못된 형식 (❌)
const wrongDate = new Date().toLocaleDateString(); // "11/22/2025"
```

---

## 다음 단계

### 1. 관리자 UI 구현
- [ ] 법원 기일 목록 페이지 (`/admin/court-hearings`)
- [ ] 기일 생성/수정 모달
- [ ] 데드라인 대시보드 (`/admin/deadlines`)
- [ ] 캘린더 뷰 통합

### 2. 알림 시스템
- [ ] 이메일 알림 (D-3, D-7)
- [ ] SMS 알림 (긴급 데드라인)
- [ ] 푸시 알림 (웹/모바일)

### 3. 파일 업로드
- [ ] 기일통지서 업로드 (`notice_document_url`)
- [ ] Supabase Storage 버킷 생성
- [ ] 파일 다운로드 링크

### 4. 고급 검색
- [ ] 날짜 범위 필터
- [ ] 법원별 필터
- [ ] 변호사별 필터
- [ ] 풀텍스트 검색 (메모, 결과)

---

## 참고 자료

### 파일 위치
- **마이그레이션**: `/supabase/migrations/20251122_court_hearings_system.sql`
- **타입 정의**: `/types/court-hearing.ts`
- **헬퍼 함수**: `/lib/supabase/court-hearings.ts`, `/lib/supabase/case-deadlines.ts`
- **API**: `/app/api/admin/court-hearings/`, `/app/api/admin/case-deadlines/`

### 데이터베이스 함수
- `calculate_deadline_date(p_trigger_date, p_deadline_type)`: 데드라인 계산
- `update_overdue_deadlines()`: 기한 초과 데드라인 상태 업데이트

### View
- `upcoming_hearings`: 7일 이내 예정된 기일
- `urgent_deadlines`: 3일 이내 데드라인

---

**작성자**: Claude (AI Assistant)
**버전**: 1.0
**최종 업데이트**: 2025-11-22
