-- 사건별 원드라이브 폴더 URL 필드 추가
-- 의뢰인 포털에서 소송 서류 폴더를 iframe으로 보여주기 위함

ALTER TABLE legal_cases
ADD COLUMN IF NOT EXISTS onedrive_folder_url TEXT;

COMMENT ON COLUMN legal_cases.onedrive_folder_url IS '원드라이브 공유 폴더 URL (소송 서류)';
