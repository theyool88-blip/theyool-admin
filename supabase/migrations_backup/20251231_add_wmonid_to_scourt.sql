-- scourt_profile_cases에 WMONID 컬럼 추가
-- 2025-12-31
--
-- 핵심 발견: encCsNo는 WMONID에 바인딩됨
-- 같은 WMONID를 사용해야 캡챠 없이 접근 가능

-- WMONID 컬럼 추가
ALTER TABLE scourt_profile_cases ADD COLUMN IF NOT EXISTS wmonid VARCHAR(20);

-- 인덱스 (같은 WMONID로 그룹핑된 사건들 조회용)
CREATE INDEX IF NOT EXISTS idx_scourt_profile_cases_wmonid ON scourt_profile_cases(wmonid);

-- 설명 코멘트
COMMENT ON COLUMN scourt_profile_cases.wmonid IS 'encCsNo가 바인딩된 WMONID 쿠키값. 2년간 유효. 재접근 시 이 값 사용 필수.';
COMMENT ON COLUMN scourt_profile_cases.enc_cs_no IS '암호화된 사건번호. WMONID와 함께 사용해야 캡챠 없이 상세조회 가능.';
