/**
 * 홈페이지 데이터 마이그레이션 스크립트
 * theyool Supabase → theyool-admin Supabase
 *
 * 마이그레이션 대상:
 * 1. blog_posts → homepage_blog_posts
 * 2. cases (성공사례) → homepage_cases
 * 3. faqs → homepage_faqs
 * 4. instagram_posts → homepage_instagram_posts
 * 5. testimonial_cases → homepage_testimonials
 * 6. testimonial_evidence_photos → homepage_testimonial_photos
 * 7. consultations_unified → consultations + bookings (분리)
 *
 * 사용법:
 * 1. .env.local에 THEYOOL_SUPABASE_URL, THEYOOL_SUPABASE_SERVICE_KEY 설정
 * 2. npx tsx scripts/migrate-homepage-data.ts --dry-run (테스트)
 * 3. npx tsx scripts/migrate-homepage-data.ts (실행)
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// .env.local 로드
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// ============================================================================
// 환경 변수
// ============================================================================

// theyool (소스)
const THEYOOL_URL = process.env.THEYOOL_SUPABASE_URL || '';
const THEYOOL_SERVICE_KEY = process.env.THEYOOL_SUPABASE_SERVICE_KEY || '';

// theyool-admin (대상)
const ADMIN_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const ADMIN_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// 더율 테넌트 ID
const THEYOOL_TENANT_ID = process.env.THEYOOL_TENANT_ID || '';

// 드라이런 모드
const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose');

// ============================================================================
// 클라이언트 생성
// ============================================================================

let sourceClient: SupabaseClient;
let targetClient: SupabaseClient;

function initClients() {
  if (!THEYOOL_URL || !THEYOOL_SERVICE_KEY) {
    console.error('❌ THEYOOL_SUPABASE_URL 또는 THEYOOL_SUPABASE_SERVICE_KEY가 설정되지 않았습니다.');
    console.log('   .env.local에 다음 환경변수를 추가하세요:');
    console.log('   THEYOOL_SUPABASE_URL=https://kqqyipnlkmmprfgygauk.supabase.co');
    console.log('   THEYOOL_SUPABASE_SERVICE_KEY=your-service-key');
    process.exit(1);
  }

  if (!ADMIN_URL || !ADMIN_SERVICE_KEY) {
    console.error('❌ NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다.');
    process.exit(1);
  }

  if (!THEYOOL_TENANT_ID) {
    console.error('❌ THEYOOL_TENANT_ID가 설정되지 않았습니다.');
    console.log('   더율 테넌트 ID를 .env.local에 추가하세요.');
    console.log('   예: THEYOOL_TENANT_ID=799ce69a-df47-454d-8355-90b981ecf32f');
    process.exit(1);
  }

  sourceClient = createClient(THEYOOL_URL, THEYOOL_SERVICE_KEY, {
    auth: { persistSession: false },
  });

  targetClient = createClient(ADMIN_URL, ADMIN_SERVICE_KEY, {
    auth: { persistSession: false },
  });

  console.log('✅ Supabase 클라이언트 초기화 완료');
  console.log(`   소스: ${THEYOOL_URL}`);
  console.log(`   대상: ${ADMIN_URL}`);
  console.log(`   테넌트: ${THEYOOL_TENANT_ID}`);
  console.log(`   드라이런: ${DRY_RUN ? '예' : '아니오'}`);
  console.log('');
}

// ============================================================================
// 변호사 매핑 캐시
// ============================================================================

const lawyerMapping: Map<string, string> = new Map();

async function loadLawyerMapping() {
  const { data: members, error } = await targetClient
    .from('tenant_members')
    .select('id, display_name, user_id')
    .eq('tenant_id', THEYOOL_TENANT_ID)
    .in('role', ['owner', 'admin', 'lawyer']);

  if (error) {
    console.error('Failed to load lawyer mapping:', error);
    return;
  }

  // 이름 → UUID 매핑
  for (const member of members || []) {
    if (member.display_name) {
      lawyerMapping.set(member.display_name, member.id);
    }
  }

  console.log(`✅ 변호사 매핑 로드: ${lawyerMapping.size}명`);
  if (VERBOSE) {
    for (const [name, id] of lawyerMapping) {
      console.log(`   ${name} → ${id}`);
    }
  }
}

function getLawyerId(name: string | null): string | null {
  if (!name) return null;
  return lawyerMapping.get(name) || null;
}

// ============================================================================
// 1. 블로그 마이그레이션
// ============================================================================

async function migrateBlogPosts() {
  console.log('\n📝 블로그 마이그레이션 시작...');

  const { data: posts, error } = await sourceClient
    .from('blog_posts')
    .select('*');

  if (error) {
    console.error('❌ 블로그 조회 실패:', error);
    return { migrated: 0, errors: 1 };
  }

  if (!posts || posts.length === 0) {
    console.log('   마이그레이션할 블로그가 없습니다.');
    return { migrated: 0, errors: 0 };
  }

  console.log(`   ${posts.length}개 블로그 발견`);

  const mapped = posts.map((post) => ({
    tenant_id: THEYOOL_TENANT_ID,
    notion_id: post.notion_id,
    notion_last_edited_time: post.notion_last_edited_time,
    title: post.title,
    slug: post.slug,
    content: post.content,
    excerpt: post.excerpt,
    cover_image: post.cover_image,
    category: post.category,
    tags: post.tags,
    meta_title: post.meta_title,
    meta_description: post.meta_description,
    views: post.views || 0,
    status: post.status || 'published',
    published_at: post.published_at,
    created_at: post.created_at,
    updated_at: post.updated_at,
  }));

  if (DRY_RUN) {
    console.log(`   [드라이런] ${mapped.length}개 블로그 마이그레이션 예정`);
    if (VERBOSE) {
      console.log('   샘플:', JSON.stringify(mapped[0], null, 2));
    }
    return { migrated: mapped.length, errors: 0 };
  }

  const { error: insertError } = await targetClient
    .from('homepage_blog_posts')
    .upsert(mapped, { onConflict: 'tenant_id,notion_id' });

  if (insertError) {
    console.error('❌ 블로그 삽입 실패:', insertError);
    return { migrated: 0, errors: mapped.length };
  }

  console.log(`✅ ${mapped.length}개 블로그 마이그레이션 완료`);
  return { migrated: mapped.length, errors: 0 };
}

// ============================================================================
// 2. 성공사례 마이그레이션
// ============================================================================

async function migrateCases() {
  console.log('\n📋 성공사례 마이그레이션 시작...');

  const { data: cases, error } = await sourceClient
    .from('cases')
    .select('*');

  if (error) {
    console.error('❌ 성공사례 조회 실패:', error);
    return { migrated: 0, errors: 1 };
  }

  if (!cases || cases.length === 0) {
    console.log('   마이그레이션할 성공사례가 없습니다.');
    return { migrated: 0, errors: 0 };
  }

  console.log(`   ${cases.length}개 성공사례 발견`);

  const mapped = cases.map((c) => ({
    tenant_id: THEYOOL_TENANT_ID,
    notion_id: c.notion_id,
    notion_last_edited_time: c.notion_last_edited_time,
    title: c.title,
    slug: c.slug,
    content: c.content,
    summary: c.summary || c.excerpt,
    cover_image: c.cover_image,
    category: c.category,
    case_type: c.case_type,
    result: c.result,
    result_details: c.result_details,
    tags: c.tags,
    meta_title: c.meta_title,
    meta_description: c.meta_description,
    views: c.views || 0,
    status: c.status || 'published',
    published_at: c.published_at,
    created_at: c.created_at,
    updated_at: c.updated_at,
  }));

  if (DRY_RUN) {
    console.log(`   [드라이런] ${mapped.length}개 성공사례 마이그레이션 예정`);
    if (VERBOSE) {
      console.log('   샘플:', JSON.stringify(mapped[0], null, 2));
    }
    return { migrated: mapped.length, errors: 0 };
  }

  const { error: insertError } = await targetClient
    .from('homepage_cases')
    .upsert(mapped, { onConflict: 'tenant_id,notion_id' });

  if (insertError) {
    console.error('❌ 성공사례 삽입 실패:', insertError);
    return { migrated: 0, errors: mapped.length };
  }

  console.log(`✅ ${mapped.length}개 성공사례 마이그레이션 완료`);
  return { migrated: mapped.length, errors: 0 };
}

// ============================================================================
// 3. FAQ 마이그레이션
// ============================================================================

async function migrateFaqs() {
  console.log('\n❓ FAQ 마이그레이션 시작...');

  const { data: faqs, error } = await sourceClient
    .from('faqs')
    .select('*');

  if (error) {
    console.error('❌ FAQ 조회 실패:', error);
    return { migrated: 0, errors: 1 };
  }

  if (!faqs || faqs.length === 0) {
    console.log('   마이그레이션할 FAQ가 없습니다.');
    return { migrated: 0, errors: 0 };
  }

  console.log(`   ${faqs.length}개 FAQ 발견`);

  const mapped = faqs.map((faq) => ({
    tenant_id: THEYOOL_TENANT_ID,
    notion_id: faq.notion_id,
    notion_last_edited_time: faq.notion_last_edited_time,
    question: faq.question,
    answer: faq.answer,
    slug: faq.slug,
    category: faq.category,
    tags: faq.tags,
    sort_order: faq.sort_order || 0,
    status: faq.status || 'published',
    created_at: faq.created_at,
    updated_at: faq.updated_at,
  }));

  if (DRY_RUN) {
    console.log(`   [드라이런] ${mapped.length}개 FAQ 마이그레이션 예정`);
    if (VERBOSE) {
      console.log('   샘플:', JSON.stringify(mapped[0], null, 2));
    }
    return { migrated: mapped.length, errors: 0 };
  }

  const { error: insertError } = await targetClient
    .from('homepage_faqs')
    .upsert(mapped, { onConflict: 'tenant_id,notion_id' });

  if (insertError) {
    console.error('❌ FAQ 삽입 실패:', insertError);
    return { migrated: 0, errors: mapped.length };
  }

  console.log(`✅ ${mapped.length}개 FAQ 마이그레이션 완료`);
  return { migrated: mapped.length, errors: 0 };
}

// ============================================================================
// 4. 인스타그램 마이그레이션
// ============================================================================

async function migrateInstagram() {
  console.log('\n📸 인스타그램 마이그레이션 시작...');

  const { data: posts, error } = await sourceClient
    .from('instagram_posts')
    .select('*');

  if (error) {
    console.error('❌ 인스타그램 조회 실패:', error);
    return { migrated: 0, errors: 1 };
  }

  if (!posts || posts.length === 0) {
    console.log('   마이그레이션할 인스타그램이 없습니다.');
    return { migrated: 0, errors: 0 };
  }

  console.log(`   ${posts.length}개 인스타그램 포스트 발견`);

  const mapped = posts.map((post) => ({
    tenant_id: THEYOOL_TENANT_ID,
    instagram_id: post.instagram_id || post.id,
    permalink: post.permalink,
    media_url: post.media_url,
    media_type: post.media_type,
    caption: post.caption,
    thumbnail_url: post.thumbnail_url,
    is_visible: post.is_visible !== false,
    posted_at: post.posted_at || post.timestamp,
    created_at: post.created_at,
    updated_at: post.updated_at,
  }));

  if (DRY_RUN) {
    console.log(`   [드라이런] ${mapped.length}개 인스타그램 마이그레이션 예정`);
    if (VERBOSE) {
      console.log('   샘플:', JSON.stringify(mapped[0], null, 2));
    }
    return { migrated: mapped.length, errors: 0 };
  }

  const { error: insertError } = await targetClient
    .from('homepage_instagram_posts')
    .upsert(mapped, { onConflict: 'tenant_id,instagram_id' });

  if (insertError) {
    console.error('❌ 인스타그램 삽입 실패:', insertError);
    return { migrated: 0, errors: mapped.length };
  }

  console.log(`✅ ${mapped.length}개 인스타그램 마이그레이션 완료`);
  return { migrated: mapped.length, errors: 0 };
}

// ============================================================================
// 5. 의뢰인 후기 마이그레이션
// ============================================================================

async function migrateTestimonials() {
  console.log('\n⭐ 의뢰인 후기 마이그레이션 시작...');

  const { data: testimonials, error } = await sourceClient
    .from('testimonial_cases')
    .select('*');

  if (error) {
    console.error('❌ 의뢰인 후기 조회 실패:', error);
    return { migrated: 0, errors: 1 };
  }

  if (!testimonials || testimonials.length === 0) {
    console.log('   마이그레이션할 의뢰인 후기가 없습니다.');
    return { migrated: 0, errors: 0 };
  }

  console.log(`   ${testimonials.length}개 의뢰인 후기 발견`);

  const mapped = testimonials.map((t) => ({
    tenant_id: THEYOOL_TENANT_ID,
    client_name: t.client_name,
    client_gender: t.client_gender,
    client_age_group: t.client_age_group,
    case_type: t.case_type,
    case_summary: t.case_summary,
    testimonial_text: t.testimonial_text || t.content,
    rating: t.rating,
    lawyer_id: getLawyerId(t.lawyer_name),
    lawyer_name: t.lawyer_name,
    consent_given: t.consent_given || false,
    consent_date: t.consent_date,
    verified: t.verified || false,
    verified_at: t.verified_at,
    status: t.status || 'published',
    published_at: t.published_at,
    sort_order: t.sort_order || 0,
    is_featured: t.is_featured || false,
    created_at: t.created_at,
    updated_at: t.updated_at,
  }));

  if (DRY_RUN) {
    console.log(`   [드라이런] ${mapped.length}개 의뢰인 후기 마이그레이션 예정`);
    if (VERBOSE) {
      console.log('   샘플:', JSON.stringify(mapped[0], null, 2));
    }
    return { migrated: mapped.length, errors: 0 };
  }

  const { data: inserted, error: insertError } = await targetClient
    .from('homepage_testimonials')
    .upsert(mapped, { onConflict: 'id' })
    .select('id');

  if (insertError) {
    console.error('❌ 의뢰인 후기 삽입 실패:', insertError);
    return { migrated: 0, errors: mapped.length };
  }

  console.log(`✅ ${mapped.length}개 의뢰인 후기 마이그레이션 완료`);
  return { migrated: mapped.length, errors: 0 };
}

// ============================================================================
// 6. 증빙 사진 마이그레이션 (Storage 별도)
// ============================================================================

async function migrateTestimonialPhotos() {
  console.log('\n📷 증빙 사진 메타데이터 마이그레이션 시작...');

  const { data: photos, error } = await sourceClient
    .from('testimonial_evidence_photos')
    .select('*');

  if (error) {
    console.error('❌ 증빙 사진 조회 실패:', error);
    return { migrated: 0, errors: 1 };
  }

  if (!photos || photos.length === 0) {
    console.log('   마이그레이션할 증빙 사진이 없습니다.');
    return { migrated: 0, errors: 0 };
  }

  console.log(`   ${photos.length}개 증빙 사진 메타데이터 발견`);
  console.log('   ⚠️  실제 파일은 Storage 마이그레이션 스크립트에서 처리됩니다.');

  const mapped = photos.map((photo) => ({
    tenant_id: THEYOOL_TENANT_ID,
    testimonial_id: photo.testimonial_id,
    file_path: photo.file_path,
    file_name: photo.file_name,
    file_size: photo.file_size,
    mime_type: photo.mime_type,
    blur_applied: photo.blur_applied || false,
    blur_regions: photo.blur_regions,
    sort_order: photo.sort_order || 0,
    caption: photo.caption,
    created_at: photo.created_at,
  }));

  if (DRY_RUN) {
    console.log(`   [드라이런] ${mapped.length}개 증빙 사진 메타데이터 마이그레이션 예정`);
    return { migrated: mapped.length, errors: 0 };
  }

  // testimonial_id 매핑 필요 - 원본 ID와 새 ID 매핑
  console.log('   ⚠️  증빙 사진은 testimonial_id 매핑이 필요합니다.');
  console.log('   현재는 동일 ID를 사용한다고 가정합니다.');

  const { error: insertError } = await targetClient
    .from('homepage_testimonial_photos')
    .upsert(mapped, { onConflict: 'id' });

  if (insertError) {
    console.error('❌ 증빙 사진 메타데이터 삽입 실패:', insertError);
    return { migrated: 0, errors: mapped.length };
  }

  console.log(`✅ ${mapped.length}개 증빙 사진 메타데이터 마이그레이션 완료`);
  return { migrated: mapped.length, errors: 0 };
}

// ============================================================================
// 7. consultations_unified 분리 마이그레이션
// ============================================================================

async function migrateConsultations() {
  console.log('\n📞 상담신청 마이그레이션 시작...');

  const { data: consultations, error } = await sourceClient
    .from('consultations_unified')
    .select('*');

  if (error) {
    console.error('❌ 상담 조회 실패:', error);
    return { consultations: 0, bookings: 0, errors: 1 };
  }

  if (!consultations || consultations.length === 0) {
    console.log('   마이그레이션할 상담이 없습니다.');
    return { consultations: 0, bookings: 0, errors: 0 };
  }

  console.log(`   ${consultations.length}개 상담 발견`);

  // 타입별 분리
  const callbackConsultations = consultations.filter(
    (c) => c.request_type === 'callback' || c.request_type === 'info'
  );
  const bookingConsultations = consultations.filter(
    (c) => c.request_type === 'visit' || c.request_type === 'video'
  );

  console.log(`   콜백/정보 요청: ${callbackConsultations.length}개 → consultations`);
  console.log(`   방문/화상 예약: ${bookingConsultations.length}개 → bookings`);

  // consultations 매핑
  const mappedConsultations = callbackConsultations.map((c) => ({
    tenant_id: THEYOOL_TENANT_ID,
    client_name: c.client_name,
    phone: c.phone,
    email: c.email,
    category: c.category,
    consultation_type: c.request_type === 'callback' ? 'callback' : 'inquiry',
    content: c.message,
    status: mapConsultationStatus(c.status),
    assigned_to: getLawyerId(c.assigned_lawyer),
    utm_source: c.utm_source,
    utm_medium: c.utm_medium,
    utm_campaign: c.utm_campaign,
    created_at: c.created_at,
    updated_at: c.updated_at,
  }));

  // bookings 매핑
  const mappedBookings = bookingConsultations.map((c) => ({
    tenant_id: THEYOOL_TENANT_ID,
    client_name: c.client_name,
    phone: c.phone,
    email: c.email,
    type: c.request_type === 'visit' ? 'visit' : 'video',
    scheduled_date: c.preferred_date,
    scheduled_time: c.preferred_time,
    category: c.category,
    notes: c.message,
    status: mapBookingStatus(c.status),
    assigned_to: getLawyerId(c.assigned_lawyer),
    office_location: c.office_location,
    consultation_fee: c.consultation_fee || 0,
    payment_status: c.payment_status,
    payment_method: c.payment_method,
    paid_at: c.paid_at,
    payment_transaction_id: c.payment_transaction_id,
    utm_source: c.utm_source,
    utm_medium: c.utm_medium,
    utm_campaign: c.utm_campaign,
    video_link: c.video_conference_link,
    created_at: c.created_at,
    updated_at: c.updated_at,
  }));

  if (DRY_RUN) {
    console.log(`   [드라이런] ${mappedConsultations.length}개 consultations 마이그레이션 예정`);
    console.log(`   [드라이런] ${mappedBookings.length}개 bookings 마이그레이션 예정`);
    if (VERBOSE && mappedConsultations.length > 0) {
      console.log('   샘플 consultation:', JSON.stringify(mappedConsultations[0], null, 2));
    }
    if (VERBOSE && mappedBookings.length > 0) {
      console.log('   샘플 booking:', JSON.stringify(mappedBookings[0], null, 2));
    }
    return {
      consultations: mappedConsultations.length,
      bookings: mappedBookings.length,
      errors: 0,
    };
  }

  let consultationErrors = 0;
  let bookingErrors = 0;

  // consultations 삽입
  if (mappedConsultations.length > 0) {
    const { error: consultError } = await targetClient
      .from('consultations')
      .insert(mappedConsultations);

    if (consultError) {
      console.error('❌ consultations 삽입 실패:', consultError);
      consultationErrors = mappedConsultations.length;
    } else {
      console.log(`✅ ${mappedConsultations.length}개 consultations 마이그레이션 완료`);
    }
  }

  // bookings 삽입
  if (mappedBookings.length > 0) {
    const { error: bookingError } = await targetClient
      .from('bookings')
      .insert(mappedBookings);

    if (bookingError) {
      console.error('❌ bookings 삽입 실패:', bookingError);
      bookingErrors = mappedBookings.length;
    } else {
      console.log(`✅ ${mappedBookings.length}개 bookings 마이그레이션 완료`);
    }
  }

  return {
    consultations: consultationErrors === 0 ? mappedConsultations.length : 0,
    bookings: bookingErrors === 0 ? mappedBookings.length : 0,
    errors: consultationErrors + bookingErrors,
  };
}

// 상태 매핑 함수
function mapConsultationStatus(status: string): string {
  const mapping: Record<string, string> = {
    pending: 'pending',
    contacted: 'in_progress',
    scheduled: 'in_progress',
    confirmed: 'in_progress',
    completed: 'completed',
    converted: 'completed',
    cancelled: 'cancelled',
    no_show: 'cancelled',
    spam: 'cancelled',
  };
  return mapping[status] || 'pending';
}

function mapBookingStatus(status: string): string {
  const mapping: Record<string, string> = {
    pending: 'pending',
    confirmed: 'confirmed',
    completed: 'completed',
    cancelled: 'cancelled',
    no_show: 'no_show',
  };
  return mapping[status] || 'pending';
}

// ============================================================================
// 메인 실행
// ============================================================================

async function main() {
  console.log('='.repeat(60));
  console.log('🚀 홈페이지 데이터 마이그레이션');
  console.log('='.repeat(60));

  initClients();

  // 변호사 매핑 로드
  await loadLawyerMapping();

  // 결과 집계
  const results = {
    blogPosts: { migrated: 0, errors: 0 },
    cases: { migrated: 0, errors: 0 },
    faqs: { migrated: 0, errors: 0 },
    instagram: { migrated: 0, errors: 0 },
    testimonials: { migrated: 0, errors: 0 },
    photos: { migrated: 0, errors: 0 },
    consultations: { consultations: 0, bookings: 0, errors: 0 },
  };

  // 마이그레이션 실행
  results.blogPosts = await migrateBlogPosts();
  results.cases = await migrateCases();
  results.faqs = await migrateFaqs();
  results.instagram = await migrateInstagram();
  results.testimonials = await migrateTestimonials();
  results.photos = await migrateTestimonialPhotos();
  results.consultations = await migrateConsultations();

  // 결과 출력
  console.log('\n' + '='.repeat(60));
  console.log('📊 마이그레이션 결과');
  console.log('='.repeat(60));

  const totalMigrated =
    results.blogPosts.migrated +
    results.cases.migrated +
    results.faqs.migrated +
    results.instagram.migrated +
    results.testimonials.migrated +
    results.photos.migrated +
    results.consultations.consultations +
    results.consultations.bookings;

  const totalErrors =
    results.blogPosts.errors +
    results.cases.errors +
    results.faqs.errors +
    results.instagram.errors +
    results.testimonials.errors +
    results.photos.errors +
    results.consultations.errors;

  console.log(`
  블로그:        ${results.blogPosts.migrated}개 (에러: ${results.blogPosts.errors})
  성공사례:      ${results.cases.migrated}개 (에러: ${results.cases.errors})
  FAQ:          ${results.faqs.migrated}개 (에러: ${results.faqs.errors})
  인스타그램:    ${results.instagram.migrated}개 (에러: ${results.instagram.errors})
  의뢰인 후기:   ${results.testimonials.migrated}개 (에러: ${results.testimonials.errors})
  증빙 사진:     ${results.photos.migrated}개 (에러: ${results.photos.errors})
  상담 (콜백):   ${results.consultations.consultations}개
  상담 (예약):   ${results.consultations.bookings}개 (에러: ${results.consultations.errors})

  총계: ${totalMigrated}개 마이그레이션 / ${totalErrors}개 에러
  `);

  if (DRY_RUN) {
    console.log('⚠️  드라이런 모드: 실제 데이터는 변경되지 않았습니다.');
    console.log('   실제 마이그레이션을 수행하려면 --dry-run 옵션 없이 실행하세요.');
  }

  console.log('\n다음 단계:');
  console.log('1. Storage 마이그레이션: npx tsx scripts/migrate-homepage-storage.ts');
  console.log('2. theyool 홈페이지 코드 업데이트 (.env.local, 테이블명 변경)');
  console.log('3. 데이터 검증 및 테스트');
}

main().catch(console.error);
