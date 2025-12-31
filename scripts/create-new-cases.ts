import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://kqqyipnlkmmprfgygauk.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtxcXlpcG5sa21tcHJmZ3lnYXVrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjMyNDQyOSwiZXhwIjoyMDc3OTAwNDI5fQ.nmE-asCNpDnxix4ZxyNlEyocJdG8kPEunx9MHOTnXS0'
);

// 새로 등록할 사건들
const newCases = [
  { clientName: '박정현', caseNumber: '2024드단58330', caseName: '박정현v(이혼)' },
  { clientName: '박지원', caseNumber: '2025가소73623', caseName: '박지원v(손해배상)' },
  { clientName: '조주성', caseNumber: '2025너2096', caseName: '조주성v(이혼)' },
  { clientName: '김지영', caseNumber: '2025느단3520', caseName: '김지영v(친권자변경)' },
  { clientName: '김요한', caseNumber: '2025드단20433', caseName: '김요한v(손해배상)' },
];

async function createCases() {
  console.log('Creating new cases...');

  for (const newCase of newCases) {
    // 1. 의뢰인 찾기
    const { data: clients } = await supabase
      .from('clients')
      .select('id, name')
      .ilike('name', `%${newCase.clientName}%`);

    if (!clients || clients.length === 0) {
      console.log(`[NOT FOUND] Client: ${newCase.clientName}`);
      continue;
    }

    const client = clients[0];

    // 2. 이미 같은 사건번호로 등록되어 있는지 확인
    const { data: existingCase } = await supabase
      .from('legal_cases')
      .select('id')
      .eq('court_case_number', newCase.caseNumber)
      .single();

    if (existingCase) {
      console.log(`[ALREADY EXISTS] ${newCase.caseNumber}`);
      continue;
    }

    // 3. 새 사건 등록
    const { data: createdCase, error } = await supabase
      .from('legal_cases')
      .insert({
        case_name: newCase.caseName,
        court_case_number: newCase.caseNumber,
        client_id: client.id,
        status: '진행중',
        case_type: '이혼',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.log(`[ERROR] ${newCase.clientName}: ${error.message}`);
    } else {
      console.log(`[CREATED] ${newCase.clientName}: ${newCase.caseName} (${newCase.caseNumber})`);
    }
  }

  console.log('\nDone!');
}

createCases();
