/**
 * GET /api/admin/cases/[id]/contracts
 * 해당 사건의 계약서 파일 목록 조회
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isAuthenticated } from '@/lib/auth/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: caseId } = await params;

    if (!caseId) {
      return NextResponse.json(
        { success: false, error: '사건 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // 계약서 파일 목록 조회
    const { data: contracts, error: contractsError } = await supabase
      .from('case_contracts')
      .select('id, file_name, file_path, file_size, file_type, uploaded_at')
      .eq('legal_case_id', caseId)
      .order('uploaded_at', { ascending: false });

    if (contractsError) {
      // 테이블이 없으면 빈 배열 반환
      if (contractsError.code === '42P01') {
        return NextResponse.json({ success: true, contracts: [] });
      }
      console.error('계약서 조회 오류:', contractsError);
      return NextResponse.json(
        { success: false, error: '계약서 조회에 실패했습니다.' },
        { status: 500 }
      );
    }

    // 각 파일의 public URL 생성
    const contractsWithUrl = (contracts || []).map(contract => {
      const { data: urlData } = supabase.storage
        .from('case-contracts')
        .getPublicUrl(contract.file_path);

      return {
        ...contract,
        publicUrl: urlData.publicUrl
      };
    });

    return NextResponse.json({
      success: true,
      contracts: contractsWithUrl
    });

  } catch (error) {
    console.error('계약서 목록 API 오류:', error);
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
