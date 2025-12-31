import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load .env.local
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  console.log('테넌트 로고 마이그레이션 확인 중...');
  console.log('Supabase URL:', supabaseUrl);

  // Check if tenants table exists and get sample
  const { data: tenants, error: checkError } = await supabase
    .from('tenants')
    .select('id, name, slug, logo_url, logo_dark_url')
    .limit(5);

  if (checkError) {
    console.error('❌ 테넌트 테이블 확인 실패:', checkError.message);

    if (checkError.message.includes('does not exist') || checkError.message.includes('relation')) {
      console.log('\n⚠️ tenants 테이블이 없습니다.');
      console.log('먼저 멀티테넌트 마이그레이션을 Supabase Dashboard에서 적용해주세요.');
    } else if (checkError.message.includes('logo_url')) {
      console.log('\n⚠️ logo_url 컬럼이 없습니다.');
      console.log('Supabase Dashboard > SQL Editor에서 다음 SQL을 실행해주세요:\n');
      console.log('----------------------------------------');
      console.log('ALTER TABLE tenants ADD COLUMN IF NOT EXISTS logo_url TEXT;');
      console.log('ALTER TABLE tenants ADD COLUMN IF NOT EXISTS logo_dark_url TEXT;');
      console.log('----------------------------------------');
    }
    return;
  }

  console.log('✅ tenants 테이블 확인 완료');

  if (tenants && tenants.length > 0) {
    console.log('\n현재 테넌트 목록:');
    tenants.forEach(t => {
      const logoStatus = t.logo_url ? '✓ 로고 있음' : '- 로고 없음';
      console.log(`  ${t.name} (${t.slug}): ${logoStatus}`);
    });

    // Check if logo_url column exists by checking the first tenant
    if (tenants[0].logo_url === undefined) {
      console.log('\n⚠️ logo_url 컬럼이 없습니다. 마이그레이션이 필요합니다.');
    } else {
      console.log('\n✅ logo_url 컬럼이 존재합니다. 마이그레이션 완료!');
    }
  } else {
    console.log('\n등록된 테넌트가 없습니다.');
    console.log('(멀티테넌트 마이그레이션이 적용되지 않았을 수 있습니다)');
  }
}

applyMigration().catch(console.error);
