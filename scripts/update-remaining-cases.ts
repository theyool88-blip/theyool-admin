import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://kqqyipnlkmmprfgygauk.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtxcXlpcG5sa21tcHJmZ3lnYXVrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjMyNDQyOSwiZXhwIjoyMDc3OTAwNDI5fQ.nmE-asCNpDnxix4ZxyNlEyocJdG8kPEunx9MHOTnXS0'
);

const targets = [
  { name: '박정현', caseNumber: '2024드단58330' },
  { name: '박지원', caseNumber: '2025가소73623' },
  { name: '조주성', caseNumber: '2025너2096' },
  { name: '김지영', caseNumber: '2025느단3520' },
  { name: '김요한', caseNumber: '2025드단20433' },
];

async function update() {
  for (const t of targets) {
    // 의뢰인 찾기
    const { data: clients } = await supabase
      .from('clients')
      .select('id')
      .ilike('name', `%${t.name}%`);

    if (!clients || clients.length === 0) {
      console.log(`${t.name}: client not found`);
      continue;
    }

    // 해당 의뢰인의 사건 중 court_case_number가 비어있는 것 찾기
    for (const client of clients) {
      const { data: cases } = await supabase
        .from('legal_cases')
        .select('id, case_name, court_case_number')
        .eq('client_id', client.id)
        .is('court_case_number', null);

      if (cases && cases.length > 0) {
        console.log(`${t.name} - empty cases: ${cases.map(c => c.case_name).join(', ')}`);

        // 첫 번째 빈 사건에 업데이트
        const { error } = await supabase
          .from('legal_cases')
          .update({ court_case_number: t.caseNumber })
          .eq('id', cases[0].id);

        if (!error) {
          console.log(`  -> UPDATED ${cases[0].case_name} with ${t.caseNumber}`);
        } else {
          console.log(`  -> ERROR: ${error.message}`);
        }
      } else {
        // 이미 다 채워져있으면 case_name으로 찾기
        const { data: allCases } = await supabase
          .from('legal_cases')
          .select('id, case_name, court_case_number')
          .eq('client_id', client.id);
        console.log(`${t.name} - all cases filled: ${allCases?.map(c => `${c.case_name}(${c.court_case_number})`).join(', ') || 'none'}`);
      }
    }
  }
}

update();
