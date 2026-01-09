/**
 * POST /api/admin/contracts/upload
 * 계약서 파일 업로드
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { withTenant, withTenantId } from '@/lib/api/with-tenant';

const ALLOWED_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export const POST = withTenant(async (request, { tenant }) => {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const legalCaseId = formData.get('legalCaseId') as string | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: '파일이 필요합니다.' },
        { status: 400 }
      );
    }

    // 파일 유효성 검사
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: 'PDF, 이미지(PNG, JPG), Word 파일만 업로드 가능합니다.' },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { success: false, error: '파일 크기는 10MB 이하여야 합니다.' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // 파일명 생성 (중복 방지를 위해 타임스탬프 추가)
    const timestamp = Date.now();
    const ext = file.name.split('.').pop() || 'pdf';
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9가-힣._-]/g, '_');
    const caseFolder = legalCaseId || 'pending';
    const fileName = `${tenant.tenantId}/${caseFolder}/${timestamp}_${sanitizedName}`;

    // 파일 업로드
    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from('case-contracts')
      .upload(fileName, arrayBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('Contract upload error:', uploadError);
      return NextResponse.json(
        { success: false, error: '파일 업로드에 실패했습니다.' },
        { status: 500 }
      );
    }

    // 공개 URL 가져오기
    const { data: urlData } = supabase.storage
      .from('case-contracts')
      .getPublicUrl(fileName);

    const publicUrl = urlData.publicUrl;

    // 사건 ID가 있으면 case_contracts 테이블에 기록
    let contractRecord = null;
    if (legalCaseId) {
      const { data: inserted, error: insertError } = await supabase
        .from('case_contracts')
        .insert([withTenantId({
          legal_case_id: legalCaseId,
          file_name: file.name,
          file_path: fileName,
          file_size: file.size,
          file_type: file.type,
        }, tenant)])
        .select()
        .single();

      if (insertError) {
        console.error('Contract record insert error:', insertError);
        // 파일은 업로드되었지만 DB 기록 실패 - 경고만 하고 계속 진행
      } else {
        contractRecord = inserted;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        id: contractRecord?.id || null,
        fileName: file.name,
        filePath: fileName,
        fileSize: file.size,
        fileType: file.type,
        publicUrl,
      },
    });

  } catch (error) {
    console.error('Contract upload API error:', error);
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
});

/**
 * DELETE /api/admin/contracts/upload
 * 계약서 파일 삭제
 */
export const DELETE = withTenant(async (request, { tenant }) => {
  try {
    const { searchParams } = new URL(request.url);
    const contractId = searchParams.get('id');
    const filePath = searchParams.get('filePath');

    if (!contractId && !filePath) {
      return NextResponse.json(
        { success: false, error: 'id 또는 filePath가 필요합니다.' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    let pathToDelete = filePath;

    // contractId로 삭제하는 경우
    if (contractId) {
      // 레코드 조회
      const { data: contract, error: fetchError } = await supabase
        .from('case_contracts')
        .select('file_path, tenant_id')
        .eq('id', contractId)
        .single();

      if (fetchError || !contract) {
        return NextResponse.json(
          { success: false, error: '계약서를 찾을 수 없습니다.' },
          { status: 404 }
        );
      }

      // 테넌트 확인
      if (contract.tenant_id !== tenant.tenantId && !tenant.isSuperAdmin) {
        return NextResponse.json(
          { success: false, error: '삭제 권한이 없습니다.' },
          { status: 403 }
        );
      }

      pathToDelete = contract.file_path;

      // DB 레코드 삭제
      await supabase
        .from('case_contracts')
        .delete()
        .eq('id', contractId);
    }

    // 스토리지에서 파일 삭제
    if (pathToDelete) {
      // 테넌트 경로 확인 (보안)
      if (!pathToDelete.startsWith(tenant.tenantId) && !tenant.isSuperAdmin) {
        return NextResponse.json(
          { success: false, error: '삭제 권한이 없습니다.' },
          { status: 403 }
        );
      }

      const { error: deleteError } = await supabase.storage
        .from('case-contracts')
        .remove([pathToDelete]);

      if (deleteError) {
        console.error('Storage delete error:', deleteError);
        // 스토리지 삭제 실패해도 DB 레코드는 이미 삭제됨
      }
    }

    return NextResponse.json({
      success: true,
      message: '계약서가 삭제되었습니다.',
    });

  } catch (error) {
    console.error('Contract delete API error:', error);
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
});
