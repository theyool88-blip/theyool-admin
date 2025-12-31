/**
 * POST /api/auth/register/lawyer
 * 변호사 회원가입 API
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  LawyerRegistrationInput,
  registerLawyer,
  validatePassword,
  validateBarNumber,
} from '@/lib/auth/lawyer-registration';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 필수 필드 검증
    const requiredFields = ['email', 'password', 'name', 'officeName', 'officeType'];
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { success: false, error: `${field} 필드가 필요합니다.` },
          { status: 400 }
        );
      }
    }

    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      return NextResponse.json(
        { success: false, error: '올바른 이메일 형식이 아닙니다.' },
        { status: 400 }
      );
    }

    // 비밀번호 강도 검증
    const passwordValidation = validatePassword(body.password);
    if (!passwordValidation.valid) {
      return NextResponse.json(
        { success: false, error: passwordValidation.message },
        { status: 400 }
      );
    }

    // 사무소 유형 검증
    if (!['individual', 'firm'].includes(body.officeType)) {
      return NextResponse.json(
        { success: false, error: '사무소 유형이 올바르지 않습니다.' },
        { status: 400 }
      );
    }

    // 변호사 등록번호 검증 (입력된 경우에만)
    if (body.barNumber && !validateBarNumber(body.barNumber)) {
      return NextResponse.json(
        { success: false, error: '변호사 등록번호 형식이 올바르지 않습니다. (5-6자리 숫자)' },
        { status: 400 }
      );
    }

    // 회원가입 처리
    const input: LawyerRegistrationInput = {
      email: body.email,
      password: body.password,
      name: body.name,
      barNumber: body.barNumber,
      phone: body.phone,
      officeName: body.officeName,
      officeType: body.officeType,
      officePhone: body.officePhone,
      officeAddress: body.officeAddress,
      wantHomepage: body.wantHomepage || false,
    };

    // Admin client 사용 (사용자 생성 권한 필요)
    const supabase = createAdminClient();
    const result = await registerLawyer(supabase, input);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error, errorCode: result.errorCode },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '회원가입이 완료되었습니다. 이메일 인증 후 로그인해주세요.',
      data: {
        userId: result.userId,
        tenantId: result.tenantId,
      },
    });

  } catch (error) {
    console.error('Registration API error:', error);
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
