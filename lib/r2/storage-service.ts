/**
 * R2 Storage Service
 *
 * High-level storage service providing clean API for file and folder operations.
 * Uses r2-client.ts for R2 operations and Supabase for metadata management.
 */

import { createClient } from '@/lib/supabase/server';
import {
  generateUploadUrl,
  generateDownloadUrl,
  deleteObject,
} from './r2-client';
import { randomUUID } from 'crypto';
import type { R2File, R2Folder } from '@/types/r2';

// ============================================================================
// Types
// ============================================================================

// Re-export types from canonical source for backward compatibility
export type { R2File, R2Folder }

export interface StorageUsage {
  quota_bytes: number;
  extra_quota_bytes: number;
  used_bytes: number;
  file_count: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Build R2 object key from components
 *
 * @param tenantId - Tenant ID
 * @param path - Folder path (e.g., "/contracts/2024")
 * @param filename - File name
 * @returns Complete R2 key (e.g., "tenant-abc/contracts/2024/filename.pdf")
 */
export function buildR2Key(tenantId: string, path: string, filename: string): string {
  // Sanitize path: remove leading/trailing slashes
  const sanitizedPath = path.replace(/^\/+|\/+$/g, '');

  // Build key: tenant-{id}/{path}/{filename}
  const parts = [`tenant-${tenantId}`];
  if (sanitizedPath) {
    parts.push(sanitizedPath);
  }
  parts.push(filename);

  return parts.join('/');
}

/**
 * Generate display name for file
 *
 * @param originalName - Original file name
 * @param docType - Optional document type
 * @returns Display name
 */
export function generateDisplayName(originalName: string, docType?: string): string {
  if (docType) {
    // Extract extension
    const ext = originalName.split('.').pop() || '';
    const baseName = originalName.replace(`.${ext}`, '');

    // Format: "[DocType] OriginalName.ext"
    return `[${docType}] ${baseName}.${ext}`;
  }

  return originalName;
}

// ============================================================================
// Storage Service Class
// ============================================================================

export class StorageService {
  /**
   * Upload a file to R2 with metadata tracking
   *
   * Creates database record and returns presigned upload URL.
   * Client uploads directly to R2, then calls completeUpload() with ETag.
   *
   * @param params - Upload parameters
   * @returns File ID and presigned upload URL
   */
  static async uploadFile(params: {
    tenantId: string;
    folderId?: string;
    caseId?: string;
    file: { name: string; size: number; type: string };
    uploadedBy: string;
  }): Promise<{ fileId: string; uploadUrl: string }> {
    const supabase = await createClient();
    const { tenantId, folderId, caseId, file, uploadedBy } = params;

    // Check quota before proceeding
    const quotaCheck = await this.checkQuota(tenantId, file.size);
    if (!quotaCheck.allowed) {
      throw new Error(
        `Storage quota exceeded. Need ${file.size} bytes, only ${quotaCheck.remaining} bytes remaining.`
      );
    }

    // Generate unique file ID and R2 key
    const fileId = randomUUID();
    const timestamp = Date.now();
    const sanitizedFilename = `${timestamp}-${file.name}`;

    // Get folder path if folder_id provided
    let folderPath = '';
    if (folderId) {
      const { data: folder, error: folderError } = await supabase
        .from('r2_folders')
        .select('path')
        .eq('id', folderId)
        .single();

      if (folderError) {
        throw new Error(`Failed to get folder path: ${folderError.message}`);
      }

      folderPath = folder.path;
    }

    const r2Key = buildR2Key(tenantId, folderPath, sanitizedFilename);

    // Generate presigned upload URL
    const uploadUrl = await generateUploadUrl(r2Key, file.type);

    // Create database record (pending upload)
    const { error: insertError } = await supabase.from('r2_files').insert({
      id: fileId,
      tenant_id: tenantId,
      r2_key: r2Key,
      original_name: file.name,
      display_name: generateDisplayName(file.name),
      mime_type: file.type,
      file_size: file.size,
      folder_id: folderId || null,
      case_id: caseId || null,
      uploaded_by: uploadedBy,
      is_contract: false,
      client_visible: false,
    });

    if (insertError) {
      throw new Error(`Failed to create file record: ${insertError.message}`);
    }

    return { fileId, uploadUrl };
  }

  /**
   * Complete upload by updating ETag and storage usage
   *
   * @param fileId - File ID
   * @param etag - ETag from R2 upload response
   * @returns Updated file record
   */
  static async completeUpload(fileId: string, etag: string): Promise<R2File> {
    const supabase = await createClient();

    // Get file record
    const { data: file, error: fetchError } = await supabase
      .from('r2_files')
      .select('*')
      .eq('id', fileId)
      .single();

    if (fetchError || !file) {
      throw new Error(`File not found: ${fileId}`);
    }

    // Update ETag
    const { data: updated, error: updateError } = await supabase
      .from('r2_files')
      .update({ r2_etag: etag })
      .eq('id', fileId)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to update file ETag: ${updateError.message}`);
    }

    // Update storage usage
    await this.updateUsage(file.tenant_id, file.file_size || 0, 1);

    return updated as R2File;
  }

  /**
   * Get download URL for a file
   *
   * @param fileId - File ID
   * @returns Presigned download URL and file metadata
   */
  static async downloadFile(fileId: string): Promise<{ downloadUrl: string; file: R2File }> {
    const supabase = await createClient();

    // Get file record
    const { data: file, error } = await supabase
      .from('r2_files')
      .select('*')
      .eq('id', fileId)
      .single();

    if (error || !file) {
      throw new Error(`File not found: ${fileId}`);
    }

    // Generate presigned download URL
    const downloadUrl = await generateDownloadUrl(file.r2_key);

    return { downloadUrl, file: file as R2File };
  }

  /**
   * Delete a file from R2 and database
   *
   * @param fileId - File ID to delete
   */
  static async deleteFile(fileId: string): Promise<void> {
    const supabase = await createClient();

    // Get file record
    const { data: file, error: fetchError } = await supabase
      .from('r2_files')
      .select('*')
      .eq('id', fileId)
      .single();

    if (fetchError || !file) {
      throw new Error(`File not found: ${fileId}`);
    }

    // Delete from R2
    await deleteObject(file.r2_key);

    // Delete from database
    const { error: deleteError } = await supabase
      .from('r2_files')
      .delete()
      .eq('id', fileId);

    if (deleteError) {
      throw new Error(`Failed to delete file record: ${deleteError.message}`);
    }

    // Update storage usage
    await this.updateUsage(file.tenant_id, -(file.file_size || 0), -1);
  }

  /**
   * Move file to different folder
   *
   * @param fileId - File ID
   * @param targetFolderId - Target folder ID (null for root)
   * @returns Updated file record
   */
  static async moveFile(fileId: string, targetFolderId: string | null): Promise<R2File> {
    const supabase = await createClient();

    // Update folder_id
    const { data: updated, error } = await supabase
      .from('r2_files')
      .update({ folder_id: targetFolderId })
      .eq('id', fileId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to move file: ${error.message}`);
    }

    return updated as R2File;
  }

  /**
   * Update file metadata
   *
   * @param fileId - File ID
   * @param updates - Partial file updates
   * @returns Updated file record
   */
  static async updateFile(fileId: string, updates: Partial<R2File>): Promise<R2File> {
    const supabase = await createClient();

    const { data: updated, error } = await supabase
      .from('r2_files')
      .update(updates)
      .eq('id', fileId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update file: ${error.message}`);
    }

    return updated as R2File;
  }

  /**
   * Create a new folder
   *
   * @param params - Folder creation parameters
   * @returns Created folder record
   */
  static async createFolder(params: {
    tenantId: string;
    parentId?: string | null;
    name: string;
    caseId?: string | null;
    isContractFolder?: boolean;
  }): Promise<R2Folder> {
    const supabase = await createClient();
    const { tenantId, parentId, name, caseId, isContractFolder } = params;

    // Calculate path and depth
    let path = `/${name}`;
    let depth = 0;

    if (parentId) {
      const { data: parent, error: parentError } = await supabase
        .from('r2_folders')
        .select('path, depth')
        .eq('id', parentId)
        .single();

      if (parentError || !parent) {
        throw new Error(`Parent folder not found: ${parentId}`);
      }

      path = `${parent.path}/${name}`;
      depth = parent.depth + 1;
    }

    // Create folder
    const { data: folder, error } = await supabase
      .from('r2_folders')
      .insert({
        tenant_id: tenantId,
        name,
        path,
        parent_id: parentId || null,
        case_id: caseId || null,
        is_contract_folder: isContractFolder || false,
        depth,
        display_order: 0,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create folder: ${error.message}`);
    }

    return folder as R2Folder;
  }

  /**
   * Delete a folder (must be empty)
   *
   * @param folderId - Folder ID to delete
   */
  static async deleteFolder(folderId: string): Promise<void> {
    const supabase = await createClient();

    // Check if folder has children
    const { data: children } = await supabase
      .from('r2_folders')
      .select('id')
      .eq('parent_id', folderId)
      .limit(1);

    if (children && children.length > 0) {
      throw new Error('Cannot delete folder with subfolders');
    }

    // Check if folder has files
    const { data: files } = await supabase
      .from('r2_files')
      .select('id')
      .eq('folder_id', folderId)
      .limit(1);

    if (files && files.length > 0) {
      throw new Error('Cannot delete folder with files');
    }

    // Delete folder
    const { error } = await supabase.from('r2_folders').delete().eq('id', folderId);

    if (error) {
      throw new Error(`Failed to delete folder: ${error.message}`);
    }
  }

  /**
   * List folders and files in a folder
   *
   * @param folderId - Folder ID (null for root)
   * @param tenantId - Tenant ID
   * @returns Folders and files in the folder
   */
  static async listFolder(
    folderId: string | null,
    tenantId: string
  ): Promise<{ folders: R2Folder[]; files: R2File[] }> {
    const supabase = await createClient();

    // Get folders
    const { data: folders, error: foldersError } = await supabase
      .from('r2_folders')
      .select('*')
      .eq('tenant_id', tenantId)
      .is('parent_id', folderId)
      .order('display_order', { ascending: true })
      .order('name', { ascending: true });

    if (foldersError) {
      throw new Error(`Failed to list folders: ${foldersError.message}`);
    }

    // Get files
    const { data: files, error: filesError } = await supabase
      .from('r2_files')
      .select('*')
      .eq('tenant_id', tenantId)
      .is('folder_id', folderId)
      .order('created_at', { ascending: false });

    if (filesError) {
      throw new Error(`Failed to list files: ${filesError.message}`);
    }

    return {
      folders: (folders || []) as R2Folder[],
      files: (files || []) as R2File[],
    };
  }

  /**
   * Move folder to different parent
   *
   * @param folderId - Folder ID
   * @param targetParentId - Target parent folder ID (null for root)
   * @returns Updated folder record
   */
  static async moveFolder(folderId: string, targetParentId: string | null): Promise<R2Folder> {
    const supabase = await createClient();

    // Get current folder
    const { data: folder, error: fetchError } = await supabase
      .from('r2_folders')
      .select('*')
      .eq('id', folderId)
      .single();

    if (fetchError || !folder) {
      throw new Error(`Folder not found: ${folderId}`);
    }

    // Calculate new path and depth
    let newPath = `/${folder.name}`;
    let newDepth = 0;

    if (targetParentId) {
      const { data: targetParent, error: parentError } = await supabase
        .from('r2_folders')
        .select('path, depth')
        .eq('id', targetParentId)
        .single();

      if (parentError || !targetParent) {
        throw new Error(`Target parent folder not found: ${targetParentId}`);
      }

      // Check for circular reference
      if (targetParent.path.startsWith(folder.path + '/')) {
        throw new Error('Cannot move folder into its own subfolder');
      }

      newPath = `${targetParent.path}/${folder.name}`;
      newDepth = targetParent.depth + 1;
    }

    // Update folder
    const { data: updated, error: updateError } = await supabase
      .from('r2_folders')
      .update({
        parent_id: targetParentId,
        path: newPath,
        depth: newDepth,
      })
      .eq('id', folderId)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to move folder: ${updateError.message}`);
    }

    // Update all descendant folders' paths recursively
    const oldPath = folder.path;
    await supabase.rpc('update_folder_paths_recursive', {
      p_folder_id: folderId,
      p_old_path: oldPath,
      p_new_path: newPath,
    });

    return updated as R2Folder;
  }

  /**
   * Rename a folder
   *
   * @param folderId - Folder ID
   * @param newName - New folder name
   * @returns Updated folder record
   */
  static async renameFolder(folderId: string, newName: string): Promise<R2Folder> {
    const supabase = await createClient();

    // Get current folder
    const { data: folder, error: fetchError } = await supabase
      .from('r2_folders')
      .select('*')
      .eq('id', folderId)
      .single();

    if (fetchError || !folder) {
      throw new Error(`Folder not found: ${folderId}`);
    }

    // Calculate new path
    const pathParts = folder.path.split('/');
    pathParts[pathParts.length - 1] = newName;
    const newPath = pathParts.join('/');

    // Update folder
    const { data: updated, error: updateError } = await supabase
      .from('r2_folders')
      .update({
        name: newName,
        path: newPath,
      })
      .eq('id', folderId)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to rename folder: ${updateError.message}`);
    }

    // Update all descendant folders' paths recursively
    const oldPath = folder.path;
    await supabase.rpc('update_folder_paths_recursive', {
      p_folder_id: folderId,
      p_old_path: oldPath,
      p_new_path: newPath,
    });

    return updated as R2Folder;
  }

  /**
   * Get storage usage for a tenant
   *
   * @param tenantId - Tenant ID
   * @returns Storage usage information
   */
  static async getStorageUsage(
    tenantId: string
  ): Promise<{ used: number; quota: number; fileCount: number }> {
    const supabase = await createClient();

    // Get or create storage record
    const { data: storageData, error } = await supabase
      .from('tenant_storage')
      .select('*')
      .eq('tenant_id', tenantId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to get storage usage: ${error.message}`);
    }

    // Create if doesn't exist
    let storage = storageData;
    if (!storage) {
      const { data: created, error: createError } = await supabase
        .from('tenant_storage')
        .insert({
          tenant_id: tenantId,
          quota_bytes: 53687091200, // 50GB default
          used_bytes: 0,
          file_count: 0,
        })
        .select()
        .single();

      if (createError) {
        throw new Error(`Failed to create storage record: ${createError.message}`);
      }

      storage = created;
    }

    const totalQuota = storage.quota_bytes + (storage.extra_quota_bytes || 0);

    return {
      used: storage.used_bytes || 0,
      quota: totalQuota,
      fileCount: storage.file_count || 0,
    };
  }

  /**
   * Check if additional storage is available
   *
   * @param tenantId - Tenant ID
   * @param additionalBytes - Bytes to check
   * @returns Whether storage is allowed and remaining bytes
   */
  static async checkQuota(
    tenantId: string,
    additionalBytes: number
  ): Promise<{ allowed: boolean; remaining: number }> {
    const usage = await this.getStorageUsage(tenantId);
    const remaining = usage.quota - usage.used;
    const allowed = remaining >= additionalBytes;

    return { allowed, remaining };
  }

  /**
   * Update storage usage atomically
   *
   * @param tenantId - Tenant ID
   * @param deltaBytes - Change in bytes (positive or negative)
   * @param deltaFiles - Change in file count (positive or negative)
   * @returns Updated storage values for quota checking
   */
  static async updateUsage(
    tenantId: string,
    deltaBytes: number,
    deltaFiles: number
  ): Promise<{ newUsedBytes: number; newFileCount: number; quotaBytes: number }> {
    const supabase = await createClient();

    const { data, error } = await supabase.rpc('update_tenant_storage_atomic', {
      p_tenant_id: tenantId,
      p_delta_bytes: deltaBytes,
      p_delta_files: deltaFiles,
    });

    if (error) {
      throw new Error(`Failed to update storage usage: ${error.message}`);
    }

    // RPC returns array with single row
    const result = Array.isArray(data) ? data[0] : data;

    return {
      newUsedBytes: result.new_used_bytes,
      newFileCount: result.new_file_count,
      quotaBytes: result.quota_bytes,
    };
  }
}
