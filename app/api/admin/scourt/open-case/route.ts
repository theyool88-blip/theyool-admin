/**
 * SCOURT 사건 페이지(일반내용 탭) 열기 API
 *
 * POST /api/admin/scourt/open-case
 *
 * 이 기능은 Cloudflare 환경에서는 지원되지 않습니다.
 * Puppeteer가 필요하며, 로컬 환경에서만 실행 가능합니다.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withTenant } from '@/lib/api/with-tenant';

export const POST = withTenant(async (
  _request: NextRequest,
  { tenant: _tenant }
) => {
  // Puppeteer 기능은 Cloudflare에서 지원되지 않음
  return NextResponse.json(
    {
      success: false,
      error: '이 기능은 서버리스 환경에서 지원되지 않습니다. 브라우저 자동화가 필요한 기능입니다.'
    },
    { status: 501 }
  );
});
