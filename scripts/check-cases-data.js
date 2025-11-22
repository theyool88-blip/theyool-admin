const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://kqqyipnlkmmprfgygauk.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtxcXlpcG5sa21tcHJmZ3lnYXVrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjMyNDQyOSwiZXhwIjoyMDc3OTAwNDI5fQ.nmE-asCNpDnxix4ZxyNlEyocJdG8kPEunx9MHOTnXS0'
);

(async () => {
  const { data, error } = await supabase
    .from('legal_cases')
    .select('id, contract_number, contract_date, case_name, office, status, client:clients(name)')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.log('Error:', error);
  } else {
    console.log('Sample data (최근 10건):');
    data.forEach((item, i) => {
      console.log(`\n${i+1}. ${item.case_name}`);
      console.log(`   계약번호: ${item.contract_number || 'NULL'}`);
      console.log(`   계약일: ${item.contract_date || 'NULL'}`);
      console.log(`   의뢰인: ${item.client?.name || 'NULL'}`);
      console.log(`   지점: ${item.office}`);
      console.log(`   상태: ${item.status}`);
    });
  }
})();
