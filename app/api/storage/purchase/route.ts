import { NextResponse } from 'next/server';
import { withTenant } from '@/lib/api/with-tenant';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/storage/purchase
 * Request additional storage quota
 *
 * This is a placeholder for actual payment integration.
 * For now, it just records the request in the database.
 */
export const POST = withTenant(async (request, { tenant }) => {
  try {
    if (!tenant.tenantId) {
      return NextResponse.json(
        { success: false, error: 'Tenant ID is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { additionalGB } = body;

    // Validate input
    if (!additionalGB || typeof additionalGB !== 'number' || additionalGB <= 0) {
      return NextResponse.json(
        { success: false, error: 'Valid additionalGB (number > 0) is required' },
        { status: 400 }
      );
    }

    // Common addon sizes: 30GB, 100GB
    if (![30, 100].includes(additionalGB)) {
      return NextResponse.json(
        { success: false, error: 'Only 30GB or 100GB addons are available' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const additionalBytes = additionalGB * 1024 * 1024 * 1024; // Convert GB to bytes

    // Get or create storage record
    let storage: any;
    let fetchError: any;
    ({ data: storage, error: fetchError } = await supabase
      .from('tenant_storage')
      .select('*')
      .eq('tenant_id', tenant.tenantId)
      .single());

    if (fetchError && fetchError.code !== 'PGRST116') {
      throw new Error(`Failed to fetch storage record: ${fetchError.message}`);
    }

    // Create if doesn't exist
    if (!storage) {
      const { data: created, error: createError } = await supabase
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

      storage = created;
    }

    // Calculate new quota
    const newExtraQuotaBytes = (storage.extra_quota_bytes || 0) + additionalBytes;
    const now = new Date();

    // Update storage with additional quota
    const { data: updated, error: updateError } = await supabase
      .from('tenant_storage')
      .update({
        extra_quota_bytes: newExtraQuotaBytes,
        extra_quota_started_at: storage.extra_quota_started_at || now.toISOString(),
        // Set expiry to 1 year from now (for subscription model)
        extra_quota_expires_at: new Date(now.getFullYear() + 1, now.getMonth(), now.getDate()).toISOString(),
      })
      .eq('tenant_id', tenant.tenantId)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to update storage quota: ${updateError.message}`);
    }

    const totalQuotaBytes = (updated.quota_bytes || 0) + (updated.extra_quota_bytes || 0);

    // TODO: Integration with payment system
    // - Create payment record
    // - Trigger payment gateway
    // - Update based on payment confirmation
    // For now, this is just a placeholder that records the request

    return NextResponse.json({
      success: true,
      message: `Successfully added ${additionalGB}GB to your storage quota. (This is a preview - payment integration pending)`,
      newQuota: {
        quotaBytes: updated.quota_bytes || 0,
        extraQuotaBytes: updated.extra_quota_bytes || 0,
        totalQuotaBytes,
      },
    });
  } catch (error) {
    console.error('Storage purchase error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to purchase additional storage',
      },
      { status: 500 }
    );
  }
});
