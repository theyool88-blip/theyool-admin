/**
 * 의뢰인 포털 미리보기 API 테스트 스크립트
 * @usage node scripts/test-client-preview-api.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function testClientPreviewAPI() {
  console.log('🧪 의뢰인 포털 미리보기 API 테스트 시작\n');

  try {
    // 1. 테스트용 의뢰인 조회
    console.log('1️⃣ 테스트용 의뢰인 조회 중...');
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('id, name, phone')
      .limit(1);

    if (clientsError) {
      console.error('❌ 의뢰인 조회 실패:', clientsError.message);
      return;
    }

    if (!clients || clients.length === 0) {
      console.log('⚠️  테스트할 의뢰인이 없습니다.');
      return;
    }

    const testClient = clients[0];
    console.log('✅ 테스트 의뢰인:', testClient.name, `(${testClient.id})\n`);

    // 2. 의뢰인의 사건 조회
    console.log('2️⃣ 의뢰인의 사건 목록 조회 중...');
    const { data: cases, error: casesError } = await supabase
      .from('legal_cases')
      .select('id, case_name, contract_number, case_type, status, office, contract_date, created_at')
      .eq('client_id', testClient.id)
      .order('created_at', { ascending: false });

    if (casesError) {
      console.error('❌ 사건 조회 실패:', casesError.message);
      return;
    }

    console.log(`✅ 사건 ${cases?.length || 0}건 발견`);
    if (cases && cases.length > 0) {
      cases.forEach((c, idx) => {
        console.log(`   ${idx + 1}. ${c.case_name} (${c.status})`);
      });
    }
    console.log();

    // 3. 다가오는 재판기일 조회 (30일 이내)
    if (cases && cases.length > 0) {
      console.log('3️⃣ 다가오는 재판기일 조회 중...');
      const today = new Date().toISOString().split('T')[0];
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      const futureDateStr = futureDate.toISOString().split('T')[0];

      const caseIds = cases.map(c => c.id);

      const { data: hearings, error: hearingsError } = await supabase
        .from('court_hearings')
        .select(`
          id,
          hearing_date,
          location,
          case_number,
          legal_cases!inner (
            case_name
          )
        `)
        .in('case_id', caseIds)
        .gte('hearing_date', today)
        .lte('hearing_date', futureDateStr)
        .order('hearing_date', { ascending: true })
        .limit(10);

      if (hearingsError) {
        console.error('⚠️  재판기일 조회 경고:', hearingsError.message);
      } else {
        console.log(`✅ 다가오는 재판기일 ${hearings?.length || 0}건 발견`);
        if (hearings && hearings.length > 0) {
          hearings.forEach((h, idx) => {
            const caseName = Array.isArray(h.legal_cases)
              ? h.legal_cases[0]?.case_name
              : h.legal_cases?.case_name;
            const dateTimeParts = h.hearing_date.split(' ');
            const date = dateTimeParts[0];
            const time = dateTimeParts.length > 1 ? dateTimeParts[1] : '';
            console.log(`   ${idx + 1}. ${date} ${time} - ${caseName} (${h.location || ''})`);
          });
        }
      }
      console.log();

      // 4. 다가오는 기한 조회 (30일 이내, 미완료)
      console.log('4️⃣ 다가오는 기한 조회 중...');
      const { data: deadlines, error: deadlinesError } = await supabase
        .from('case_deadlines')
        .select(`
          id,
          deadline_date,
          deadline_type,
          notes,
          status,
          legal_cases!inner (
            case_name
          )
        `)
        .in('case_id', caseIds)
        .neq('status', 'COMPLETED')
        .gte('deadline_date', today)
        .lte('deadline_date', futureDateStr)
        .order('deadline_date', { ascending: true })
        .limit(10);

      if (deadlinesError) {
        console.error('⚠️  기한 조회 경고:', deadlinesError.message);
      } else {
        console.log(`✅ 다가오는 기한 ${deadlines?.length || 0}건 발견`);
        if (deadlines && deadlines.length > 0) {
          deadlines.forEach((d, idx) => {
            const caseName = Array.isArray(d.legal_cases)
              ? d.legal_cases[0]?.case_name
              : d.legal_cases?.case_name;
            console.log(`   ${idx + 1}. ${d.deadline_date} - ${d.deadline_type || '기한'}: ${d.notes || ''} (${caseName})`);
          });
        }
      }
      console.log();

      // 5. 특정 사건 상세 조회 테스트
      if (cases.length > 0) {
        const testCase = cases[0];
        console.log('5️⃣ 사건 상세 정보 조회 중...');
        console.log(`   사건: ${testCase.case_name}\n`);

        // 재판기일 전체 조회
        const { data: allHearings, error: allHearingsError } = await supabase
          .from('court_hearings')
          .select(`
            id,
            hearing_date,
            location,
            hearing_type,
            result,
            judge_name,
            report,
            case_number
          `)
          .eq('case_id', testCase.id)
          .order('hearing_date', { ascending: false });

        if (allHearingsError) {
          console.error('⚠️  재판기일 상세 조회 경고:', allHearingsError.message);
        } else {
          console.log(`   ✅ 재판기일 ${allHearings?.length || 0}건`);
        }

        // 기한 전체 조회
        const { data: allDeadlines, error: allDeadlinesError } = await supabase
          .from('case_deadlines')
          .select(`
            id,
            deadline_date,
            deadline_type,
            notes,
            status
          `)
          .eq('case_id', testCase.id)
          .order('deadline_date', { ascending: true });

        if (allDeadlinesError) {
          console.error('⚠️  기한 상세 조회 경고:', allDeadlinesError.message);
        } else {
          const completedCount = allDeadlines?.filter(d => d.status === 'COMPLETED').length || 0;
          const pendingCount = allDeadlines?.filter(d => d.status !== 'COMPLETED').length || 0;
          console.log(`   ✅ 기한 ${allDeadlines?.length || 0}건 (완료: ${completedCount}, 미완료: ${pendingCount})`);
        }
      }
    }

    console.log('\n✅ 모든 테스트 완료!');
    console.log('\n📋 API 엔드포인트:');
    console.log(`   GET /api/admin/client-preview/${testClient.id}`);
    if (cases && cases.length > 0) {
      console.log(`   GET /api/admin/client-preview/${testClient.id}/cases/${cases[0].id}`);
    }

  } catch (error) {
    console.error('❌ 테스트 중 오류 발생:', error.message);
    console.error(error.stack);
  }
}

testClientPreviewAPI();
