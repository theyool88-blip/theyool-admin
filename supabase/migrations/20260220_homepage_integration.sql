-- ============================================================================
-- 홈페이지-사건관리 시스템 통합
-- 생성일: 2026-02-20
-- 설명: 홈페이지 연동을 위한 추가 필드 및 테이블
-- ============================================================================

-- ============================================================================
-- 1. consultations 테이블 확장
-- ============================================================================

-- 마케팅 추적 (UTM 파라미터)
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS utm_source TEXT;
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS utm_medium TEXT;
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS utm_campaign TEXT;

-- 리드 스코어
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS lead_score INTEGER DEFAULT 0;

-- 상태 타임스탬프
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS contacted_at TIMESTAMPTZ;
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

-- 방문자 세션 연결
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS visitor_session_id UUID;

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_consultations_utm_source ON consultations(utm_source);
CREATE INDEX IF NOT EXISTS idx_consultations_lead_score ON consultations(lead_score);
CREATE INDEX IF NOT EXISTS idx_consultations_visitor_session ON consultations(visitor_session_id);

-- 코멘트
COMMENT ON COLUMN consultations.utm_source IS 'UTM 소스 (google, naver, facebook 등)';
COMMENT ON COLUMN consultations.utm_medium IS 'UTM 매체 (cpc, organic, social 등)';
COMMENT ON COLUMN consultations.utm_campaign IS 'UTM 캠페인명';
COMMENT ON COLUMN consultations.lead_score IS '리드 점수 (방문 이력, 참여도 기반)';
COMMENT ON COLUMN consultations.visitor_session_id IS '방문자 세션 연결 ID';

-- ============================================================================
-- 2. bookings 테이블 확장
-- ============================================================================

-- 마케팅 추적 (UTM 파라미터)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS utm_source TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS utm_medium TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS utm_campaign TEXT;

-- 리드 스코어
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS lead_score INTEGER DEFAULT 0;

-- 상담료 및 결제 정보
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS consultation_fee INTEGER DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_status TEXT
  CHECK (payment_status IS NULL OR payment_status IN ('pending', 'completed', 'refunded', 'free'));
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_method TEXT
  CHECK (payment_method IS NULL OR payment_method IN ('card', 'transfer', 'cash', 'free'));
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_transaction_id TEXT;

-- 상태 타임스탬프
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS no_show_at TIMESTAMPTZ;

-- 방문자 세션 연결
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS visitor_session_id UUID;

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_bookings_utm_source ON bookings(utm_source);
CREATE INDEX IF NOT EXISTS idx_bookings_lead_score ON bookings(lead_score);
CREATE INDEX IF NOT EXISTS idx_bookings_payment_status ON bookings(payment_status);
CREATE INDEX IF NOT EXISTS idx_bookings_visitor_session ON bookings(visitor_session_id);

-- 코멘트
COMMENT ON COLUMN bookings.utm_source IS 'UTM 소스';
COMMENT ON COLUMN bookings.utm_medium IS 'UTM 매체';
COMMENT ON COLUMN bookings.utm_campaign IS 'UTM 캠페인명';
COMMENT ON COLUMN bookings.lead_score IS '리드 점수';
COMMENT ON COLUMN bookings.consultation_fee IS '상담료 (원)';
COMMENT ON COLUMN bookings.payment_status IS '결제 상태: pending, completed, refunded, free';
COMMENT ON COLUMN bookings.payment_method IS '결제 방법: card, transfer, cash, free';
COMMENT ON COLUMN bookings.paid_at IS '결제 완료 시간';
COMMENT ON COLUMN bookings.payment_transaction_id IS '결제 트랜잭션 ID';

-- ============================================================================
-- 3. visitor_sessions 테이블 (방문자 세션)
-- ============================================================================
CREATE TABLE IF NOT EXISTS visitor_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- 방문자 식별
  visitor_id TEXT NOT NULL,           -- 익명 UUID (쿠키 기반, 365일 유지)
  session_id TEXT NOT NULL,           -- 세션 UUID (세션당 생성)

  -- 유입 정보
  referrer TEXT,                      -- 참조 URL
  landing_page TEXT,                  -- 랜딩 페이지
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,

  -- 브라우저/디바이스
  user_agent TEXT,
  device_type TEXT,                   -- mobile, tablet, desktop
  ip_address TEXT,                    -- 익명화 가능 (마지막 옥텟 0으로)

  -- 방문 통계
  visit_count INTEGER DEFAULT 1,      -- 이 visitor_id의 누적 방문 횟수
  is_returning BOOLEAN DEFAULT false, -- 재방문 여부

  -- 시간
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_visitor_sessions_tenant_id ON visitor_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_visitor_sessions_visitor_id ON visitor_sessions(visitor_id);
CREATE INDEX IF NOT EXISTS idx_visitor_sessions_session_id ON visitor_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_visitor_sessions_started_at ON visitor_sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_visitor_sessions_utm_source ON visitor_sessions(utm_source);

-- 코멘트
COMMENT ON TABLE visitor_sessions IS '홈페이지 방문자 세션 정보';
COMMENT ON COLUMN visitor_sessions.visitor_id IS '익명 방문자 ID (쿠키 기반)';
COMMENT ON COLUMN visitor_sessions.session_id IS '세션 ID (세션당 고유)';
COMMENT ON COLUMN visitor_sessions.is_returning IS '재방문자 여부';

-- ============================================================================
-- 4. page_views 테이블 (페이지 뷰)
-- ============================================================================
CREATE TABLE IF NOT EXISTS page_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES visitor_sessions(id) ON DELETE CASCADE,

  -- 페이지 정보
  page_path TEXT NOT NULL,
  page_title TEXT,
  page_type TEXT,                     -- home, service, blog, case, faq, contact, landing

  -- 콘텐츠 정보 (블로그/사례 등)
  content_id TEXT,                    -- 콘텐츠 ID (블로그 포스트 slug 등)
  content_category TEXT,              -- 콘텐츠 카테고리

  -- 참여도 지표
  time_on_page INTEGER,               -- 체류 시간 (초)
  scroll_depth INTEGER,               -- 스크롤 깊이 (0-100%)
  click_count INTEGER DEFAULT 0,      -- 클릭 수

  -- 이벤트 정보
  exit_page BOOLEAN DEFAULT false,    -- 이탈 페이지 여부

  viewed_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_page_views_tenant_id ON page_views(tenant_id);
CREATE INDEX IF NOT EXISTS idx_page_views_session_id ON page_views(session_id);
CREATE INDEX IF NOT EXISTS idx_page_views_page_path ON page_views(page_path);
CREATE INDEX IF NOT EXISTS idx_page_views_page_type ON page_views(page_type);
CREATE INDEX IF NOT EXISTS idx_page_views_viewed_at ON page_views(viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_page_views_content_id ON page_views(content_id);

-- 코멘트
COMMENT ON TABLE page_views IS '페이지 뷰 추적';
COMMENT ON COLUMN page_views.page_type IS '페이지 유형: home, service, blog, case, faq, contact, landing';
COMMENT ON COLUMN page_views.scroll_depth IS '스크롤 깊이 (0-100%)';

-- ============================================================================
-- 5. tenant_api_keys 테이블 (API 키 관리)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tenant_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- 키 정보
  key_hash TEXT NOT NULL,             -- bcrypt 해시된 키
  key_prefix VARCHAR(12) NOT NULL,    -- 표시용 프리픽스 (pk_abc123)
  name VARCHAR(100),                  -- 키 이름 (예: "홈페이지 연동용")

  -- 권한 및 제한
  scopes JSONB DEFAULT '["consultations:write", "bookings:write", "visitor:write"]'::jsonb,
  rate_limit_per_minute INTEGER DEFAULT 60,
  allowed_origins TEXT[],             -- CORS 허용 도메인 목록

  -- 상태
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  usage_count INTEGER DEFAULT 0,

  -- 메타데이터
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES tenant_members(id)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_tenant_api_keys_tenant_id ON tenant_api_keys(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_api_keys_key_prefix ON tenant_api_keys(key_prefix);
CREATE INDEX IF NOT EXISTS idx_tenant_api_keys_is_active ON tenant_api_keys(is_active);

-- 코멘트
COMMENT ON TABLE tenant_api_keys IS '테넌트 API 키 (홈페이지 연동용)';
COMMENT ON COLUMN tenant_api_keys.key_hash IS 'bcrypt 해시된 API 키';
COMMENT ON COLUMN tenant_api_keys.key_prefix IS '표시용 키 프리픽스 (pk_abc123)';
COMMENT ON COLUMN tenant_api_keys.scopes IS '허용된 API 스코프';
COMMENT ON COLUMN tenant_api_keys.allowed_origins IS 'CORS 허용 도메인 목록';

-- ============================================================================
-- 6. RLS 정책
-- ============================================================================

-- visitor_sessions RLS
ALTER TABLE visitor_sessions ENABLE ROW LEVEL SECURITY;

-- 공개 INSERT (홈페이지에서)
CREATE POLICY "public_insert_visitor_sessions" ON visitor_sessions
  FOR INSERT
  WITH CHECK (true);

-- 테넌트 격리 조회
CREATE POLICY "tenant_isolation_visitor_sessions" ON visitor_sessions
  FOR SELECT TO authenticated
  USING (is_super_admin() OR tenant_id = get_current_tenant_id());

-- 테넌트 관리 (UPDATE/DELETE)
CREATE POLICY "tenant_manage_visitor_sessions" ON visitor_sessions
  FOR UPDATE TO authenticated
  USING (is_super_admin() OR tenant_id = get_current_tenant_id())
  WITH CHECK (is_super_admin() OR tenant_id = get_current_tenant_id());

CREATE POLICY "tenant_delete_visitor_sessions" ON visitor_sessions
  FOR DELETE TO authenticated
  USING (is_super_admin() OR tenant_id = get_current_tenant_id());

-- page_views RLS
ALTER TABLE page_views ENABLE ROW LEVEL SECURITY;

-- 공개 INSERT (홈페이지에서)
CREATE POLICY "public_insert_page_views" ON page_views
  FOR INSERT
  WITH CHECK (true);

-- 테넌트 격리 조회
CREATE POLICY "tenant_isolation_page_views" ON page_views
  FOR SELECT TO authenticated
  USING (is_super_admin() OR tenant_id = get_current_tenant_id());

-- 테넌트 관리
CREATE POLICY "tenant_manage_page_views" ON page_views
  FOR UPDATE TO authenticated
  USING (is_super_admin() OR tenant_id = get_current_tenant_id())
  WITH CHECK (is_super_admin() OR tenant_id = get_current_tenant_id());

CREATE POLICY "tenant_delete_page_views" ON page_views
  FOR DELETE TO authenticated
  USING (is_super_admin() OR tenant_id = get_current_tenant_id());

-- tenant_api_keys RLS
ALTER TABLE tenant_api_keys ENABLE ROW LEVEL SECURITY;

-- 테넌트 admin 이상만 API 키 관리
CREATE POLICY "tenant_admin_api_keys" ON tenant_api_keys
  FOR ALL TO authenticated
  USING (
    is_super_admin() OR
    (tenant_id = get_current_tenant_id() AND has_role_or_higher('admin'))
  )
  WITH CHECK (
    is_super_admin() OR
    (tenant_id = get_current_tenant_id() AND has_role_or_higher('admin'))
  );

-- ============================================================================
-- 7. 트리거: updated_at 및 last_activity_at
-- ============================================================================

-- visitor_sessions last_activity_at 업데이트 (page_views INSERT 시)
CREATE OR REPLACE FUNCTION update_session_last_activity()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE visitor_sessions
  SET last_activity_at = NOW()
  WHERE id = NEW.session_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_session_activity_on_page_view ON page_views;
CREATE TRIGGER update_session_activity_on_page_view
  AFTER INSERT ON page_views
  FOR EACH ROW
  EXECUTE FUNCTION update_session_last_activity();

-- ============================================================================
-- 8. 상담/예약 상태 변경 시 타임스탬프 자동 업데이트 트리거
-- ============================================================================

-- consultations 상태 변경 트리거
CREATE OR REPLACE FUNCTION update_consultation_status_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  -- 상태가 변경되었을 때만 실행
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    CASE NEW.status
      WHEN 'in_progress' THEN
        IF NEW.contacted_at IS NULL THEN
          NEW.contacted_at := NOW();
        END IF;
      WHEN 'completed' THEN
        IF NEW.completed_at IS NULL THEN
          NEW.completed_at := NOW();
        END IF;
      WHEN 'cancelled' THEN
        IF NEW.cancelled_at IS NULL THEN
          NEW.cancelled_at := NOW();
        END IF;
      ELSE
        -- 다른 상태는 처리하지 않음
    END CASE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS consultation_status_timestamps ON consultations;
CREATE TRIGGER consultation_status_timestamps
  BEFORE UPDATE ON consultations
  FOR EACH ROW
  EXECUTE FUNCTION update_consultation_status_timestamps();

-- bookings 상태 변경 트리거
CREATE OR REPLACE FUNCTION update_booking_status_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  -- 상태가 변경되었을 때만 실행
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    CASE NEW.status
      WHEN 'confirmed' THEN
        IF NEW.confirmed_at IS NULL THEN
          NEW.confirmed_at := NOW();
        END IF;
      WHEN 'completed' THEN
        IF NEW.completed_at IS NULL THEN
          NEW.completed_at := NOW();
        END IF;
      WHEN 'cancelled' THEN
        IF NEW.cancelled_at IS NULL THEN
          NEW.cancelled_at := NOW();
        END IF;
      WHEN 'no_show' THEN
        IF NEW.no_show_at IS NULL THEN
          NEW.no_show_at := NOW();
        END IF;
      ELSE
        -- 다른 상태는 처리하지 않음
    END CASE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS booking_status_timestamps ON bookings;
CREATE TRIGGER booking_status_timestamps
  BEFORE UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_booking_status_timestamps();

-- ============================================================================
-- 9. 리드 스코어 자동 계산 함수
-- ============================================================================

-- 방문자의 리드 스코어 계산 (페이지 뷰, 체류 시간 기반)
CREATE OR REPLACE FUNCTION calculate_visitor_lead_score(p_visitor_session_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_score INTEGER := 0;
  v_page_count INTEGER;
  v_total_time INTEGER;
  v_service_views INTEGER;
  v_blog_views INTEGER;
  v_is_returning BOOLEAN;
BEGIN
  -- 세션 정보 조회
  SELECT is_returning INTO v_is_returning
  FROM visitor_sessions WHERE id = p_visitor_session_id;

  -- 재방문자 가산점
  IF v_is_returning THEN
    v_score := v_score + 20;
  END IF;

  -- 페이지 뷰 수
  SELECT COUNT(*), COALESCE(SUM(time_on_page), 0)
  INTO v_page_count, v_total_time
  FROM page_views WHERE session_id = p_visitor_session_id;

  -- 페이지 수 기반 점수 (최대 20점)
  v_score := v_score + LEAST(v_page_count * 5, 20);

  -- 체류 시간 기반 점수 (분당 5점, 최대 30점)
  v_score := v_score + LEAST((v_total_time / 60) * 5, 30);

  -- 서비스 페이지 조회 가산점
  SELECT COUNT(*) INTO v_service_views
  FROM page_views
  WHERE session_id = p_visitor_session_id
    AND page_type = 'service';
  v_score := v_score + LEAST(v_service_views * 10, 20);

  -- 블로그/사례 조회 가산점
  SELECT COUNT(*) INTO v_blog_views
  FROM page_views
  WHERE session_id = p_visitor_session_id
    AND page_type IN ('blog', 'case');
  v_score := v_score + LEAST(v_blog_views * 3, 10);

  RETURN LEAST(v_score, 100);  -- 최대 100점
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION calculate_visitor_lead_score(UUID) IS '방문자 세션의 리드 스코어 계산 (0-100)';

-- ============================================================================
-- 10. 홈페이지 콘텐츠 테이블
-- ============================================================================

-- 10.1 homepage_blog_posts: 블로그 글 (테넌트별)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS homepage_blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Notion 동기화 (선택적)
  notion_id TEXT,
  notion_last_edited_time TIMESTAMPTZ,

  -- 콘텐츠
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  content TEXT,                       -- HTML 또는 Markdown
  excerpt TEXT,                       -- 요약 (목록용)
  cover_image TEXT,                   -- 커버 이미지 URL

  -- 분류
  category TEXT,
  tags TEXT[] DEFAULT '{}',

  -- SEO
  meta_title TEXT,
  meta_description TEXT,
  canonical_url TEXT,

  -- 전문 검색
  search_vector TSVECTOR,

  -- 통계
  view_count INTEGER DEFAULT 0,
  share_count INTEGER DEFAULT 0,

  -- 작성자
  author_id UUID REFERENCES tenant_members(id) ON DELETE SET NULL,
  author_name TEXT,                   -- 비정규화 (표시용)

  -- 상태
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  published_at TIMESTAMPTZ,
  featured BOOLEAN DEFAULT false,     -- 대표 게시물

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 제약조건: 테넌트 내 slug 고유
  UNIQUE(tenant_id, slug)
);

-- Notion 동기화용 유니크 (선택적)
CREATE UNIQUE INDEX IF NOT EXISTS idx_homepage_blog_posts_notion
  ON homepage_blog_posts(tenant_id, notion_id)
  WHERE notion_id IS NOT NULL;

-- 10.2 homepage_cases: 성공사례 (법적 사건 아님, 홈페이지 콘텐츠)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS homepage_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Notion 동기화 (선택적)
  notion_id TEXT,
  notion_last_edited_time TIMESTAMPTZ,

  -- 콘텐츠
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  content TEXT,
  summary TEXT,                       -- 간단 요약
  cover_image TEXT,

  -- 사건 정보 (익명화된 형태)
  category TEXT,                      -- 이혼, 위자료, 양육권 등
  case_type TEXT,                     -- 협의이혼, 재판이혼 등
  tags TEXT[] DEFAULT '{}',

  -- 결과
  result TEXT,                        -- 승소, 화해, 조정 등
  result_amount TEXT,                 -- "위자료 5,000만원" 등 (익명화)
  result_details TEXT,

  -- 담당 변호사 (선택적)
  lawyer_id UUID REFERENCES tenant_members(id) ON DELETE SET NULL,
  lawyer_name TEXT,

  -- SEO
  meta_title TEXT,
  meta_description TEXT,
  search_vector TSVECTOR,

  -- 통계
  view_count INTEGER DEFAULT 0,

  -- 상태
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  published_at TIMESTAMPTZ,
  featured BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(tenant_id, slug)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_homepage_cases_notion
  ON homepage_cases(tenant_id, notion_id)
  WHERE notion_id IS NOT NULL;

-- 10.3 homepage_faqs: 자주 묻는 질문
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS homepage_faqs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Notion 동기화 (선택적)
  notion_id TEXT,
  notion_last_edited_time TIMESTAMPTZ,

  -- 콘텐츠
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  slug TEXT,

  -- 분류
  category TEXT,
  tags TEXT[] DEFAULT '{}',

  -- 연결 콘텐츠 (관련 블로그/사례)
  related_blog_ids UUID[] DEFAULT '{}',
  related_case_ids UUID[] DEFAULT '{}',

  -- SEO
  search_vector TSVECTOR,

  -- 정렬/표시
  sort_order INTEGER DEFAULT 0,
  featured BOOLEAN DEFAULT false,

  -- 상태
  status TEXT DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_homepage_faqs_notion
  ON homepage_faqs(tenant_id, notion_id)
  WHERE notion_id IS NOT NULL;

-- 10.4 homepage_instagram_posts: 인스타그램 연동
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS homepage_instagram_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- 인스타그램 데이터
  instagram_id TEXT NOT NULL,
  permalink TEXT,
  media_url TEXT,
  media_type TEXT CHECK (media_type IN ('IMAGE', 'VIDEO', 'CAROUSEL_ALBUM')),
  caption TEXT,
  thumbnail_url TEXT,

  -- 콘텐츠 연결 (성공사례/블로그와 연결)
  linked_case_id UUID REFERENCES homepage_cases(id) ON DELETE SET NULL,
  linked_blog_id UUID REFERENCES homepage_blog_posts(id) ON DELETE SET NULL,

  -- 표시 설정
  is_visible BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,

  -- 시간
  posted_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ DEFAULT NOW(),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(tenant_id, instagram_id)
);

-- 10.5 homepage_testimonials: 의뢰인 후기
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS homepage_testimonials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- 의뢰인 정보 (익명화 필수!)
  client_display_name TEXT NOT NULL,  -- 예: "김OO", "30대 남성" 등
  client_gender TEXT CHECK (client_gender IS NULL OR client_gender IN ('male', 'female', 'other')),
  client_age_group TEXT,              -- "30대", "40대" 등

  -- 사건 정보 (익명화)
  case_type TEXT NOT NULL,            -- 이혼, 양육권 등
  case_summary TEXT,                  -- 간단한 사건 설명

  -- 후기 내용
  testimonial_text TEXT NOT NULL,
  rating INTEGER CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5)),

  -- 담당 변호사
  lawyer_id UUID REFERENCES tenant_members(id) ON DELETE SET NULL,
  lawyer_name TEXT,

  -- 동의/검증 (중요!)
  consent_given BOOLEAN DEFAULT false,
  consent_date TIMESTAMPTZ,
  consent_method TEXT,                -- written, verbal, online 등
  verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES tenant_members(id) ON DELETE SET NULL,

  -- 표시 설정
  sort_order INTEGER DEFAULT 0,
  featured BOOLEAN DEFAULT false,

  -- 상태
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'published')),
  rejection_reason TEXT,
  published_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10.6 homepage_testimonial_photos: 후기 증빙 사진
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS homepage_testimonial_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  testimonial_id UUID NOT NULL REFERENCES homepage_testimonials(id) ON DELETE CASCADE,

  -- 파일 정보
  storage_path TEXT NOT NULL,         -- Supabase Storage 경로
  file_name TEXT,
  file_size INTEGER,
  mime_type TEXT,

  -- 개인정보 보호 (필수!)
  blur_applied BOOLEAN DEFAULT false, -- 블러 처리 여부
  blur_regions JSONB,                 -- 블러 영역 좌표 [{x, y, width, height}, ...]

  -- 원본 보관 (관리자만 접근)
  original_path TEXT,                 -- 블러 전 원본 (접근 제한)

  -- 표시
  sort_order INTEGER DEFAULT 0,
  caption TEXT,
  is_visible BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 11. 홈페이지 콘텐츠 인덱스
-- ============================================================================

-- blog_posts
CREATE INDEX IF NOT EXISTS idx_homepage_blog_posts_tenant ON homepage_blog_posts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_homepage_blog_posts_slug ON homepage_blog_posts(tenant_id, slug);
CREATE INDEX IF NOT EXISTS idx_homepage_blog_posts_status ON homepage_blog_posts(tenant_id, status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_homepage_blog_posts_category ON homepage_blog_posts(tenant_id, category) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_homepage_blog_posts_search ON homepage_blog_posts USING GIN(search_vector);

-- cases
CREATE INDEX IF NOT EXISTS idx_homepage_cases_tenant ON homepage_cases(tenant_id);
CREATE INDEX IF NOT EXISTS idx_homepage_cases_slug ON homepage_cases(tenant_id, slug);
CREATE INDEX IF NOT EXISTS idx_homepage_cases_status ON homepage_cases(tenant_id, status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_homepage_cases_category ON homepage_cases(tenant_id, category) WHERE status = 'published';

-- faqs
CREATE INDEX IF NOT EXISTS idx_homepage_faqs_tenant ON homepage_faqs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_homepage_faqs_category ON homepage_faqs(tenant_id, category, sort_order);

-- instagram
CREATE INDEX IF NOT EXISTS idx_homepage_instagram_tenant ON homepage_instagram_posts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_homepage_instagram_visible ON homepage_instagram_posts(tenant_id, is_visible, sort_order);

-- testimonials
CREATE INDEX IF NOT EXISTS idx_homepage_testimonials_tenant ON homepage_testimonials(tenant_id);
CREATE INDEX IF NOT EXISTS idx_homepage_testimonials_status ON homepage_testimonials(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_homepage_testimonial_photos_testimonial ON homepage_testimonial_photos(testimonial_id);

-- ============================================================================
-- 12. 홈페이지 콘텐츠 RLS 정책
-- ============================================================================

ALTER TABLE homepage_blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE homepage_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE homepage_faqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE homepage_instagram_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE homepage_testimonials ENABLE ROW LEVEL SECURITY;
ALTER TABLE homepage_testimonial_photos ENABLE ROW LEVEL SECURITY;

-- 공개 읽기: published 상태만 (홈페이지에서 조회)
CREATE POLICY "homepage_blog_posts_public_read" ON homepage_blog_posts
  FOR SELECT TO anon, authenticated
  USING (status = 'published');

CREATE POLICY "homepage_cases_public_read" ON homepage_cases
  FOR SELECT TO anon, authenticated
  USING (status = 'published');

CREATE POLICY "homepage_faqs_public_read" ON homepage_faqs
  FOR SELECT TO anon, authenticated
  USING (status = 'published');

CREATE POLICY "homepage_instagram_public_read" ON homepage_instagram_posts
  FOR SELECT TO anon, authenticated
  USING (is_visible = true);

CREATE POLICY "homepage_testimonials_public_read" ON homepage_testimonials
  FOR SELECT TO anon, authenticated
  USING (status = 'published');

-- 후기 사진: 블러 처리된 것만 + 부모 후기가 published인 경우만
CREATE POLICY "homepage_testimonial_photos_public_read" ON homepage_testimonial_photos
  FOR SELECT TO anon, authenticated
  USING (
    blur_applied = true
    AND is_visible = true
    AND EXISTS (
      SELECT 1 FROM homepage_testimonials t
      WHERE t.id = testimonial_id AND t.status = 'published'
    )
  );

-- 테넌트 관리: 자신의 테넌트 데이터만 CRUD
CREATE POLICY "homepage_blog_posts_tenant_all" ON homepage_blog_posts
  FOR ALL TO authenticated
  USING (is_super_admin() OR tenant_id = get_current_tenant_id())
  WITH CHECK (is_super_admin() OR tenant_id = get_current_tenant_id());

CREATE POLICY "homepage_cases_tenant_all" ON homepage_cases
  FOR ALL TO authenticated
  USING (is_super_admin() OR tenant_id = get_current_tenant_id())
  WITH CHECK (is_super_admin() OR tenant_id = get_current_tenant_id());

CREATE POLICY "homepage_faqs_tenant_all" ON homepage_faqs
  FOR ALL TO authenticated
  USING (is_super_admin() OR tenant_id = get_current_tenant_id())
  WITH CHECK (is_super_admin() OR tenant_id = get_current_tenant_id());

CREATE POLICY "homepage_instagram_tenant_all" ON homepage_instagram_posts
  FOR ALL TO authenticated
  USING (is_super_admin() OR tenant_id = get_current_tenant_id())
  WITH CHECK (is_super_admin() OR tenant_id = get_current_tenant_id());

CREATE POLICY "homepage_testimonials_tenant_all" ON homepage_testimonials
  FOR ALL TO authenticated
  USING (is_super_admin() OR tenant_id = get_current_tenant_id())
  WITH CHECK (is_super_admin() OR tenant_id = get_current_tenant_id());

CREATE POLICY "homepage_testimonial_photos_tenant_all" ON homepage_testimonial_photos
  FOR ALL TO authenticated
  USING (is_super_admin() OR tenant_id = get_current_tenant_id())
  WITH CHECK (is_super_admin() OR tenant_id = get_current_tenant_id());

-- ============================================================================
-- 13. 홈페이지 콘텐츠 트리거
-- ============================================================================

-- updated_at 자동 갱신
CREATE OR REPLACE FUNCTION update_homepage_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 각 테이블에 트리거 적용
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'homepage_blog_posts', 'homepage_cases', 'homepage_faqs',
    'homepage_instagram_posts', 'homepage_testimonials'
  ])
  LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS update_%s_updated_at ON %s;
      CREATE TRIGGER update_%s_updated_at
        BEFORE UPDATE ON %s
        FOR EACH ROW
        EXECUTE FUNCTION update_homepage_updated_at();
    ', tbl, tbl, tbl, tbl);
  END LOOP;
END;
$$;

-- 전문 검색 벡터 자동 생성 (블로그)
CREATE OR REPLACE FUNCTION update_blog_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('simple', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(NEW.excerpt, '')), 'B') ||
    setweight(to_tsvector('simple', COALESCE(NEW.content, '')), 'C') ||
    setweight(to_tsvector('simple', COALESCE(array_to_string(NEW.tags, ' '), '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_homepage_blog_posts_search ON homepage_blog_posts;
CREATE TRIGGER update_homepage_blog_posts_search
  BEFORE INSERT OR UPDATE OF title, excerpt, content, tags ON homepage_blog_posts
  FOR EACH ROW
  EXECUTE FUNCTION update_blog_search_vector();

-- 전문 검색 벡터 자동 생성 (성공사례)
CREATE OR REPLACE FUNCTION update_case_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('simple', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(NEW.summary, '')), 'B') ||
    setweight(to_tsvector('simple', COALESCE(NEW.content, '')), 'C') ||
    setweight(to_tsvector('simple', COALESCE(NEW.category, '')), 'A');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_homepage_cases_search ON homepage_cases;
CREATE TRIGGER update_homepage_cases_search
  BEFORE INSERT OR UPDATE OF title, summary, content, category ON homepage_cases
  FOR EACH ROW
  EXECUTE FUNCTION update_case_search_vector();

-- ============================================================================
-- 14. API 요청 로그 테이블 (감사/디버깅)
-- ============================================================================

CREATE TABLE IF NOT EXISTS api_request_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  api_key_id UUID REFERENCES tenant_api_keys(id) ON DELETE SET NULL,

  -- 요청 정보
  endpoint TEXT NOT NULL,             -- /api/public/consultations
  method TEXT NOT NULL,               -- POST, GET

  -- 클라이언트 정보
  origin TEXT,
  ip_address TEXT,
  user_agent TEXT,

  -- 응답
  status_code INTEGER,
  response_time_ms INTEGER,

  -- 에러 (있는 경우)
  error_code TEXT,
  error_message TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_api_request_logs_tenant ON api_request_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_request_logs_key ON api_request_logs(api_key_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_request_logs_created ON api_request_logs(created_at DESC);

-- RLS
ALTER TABLE api_request_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "api_request_logs_tenant_read" ON api_request_logs
  FOR SELECT TO authenticated
  USING (
    is_super_admin()
    OR (tenant_id = get_current_tenant_id() AND has_role_or_higher('admin'))
  );

-- 서비스 역할만 INSERT 가능 (API 서버에서)
CREATE POLICY "api_request_logs_service_insert" ON api_request_logs
  FOR INSERT TO service_role
  WITH CHECK (true);

-- 코멘트
COMMENT ON TABLE api_request_logs IS 'API 요청 로그 (감사/디버깅용)';

-- ============================================================================
-- 15. SMS 테이블 테넌트화
-- ============================================================================

-- sms_templates에 tenant_id 추가 (기존 데이터는 NULL = 시스템 기본)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sms_templates' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE sms_templates ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
  END IF;
END;
$$;

-- sms_logs에 tenant_id 추가
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sms_logs' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE sms_logs ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
  END IF;
END;
$$;

-- SMS RLS 업데이트
DROP POLICY IF EXISTS "sms_templates_tenant" ON sms_templates;
DROP POLICY IF EXISTS "sms_logs_tenant" ON sms_logs;

CREATE POLICY "sms_templates_tenant_access" ON sms_templates
  FOR ALL TO authenticated
  USING (
    is_super_admin()
    OR tenant_id IS NULL  -- 시스템 기본 템플릿
    OR tenant_id = get_current_tenant_id()
  )
  WITH CHECK (
    is_super_admin()
    OR tenant_id = get_current_tenant_id()
  );

CREATE POLICY "sms_logs_tenant_access" ON sms_logs
  FOR ALL TO authenticated
  USING (is_super_admin() OR tenant_id = get_current_tenant_id())
  WITH CHECK (is_super_admin() OR tenant_id = get_current_tenant_id());

-- ============================================================================
-- 16. API Key 검증 함수 (서버에서 호출)
-- ============================================================================

CREATE OR REPLACE FUNCTION verify_api_key(
  p_key_prefix TEXT,
  p_origin TEXT DEFAULT NULL
)
RETURNS TABLE (
  tenant_id UUID,
  api_key_id UUID,
  scopes JSONB,
  rate_limit_per_minute INTEGER,
  is_valid BOOLEAN,
  error_message TEXT
) AS $$
DECLARE
  v_key_record RECORD;
BEGIN
  -- 키 조회
  SELECT * INTO v_key_record
  FROM tenant_api_keys
  WHERE key_prefix = p_key_prefix
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > NOW())
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT
      NULL::UUID, NULL::UUID, NULL::JSONB, NULL::INTEGER,
      false, 'Invalid or expired API key';
    RETURN;
  END IF;

  -- Origin 검증 (설정된 경우)
  IF p_origin IS NOT NULL
     AND v_key_record.allowed_origins IS NOT NULL
     AND array_length(v_key_record.allowed_origins, 1) > 0
     AND NOT (p_origin = ANY(v_key_record.allowed_origins)) THEN
    RETURN QUERY SELECT
      NULL::UUID, NULL::UUID, NULL::JSONB, NULL::INTEGER,
      false, 'Origin not allowed';
    RETURN;
  END IF;

  -- 사용 통계 업데이트
  UPDATE tenant_api_keys
  SET
    last_used_at = NOW(),
    usage_count = usage_count + 1
  WHERE id = v_key_record.id;

  RETURN QUERY SELECT
    v_key_record.tenant_id,
    v_key_record.id,
    v_key_record.scopes,
    v_key_record.rate_limit_per_minute,
    true,
    NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION verify_api_key(TEXT, TEXT) IS 'API Key 검증 및 테넌트 정보 반환';

-- ============================================================================
-- 17. 방문자 전환 추적 트리거
-- ============================================================================

-- 상담/예약 완료 시 세션 전환 표시
CREATE OR REPLACE FUNCTION mark_session_converted()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.visitor_session_id IS NOT NULL THEN
    UPDATE visitor_sessions
    SET
      last_activity_at = NOW()
    WHERE id = NEW.visitor_session_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS consultations_mark_converted ON consultations;
CREATE TRIGGER consultations_mark_converted
  AFTER INSERT ON consultations
  FOR EACH ROW
  EXECUTE FUNCTION mark_session_converted();

DROP TRIGGER IF EXISTS bookings_mark_converted ON bookings;
CREATE TRIGGER bookings_mark_converted
  AFTER INSERT ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION mark_session_converted();

-- ============================================================================
-- 18. Storage 버킷 설정
-- ============================================================================

-- Storage 버킷 생성 (이미 존재하면 무시)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('homepage-images', 'homepage-images', true, 10485760, -- 10MB
   ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('homepage-testimonial-photos', 'homepage-testimonial-photos', false, 10485760,
   ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Storage RLS (기존 정책이 없을 때만)
DO $$
BEGIN
  -- homepage-images 공개 읽기
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects' AND policyname = 'homepage_images_public_read'
  ) THEN
    CREATE POLICY "homepage_images_public_read" ON storage.objects
      FOR SELECT TO anon, authenticated
      USING (bucket_id = 'homepage-images');
  END IF;

  -- homepage-images 테넌트 업로드
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects' AND policyname = 'homepage_images_tenant_upload'
  ) THEN
    CREATE POLICY "homepage_images_tenant_upload" ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'homepage-images'
        AND (storage.foldername(name))[1] = get_current_tenant_id()::TEXT
      );
  END IF;

  -- 후기 사진: 테넌트만 업로드/관리
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects' AND policyname = 'testimonial_photos_tenant_manage'
  ) THEN
    CREATE POLICY "testimonial_photos_tenant_manage" ON storage.objects
      FOR ALL TO authenticated
      USING (
        bucket_id = 'homepage-testimonial-photos'
        AND (storage.foldername(name))[1] = get_current_tenant_id()::TEXT
      )
      WITH CHECK (
        bucket_id = 'homepage-testimonial-photos'
        AND (storage.foldername(name))[1] = get_current_tenant_id()::TEXT
      );
  END IF;
END;
$$;

-- ============================================================================
-- 코멘트
-- ============================================================================
COMMENT ON TABLE homepage_blog_posts IS '홈페이지 블로그 글 (테넌트별)';
COMMENT ON TABLE homepage_cases IS '홈페이지 성공사례 (테넌트별, legal_cases와 다름)';
COMMENT ON TABLE homepage_faqs IS '홈페이지 FAQ (테넌트별)';
COMMENT ON TABLE homepage_instagram_posts IS '인스타그램 연동 게시물';
COMMENT ON TABLE homepage_testimonials IS '의뢰인 후기 (익명화 필수)';
COMMENT ON TABLE homepage_testimonial_photos IS '후기 증빙 사진 (블러 처리 필수)';

-- ============================================================================
-- 완료
-- ============================================================================
