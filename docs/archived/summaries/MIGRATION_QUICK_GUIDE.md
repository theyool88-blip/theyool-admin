# 변호사미팅 마이그레이션 실행 가이드

## Supabase SQL Editor에서 실행할 SQL

```sql
-- =====================================================
-- 변호사미팅 기일 유형 추가
-- =====================================================

ALTER TYPE hearing_type ADD VALUE IF NOT EXISTS 'HEARING_LAWYER_MEETING';
```

## 실행 방법

1. Supabase Dashboard 접속: https://supabase.com/dashboard/project/kqqyipnlkmmprfgygauk
2. 좌측 메뉴 → SQL Editor
3. New query 클릭
4. 위 SQL 붙여넣기
5. Run 버튼 클릭

## 결과 확인

```sql
-- ENUM 값 확인 쿼리
SELECT enumlabel FROM pg_enum
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'hearing_type')
ORDER BY enumsortorder;
```

### 예상 결과
```
HEARING_MAIN
HEARING_INTERIM
HEARING_MEDIATION
HEARING_INVESTIGATION
HEARING_PARENTING
HEARING_JUDGMENT
HEARING_LAWYER_MEETING  ← 이 값이 표시되면 성공
```

## 주의사항

- 이미 실행했다면: "value already exists" 에러 발생 → 정상 (무시 가능)
- 안전성: 기존 데이터에 영향 없음
- 트랜잭션: ENUM 추가는 트랜잭션 외부에서 실행됨

## 완료 후

프론트엔드에서 "변호사미팅" 기일 유형이 자동으로 표시됩니다.

- QuickAddHearingModal: 기일 유형 선택 드롭다운에 "변호사미팅" 추가
- CaseDetail: 청록색 배지로 표시
- MonthlyCalendar: 청록색 점/배경으로 표시
