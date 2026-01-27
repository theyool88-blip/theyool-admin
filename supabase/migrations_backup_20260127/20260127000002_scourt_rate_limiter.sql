-- supabase/migrations/20260127000002_scourt_rate_limiter.sql

-- SCOURT 동시 요청 카운터 테이블
CREATE TABLE IF NOT EXISTS scourt_rate_limit (
  id integer PRIMARY KEY DEFAULT 1,
  concurrent_count integer DEFAULT 0,
  last_updated timestamptz DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);

-- 초기 행 삽입
INSERT INTO scourt_rate_limit (id, concurrent_count) VALUES (1, 0)
ON CONFLICT (id) DO NOTHING;

-- RLS 활성화
ALTER TABLE scourt_rate_limit ENABLE ROW LEVEL SECURITY;

-- RLS 정책: 모든 authenticated 사용자가 읽기 가능
CREATE POLICY "scourt_rate_limit_select_authenticated"
ON scourt_rate_limit
FOR SELECT
TO authenticated
USING (true);

-- RLS 정책: service_role만 수정 가능
-- 주의: RPC 함수는 SECURITY DEFINER로 실행되어 RLS를 우회함
CREATE POLICY "scourt_rate_limit_all_service"
ON scourt_rate_limit
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 슬롯 획득 시도 (atomic, returns true if acquired)
-- SECURITY DEFINER: 함수 소유자 권한으로 실행 (RLS 우회)
-- 주의: SECURITY DEFINER 함수는 RLS 정책을 우회하므로 함수 내부에서 권한 검사 필요 시 별도 구현
CREATE OR REPLACE FUNCTION try_acquire_scourt_slot(max_concurrent integer DEFAULT 3)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  acquired boolean := false;
BEGIN
  -- Stale 슬롯 정리 (5분 이상 업데이트 없으면 리셋)
  UPDATE scourt_rate_limit
  SET concurrent_count = 0
  WHERE id = 1
    AND last_updated < now() - interval '5 minutes'
    AND concurrent_count > 0;

  -- 슬롯 획득 시도
  UPDATE scourt_rate_limit
  SET concurrent_count = concurrent_count + 1,
      last_updated = now()
  WHERE id = 1 AND concurrent_count < max_concurrent;

  IF FOUND THEN
    acquired := true;
  END IF;

  RETURN acquired;
END;
$$;

-- 슬롯 해제
-- SECURITY DEFINER: 함수 소유자 권한으로 실행 (RLS 우회)
CREATE OR REPLACE FUNCTION release_scourt_slot()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE scourt_rate_limit
  SET concurrent_count = GREATEST(concurrent_count - 1, 0),
      last_updated = now()
  WHERE id = 1;
END;
$$;

-- 현재 동시 요청 수 조회
-- SECURITY DEFINER: 함수 소유자 권한으로 실행 (RLS 우회)
CREATE OR REPLACE FUNCTION get_scourt_concurrent_count()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT concurrent_count FROM scourt_rate_limit WHERE id = 1;
$$;
