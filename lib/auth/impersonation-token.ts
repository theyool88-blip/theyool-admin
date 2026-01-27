/**
 * Impersonation Token Signing/Verification
 *
 * 슈퍼 어드민 대리 접속 토큰의 무결성을 보장하기 위한 서명/검증 유틸리티
 * HMAC-SHA256을 사용하여 토큰 위조를 방지합니다.
 */

import { createHmac } from 'crypto';

// 환경 변수에서 시크릿 키를 가져옵니다. 없으면 개발 환경용 기본값 사용 (프로덕션에서는 반드시 설정 필요)
const SECRET = process.env.IMPERSONATION_SECRET || (
  process.env.NODE_ENV === 'development'
    ? 'dev-impersonation-secret-please-change-in-production'
    : undefined
);

if (!SECRET && process.env.NODE_ENV === 'production') {
  console.error('CRITICAL: IMPERSONATION_SECRET environment variable is not set in production!');
}

export interface ImpersonationPayload {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  impersonatedAt: string;
  expiresAt: string;
  superAdminUserId: string; // 대리 접속을 시작한 슈퍼어드민 ID
}

/**
 * 서명된 토큰 생성
 * @param payload - 토큰에 포함될 데이터
 * @returns Base64로 인코딩된 서명된 토큰
 */
export function signToken(payload: ImpersonationPayload): string {
  if (!SECRET) {
    throw new Error('IMPERSONATION_SECRET is not configured');
  }

  const data = JSON.stringify(payload);
  const signature = createHmac('sha256', SECRET).update(data).digest('hex');

  return Buffer.from(JSON.stringify({
    data,
    signature,
    version: 1  // 향후 토큰 형식 변경 시 버전 관리용
  })).toString('base64');
}

/**
 * 서명된 토큰 검증 및 디코딩
 * @param token - Base64로 인코딩된 서명된 토큰
 * @returns 검증 성공 시 payload, 실패 시 null
 */
export function verifyToken(token: string): ImpersonationPayload | null {
  if (!SECRET) {
    console.error('IMPERSONATION_SECRET is not configured');
    return null;
  }

  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString());

    // 버전 체크 (선택적)
    if (decoded.version && decoded.version !== 1) {
      console.warn('Unknown token version:', decoded.version);
      return null;
    }

    const { data, signature } = decoded;

    if (!data || !signature) {
      console.warn('Invalid token structure');
      return null;
    }

    // 서명 검증
    const expected = createHmac('sha256', SECRET).update(data).digest('hex');

    // Timing-safe 비교 (타이밍 공격 방지)
    if (!timingSafeEqual(signature, expected)) {
      console.warn('Token signature mismatch');
      return null;
    }

    const payload = JSON.parse(data) as ImpersonationPayload;

    // 필수 필드 검증
    if (!payload.tenantId || !payload.expiresAt || !payload.superAdminUserId) {
      console.warn('Missing required fields in token payload');
      return null;
    }

    return payload;
  } catch (error) {
    console.warn('Token verification failed:', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

/**
 * 토큰 만료 여부 확인
 * @param payload - 검증된 토큰 payload
 * @returns 만료 여부
 */
export function isTokenExpired(payload: ImpersonationPayload): boolean {
  const expiresAt = new Date(payload.expiresAt);
  return expiresAt < new Date();
}

/**
 * Timing-safe string comparison
 * 타이밍 공격을 방지하기 위한 일정 시간 비교
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}
