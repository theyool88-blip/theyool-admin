-- ================================================================
-- 기한 유형 확장 (형사/가사비송/지급명령)
--
-- 추가되는 불변기간:
-- - DL_CRIMINAL_APPEAL: 형사 상소기간 (7일) - 형소법 §358
-- - DL_FAMILY_NONLIT: 가사비송 즉시항고 (14일) - 가사소송법
-- - DL_PAYMENT_ORDER: 지급명령 이의신청 (14일) - 민소법 §470
-- ================================================================

-- 1. ENUM 타입에 새 값 추가
-- PostgreSQL에서 ENUM에 값을 추가할 때는 ALTER TYPE ... ADD VALUE 사용
ALTER TYPE deadline_type ADD VALUE IF NOT EXISTS 'DL_CRIMINAL_APPEAL';
ALTER TYPE deadline_type ADD VALUE IF NOT EXISTS 'DL_FAMILY_NONLIT';
ALTER TYPE deadline_type ADD VALUE IF NOT EXISTS 'DL_PAYMENT_ORDER';

-- 2. deadline_types 테이블에 새 기한 유형 데이터 삽입
INSERT INTO deadline_types (type, name, days, description) VALUES
  ('DL_CRIMINAL_APPEAL', '형사 상소기간', 7, '형사사건 항소 또는 상고 제기 가능 기간 (형소법 §358)'),
  ('DL_FAMILY_NONLIT', '가사비송 즉시항고', 14, '가사비송사건 심판에 대한 즉시항고 기간 (가사소송법)'),
  ('DL_PAYMENT_ORDER', '지급명령 이의신청', 14, '지급명령에 대한 이의신청 기간 (민소법 §470)')
ON CONFLICT (type) DO NOTHING;

-- 3. case_deadlines 테이블에 scourt_update_id 컬럼 추가 (중복 방지용)
ALTER TABLE case_deadlines
ADD COLUMN IF NOT EXISTS scourt_update_id UUID REFERENCES scourt_case_updates(id) ON DELETE SET NULL;

-- 4. 인덱스 추가 (중복 체크용)
CREATE INDEX IF NOT EXISTS idx_case_deadlines_scourt_update_id
ON case_deadlines(scourt_update_id)
WHERE scourt_update_id IS NOT NULL;

-- 5. 코멘트 추가
COMMENT ON COLUMN case_deadlines.scourt_update_id IS 'SCOURT 자동 등록 시 연결된 업데이트 ID (중복 방지용)';
