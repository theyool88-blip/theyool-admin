/**
 * POST /api/drive/files/[id]/move
 * Move file to different folder
 * Body: { targetFolderId: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { withTenant } from '@/lib/api/with-tenant';

interface R2File {
  id: string;
  tenant_id: string;
  r2_key: string;
  folder_id: string | null;
  is_contract: boolean;
}

interface R2Folder {
  id: string;
  tenant_id: string;
  is_contract_folder: boolean;
  path: string;
}

export const POST = withTenant(async (request: NextRequest, { tenant, params }) => {
  try {
    const fileId = params?.id;
    if (!fileId) {
      return NextResponse.json(
        { success: false, error: 'File ID is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { targetFolderId } = body;

    if (!targetFolderId) {
      return NextResponse.json(
        { success: false, error: 'targetFolderId is required' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Fetch file metadata
    const { data: file, error: fetchFileError } = await supabase
      .from('r2_files')
      .select('id, tenant_id, r2_key, folder_id, is_contract')
      .eq('id', fileId)
      .single();

    if (fetchFileError || !file) {
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

    // Fetch target folder
    const { data: targetFolder, error: fetchFolderError } = await supabase
      .from('r2_folders')
      .select('id, tenant_id, is_contract_folder, path')
      .eq('id', targetFolderId)
      .single();

    if (fetchFolderError || !targetFolder) {
      return NextResponse.json(
        { success: false, error: 'Target folder not found' },
        { status: 404 }
      );
    }

    const typedFolder = targetFolder as R2Folder;

    // Target folder must belong to same tenant
    if (typedFolder.tenant_id !== tenant.tenantId) {
      return NextResponse.json(
        { success: false, error: 'Cannot move file to different tenant folder' },
        { status: 403 }
      );
    }

    // If target is contract folder, require admin/owner role
    if (typedFolder.is_contract_folder) {
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

    // If moving FROM contract folder, require admin/owner role
    if (typedFile.is_contract) {
      const roleHierarchy = { owner: 4, admin: 3, lawyer: 2, staff: 1 };
      if (
        !tenant.isSuperAdmin &&
        roleHierarchy[tenant.memberRole as keyof typeof roleHierarchy] < 3
      ) {
        return NextResponse.json(
          { success: false, error: 'Moving contract files requires admin or owner role' },
          { status: 403 }
        );
      }
    }

    // Update file's folder_id
    const { data: updatedFile, error: updateError } = await supabase
      .from('r2_files')
      .update({
        folder_id: targetFolderId,
        is_contract: typedFolder.is_contract_folder,
        updated_at: new Date().toISOString(),
      })
      .eq('id', fileId)
      .select()
      .single();

    if (updateError) {
      console.error('File move error:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to move file' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      file: updatedFile,
      message: `File moved to folder: ${typedFolder.path}`,
    });
  } catch (error) {
    console.error('File move API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
});
