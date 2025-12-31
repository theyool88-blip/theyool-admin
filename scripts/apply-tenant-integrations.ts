import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function runMigration() {
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  console.log('=== tenant_integrations 테이블 생성 ===');

  // 1. Check if table exists
  const { data: existing, error: existingError } = await supabase
    .from('tenant_integrations')
    .select('id')
    .limit(1);

  console.log('Existing data:', existing, 'Error:', existingError?.message);

  const tableDoesNotExist = existingError?.message?.includes('not find') || existingError?.message?.includes('does not exist');

  if (!tableDoesNotExist) {
    console.log('tenant_integrations 테이블이 이미 존재합니다.');

    // Check if oauth_states exists
    const { data: oauthStates } = await supabase
      .from('oauth_states')
      .select('id')
      .limit(1);

    if (oauthStates !== null) {
      console.log('oauth_states 테이블이 이미 존재합니다.');
    }

    // Check existing integrations
    const { data: integrations } = await supabase
      .from('tenant_integrations')
      .select('*');

    console.log('\n현재 연동 목록:');
    if (integrations && integrations.length > 0) {
      integrations.forEach((i) => {
        console.log(`  - ${i.provider}: ${i.status} (tenant: ${i.tenant_id})`);
      });
    } else {
      console.log('  (연동 없음)');
    }

    return;
  }

  // Table doesn't exist - try to create via Supabase Management API
  console.log('테이블이 없습니다. SQL을 직접 실행합니다...');

  // Read migration file
  const migrationPath = path.join(__dirname, '../supabase/migrations/20260107_tenant_integrations.sql');
  const sqlContent = fs.readFileSync(migrationPath, 'utf8');

  // Execute via Supabase REST API
  // Note: Direct SQL execution requires service role or admin API
  console.log('\nSupabase Dashboard에서 직접 SQL을 실행해주세요:');
  console.log('1. https://supabase.com/dashboard 접속');
  console.log('2. 프로젝트 선택 > SQL Editor');
  console.log('3. 다음 파일의 내용을 복사하여 실행:');
  console.log(`   ${migrationPath}`);
  console.log('\n또는 아래 SQL을 직접 실행:\n');
  console.log('--- SQL 시작 ---');
  console.log(sqlContent.slice(0, 500) + '\n... (전체 내용은 파일 참조)');
  console.log('--- SQL 끝 ---');
}

runMigration().catch(console.error);
