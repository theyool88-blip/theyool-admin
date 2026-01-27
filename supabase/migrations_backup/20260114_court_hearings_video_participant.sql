-- court_hearings에 화상 참여자 정보 컬럼 추가
-- 2026-01-14
--
-- 용도: 일방 화상기일에서 누가 화상으로 참석하는지 표시
-- 데이터 출처: SCOURT raw_data.data.btprAgntList[].agntNm에서 [화상장치] 마커 추출

-- 화상 참여자 측 컬럼 추가
ALTER TABLE court_hearings
ADD COLUMN IF NOT EXISTS video_participant_side TEXT;

-- 코멘트
COMMENT ON COLUMN court_hearings.video_participant_side IS '화상 참여자 측: plaintiff_side(원고측), defendant_side(피고측), both(쌍방), NULL(화상기일 아님)';

-- 인덱스 (화상기일 필터링용)
CREATE INDEX IF NOT EXISTS idx_court_hearings_video_participant
ON court_hearings(video_participant_side)
WHERE video_participant_side IS NOT NULL;

-- 기존 데이터 업데이트: scourt_type_raw에서 쌍방 화상장치인 경우
UPDATE court_hearings
SET video_participant_side = 'both'
WHERE scourt_type_raw ILIKE '%쌍방 화상장치%'
  OR scourt_type_raw ILIKE '%쌍방화상장치%';

-- 완료 메시지
DO $$
BEGIN
  RAISE NOTICE '✅ court_hearings.video_participant_side 컬럼 추가 완료';
  RAISE NOTICE '   - 쌍방 화상기일 %건 업데이트', (SELECT COUNT(*) FROM court_hearings WHERE video_participant_side = 'both');
END $$;
