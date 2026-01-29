/**
 * Individual file operations API
 * GET /api/drive/files/[id]?action=download|preview - Get file metadata or generate presigned URL
 * PUT /api/drive/files/[id] - Update file metadata
 * DELETE /api/drive/files/[id]?hard=true - Delete file (soft or hard)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { withTenant } from '@/lib/api/with-tenant';
import { generateDownloadUrl, deleteObject } from '@/lib/r2/r2-client';

// Interface for r2_files table record
interface R2File {
  id: string;
  tenant_id: string;
  r2_key: string;
  r2_etag: string | null;
  original_name: string;
  display_name: string;
  mime_type: string | null;
  file_size: number | null;
  folder_id: string | null;
  case_id: string | null;
  doc_type: string | null;
  doc_subtype: string | null;
  parsed_date: string | null;
  exhibit_number: string | null;
  is_contract: boolean;
  client_visible: boolean;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * GET /api/drive/files/[id]?action=download|preview
 * Get file metadata or generate presigned URL for download/preview
 */
export const GET = withTenant(async (request: NextRequest, { tenant, params }) => {
  try {
    const fileId = params?.id;
    if (!fileId) {
      return NextResponse.json(
        { success: false, error: 'File ID is required' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action'); // download | preview

    const supabase = createAdminClient();

    // Fetch file metadata
    const { data: file, error: fetchError } = await supabase
      .from('r2_files')
      .select('*')
      .eq('id', fileId)
      .single();

    if (fetchError || !file) {
      return NextResponse.json(
        { success: false, error: 'File not found' },
        { status: 404 }
      );
    }

    const typedFile = file as R2File;

    // Tenant permission check
    if (typedFile.tenant_id !== tenant.tenantId && !tenant.isSuperAdmin) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      );
    }

    // Contract file permission check (admin/owner only)
    if (typedFile.is_contract) {
      const roleHierarchy = { owner: 4, admin: 3, lawyer: 2, staff: 1 };
      if (
        !tenant.isSuperAdmin &&
        roleHierarchy[tenant.memberRole as keyof typeof roleHierarchy] < 3
      ) {
        return NextResponse.json(
          { success: false, error: 'Contract files require admin or owner role' },
          { status: 403 }
        );
      }
    }

    // Client portal visibility check (if user is client)
    // NOTE: Add client role check logic here when client portal is implemented
    // if (tenant.memberRole === 'client' && !typedFile.client_visible) {
    //   return NextResponse.json(
    //     { success: false, error: 'File not visible to clients' },
    //     { status: 403 }
    //   );
    // }

    // If no action specified, return metadata only
    if (!action) {
      return NextResponse.json({
        success: true,
        file: typedFile,
      });
    }

    // Generate presigned URL for download or preview
    if (action === 'download' || action === 'preview') {
      const expirySeconds = action === 'download' ? 300 : 900; // 5min for download, 15min for preview

      const downloadUrl = await generateDownloadUrl(typedFile.r2_key, expirySeconds);
      const expiresAt = new Date(Date.now() + expirySeconds * 1000).toISOString();

      return NextResponse.json({
        success: true,
        downloadUrl,
        filename: typedFile.display_name,
        expiresAt,
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action parameter' },
      { status: 400 }
    );
  } catch (error) {
    console.error('File GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
});

/**
 * PUT /api/drive/files/[id]
 * Update file metadata
 * Body: { displayName?, folderId?, clientVisible?, docType? }
 */
export const PUT = withTenant(async (request: NextRequest, { tenant, params }) => {
  try {
    const fileId = params?.id;
    if (!fileId) {
      return NextResponse.json(
        { success: false, error: 'File ID is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { displayName, folderId, clientVisible, docType } = body;

    const supabase = createAdminClient();

    // Fetch existing file
    const { data: existingFile, error: fetchError } = await supabase
      .from('r2_files')
      .select('*, folder_id')
      .eq('id', fileId)
      .single();

    if (fetchError || !existingFile) {
      return NextResponse.json(
        { success: false, error: 'File not found' },
        { status: 404 }
      );
    }

    const typedFile = existingFile as R2File;

    // Tenant permission check
    if (typedFile.tenant_id !== tenant.tenantId && !tenant.isSuperAdmin) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      );
    }

    // If moving to contract folder, require admin/owner role
    if (folderId) {
      const { data: targetFolder } = await supabase
        .from('r2_folders')
        .select('is_contract_folder')
        .eq('id', folderId)
        .single();

      if (targetFolder?.is_contract_folder) {
        const roleHierarchy = { owner: 4, admin: 3, lawyer: 2, staff: 1 };
        if (
          !tenant.isSuperAdmin &&
          roleHierarchy[tenant.memberRole as keyof typeof roleHierarchy] < 3
        ) {
          return NextResponse.json(
            { success: false, error: 'Moving to contract folder requires admin or owner role' },
            { status: 403 }
          );
        }
      }
    }

    // Build update object
    const updateData: Partial<R2File> = {
      updated_at: new Date().toISOString(),
    };

    if (displayName !== undefined) updateData.display_name = displayName;
    if (folderId !== undefined) updateData.folder_id = folderId;
    if (clientVisible !== undefined) updateData.client_visible = clientVisible;
    if (docType !== undefined) updateData.doc_type = docType;

    // Update file metadata
    const { data: updatedFile, error: updateError } = await supabase
      .from('r2_files')
      .update(updateData)
      .eq('id', fileId)
      .select()
      .single();

    if (updateError) {
      console.error('File update error:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to update file' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      file: updatedFile as R2File,
    });
  } catch (error) {
    console.error('File PUT error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
});

/**
 * DELETE /api/drive/files/[id]?hard=true
 * Delete file (soft delete by default, hard delete if hard=true)
 * Hard delete: removes from R2 and updates tenant storage usage
 */
export const DELETE = withTenant(async (request: NextRequest, { tenant, params }) => {
  try {
    const fileId = params?.id;
    if (!fileId) {
      return NextResponse.json(
        { success: false, error: 'File ID is required' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const hard = searchParams.get('hard') === 'true';

    const supabase = createAdminClient();

    // Fetch file metadata
    const { data: file, error: fetchError } = await supabase
      .from('r2_files')
      .select('*')
      .eq('id', fileId)
      .single();

    if (fetchError || !file) {
      return NextResponse.json(
        { success: false, error: 'File not found' },
        { status: 404 }
      );
    }

    const typedFile = file as R2File;

    // Tenant permission check
    if (typedFile.tenant_id !== tenant.tenantId && !tenant.isSuperAdmin) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      );
    }

    // Contract file permission check (admin/owner only)
    if (typedFile.is_contract) {
      const roleHierarchy = { owner: 4, admin: 3, lawyer: 2, staff: 1 };
      if (
        !tenant.isSuperAdmin &&
        roleHierarchy[tenant.memberRole as keyof typeof roleHierarchy] < 3
      ) {
        return NextResponse.json(
          { success: false, error: 'Deleting contract files requires admin or owner role' },
          { status: 403 }
        );
      }
    }

    if (hard) {
      // Hard delete: Remove from R2 and database
      try {
        await deleteObject(typedFile.r2_key);
      } catch (r2Error) {
        console.error('R2 delete error:', r2Error);
        // Continue with DB deletion even if R2 fails
      }

      // Delete database record
      const { error: deleteError } = await supabase
        .from('r2_files')
        .delete()
        .eq('id', fileId);

      if (deleteError) {
        console.error('File hard delete error:', deleteError);
        return NextResponse.json(
          { success: false, error: 'Failed to delete file' },
          { status: 500 }
        );
      }

      // Update tenant storage usage atomically
      if (typedFile.file_size) {
        const { error: storageError } = await supabase.rpc('update_tenant_storage_atomic', {
          p_tenant_id: typedFile.tenant_id,
          p_delta_bytes: -typedFile.file_size,  // NEGATIVE to decrement
          p_delta_files: -1,                      // NEGATIVE to decrement
        });

        if (storageError) {
          console.error('Failed to update storage after hard delete:', storageError);
          // Non-fatal: file is deleted, storage count may drift
        }
      }

      return NextResponse.json({
        success: true,
        message: 'File permanently deleted',
      });
    } else {
      // Soft delete: Set deleted_at timestamp
      const { data: updatedFile, error: softDeleteError } = await supabase
        .from('r2_files')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', fileId)
        .select()
        .single();

      if (softDeleteError) {
        console.error('File soft delete error:', softDeleteError);
        return NextResponse.json(
          { success: false, error: 'Failed to delete file' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'File moved to trash',
        file: updatedFile,
      });
    }
  } catch (error) {
    console.error('File DELETE error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
});
