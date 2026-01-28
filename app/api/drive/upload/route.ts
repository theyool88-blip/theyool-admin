/**
 * POST /api/drive/upload
 * Generate presigned upload URL for file upload
 */

import { NextRequest, NextResponse } from 'next/server';
import { withTenant } from '@/lib/api/with-tenant';
import { StorageService } from '@/lib/r2/storage-service';

interface UploadRequestBody {
  folderId?: string;
  caseId?: string;
  filename: string;
  fileSize: number;
  mimeType: string;
}

export const POST = withTenant(async (request: NextRequest, { tenant }) => {
  try {
    // 1. Parse request body
    const body = (await request.json()) as UploadRequestBody;
    const { folderId, caseId, filename, fileSize, mimeType } = body;

    // 2. Validate required fields
    if (!filename || typeof fileSize !== 'number' || !mimeType) {
      return NextResponse.json(
        { error: 'Missing required fields: filename, fileSize, mimeType' },
        { status: 400 }
      );
    }

    // 3. Validate file size (max 500MB)
    const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB
    if (fileSize > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File size exceeds maximum allowed size of 500MB` },
        { status: 413 }
      );
    }

    if (fileSize <= 0) {
      return NextResponse.json(
        { error: 'Invalid file size' },
        { status: 400 }
      );
    }

    // 4. Check storage quota
    const quotaCheck = await StorageService.checkQuota(tenant.tenantId, fileSize);
    if (!quotaCheck.allowed) {
      return NextResponse.json(
        {
          error: 'Storage quota exceeded',
          details: {
            required: fileSize,
            remaining: quotaCheck.remaining,
          },
        },
        { status: 413 }
      );
    }

    // 5. Generate upload URL and create file record
    const { fileId, uploadUrl } = await StorageService.uploadFile({
      tenantId: tenant.tenantId,
      folderId: folderId || undefined,
      caseId: caseId || undefined,
      file: {
        name: filename,
        size: fileSize,
        type: mimeType,
      },
      uploadedBy: tenant.memberId,
    });

    // 6. Calculate expiration (presigned URLs typically expire in 60 minutes)
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    // 7. Return success response
    return NextResponse.json({
      success: true,
      uploadUrl,
      fileId,
      expiresAt,
    });
  } catch (error) {
    console.error('Error generating upload URL:', error);

    if (error instanceof Error) {
      // Handle specific error messages
      if (error.message.includes('quota exceeded')) {
        return NextResponse.json(
          { error: error.message },
          { status: 413 }
        );
      }

      if (error.message.includes('not found')) {
        return NextResponse.json(
          { error: error.message },
          { status: 404 }
        );
      }

      return NextResponse.json(
        { error: `Failed to generate upload URL: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
