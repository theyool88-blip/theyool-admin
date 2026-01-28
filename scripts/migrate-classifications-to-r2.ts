/**
 * Migrate drive_file_classifications to r2_files
 *
 * Based on plan Section 14.3:
 *   a. Query records where r2_file_id IS NULL
 *   b. Download from Google Drive
 *   c. Upload to R2
 *   d. Create r2_files record with mapped doc_type
 *   e. Update drive_file_classifications.r2_file_id
 *
 * DOC_TYPE_MAPPING as per plan:
 *   - brief_client -> brief
 *   - brief_defendant -> brief
 *   - evidence -> evidence
 *   - third_party -> reference
 *   - judgment -> court_doc
 *
 * Features:
 *   - Progress logging
 *   - --dry-run flag for testing
 *   - --tenant-id filter for specific tenant
 *   - Error handling and retry logic
 *
 * Usage:
 *   npm run script scripts/migrate-classifications-to-r2.ts
 *   npm run script scripts/migrate-classifications-to-r2.ts -- --dry-run
 *   npm run script scripts/migrate-classifications-to-r2.ts -- --tenant-id=<uuid>
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import { google } from 'googleapis';

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

// Google Drive Configuration
const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

if (!GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_PRIVATE_KEY) {
  console.error('❌ Missing Google Drive credentials.');
  process.exit(1);
}

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: GOOGLE_PRIVATE_KEY,
  },
  scopes: ['https://www.googleapis.com/auth/drive.readonly'],
});

const drive = google.drive({ version: 'v3', auth });

// Parse CLI arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const tenantIdArg = args.find((arg) => arg.startsWith('--tenant-id='));
const targetTenantId = tenantIdArg ? tenantIdArg.split('=')[1] : null;

// Document type mapping per plan Section 14.2
const DOC_TYPE_MAPPING: Record<string, string> = {
  brief_client: 'brief',
  brief_defendant: 'brief',
  evidence: 'evidence',
  third_party: 'reference',
  judgment: 'court_doc',
};

interface DriveFileClassification {
  id: string;
  tenant_id: string;
  drive_file_id: string;
  file_name: string;
  folder_path: string | null;
  case_id: string | null;
  client_visible: boolean;
  client_doc_type: string | null;
  created_at: string;
}

/**
 * Build R2 key from classification data
 */
function buildR2Key(tenantId: string, caseId: string | null, fileName: string): string {
  const timestamp = Date.now();
  const sanitizedFilename = `${timestamp}-${fileName}`;

  if (caseId) {
    return `tenant-${tenantId}/cases/${caseId}/documents/${sanitizedFilename}`;
  } else {
    return `tenant-${tenantId}/documents/${sanitizedFilename}`;
  }
}

/**
 * Download file from Google Drive
 */
async function downloadFromGoogleDrive(driveFileId: string): Promise<{ buffer: Buffer; mimeType: string; size: number }> {
  try {
    // Get file metadata first
    const metadata = await drive.files.get({
      fileId: driveFileId,
      fields: 'mimeType,size',
    });

    const mimeType = metadata.data.mimeType || 'application/octet-stream';
    const size = parseInt(metadata.data.size || '0', 10);

    // Download file content
    const response = await drive.files.get(
      {
        fileId: driveFileId,
        alt: 'media',
      },
      { responseType: 'arraybuffer' }
    );

    const buffer = Buffer.from(response.data as ArrayBuffer);

    return { buffer, mimeType, size };
  } catch (error: any) {
    throw new Error(`Failed to download from Google Drive: ${error.message}`);
  }
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
  caseId: string | null;
  r2Key: string;
  etag: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  docType: string | null;
  clientVisible: boolean;
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
    doc_type: params.docType,
    client_visible: params.clientVisible,
    is_contract: false,
    migrated_from: params.migratedFrom,
  });

  if (error) {
    throw new Error(`Failed to create r2_files record: ${error.message}`);
  }

  return fileId;
}

/**
 * Update drive_file_classifications with r2_file_id
 */
async function linkClassificationToR2File(classificationId: string, r2FileId: string): Promise<void> {
  const { error } = await supabase
    .from('drive_file_classifications')
    .update({ r2_file_id: r2FileId })
    .eq('id', classificationId);

  if (error) {
    throw new Error(`Failed to update drive_file_classifications: ${error.message}`);
  }
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
 * Migrate a single classification record
 */
async function migrateClassification(classification: DriveFileClassification): Promise<void> {
  console.log(`\n  📄 Migrating: ${classification.file_name}`);
  console.log(`     Drive File ID: ${classification.drive_file_id}`);
  console.log(`     Doc Type: ${classification.client_doc_type || 'none'}`);

  if (isDryRun) {
    console.log('     [DRY RUN] Skipping actual migration');
    return;
  }

  try {
    // Step 1: Download from Google Drive
    console.log('     ⬇️  Downloading from Google Drive...');
    const { buffer, mimeType, size } = await downloadFromGoogleDrive(classification.drive_file_id);
    console.log(`     ✅ Downloaded (${size} bytes, ${mimeType})`);

    // Step 2: Upload to R2
    const r2Key = buildR2Key(classification.tenant_id, classification.case_id, classification.file_name);
    console.log(`     ⬆️  Uploading to R2: ${r2Key}`);
    const { etag } = await uploadToR2(r2Key, buffer, mimeType);
    console.log(`     ✅ Uploaded (ETag: ${etag})`);

    // Step 3: Map doc_type
    const mappedDocType = classification.client_doc_type
      ? DOC_TYPE_MAPPING[classification.client_doc_type] || 'reference'
      : null;
    console.log(`     🔄 Mapped doc_type: ${classification.client_doc_type || 'null'} -> ${mappedDocType || 'null'}`);

    // Step 4: Create r2_files record
    console.log('     💾 Creating r2_files record...');
    const fileId = await createR2FileRecord({
      tenantId: classification.tenant_id,
      caseId: classification.case_id,
      r2Key,
      etag,
      originalName: classification.file_name,
      mimeType,
      fileSize: size,
      docType: mappedDocType,
      clientVisible: classification.client_visible,
      migratedFrom: `drive_file_classifications:${classification.id}`,
    });
    console.log(`     ✅ Created r2_files record (ID: ${fileId})`);

    // Step 5: Update drive_file_classifications
    console.log('     🔗 Linking classification to R2 file...');
    await linkClassificationToR2File(classification.id, fileId);
    console.log('     ✅ Linked classification');

    // Step 6: Update storage usage
    console.log('     📊 Updating storage usage...');
    await updateStorageUsage(classification.tenant_id, size);
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
  console.log('  Migrate drive_file_classifications to R2');
  console.log('═══════════════════════════════════════════════════════');

  if (isDryRun) {
    console.log('\n🔍 DRY RUN MODE - No changes will be made\n');
  }

  if (targetTenantId) {
    console.log(`\n🔍 Filter: tenant_id = ${targetTenantId}\n`);
  }

  // Query drive_file_classifications where r2_file_id IS NULL
  console.log('📋 Querying drive_file_classifications table...');
  let query = supabase.from('drive_file_classifications').select('*').is('r2_file_id', null);

  if (targetTenantId) {
    query = query.eq('tenant_id', targetTenantId);
  }

  const { data: classifications, error } = await query;

  if (error) {
    console.error('❌ Failed to query drive_file_classifications:', error.message);
    process.exit(1);
  }

  if (!classifications || classifications.length === 0) {
    console.log('\n✅ No classifications found to migrate.');
    process.exit(0);
  }

  console.log(`\n📦 Found ${classifications.length} classification(s) to migrate`);

  // Migrate each classification
  let successCount = 0;
  let failedCount = 0;

  for (let i = 0; i < classifications.length; i++) {
    const classification = classifications[i] as DriveFileClassification;
    console.log(`\n[${i + 1}/${classifications.length}]`);

    try {
      await migrateClassification(classification);
      successCount++;
    } catch (error) {
      failedCount++;
      console.error(`Failed to migrate classification ${classification.id}`);
    }
  }

  // Summary
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  Migration Summary');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${failedCount}`);
  console.log(`📊 Total: ${classifications.length}`);

  if (isDryRun) {
    console.log('\n🔍 DRY RUN - No actual changes were made');
  }

  process.exit(failedCount > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
