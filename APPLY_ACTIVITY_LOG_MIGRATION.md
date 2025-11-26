# 상담 활동 이력 시스템 마이그레이션 가이드

## 마이그레이션 적용 방법

### Option 1: 마이그레이션 스크립트 사용
```bash
node scripts/apply-migration.js supabase/migrations/20251125_create_consultation_activity_log.sql
```

### Option 2: 직접 SQL 실행
Supabase Dashboard → SQL Editor에서 다음 파일의 내용을 복사하여 실행:
- `supabase/migrations/20251125_create_consultation_activity_log.sql`

## 마이그레이션 내용

### 1. 테이블 생성
- **consultation_activity_log**: 모든 상담 활동 이력 저장
  - 상담 ID 참조 (외래키)
  - 활동 유형 (created, status_changed, assigned, scheduled, etc.)
  - 설명 (한글)
  - 변경 전/후 값
  - 작업자 정보 (admin/system/customer)
  - 메타데이터 (JSONB)

### 2. 자동 트리거 설정
상담 테이블에 INSERT/UPDATE 발생 시 자동으로 활동 이력 기록:
- ✅ 상담 생성
- ✅ 상태 변경 (pending → contacted → confirmed 등)
- ✅ 담당 변호사 배정/변경
- ✅ 일정 확정/변경/삭제
- ✅ 사건 연결
- ✅ 유입 경로 변경
- ✅ 관리자 메모 추가

### 3. 도우미 함수
- `get_consultation_activity_summary(consultation_id)`: 통계 요약 조회
  - 전체 활동 수
  - 마지막 활동 시간
  - 상태 변경 횟수
  - 일정 변경 횟수
  - 메모 추가 횟수

### 4. 기존 데이터 마이그레이션
모든 기존 상담에 대해 "생성" 이력을 자동으로 추가합니다.

## 확인 방법

마이그레이션 적용 후:

```sql
-- 1. 테이블 확인
SELECT COUNT(*) FROM consultation_activity_log;

-- 2. 트리거 확인
SELECT trigger_name FROM information_schema.triggers
WHERE event_object_table = 'consultations';

-- 3. 샘플 이력 조회
SELECT
  cal.created_at,
  cal.activity_type,
  cal.description,
  c.name
FROM consultation_activity_log cal
JOIN consultations c ON c.id = cal.consultation_id
ORDER BY cal.created_at DESC
LIMIT 10;

-- 4. 통계 함수 테스트
SELECT * FROM get_consultation_activity_summary(
  (SELECT id FROM consultations LIMIT 1)
);
```

## 사용 방법

### 관리자 페이지에서 확인
1. 상담 관리 페이지 → 상담 클릭
2. "📜 활동 이력" 탭 클릭
3. 모든 변경 내역을 타임라인으로 확인

### API로 조회
```javascript
// 이력 조회
const response = await fetch(`/api/admin/consultations/${consultationId}/activities?include_summary=true`);
const data = await response.json();
console.log(data.data); // 활동 목록
console.log(data.summary); // 통계 요약

// 수동 이력 추가
await fetch(`/api/admin/consultations/${consultationId}/activities`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    activity_type: 'note_added',
    description: '고객과 통화 완료',
    actor_name: '김관리자'
  })
});
```

## 자동 추적되는 변경사항

이제 모든 상담 관련 변경사항이 자동으로 기록됩니다:

| 작업 | 기록 내용 |
|------|----------|
| 상담 생성 | "새로운 상담 요청이 등록되었습니다." |
| 상태 변경 | "상담 상태가 변경되었습니다: pending → contacted" |
| 담당자 배정 | "담당 변호사가 육심원님으로 지정되었습니다" |
| 일정 확정 | "상담 일정이 확정되었습니다: 2024-01-15 14:00" |
| 일정 변경 | "상담 일정이 변경되었습니다: 2024-01-15 14:00 → 2024-01-16 10:00" |
| 일정 삭제 | "확정된 일정이 삭제되었습니다: 2024-01-15 14:00" |
| 사건 연결 | "사건이 연결되었습니다." |
| 유입 경로 설정 | "유입 경로가 네이버(으)로 설정되었습니다" |
| 메모 추가 | "관리자 메모가 추가되었습니다." |

## 혜택

### 투명성
- 누가, 언제, 무엇을 변경했는지 완벽히 추적
- 고객 문의 시 정확한 이력 제공 가능

### 법적 근거
- 법무법인에서 중요한 변경 이력 증거 자료
- 분쟁 발생 시 대응 가능

### 성과 분석
- 상담 처리 프로세스 분석
- 병목 구간 식별
- 담당자별 업무량 파악

### 고객 서비스 개선
- 상담 진행 상황을 고객에게 투명하게 공유
- 지연 사유 명확히 설명 가능
