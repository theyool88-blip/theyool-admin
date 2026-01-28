/**
 * Rollback R2 migrations to Supabase Storage
 *
 * Rollback script that:
 *   a. Queries r2_files with migrated_from set
 *   b. Deletes from R2
 *   c. Removes r2_files records
 *   d. Clears r2_file_id from drive_file_classifications
 *
 * Features:
 *   - Progress logging
 *   - --dry-run flag for testing
 *   - --tenant-id filter for specific tenant
 *   - --source filter (case_contracts|drive_file_classifications)
 *
 * Usage:
 *   npm run script scripts/rollback-to-supabase.ts
 *   npm run script scripts/rollback-to-supabase.ts -- --dry-run
 *   npm run script scripts/rollback-to-supabase.ts -- --tenant-id=<uuid>
 *   npm run script scripts/rollback-to-supabase.ts -- --source=case_contracts
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';

// Load environment variables
config({ path: '.env.local' });

// Supabase Admin Client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// R2 Configuration
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;

if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
  console.error('❌ Missing R2 environment variables.');
  process.exit(1);
}

const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

// Parse CLI arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const tenantIdArg = args.find((arg) => arg.startsWith('--tenant-id='));
const targetTenantId = tenantIdArg ? tenantIdArg.split('=')[1] : null;
const sourceArg = args.find((arg) => arg.startsWith('--source='));
const sourceFilter = sourceArg ? sourceArg.split('=')[1] : null;

interface R2File {
  id: string;
  tenant_id: string;
  r2_key: string;
  file_size: number | null;
  migrated_from: string | null;
}

/**
 * Delete object from R2
 */
async function deleteFromR2(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  });

  await r2Client.send(command);
}

/**
 * Delete r2_files record
 */
async function deleteR2FileRecord(fileId: string): Promise<void> {
  const { error } = await supabase.from('r2_files').delete().eq('id', fileId);

  if (error) {
    throw new Error(`Failed to delete r2_files record: ${error.message}`);
  }
}

/**
 * Clear r2_file_id from drive_file_classifications
 */
async function clearClassificationLink(r2FileId: string): Promise<void> {
  const { error } = await supabase
    .from('drive_file_classifications')
    .update({ r2_file_id: null })
    .eq('r2_file_id', r2FileId);

  if (error) {
    throw new Error(`Failed to clear classification link: ${error.message}`);
  }
}

/**
 * Update tenant storage usage
 */
async function updateStorageUsage(tenantId: string, deltaBytes: number, deltaFiles: number): Promise<void> {
  const { data: storage, error: fetchError } = await supabase
    .from('tenant_storage')
    .select('*')
    .eq('tenant_id', tenantId)
    .single();

  if (fetchError && fetchError.code !== 'PGRST116') {
    throw new Error(`Failed to fetch storage: ${fetchError.message}`);
  }

  if (!storage) {
    console.warn(`⚠️  No storage record found for tenant ${tenantId}`);
    return;
  }

  const newUsedBytes = Math.max(0, storage.used_bytes + deltaBytes);
  const newFileCount = Math.max(0, storage.file_count + deltaFiles);

  const { error: updateError } = await supabase
    .from('tenant_storage')
    .update({
      used_bytes: newUsedBytes,
      file_count: newFileCount,
    })
    .eq('tenant_id', tenantId);

  if (updateError) {
    throw new Error(`Failed to update storage usage: ${updateError.message}`);
  }
}

/**
 * Extract source type from migrated_from field
 */
function extractSourceType(migratedFrom: string | null): string | null {
  if (!migratedFrom) return null;

  if (migratedFrom.startsWith('case_contracts:')) {
    return 'case_contracts';
  } else if (migratedFrom.startsWith('drive_file_classifications:')) {
    return 'drive_file_classifications';
  }

  return null;
}

/**
 * Rollback a single R2 file
 */
async function rollbackFile(file: R2File): Promise<void> {
  const sourceType = extractSourceType(file.migrated_from);

  console.log(`\n  📄 Rolling back: ${file.r2_key}`);
  console.log(`     Source: ${file.migrated_from || 'unknown'}`);
  console.log(`     File ID: ${file.id}`);

  if (isDryRun) {
    console.log('     [DRY RUN] Skipping actual rollback');
    return;
  }

  try {
    // Step 1: Delete from R2
    console.log('     🗑️  Deleting from R2...');
    await deleteFromR2(file.r2_key);
    console.log('     ✅ Deleted from R2');

    // Step 2: Clear drive_file_classifications link if applicable
    if (sourceType === 'drive_file_classifications') {
      console.log('     🔗 Clearing classification link...');
      await clearClassificationLink(file.id);
      console.log('     ✅ Cleared classification link');
    }

    // Step 3: Delete r2_files record
    console.log('     💾 Deleting r2_files record...');
    await deleteR2FileRecord(file.id);
    console.log('     ✅ Deleted r2_files record');

    // Step 4: Update storage usage
    console.log('     📊 Updating storage usage...');
    await updateStorageUsage(file.tenant_id, -(file.file_size || 0), -1);
    console.log('     ✅ Updated storage usage');

    console.log('     ✅ Rollback complete');
  } catch (error) {
    console.error(`     ❌ Rollback failed: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

/**
 * Main rollback function
 */
async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  Rollback R2 Migrations to Supabase Storage');
  console.log('═══════════════════════════════════════════════════════');

  if (isDryRun) {
    console.log('\n🔍 DRY RUN MODE - No changes will be made\n');
  }

  if (targetTenantId) {
    console.log(`\n🔍 Filter: tenant_id = ${targetTenantId}`);
  }

  if (sourceFilter) {
    console.log(`\n🔍 Filter: source = ${sourceFilter}`);
  }

  console.log();

  // Query r2_files with migrated_from set
  console.log('📋 Querying r2_files with migrated_from...');
  let query = supabase.from('r2_files').select('*').not('migrated_from', 'is', null);

  if (targetTenantId) {
    query = query.eq('tenant_id', targetTenantId);
  }

  const { data: files, error } = await query;

  if (error) {
    console.error('❌ Failed to query r2_files:', error.message);
    process.exit(1);
  }

  if (!files || files.length === 0) {
    console.log('\n✅ No migrated files found to rollback.');
    process.exit(0);
  }

  // Apply source filter if specified
  let filteredFiles = files as R2File[];
  if (sourceFilter) {
    filteredFiles = filteredFiles.filter((file) => {
      const sourceType = extractSourceType(file.migrated_from);
      return sourceType === sourceFilter;
    });

    if (filteredFiles.length === 0) {
      console.log(`\n✅ No files found with source=${sourceFilter}`);
      process.exit(0);
    }
  }

  console.log(`\n📦 Found ${filteredFiles.length} file(s) to rollback`);

  // Summary by source
  const sourceCount: Record<string, number> = {};
  filteredFiles.forEach((file) => {
    const sourceType = extractSourceType(file.migrated_from) || 'unknown';
    sourceCount[sourceType] = (sourceCount[sourceType] || 0) + 1;
  });

  console.log('\n📊 Breakdown by source:');
  Object.entries(sourceCount).forEach(([source, count]) => {
    console.log(`   - ${source}: ${count}`);
  });

  // Rollback each file
  console.log('\n🔄 Starting rollback...');
  let successCount = 0;
  let failedCount = 0;

  for (let i = 0; i < filteredFiles.length; i++) {
    const file = filteredFiles[i];
    console.log(`\n[${i + 1}/${filteredFiles.length}]`);

    try {
      await rollbackFile(file);
      successCount++;
    } catch (error) {
      failedCount++;
      console.error(`Failed to rollback file ${file.id}`);
    }
  }

  // Summary
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  Rollback Summary');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${failedCount}`);
  console.log(`📊 Total: ${filteredFiles.length}`);

  if (isDryRun) {
    console.log('\n🔍 DRY RUN - No actual changes were made');
  }

  process.exit(failedCount > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
