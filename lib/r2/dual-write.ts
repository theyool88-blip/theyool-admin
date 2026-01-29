/**
 * Dual-write helper for transition period
 *
 * Supports writing to both R2 and legacy systems (Supabase Storage, Google Drive)
 * during the migration phase to ensure data consistency.
 *
 * Usage:
 *   import { dualWriteFile } from '@/lib/r2/dual-write';
 *
 *   const result = await dualWriteFile({
 *     r2File: {
 *       tenant_id: tenantId,
 *       case_id: caseId,
 *       // ... other fields
 *     },
 *     driveLegacy: {
 *       driveFileId: 'google-drive-id',
 *       folderPath: '/some/folder',
 *     },
 *   });
 */

import { createClient } from '@/lib/supabase/server';

// ============================================================================
// Types
// ============================================================================

export interface R2FileInsert {
  tenant_id: string;
  r2_key: string;
  r2_etag?: string;
  original_name: string;
  display_name: string;
  mime_type?: string | null;
  file_size?: number | null;
  folder_id?: string | null;
  case_id?: string | null;
  doc_type?: string | null;
  doc_subtype?: string | null;
  parsed_date?: string | null;
  exhibit_number?: string | null;
  is_contract?: boolean;
  client_visible?: boolean;
  uploaded_by?: string | null;
}

export interface DriveLegacyOptions {
  driveFileId: string;
  folderPath: string;
}

export interface DualWriteResult {
  r2FileId: string;
  classificationId?: string;
}

// ============================================================================
// Doc Type Mapping
// ============================================================================

/**
 * Map R2 doc_type to legacy client_doc_type
 *
 * Reverse mapping of migration:
 *   brief -> brief_client (or brief_defendant, context-dependent)
 *   evidence -> evidence
 *   reference -> third_party
 *   court_doc -> judgment
 */
function mapR2DocTypeToClientDocType(docType: string | null | undefined): string | null {
  if (!docType) return null;

  const mapping: Record<string, string> = {
    brief: 'brief_client', // Default to client brief
    evidence: 'evidence',
    reference: 'third_party',
    court_doc: 'judgment',
  };

  return mapping[docType] || null;
}

// ============================================================================
// Dual-Write Function
// ============================================================================

/**
 * Write file metadata to both R2 (r2_files) and legacy system (drive_file_classifications)
 *
 * This function is used during the transition period to maintain data consistency
 * across both the new R2 system and legacy Google Drive classifications.
 *
 * @param params - Dual-write parameters
 * @returns File IDs for both R2 and classification records
 */
export async function dualWriteFile(params: {
  r2File: R2FileInsert;
  driveLegacy?: DriveLegacyOptions;
}): Promise<DualWriteResult> {
  const supabase = await createClient();

  // Step 1: Insert into r2_files table
  const { data: r2File, error: r2Error } = await supabase
    .from('r2_files')
    .insert({
      tenant_id: params.r2File.tenant_id,
      r2_key: params.r2File.r2_key,
      r2_etag: params.r2File.r2_etag || null,
      original_name: params.r2File.original_name,
      display_name: params.r2File.display_name,
      mime_type: params.r2File.mime_type || null,
      file_size: params.r2File.file_size || null,
      folder_id: params.r2File.folder_id || null,
      case_id: params.r2File.case_id || null,
      doc_type: params.r2File.doc_type || null,
      doc_subtype: params.r2File.doc_subtype || null,
      parsed_date: params.r2File.parsed_date || null,
      exhibit_number: params.r2File.exhibit_number || null,
      is_contract: params.r2File.is_contract || false,
      client_visible: params.r2File.client_visible || false,
      uploaded_by: params.r2File.uploaded_by || null,
    })
    .select()
    .single();

  if (r2Error || !r2File) {
    throw new Error(`Failed to insert into r2_files: ${r2Error?.message || 'Unknown error'}`);
  }

  const result: DualWriteResult = {
    r2FileId: r2File.id,
  };

  // Step 2: Optionally write to drive_file_classifications (if legacy info provided)
  if (params.driveLegacy) {
    const clientDocType = mapR2DocTypeToClientDocType(params.r2File.doc_type);

    const { data: classification, error: classificationError } = await supabase
      .from('drive_file_classifications')
      .insert({
        tenant_id: params.r2File.tenant_id,
        drive_file_id: params.driveLegacy.driveFileId,
        file_name: params.r2File.original_name,
        folder_path: params.driveLegacy.folderPath,
        case_id: params.r2File.case_id || null,
        client_visible: params.r2File.client_visible || false,
        client_doc_type: clientDocType,
        r2_file_id: r2File.id, // Link to R2 file
      })
      .select()
      .single();

    if (classificationError) {
      // Log warning but don't fail the entire operation
      console.warn(
        `Warning: Failed to insert into drive_file_classifications: ${classificationError.message}`
      );
    } else if (classification) {
      result.classificationId = classification.id;
    }
  }

  return result;
}

// ============================================================================
// Dual-Read Function
// ============================================================================

/**
 * Read file metadata from both R2 and legacy system
 *
 * Tries R2 first, falls back to drive_file_classifications if not found.
 *
 * @param params - Read parameters
 * @returns File metadata from either R2 or legacy system
 */
export async function dualReadFile(params: {
  fileId?: string;
  caseId?: string;
  clientVisible?: boolean;
}): Promise<{
  files: Record<string, unknown>[];
  source: 'r2' | 'legacy';
}> {
  const supabase = await createClient();

  // Step 1: Try R2 first
  let r2Query = supabase.from('r2_files').select('*');

  if (params.fileId) {
    r2Query = r2Query.eq('id', params.fileId);
  }

  if (params.caseId) {
    r2Query = r2Query.eq('case_id', params.caseId);
  }

  if (params.clientVisible !== undefined) {
    r2Query = r2Query.eq('client_visible', params.clientVisible);
  }

  const { data: r2Files, error: r2Error } = await r2Query;

  if (!r2Error && r2Files && r2Files.length > 0) {
    return {
      files: r2Files,
      source: 'r2',
    };
  }

  // Step 2: Fallback to drive_file_classifications
  let legacyQuery = supabase.from('drive_file_classifications').select('*');

  if (params.caseId) {
    legacyQuery = legacyQuery.eq('case_id', params.caseId);
  }

  if (params.clientVisible !== undefined) {
    legacyQuery = legacyQuery.eq('client_visible', params.clientVisible);
  }

  const { data: legacyFiles, error: legacyError } = await legacyQuery;

  if (legacyError) {
    throw new Error(`Failed to read from both R2 and legacy: ${legacyError.message}`);
  }

  return {
    files: legacyFiles || [],
    source: 'legacy',
  };
}

// ============================================================================
// Dual-Delete Function
// ============================================================================

/**
 * Delete file metadata from both R2 and legacy system
 *
 * Ensures consistency by deleting from both systems.
 *
 * @param r2FileId - R2 file ID to delete
 */
export async function dualDeleteFile(r2FileId: string): Promise<void> {
  const supabase = await createClient();

  // Step 1: Get R2 file to find linked classification
  const { data: r2File, error: fetchError } = await supabase
    .from('r2_files')
    .select('*')
    .eq('id', r2FileId)
    .single();

  if (fetchError) {
    throw new Error(`Failed to fetch R2 file: ${fetchError.message}`);
  }

  // Step 2: Delete from drive_file_classifications if linked
  const { error: classificationDeleteError } = await supabase
    .from('drive_file_classifications')
    .delete()
    .eq('r2_file_id', r2FileId);

  if (classificationDeleteError) {
    console.warn(
      `Warning: Failed to delete from drive_file_classifications: ${classificationDeleteError.message}`
    );
  }

  // Step 3: Delete from r2_files
  const { error: r2DeleteError } = await supabase.from('r2_files').delete().eq('id', r2FileId);

  if (r2DeleteError) {
    throw new Error(`Failed to delete from r2_files: ${r2DeleteError.message}`);
  }
}
