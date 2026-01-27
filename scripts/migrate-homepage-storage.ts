/**
 * 홈페이지 Storage 마이그레이션 스크립트
 * theyool Supabase Storage → luseed Supabase Storage
 *
 * 마이그레이션 대상:
 * - testimonial-photos/* → homepage-testimonial-photos/{tenant_id}/*
 * - blog-images/* → homepage-blog-images/{tenant_id}/*
 * - case-images/* → homepage-case-images/{tenant_id}/*
 *
 * 사용법:
 * 1. .env.local에 THEYOOL_SUPABASE_URL, THEYOOL_SUPABASE_SERVICE_KEY 설정
 * 2. npx tsx scripts/migrate-homepage-storage.ts --dry-run (테스트)
 * 3. npx tsx scripts/migrate-homepage-storage.ts (실행)
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

// luseed (대상)
const ADMIN_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const ADMIN_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// 더율 테넌트 ID
const THEYOOL_TENANT_ID = process.env.THEYOOL_TENANT_ID || '';

// 드라이런 모드
const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose');

// ============================================================================
// 버킷 매핑
// ============================================================================

interface BucketMapping {
  source: string;        // 소스 버킷 이름
  target: string;        // 대상 버킷 이름
  addTenantPrefix: boolean;  // tenant_id 프리픽스 추가 여부
}

const BUCKET_MAPPINGS: BucketMapping[] = [
  {
    source: 'testimonial-photos',
    target: 'homepage-testimonial-photos',
    addTenantPrefix: true,
  },
  {
    source: 'blog-images',
    target: 'homepage-blog-images',
    addTenantPrefix: true,
  },
  {
    source: 'case-images',
    target: 'homepage-case-images',
    addTenantPrefix: true,
  },
];

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
// 버킷 확인/생성
// ============================================================================

async function ensureBucketExists(bucketName: string): Promise<boolean> {
  // 버킷 존재 확인
  const { data: buckets, error: listError } = await targetClient.storage.listBuckets();

  if (listError) {
    console.error(`❌ 버킷 목록 조회 실패:`, listError);
    return false;
  }

  const exists = buckets?.some((b) => b.name === bucketName);

  if (exists) {
    if (VERBOSE) {
      console.log(`   버킷 존재 확인: ${bucketName}`);
    }
    return true;
  }

  // 버킷 생성
  if (DRY_RUN) {
    console.log(`   [드라이런] 버킷 생성 예정: ${bucketName}`);
    return true;
  }

  const { error: createError } = await targetClient.storage.createBucket(bucketName, {
    public: true,  // 홈페이지에서 공개 접근 필요
    fileSizeLimit: 10 * 1024 * 1024,  // 10MB
    allowedMimeTypes: ['image/*'],
  });

  if (createError) {
    console.error(`❌ 버킷 생성 실패 (${bucketName}):`, createError);
    return false;
  }

  console.log(`✅ 버킷 생성: ${bucketName}`);
  return true;
}

// ============================================================================
// 파일 목록 조회 (재귀)
// ============================================================================

interface FileInfo {
  name: string;
  path: string;
  size: number;
}

async function listAllFiles(
  client: SupabaseClient,
  bucket: string,
  folder: string = ''
): Promise<FileInfo[]> {
  const files: FileInfo[] = [];

  const { data, error } = await client.storage.from(bucket).list(folder, {
    limit: 1000,
    sortBy: { column: 'name', order: 'asc' },
  });

  if (error) {
    console.error(`❌ 파일 목록 조회 실패 (${bucket}/${folder}):`, error);
    return files;
  }

  for (const item of data || []) {
    const itemPath = folder ? `${folder}/${item.name}` : item.name;

    if (item.id) {
      // 파일
      files.push({
        name: item.name,
        path: itemPath,
        size: item.metadata?.size || 0,
      });
    } else {
      // 폴더 - 재귀 조회
      const subFiles = await listAllFiles(client, bucket, itemPath);
      files.push(...subFiles);
    }
  }

  return files;
}

// ============================================================================
// 단일 버킷 마이그레이션
// ============================================================================

async function migrateBucket(mapping: BucketMapping): Promise<{ migrated: number; errors: number; skipped: number }> {
  console.log(`\n📦 ${mapping.source} → ${mapping.target} 마이그레이션 시작...`);

  let migrated = 0;
  let errors = 0;
  let skipped = 0;

  // 대상 버킷 확인/생성
  const bucketReady = await ensureBucketExists(mapping.target);
  if (!bucketReady && !DRY_RUN) {
    return { migrated: 0, errors: 1, skipped: 0 };
  }

  // 소스 파일 목록 조회
  const files = await listAllFiles(sourceClient, mapping.source);

  if (files.length === 0) {
    console.log(`   마이그레이션할 파일이 없습니다.`);
    return { migrated: 0, errors: 0, skipped: 0 };
  }

  console.log(`   ${files.length}개 파일 발견`);

  // 파일별 마이그레이션
  for (const file of files) {
    const targetPath = mapping.addTenantPrefix
      ? `${THEYOOL_TENANT_ID}/${file.path}`
      : file.path;

    if (VERBOSE) {
      console.log(`   ${file.path} → ${targetPath}`);
    }

    if (DRY_RUN) {
      migrated++;
      continue;
    }

    try {
      // 대상에 이미 존재하는지 확인
      const { data: existingFile } = await targetClient.storage
        .from(mapping.target)
        .download(targetPath);

      if (existingFile) {
        if (VERBOSE) {
          console.log(`   [스킵] 이미 존재: ${targetPath}`);
        }
        skipped++;
        continue;
      }
    } catch {
      // 파일이 존재하지 않음 - 계속 진행
    }

    try {
      // 소스에서 다운로드
      const { data: fileData, error: downloadError } = await sourceClient.storage
        .from(mapping.source)
        .download(file.path);

      if (downloadError || !fileData) {
        console.error(`   ❌ 다운로드 실패: ${file.path}`, downloadError);
        errors++;
        continue;
      }

      // 대상에 업로드
      const { error: uploadError } = await targetClient.storage
        .from(mapping.target)
        .upload(targetPath, fileData, {
          cacheControl: '31536000',  // 1년
          upsert: true,
        });

      if (uploadError) {
        console.error(`   ❌ 업로드 실패: ${targetPath}`, uploadError);
        errors++;
        continue;
      }

      migrated++;
    } catch (err) {
      console.error(`   ❌ 파일 처리 실패: ${file.path}`, err);
      errors++;
    }
  }

  console.log(`✅ ${migrated}개 파일 마이그레이션 완료 (에러: ${errors}, 스킵: ${skipped})`);
  return { migrated, errors, skipped };
}

// ============================================================================
// 데이터베이스 경로 업데이트
// ============================================================================

async function updateFilePaths(): Promise<void> {
  console.log('\n🔄 데이터베이스 파일 경로 업데이트...');

  if (DRY_RUN) {
    console.log('   [드라이런] 파일 경로 업데이트 예정');
    return;
  }

  // homepage_testimonial_photos 테이블의 file_path 업데이트
  // testimonial-photos/xxx → homepage-testimonial-photos/{tenant_id}/xxx
  const { error: updateError } = await targetClient
    .from('homepage_testimonial_photos')
    .update({
      file_path: targetClient.rpc('update_file_path', {
        old_bucket: 'testimonial-photos',
        new_bucket: `homepage-testimonial-photos/${THEYOOL_TENANT_ID}`,
      }),
    })
    .eq('tenant_id', THEYOOL_TENANT_ID)
    .like('file_path', 'testimonial-photos/%');

  if (updateError) {
    console.log('   ⚠️  RPC 함수가 없습니다. 수동으로 파일 경로를 업데이트해야 할 수 있습니다.');
    console.log('   업데이트 예시:');
    console.log(`   UPDATE homepage_testimonial_photos`);
    console.log(`   SET file_path = REPLACE(file_path, 'testimonial-photos/', 'homepage-testimonial-photos/${THEYOOL_TENANT_ID}/')`);
    console.log(`   WHERE tenant_id = '${THEYOOL_TENANT_ID}';`);
  } else {
    console.log('✅ 파일 경로 업데이트 완료');
  }
}

// ============================================================================
// 메인 실행
// ============================================================================

async function main() {
  console.log('='.repeat(60));
  console.log('🚀 홈페이지 Storage 마이그레이션');
  console.log('='.repeat(60));

  initClients();

  // 결과 집계
  const results: Record<string, { migrated: number; errors: number; skipped: number }> = {};

  // 버킷별 마이그레이션
  for (const mapping of BUCKET_MAPPINGS) {
    results[mapping.source] = await migrateBucket(mapping);
  }

  // 파일 경로 업데이트
  await updateFilePaths();

  // 결과 출력
  console.log('\n' + '='.repeat(60));
  console.log('📊 Storage 마이그레이션 결과');
  console.log('='.repeat(60));

  let totalMigrated = 0;
  let totalErrors = 0;
  let totalSkipped = 0;

  for (const [bucket, result] of Object.entries(results)) {
    console.log(`  ${bucket}: ${result.migrated}개 마이그레이션, ${result.skipped}개 스킵, ${result.errors}개 에러`);
    totalMigrated += result.migrated;
    totalErrors += result.errors;
    totalSkipped += result.skipped;
  }

  console.log('');
  console.log(`  총계: ${totalMigrated}개 마이그레이션 / ${totalSkipped}개 스킵 / ${totalErrors}개 에러`);

  if (DRY_RUN) {
    console.log('\n⚠️  드라이런 모드: 실제 파일은 이동되지 않았습니다.');
    console.log('   실제 마이그레이션을 수행하려면 --dry-run 옵션 없이 실행하세요.');
  }

  console.log('\n다음 단계:');
  console.log('1. theyool 홈페이지 코드 업데이트 (.env.local, 버킷명 변경)');
  console.log('2. 이미지 URL 참조 확인 및 테스트');
  console.log('3. 데이터베이스의 file_path 컬럼 업데이트 확인');
}

main().catch(console.error);
