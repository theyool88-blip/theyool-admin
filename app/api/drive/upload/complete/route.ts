/**
 * POST /api/drive/upload/complete
 * Confirm upload completion and apply inbox classification rules
 */

import { NextRequest, NextResponse } from 'next/server';
import { withTenant } from '@/lib/api/with-tenant';
import { StorageService } from '@/lib/r2/storage-service';
import { createClient } from '@/lib/supabase/server';

interface CompleteUploadRequestBody {
  fileId: string;
  etag: string;
}

interface InboxRule {
  id: string;
  priority: number;
  is_active: boolean;
  conditions: {
    filename_pattern?: string;
    mime_type?: string;
    size_min?: number;
    size_max?: number;
  };
  actions: {
    move_to_folder?: string;
    set_doc_type?: string;
    set_doc_subtype?: string;
    set_client_visible?: boolean;
  };
}

export const POST = withTenant(async (request: NextRequest, { tenant }) => {
  try {
    // 1. Parse request body
    const body = (await request.json()) as CompleteUploadRequestBody;
    const { fileId, etag } = body;

    // 2. Validate required fields
    if (!fileId || !etag) {
      return NextResponse.json(
        { error: 'Missing required fields: fileId, etag' },
        { status: 400 }
      );
    }

    // 3. Verify file belongs to tenant
    const supabase = await createClient();
    const { data: file, error: fileError } = await supabase
      .from('r2_files')
      .select('id, tenant_id, original_name, mime_type, file_size')
      .eq('id', fileId)
      .eq('tenant_id', tenant.tenantId)
      .single();

    if (fileError || !file) {
      return NextResponse.json(
        { error: 'File not found or access denied' },
        { status: 404 }
      );
    }

    // 4. Complete upload (updates ETag and storage usage)
    await StorageService.completeUpload(fileId, etag);

    // 5. Apply inbox classification rules
    const { data: rules, error: rulesError } = await supabase
      .from('inbox_rules')
      .select('*')
      .eq('tenant_id', tenant.tenantId)
      .eq('is_active', true)
      .order('priority', { ascending: false });

    if (!rulesError && rules && rules.length > 0) {
      // Find first matching rule
      const matchingRule = rules.find((rule: InboxRule) => {
        const conditions = rule.conditions;

        // Check filename pattern
        if (conditions.filename_pattern) {
          const regex = new RegExp(conditions.filename_pattern, 'i');
          if (!regex.test(file.original_name)) {
            return false;
          }
        }

        // Check MIME type
        if (conditions.mime_type && file.mime_type) {
          const mimePattern = new RegExp(conditions.mime_type, 'i');
          if (!mimePattern.test(file.mime_type)) {
            return false;
          }
        }

        // Check size range
        if (conditions.size_min !== undefined && file.file_size) {
          if (file.file_size < conditions.size_min) {
            return false;
          }
        }

        if (conditions.size_max !== undefined && file.file_size) {
          if (file.file_size > conditions.size_max) {
            return false;
          }
        }

        return true;
      });

      // Apply actions from matching rule
      if (matchingRule) {
        const actions = matchingRule.actions;
        const updates: Record<string, unknown> = {};

        if (actions.move_to_folder) {
          updates.folder_id = actions.move_to_folder;
        }

        if (actions.set_doc_type) {
          updates.doc_type = actions.set_doc_type;
        }

        if (actions.set_doc_subtype) {
          updates.doc_subtype = actions.set_doc_subtype;
        }

        if (actions.set_client_visible !== undefined) {
          updates.client_visible = actions.set_client_visible;
        }

        // Apply updates if any actions were triggered
        if (Object.keys(updates).length > 0) {
          await StorageService.updateFile(fileId, updates);
        }
      }
    }

    // 6. Get final file state
    const { data: finalFile, error: finalError } = await supabase
      .from('r2_files')
      .select('*')
      .eq('id', fileId)
      .single();

    if (finalError) {
      return NextResponse.json(
        { error: 'Failed to retrieve final file state' },
        { status: 500 }
      );
    }

    // 7. Return success response
    return NextResponse.json({
      success: true,
      file: finalFile,
    });
  } catch (error) {
    console.error('Error completing upload:', error);

    if (error instanceof Error) {
      // Handle specific error messages
      if (error.message.includes('not found')) {
        return NextResponse.json(
          { error: error.message },
          { status: 404 }
        );
      }

      return NextResponse.json(
        { error: `Failed to complete upload: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
