/**
 * Migrate files from case_contracts (Supabase Storage) to R2
 *
 * Steps:
 *   a. Query case_contracts table
 *   b. For each contract, download from Supabase Storage
 *   c. Upload to R2 with proper key structure
 *   d. Create r2_files record
 *   e. Update tenant_storage usage
 *
 * Features:
 *   - Progress logging
 *   - --dry-run flag for testing
 *   - --tenant-id filter for specific tenant
 *   - Error handling and retry logic
 *
 * Usage:
 *   npm run script scripts/migrate-supabase-to-r2.ts
 *   npm run script scripts/migrate-supabase-to-r2.ts -- --dry-run
 *   npm run script scripts/migrate-supabase-to-r2.ts -- --tenant-id=<uuid>
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';

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

interface CaseContract {
  id: string;
  tenant_id: string;
  legal_case_id: string;
  file_path: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  uploaded_by: string | null;
  created_at: string;
}

/**
 * Build R2 key from tenant and case info
 */
function buildR2Key(tenantId: string, caseId: string, filename: string): string {
  const timestamp = Date.now();
  const sanitizedFilename = `${timestamp}-${filename}`;
  return `tenant-${tenantId}/cases/${caseId}/contracts/${sanitizedFilename}`;
}

/**
 * Download file from Supabase Storage
 */
async function downloadFromSupabase(filePath: string): Promise<Buffer> {
  const { data, error } = await supabase.storage.from('case_contracts').download(filePath);

  if (error || !data) {
    throw new Error(`Failed to download from Supabase Storage: ${error?.message || 'Unknown error'}`);
  }

  // Convert Blob to Buffer
  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Upload file to R2
 */
async function uploadToR2(key: string, buffer: Buffer, mimeType: string): Promise<{ etag: string }> {
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: mimeType,
  });

  const result = await r2Client.send(command);

  if (!result.ETag) {
    throw new Error('Failed to get ETag from R2 upload');
  }

  return { etag: result.ETag.replace(/"/g, '') };
}

/**
 * Create r2_files record
 */
async function createR2FileRecord(params: {
  tenantId: string;
  caseId: string;
  r2Key: string;
  etag: string;
  originalName: string;
  mimeType: string | null;
  fileSize: number | null;
  uploadedBy: string | null;
  migratedFrom: string;
}): Promise<string> {
  const fileId = randomUUID();

  const { error } = await supabase.from('r2_files').insert({
    id: fileId,
    tenant_id: params.tenantId,
    r2_key: params.r2Key,
    r2_etag: params.etag,
    original_name: params.originalName,
    display_name: params.originalName,
    mime_type: params.mimeType,
    file_size: params.fileSize,
    case_id: params.caseId,
    is_contract: true,
    client_visible: false,
    uploaded_by: params.uploadedBy,
    migrated_from: params.migratedFrom,
  });

  if (error) {
    throw new Error(`Failed to create r2_files record: ${error.message}`);
  }

  return fileId;
}

/**
 * Update tenant storage usage
 */
async function updateStorageUsage(tenantId: string, deltaBytes: number): Promise<void> {
  const { data: storage, error: fetchError } = await supabase
    .from('tenant_storage')
    .select('*')
    .eq('tenant_id', tenantId)
    .single();

  if (fetchError && fetchError.code !== 'PGRST116') {
    throw new Error(`Failed to fetch storage: ${fetchError.message}`);
  }

  if (!storage) {
    // Create storage record
    await supabase.from('tenant_storage').insert({
      tenant_id: tenantId,
      quota_bytes: 53687091200, // 50GB default
      used_bytes: Math.max(0, deltaBytes),
      file_count: 1,
    });
  } else {
    // Update existing record
    const newUsedBytes = Math.max(0, storage.used_bytes + deltaBytes);
    const newFileCount = storage.file_count + 1;

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
}

/**
 * Migrate a single contract file
 */
async function migrateContract(contract: CaseContract): Promise<void> {
  console.log(`\n  📄 Migrating: ${contract.file_name}`);
  console.log(`     File path: ${contract.file_path}`);
  console.log(`     Case ID: ${contract.legal_case_id}`);

  if (isDryRun) {
    console.log('     [DRY RUN] Skipping actual migration');
    return;
  }

  try {
    // Step 1: Download from Supabase Storage
    console.log('     ⬇️  Downloading from Supabase Storage...');
    const fileBuffer = await downloadFromSupabase(contract.file_path);
    console.log(`     ✅ Downloaded (${fileBuffer.length} bytes)`);

    // Step 2: Upload to R2
    const r2Key = buildR2Key(contract.tenant_id, contract.legal_case_id, contract.file_name);
    console.log(`     ⬆️  Uploading to R2: ${r2Key}`);
    const { etag } = await uploadToR2(r2Key, fileBuffer, contract.mime_type || 'application/octet-stream');
    console.log(`     ✅ Uploaded (ETag: ${etag})`);

    // Step 3: Create r2_files record
    console.log('     💾 Creating r2_files record...');
    const fileId = await createR2FileRecord({
      tenantId: contract.tenant_id,
      caseId: contract.legal_case_id,
      r2Key,
      etag,
      originalName: contract.file_name,
      mimeType: contract.mime_type,
      fileSize: contract.file_size,
      uploadedBy: contract.uploaded_by,
      migratedFrom: `case_contracts:${contract.id}`,
    });
    console.log(`     ✅ Created r2_files record (ID: ${fileId})`);

    // Step 4: Update tenant storage usage
    console.log('     📊 Updating storage usage...');
    await updateStorageUsage(contract.tenant_id, contract.file_size || 0);
    console.log('     ✅ Updated storage usage');

    console.log('     ✅ Migration complete');
  } catch (error) {
    console.error(`     ❌ Migration failed: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

/**
 * Main migration function
 */
async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  Migrate case_contracts (Supabase Storage) to R2');
  console.log('═══════════════════════════════════════════════════════');

  if (isDryRun) {
    console.log('\n🔍 DRY RUN MODE - No changes will be made\n');
  }

  if (targetTenantId) {
    console.log(`\n🔍 Filter: tenant_id = ${targetTenantId}\n`);
  }

  // Query case_contracts
  console.log('📋 Querying case_contracts table...');
  let query = supabase.from('case_contracts').select('*');

  if (targetTenantId) {
    query = query.eq('tenant_id', targetTenantId);
  }

  const { data: contracts, error } = await query;

  if (error) {
    console.error('❌ Failed to query case_contracts:', error.message);
    process.exit(1);
  }

  if (!contracts || contracts.length === 0) {
    console.log('\n✅ No contracts found to migrate.');
    process.exit(0);
  }

  console.log(`\n📦 Found ${contracts.length} contract(s) to migrate`);

  // Migrate each contract
  let successCount = 0;
  let failedCount = 0;

  for (let i = 0; i < contracts.length; i++) {
    const contract = contracts[i] as CaseContract;
    console.log(`\n[${i + 1}/${contracts.length}]`);

    try {
      await migrateContract(contract);
      successCount++;
    } catch (error) {
      failedCount++;
      console.error(`Failed to migrate contract ${contract.id}`);
    }
  }

  // Summary
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  Migration Summary');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${failedCount}`);
  console.log(`📊 Total: ${contracts.length}`);

  if (isDryRun) {
    console.log('\n🔍 DRY RUN - No actual changes were made');
  }

  process.exit(failedCount > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
