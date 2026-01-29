/**
 * Fix case_level for existing cases based on their court_case_number
 *
 * Usage: npx tsx --tsconfig tsconfig.json scripts/fix-case-levels.ts
 *
 * This script updates cases that have incorrect case_level values
 * by inferring the correct level from the court_case_number.
 */
import { createClient } from '@supabase/supabase-js';
import { parseCaseNumber } from '@/lib/scourt/case-number-utils';
import { inferCaseLevelFromType } from '@/lib/scourt/case-relations';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function main() {
  console.log('Starting case_level fix migration...\n');

  // Fetch all cases with court_case_number
  const { data: cases, error } = await supabase
    .from('legal_cases')
    .select('id, court_case_number, case_level')
    .not('court_case_number', 'is', null);

  if (error) {
    console.error('Error fetching cases:', error);
    process.exit(1);
  }

  console.log(`Found ${cases?.length || 0} cases with court_case_number\n`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const c of cases || []) {
    const parsed = parseCaseNumber(c.court_case_number);
    if (!parsed.valid || !parsed.caseType) {
      skipped++;
      continue;
    }

    const correctLevel = inferCaseLevelFromType(parsed.caseType);

    // Skip if already correct
    if (c.case_level === correctLevel) {
      skipped++;
      continue;
    }

    // Update
    const { error: updateError } = await supabase
      .from('legal_cases')
      .update({ case_level: correctLevel })
      .eq('id', c.id);

    if (updateError) {
      console.error(`Error updating ${c.id}:`, updateError.message);
      errors++;
    } else {
      console.log(`Updated ${c.court_case_number}: "${c.case_level}" -> "${correctLevel}"`);
      updated++;
    }
  }

  console.log(`\n=== Migration Complete ===`);
  console.log(`Updated: ${updated}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Errors: ${errors}`);
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
