/**
 * Inbox API - Move classified files
 * @description POST /api/inbox/move - Manually move files after classification
 * @body { fileId: string, targetFolderId: string, displayName?: string }
 * @returns Success/error response
 */

import { NextRequest, NextResponse } from 'next/server';
import { withTenant } from '@/lib/api/with-tenant';
import { createAdminClient } from '@/lib/supabase/admin';

export interface MoveFileRequest {
  fileId: string;
  targetFolderId: string;
  displayName?: string;
  docType?: 'brief' | 'evidence' | 'court_doc' | 'reference';
  clientVisible?: boolean;
  clientDocType?: 'brief_client' | 'brief_defendant' | 'evidence' | 'third_party' | 'judgment';
}

export interface MoveFileResponse {
  success: boolean;
  fileId: string;
  message?: string;
  error?: string;
}

const handler = async (
  request: NextRequest,
  context: { tenant: { tenantId: string } }
) => {
  try {
    const body: MoveFileRequest = await request.json();
    const { fileId, targetFolderId, displayName, docType, clientVisible, clientDocType } = body;

    if (!fileId || !targetFolderId) {
      return NextResponse.json<MoveFileResponse>(
        {
          success: false,
          fileId: fileId || '',
          error: 'fileId and targetFolderId are required',
        },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    const tenantId = context.tenant.tenantId;

    // Verify file exists and belongs to this tenant
    const { data: file, error: fileError } = await supabase
      .from('drive_file_classifications')
      .select('id, drive_file_id, file_name, case_id')
      .eq('id', fileId)
      .single();

    if (fileError || !file) {
      return NextResponse.json<MoveFileResponse>(
        {
          success: false,
          fileId,
          error: '파일을 찾을 수 없습니다.',
        },
        { status: 404 }
      );
    }

    // Verify case belongs to tenant
    if (file.case_id) {
      const { data: caseData, error: caseError } = await supabase
        .from('legal_cases')
        .select('id, tenant_id')
        .eq('id', file.case_id)
        .single();

      if (caseError || !caseData || caseData.tenant_id !== tenantId) {
        return NextResponse.json<MoveFileResponse>(
          {
            success: false,
            fileId,
            error: '권한이 없습니다.',
          },
          { status: 403 }
        );
      }
    }

    // Update file classification
    const updateData: Record<string, unknown> = {
      folder_path: targetFolderId,
      updated_at: new Date().toISOString(),
    };

    if (displayName) {
      updateData.display_name = displayName;
    }

    if (docType) {
      updateData.doc_type = docType;
    }

    if (clientVisible !== undefined) {
      updateData.client_visible = clientVisible;
    }

    if (clientDocType) {
      updateData.client_doc_type = clientDocType;
    }

    const { error: updateError } = await supabase
      .from('drive_file_classifications')
      .update(updateData)
      .eq('id', fileId);

    if (updateError) {
      console.error('[Move] File update error:', updateError);
      return NextResponse.json<MoveFileResponse>(
        {
          success: false,
          fileId,
          error: '파일 이동 중 오류가 발생했습니다.',
        },
        { status: 500 }
      );
    }

    // TODO: If we need to actually move files in Google Drive, implement that here
    // For now, we're just updating the metadata

    return NextResponse.json<MoveFileResponse>({
      success: true,
      fileId,
      message: '파일이 성공적으로 이동되었습니다.',
    });
  } catch (error) {
    console.error('[Move] Unexpected error:', error);
    return NextResponse.json<MoveFileResponse>(
      {
        success: false,
        fileId: '',
        error: error instanceof Error ? error.message : '서버 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
};

export const POST = withTenant(handler);
