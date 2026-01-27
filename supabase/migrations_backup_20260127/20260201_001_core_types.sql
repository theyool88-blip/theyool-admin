-- ============================================================================
-- 법률 사무소 SaaS - ENUM 타입 정의
-- 생성일: 2026-02-01
-- 설명: 모든 ENUM 타입 통합 정의
-- ============================================================================

-- ============================================================================
-- 기존 ENUM 타입 삭제 (새로 생성하기 위해)
-- ============================================================================
DROP TYPE IF EXISTS hearing_type CASCADE;
DROP TYPE IF EXISTS hearing_status CASCADE;
DROP TYPE IF EXISTS hearing_result CASCADE;
DROP TYPE IF EXISTS deadline_type CASCADE;
DROP TYPE IF EXISTS deadline_status CASCADE;
DROP TYPE IF EXISTS party_type CASCADE;
DROP TYPE IF EXISTS receivable_grade CASCADE;
DROP TYPE IF EXISTS member_role CASCADE;
DROP TYPE IF EXISTS member_status CASCADE;
DROP TYPE IF EXISTS case_status CASCADE;
DROP TYPE IF EXISTS consultation_status CASCADE;
DROP TYPE IF EXISTS booking_status CASCADE;
DROP TYPE IF EXISTS notification_channel CASCADE;
DROP TYPE IF EXISTS notification_status CASCADE;

-- ============================================================================
-- 1. 멤버 관련 ENUM
-- ============================================================================

-- 멤버 역할
CREATE TYPE member_role AS ENUM (
  'owner',      -- 소유자 (최고 권한)
  'admin',      -- 관리자
  'lawyer',     -- 변호사
  'staff'       -- 직원
);
COMMENT ON TYPE member_role IS '테넌트 멤버 역할: owner > admin > lawyer > staff';

-- 멤버 상태
CREATE TYPE member_status AS ENUM (
  'active',     -- 활성
  'invited',    -- 초대됨 (수락 대기)
  'suspended'   -- 정지됨
);
COMMENT ON TYPE member_status IS '테넌트 멤버 상태';

-- ============================================================================
-- 2. 사건 관련 ENUM
-- ============================================================================

-- 사건 상태
CREATE TYPE case_status AS ENUM (
  'active',     -- 진행 중
  'closed',     -- 종결
  'suspended',  -- 보류
  'dismissed'   -- 각하/기각
);
COMMENT ON TYPE case_status IS '사건 상태';

-- 당사자 유형
CREATE TYPE party_type AS ENUM (
  'plaintiff',  -- 원고
  'defendant',  -- 피고
  'creditor',   -- 채권자
  'debtor',     -- 채무자
  'applicant',  -- 신청인
  'respondent', -- 피신청인
  'appellant',  -- 항소인
  'appellee'    -- 피항소인
);
COMMENT ON TYPE party_type IS '사건 당사자 유형';

-- ============================================================================
-- 3. 기일 관련 ENUM
-- ============================================================================

-- 기일 유형
CREATE TYPE hearing_type AS ENUM (
  'HEARING_MAIN',           -- 변론기일
  'HEARING_INTERIM',        -- 사전·보전처분 심문기일
  'HEARING_MEDIATION',      -- 조정기일
  'HEARING_INVESTIGATION',  -- 조사기일
  'HEARING_PARENTING',      -- 상담·교육·프로그램 기일
  'HEARING_JUDGMENT',       -- 선고기일
  'HEARING_LAWYER_MEETING', -- 변호사 미팅
  'HEARING_SENTENCE',       -- 형사 선고기일
  'HEARING_TRIAL',          -- 공판기일
  'HEARING_EXAMINATION'     -- 증인신문기일
);
COMMENT ON TYPE hearing_type IS '법원 기일 유형';

-- 기일 상태
CREATE TYPE hearing_status AS ENUM (
  'SCHEDULED',  -- 예정
  'COMPLETED',  -- 완료
  'POSTPONED',  -- 연기
  'CANCELLED'   -- 취소
);
COMMENT ON TYPE hearing_status IS '법원 기일 상태';

-- 기일 결과
CREATE TYPE hearing_result AS ENUM (
  'continued',   -- 속행
  'settled',     -- 화해/조정 성립
  'judgment',    -- 판결 선고
  'dismissed',   -- 각하/기각
  'withdrawn',   -- 취하
  'adjourned',   -- 휴정
  'other'        -- 기타
);
COMMENT ON TYPE hearing_result IS '법원 기일 결과';

-- ============================================================================
-- 4. 데드라인 관련 ENUM
-- ============================================================================

-- 데드라인 유형
CREATE TYPE deadline_type AS ENUM (
  'DL_APPEAL',              -- 상소기간 (14일)
  'DL_MEDIATION_OBJ',       -- 조정·화해 이의기간 (14일)
  'DL_IMM_APPEAL',          -- 즉시항고기간 (7일)
  'DL_APPEAL_BRIEF',        -- 항소이유서 제출 (40일)
  'DL_APPEAL_BRIEF_HIGH',   -- 상고이유서 제출 (20일)
  'DL_RETRIAL',             -- 재심의 소 제기 (30일)
  'DL_CRIMINAL_APPEAL',     -- 형사상소기간 (7일)
  'DL_FAMILY_NONLIT',       -- 가사비송즉시항고 (7일)
  'DL_PAYMENT_ORDER',       -- 지급명령이의 (14일)
  'DL_ELEC_SERVICE',        -- 전자송달기간
  'DL_CUSTOM'               -- 사용자 정의 기한
);
COMMENT ON TYPE deadline_type IS '데드라인 유형';

-- 데드라인 상태
CREATE TYPE deadline_status AS ENUM (
  'PENDING',    -- 대기 중
  'COMPLETED',  -- 완료
  'OVERDUE'     -- 기한 초과
);
COMMENT ON TYPE deadline_status IS '데드라인 상태';

-- ============================================================================
-- 5. 상담/예약 관련 ENUM
-- ============================================================================

-- 상담 상태
CREATE TYPE consultation_status AS ENUM (
  'pending',      -- 대기
  'in_progress',  -- 진행 중
  'completed',    -- 완료
  'cancelled'     -- 취소
);
COMMENT ON TYPE consultation_status IS '상담 신청 상태';

-- 예약 상태
CREATE TYPE booking_status AS ENUM (
  'pending',    -- 대기
  'confirmed',  -- 확정
  'cancelled',  -- 취소
  'completed',  -- 완료
  'no_show'     -- 노쇼
);
COMMENT ON TYPE booking_status IS '상담 예약 상태';

-- ============================================================================
-- 6. 재무 관련 ENUM
-- ============================================================================

-- 미수금 등급
CREATE TYPE receivable_grade AS ENUM (
  'normal',     -- 정상
  'watch',      -- 주의
  'collection'  -- 추심
);
COMMENT ON TYPE receivable_grade IS '미수금 관리 등급';

-- ============================================================================
-- 7. 알림 관련 ENUM
-- ============================================================================

-- 알림 채널
CREATE TYPE notification_channel AS ENUM (
  'sms',          -- SMS
  'kakao_alimtalk', -- 카카오 알림톡
  'email',        -- 이메일
  'push'          -- 푸시 알림
);
COMMENT ON TYPE notification_channel IS '알림 발송 채널';

-- 알림 상태
CREATE TYPE notification_status AS ENUM (
  'pending',    -- 대기
  'sent',       -- 발송됨
  'delivered',  -- 전달됨
  'failed',     -- 실패
  'cancelled'   -- 취소됨
);
COMMENT ON TYPE notification_status IS '알림 발송 상태';

-- ============================================================================
-- 완료
-- ============================================================================
