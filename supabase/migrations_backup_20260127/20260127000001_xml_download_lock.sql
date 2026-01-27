-- supabase/migrations/20260127000001_xml_download_lock.sql

-- 다운로드 슬롯 획득 시도 (테이블 기반 락, PgBouncer 호환)
-- Returns: 'acquired' | 'already_cached' | 'downloading'
CREATE OR REPLACE FUNCTION try_acquire_xml_download_slot(p_xml_path text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_existing_content text;
  v_existing_updated timestamptz;
  v_rows integer;
BEGIN
  -- 1. 기존 캐시 확인
  SELECT xml_content, updated_at INTO v_existing_content, v_existing_updated
  FROM scourt_xml_cache
  WHERE xml_path = p_xml_path;

  IF FOUND THEN
    -- 2a. 유효한 캐시 존재 (다운로드 중 아님)
    IF v_existing_content IS NOT NULL AND v_existing_content != '__DOWNLOADING__' THEN
      RETURN 'already_cached';
    END IF;

    -- 2b. 다운로드 중 마커 존재
    IF v_existing_content = '__DOWNLOADING__' THEN
      -- 5분 이상 지났으면 stale -> 재획득 허용
      IF v_existing_updated < now() - interval '5 minutes' THEN
        UPDATE scourt_xml_cache
        SET xml_content = '__DOWNLOADING__', updated_at = now()
        WHERE xml_path = p_xml_path;
        RETURN 'acquired';
      END IF;
      RETURN 'downloading';
    END IF;
  END IF;

  -- 3. 새로 삽입 시도 (atomic)
  INSERT INTO scourt_xml_cache (xml_path, xml_content, updated_at)
  VALUES (p_xml_path, '__DOWNLOADING__', now())
  ON CONFLICT (xml_path) DO NOTHING;

  -- 4. 삽입 성공 여부 확인 (GET DIAGNOSTICS 사용 - IF FOUND는 부정확)
  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows > 0 THEN
    RETURN 'acquired';
  END IF;

  -- 5. 동시 삽입 경쟁에서 패배 -> 다시 상태 확인
  SELECT xml_content INTO v_existing_content
  FROM scourt_xml_cache
  WHERE xml_path = p_xml_path;

  IF v_existing_content = '__DOWNLOADING__' THEN
    RETURN 'downloading';
  ELSE
    RETURN 'already_cached';
  END IF;
END;
$$;

-- 다운로드 완료 후 실제 XML로 업데이트
CREATE OR REPLACE FUNCTION complete_xml_download(
  p_xml_path text,
  p_xml_content text,
  p_case_type text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE scourt_xml_cache
  SET xml_content = p_xml_content,
      case_type = p_case_type,
      updated_at = now()
  WHERE xml_path = p_xml_path
    AND (xml_content = '__DOWNLOADING__' OR xml_content IS NULL);

  RETURN FOUND;
END;
$$;

-- 다운로드 실패 시 마커 제거 (다른 인스턴스가 재시도 가능하도록)
CREATE OR REPLACE FUNCTION abort_xml_download(p_xml_path text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM scourt_xml_cache
  WHERE xml_path = p_xml_path
    AND xml_content = '__DOWNLOADING__';
END;
$$;

-- Stale 다운로드 마커 정리 (cron job 또는 수동 호출)
CREATE OR REPLACE FUNCTION cleanup_stale_xml_downloads()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_count integer;
BEGIN
  DELETE FROM scourt_xml_cache
  WHERE xml_content = '__DOWNLOADING__'
    AND updated_at < now() - interval '5 minutes';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
