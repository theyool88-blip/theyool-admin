/**
 * SCOURT CSV 미리보기 API
 * CSV를 파싱하고 결과만 반환 (SCOURT API 호출 없음)
 */

import { NextRequest, NextResponse } from 'next/server';
import { parseCasenoteCSV, getParseResultSummary } from '@/lib/scourt/csv-parser';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    const body = await request.json();
    const { csvContent } = body;

    if (!csvContent) {
      return NextResponse.json({ error: 'CSV 내용이 필요합니다' }, { status: 400 });
    }

    // CSV 파싱
    const parsedCases = parseCasenoteCSV(csvContent);
    const summary = getParseResultSummary(parsedCases);

    return NextResponse.json({
      cases: parsedCases,
      summary,
    });

  } catch (error) {
    console.error('CSV 미리보기 에러:', error);
    return NextResponse.json(
      { error: 'CSV 파싱 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
