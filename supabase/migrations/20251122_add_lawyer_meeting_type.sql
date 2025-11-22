-- =====================================================
-- 변호사미팅 기일 유형 추가
-- =====================================================
-- 파일: 20251122_add_lawyer_meeting_type.sql
-- 목적: hearing_type ENUM에 'HEARING_LAWYER_MEETING' 추가
-- 용도: 변호사-의뢰인 상담/미팅을 법원기일로 관리

-- ENUM 타입에 새 값 추가
-- PostgreSQL 9.1+ 에서는 ALTER TYPE ... ADD VALUE 사용
-- IF NOT EXISTS는 PostgreSQL 14+ 에서 지원 (이전 버전에서는 중복 추가 시 에러 발생)
ALTER TYPE hearing_type ADD VALUE IF NOT EXISTS 'HEARING_LAWYER_MEETING';

-- 참고:
-- 1. ENUM에 값을 추가하는 것은 안전한 작업입니다 (기존 데이터에 영향 없음)
-- 2. ENUM 값은 트랜잭션 내에서 추가할 수 없으므로, 별도로 실행해야 합니다
-- 3. 이미 존재하는 값을 추가하려고 하면 에러가 발생합니다
-- 4. ENUM 값은 삭제할 수 없으므로 신중하게 추가하세요

-- 마이그레이션 완료 확인:
-- SELECT enumlabel FROM pg_enum
-- WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'hearing_type')
-- ORDER BY enumsortorder;

-- 예상 결과:
-- HEARING_MAIN
-- HEARING_INTERIM
-- HEARING_MEDIATION
-- HEARING_INVESTIGATION
-- HEARING_PARENTING
-- HEARING_JUDGMENT
-- HEARING_LAWYER_MEETING (신규)
