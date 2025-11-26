/**
 * Drop consultation activity trigger
 * This trigger references case_id which doesn't exist in consultations table
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://kqqyipnlkmmprfgygauk.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtxcXlpcG5sa21tcHJmZ3lnYXVrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjMyNDQyOSwiZXhwIjoyMDc3OTAwNDI5fQ.nmE-asCNpDnxix4ZxyNlEyocJdG8kPEunx9MHOTnXS0'
);

async function dropTrigger() {
  console.log('Attempting to drop trigger via Supabase...');

  // Since Supabase JS client doesn't support raw SQL,
  // we need to use the SQL Editor in Supabase Dashboard
  // or use a direct PostgreSQL connection

  console.log('\n⚠️  Please run the following SQL in Supabase Dashboard SQL Editor:');
  console.log('--------------------------------------------------');
  console.log('DROP TRIGGER IF EXISTS trigger_log_consultation_activity ON consultations;');
  console.log('DROP FUNCTION IF EXISTS log_consultation_activity();');
  console.log('--------------------------------------------------\n');

  // Test if the table is accessible
  const { data, error } = await supabase
    .from('consultations')
    .select('id')
    .limit(1);

  if (error) {
    console.log('Error accessing consultations table:', error.message);
  } else {
    console.log('✅ Consultations table is accessible');
  }
}

dropTrigger();
