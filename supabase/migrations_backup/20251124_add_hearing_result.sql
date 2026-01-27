-- 변론기일 결과(result) 컬럼 추가
-- 작성일: 2025-11-24
-- 목적: 변론기일의 결과를 저장 (속행, 종결, 연기, 추정)

-- 1. ENUM 타입 생성 (hearing_result)
DO $$ BEGIN
  CREATE TYPE hearing_result AS ENUM (
    'CONTINUED',   -- 속행
    'CONCLUDED',   -- 종결
    'POSTPONED',   -- 연기
    'DISMISSED'    -- 추정
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. court_hearings 테이블에 result 컬럼 추가
ALTER TABLE court_hearings
ADD COLUMN IF NOT EXISTS result hearing_result;

-- 3. 컬럼 코멘트 추가
COMMENT ON COLUMN court_hearings.result IS '변론기일 결과: CONTINUED(속행), CONCLUDED(종결), POSTPONED(연기), DISMISSED(추정)';
