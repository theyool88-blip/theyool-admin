import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://kqqyipnlkmmprfgygauk.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtxcXlpcG5sa21tcHJmZ3lnYXVrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjMyNDQyOSwiZXhwIjoyMDc3OTAwNDI5fQ.nmE-asCNpDnxix4ZxyNlEyocJdG8kPEunx9MHOTnXS0'
);

async function migratePendingHearings() {
  console.log('Starting migration...');

  // 1. case_id가 null이고 google_event_id가 있는 court_hearings 찾기
  const { data: orphanedHearings, error: fetchError } = await supabase
    .from('court_hearings')
    .select('*')
    .is('case_id', null)
    .not('google_event_id', 'is', null);

  if (fetchError) {
    console.error('Error fetching orphaned hearings:', fetchError);
    return;
  }

  console.log(`Found ${orphanedHearings?.length || 0} orphaned hearings`);

  if (!orphanedHearings || orphanedHearings.length === 0) {
    console.log('No orphaned hearings to migrate');
    return;
  }

  // 2. 각 항목을 pending_calendar_events로 이동
  for (const hearing of orphanedHearings) {
    console.log(`Processing: ${hearing.case_number} - ${hearing.google_event_id}`);

    // pending에 추가
    const { error: insertError } = await supabase
      .from('pending_calendar_events')
      .upsert({
        google_event_id: hearing.google_event_id,
        summary: hearing.notes || `[${hearing.hearing_type}] ${hearing.case_number}`,
        location: hearing.location,
        start_datetime: hearing.hearing_date,
        parsed_case_number: hearing.case_number,
        parsed_hearing_type: hearing.hearing_type,
        parsed_hearing_detail: hearing.hearing_type,
        parsed_court_name: hearing.location?.split(' ')[0] || null,
        parsed_courtroom: hearing.location?.match(/제?\d+호?\s*(법정|조정실|심문실)?/)?.[0] || null,
        status: 'pending',
        match_attempted_at: new Date().toISOString(),
        match_attempts: 1,
        created_at: hearing.created_at,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'google_event_id' });

    if (insertError) {
      console.error(`Error inserting pending event:`, insertError);
      continue;
    }

    // court_hearings에서 삭제
    const { error: deleteError } = await supabase
      .from('court_hearings')
      .delete()
      .eq('id', hearing.id);

    if (deleteError) {
      console.error(`Error deleting hearing:`, deleteError);
      continue;
    }

    console.log(`Migrated: ${hearing.case_number}`);
  }

  console.log('Migration complete!');
}

migratePendingHearings();
