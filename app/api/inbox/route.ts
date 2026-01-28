/**
 * Inbox API - List unclassified files
 * @description GET /api/inbox - List files in inbox (unclassified files)
 * @query caseId? - Optional case ID for case-specific inbox
 * @returns List of files with classification suggestions
 */

import { NextRequest, NextResponse } from 'next/server';
import { withTenant } from '@/lib/api/with-tenant';
import { createAdminClient } from '@/lib/supabase/admin';

export interface InboxFile {
  id: string;
  driveFileId: string;
  fileName: string;
  folderPath: string;
  mimeType: string | null;
  fileSize: number | null;
  caseId: string | null;
  caseName?: string;
  isLargeFile: boolean;
  createdAt: string;
  suggestedDocType?: string;
  suggestedFolder?: string;
  confidence?: number;
}

export interface InboxListResponse {
  success: boolean;
  files: InboxFile[];
  totalCount: number;
  caseId?: string;
  error?: string;
}

const handler = async (
  request: NextRequest,
  context: { tenant: { tenantId: string } }
) => {
  try {
    const { searchParams } = new URL(request.url);
    const caseId = searchParams.get('caseId');
    const tenantId = context.tenant.tenantId;

    const supabase = createAdminClient();

    // Build query for unclassified files
    // A file is "unclassified" if it doesn't have a classification record
    // OR if it has a classification but client_visible is false AND client_doc_type is null
    let query = supabase
      .from('drive_file_classifications')
      .select(`
        id,
        drive_file_id,
        file_name,
        folder_path,
        mime_type,
        file_size,
        case_id,
        is_large_file,
        created_at,
        client_visible,
        client_doc_type
      `)
      .or('client_doc_type.is.null,client_visible.eq.false')
      .order('created_at', { ascending: false });

    // Filter by case if specified
    if (caseId) {
      query = query.eq('case_id', caseId);
    } else {
      // For tenant-wide inbox, we need to filter by tenant
      // First get all cases for this tenant
      const { data: tenantCases } = await supabase
        .from('legal_cases')
        .select('id')
        .eq('tenant_id', tenantId);

      if (tenantCases && tenantCases.length > 0) {
        const caseIds = tenantCases.map((c) => c.id);
        query = query.in('case_id', caseIds);
      } else {
        // No cases for this tenant
        return NextResponse.json<InboxListResponse>({
          success: true,
          files: [],
          totalCount: 0,
        });
      }
    }

    const { data: files, error: filesError } = await query;

    if (filesError) {
      console.error('[Inbox] Files fetch error:', filesError);
      return NextResponse.json<InboxListResponse>(
        {
          success: false,
          files: [],
          totalCount: 0,
          error: '파일 목록 조회 중 오류가 발생했습니다.',
        },
        { status: 500 }
      );
    }

    // Get case names for files
    const filesWithCaseInfo: InboxFile[] = [];

    if (files && files.length > 0) {
      const uniqueCaseIds = [...new Set(files.map((f) => f.case_id).filter(Boolean))];

      let caseMap: Record<string, string> = {};

      if (uniqueCaseIds.length > 0) {
        const { data: cases } = await supabase
          .from('legal_cases')
          .select('id, case_name')
          .in('id', uniqueCaseIds as string[]);

        if (cases) {
          caseMap = cases.reduce((acc, c) => {
            acc[c.id] = c.case_name;
            return acc;
          }, {} as Record<string, string>);
        }
      }

      for (const file of files) {
        filesWithCaseInfo.push({
          id: file.id,
          driveFileId: file.drive_file_id,
          fileName: file.file_name,
          folderPath: file.folder_path,
          mimeType: file.mime_type,
          fileSize: file.file_size,
          caseId: file.case_id,
          caseName: file.case_id ? caseMap[file.case_id] : undefined,
          isLargeFile: file.is_large_file,
          createdAt: file.created_at,
        });
      }
    }

    const response: InboxListResponse = {
      success: true,
      files: filesWithCaseInfo,
      totalCount: files?.length || 0,
      ...(caseId && { caseId }),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Inbox] Unexpected error:', error);
    return NextResponse.json<InboxListResponse>(
      {
        success: false,
        files: [],
        totalCount: 0,
        error: '서버 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
};

export const GET = withTenant(handler);
