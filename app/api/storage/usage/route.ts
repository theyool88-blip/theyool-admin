import { NextResponse } from 'next/server';
import { withTenant } from '@/lib/api/with-tenant';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/storage/usage
 * Get current storage usage for tenant
 */
export const GET = withTenant(async (request, { tenant }) => {
  try {
    if (!tenant.tenantId) {
      return NextResponse.json(
        { success: false, error: 'Tenant ID is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get storage usage from tenant_storage table
    const { data: storage, error } = await supabase
      .from('tenant_storage')
      .select('*')
      .eq('tenant_id', tenant.tenantId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to fetch storage usage: ${error.message}`);
    }

    // If storage record doesn't exist, create default
    if (!storage) {
      const { error: createError } = await supabase
        .from('tenant_storage')
        .insert({
          tenant_id: tenant.tenantId,
          quota_bytes: 53687091200, // 50GB default
          extra_quota_bytes: 0,
          used_bytes: 0,
          file_count: 0,
        })
        .select()
        .single();

      if (createError) {
        throw new Error(`Failed to create storage record: ${createError.message}`);
      }

      const totalQuota = 53687091200;
      const percentUsed = 0;

      return NextResponse.json({
        success: true,
        usage: {
          usedBytes: 0,
          quotaBytes: 53687091200,
          extraQuotaBytes: 0,
          totalQuotaBytes: totalQuota,
          fileCount: 0,
          percentUsed,
          byType: {
            documents: 0,
            images: 0,
            other: 0,
          },
        },
      });
    }

    // Calculate totals
    const totalQuotaBytes = (storage.quota_bytes || 0) + (storage.extra_quota_bytes || 0);
    const usedBytes = storage.used_bytes || 0;
    const percentUsed = totalQuotaBytes > 0 ? (usedBytes / totalQuotaBytes) * 100 : 0;

    // Get file counts by type (MIME type categorization)
    const { data: files } = await supabase
      .from('r2_files')
      .select('mime_type, file_size')
      .eq('tenant_id', tenant.tenantId);

    // Categorize by MIME type
    let documentBytes = 0;
    let imageBytes = 0;
    let otherBytes = 0;

    (files || []).forEach((file) => {
      const size = file.file_size || 0;
      const mimeType = file.mime_type || '';

      if (mimeType.startsWith('application/pdf') || mimeType.includes('document') || mimeType.includes('text')) {
        documentBytes += size;
      } else if (mimeType.startsWith('image/')) {
        imageBytes += size;
      } else {
        otherBytes += size;
      }
    });

    return NextResponse.json({
      success: true,
      usage: {
        usedBytes: storage.used_bytes || 0,
        quotaBytes: storage.quota_bytes || 0,
        extraQuotaBytes: storage.extra_quota_bytes || 0,
        totalQuotaBytes,
        fileCount: storage.file_count || 0,
        percentUsed: Math.round(percentUsed * 100) / 100,
        byType: {
          documents: documentBytes,
          images: imageBytes,
          other: otherBytes,
        },
      },
    });
  } catch (error) {
    console.error('Storage usage fetch error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch storage usage',
      },
      { status: 500 }
    );
  }
});
