/**
 * 카카오 알림톡 발송 라이브러리
 * Solapi API를 통한 카카오 알림톡 발송
 *
 * 참고: 알림톡은 카카오 비즈니스 채널 등록 및 템플릿 승인이 필요합니다.
 * https://developers.solapi.com/references/kakao-alimtalk
 */

import type { SendResult } from '@/types/notification';

// Solapi API 설정
const SOLAPI_API_URL = 'https://api.solapi.com/messages/v4/send';

/**
 * Solapi 인증 헤더 생성
 */
function getAuthHeader(): string | null {
  const apiKey = process.env.SOLAPI_API_KEY;
  const apiSecret = process.env.SOLAPI_API_SECRET;

  if (!apiKey || !apiSecret) {
    console.warn('SOLAPI_API_KEY or SOLAPI_API_SECRET is not configured');
    return null;
  }

  const timestamp = Date.now().toString();
  const salt = Math.random().toString(36).substring(2, 15);

  const crypto = require('crypto');
  const signature = crypto
    .createHmac('sha256', apiSecret)
    .update(timestamp + salt)
    .digest('hex');

  return `HMAC-SHA256 apiKey=${apiKey}, date=${timestamp}, salt=${salt}, signature=${signature}`;
}

/**
 * 전화번호 정규화
 */
function normalizePhone(phone: string): string {
  return phone.replace(/[^0-9]/g, '');
}

/**
 * 알림톡 발송 파라미터
 */
interface SendAlimtalkParams {
  to: string;                    // 수신자 전화번호
  templateId: string;            // 카카오 승인 템플릿 ID
  variables?: Record<string, string>; // 템플릿 변수
  buttons?: AlimtalkButton[];    // 버튼 (선택)
  fallbackSMS?: boolean;         // 발송 실패시 SMS로 대체 발송
  fallbackMessage?: string;      // 대체 SMS 메시지
}

/**
 * 알림톡 버튼 타입
 */
interface AlimtalkButton {
  type: 'WL' | 'AL' | 'BK' | 'MD' | 'DS';
  // WL: 웹링크, AL: 앱링크, BK: 봇 키워드, MD: 메시지 전달, DS: 배송조회
  name: string;
  linkMobile?: string;
  linkPc?: string;
  schemeIos?: string;
  schemeAndroid?: string;
}

/**
 * 카카오 알림톡 발송
 */
export async function sendAlimtalk({
  to,
  templateId,
  variables = {},
  buttons,
  fallbackSMS = true,
  fallbackMessage,
}: SendAlimtalkParams): Promise<SendResult> {
  const authHeader = getAuthHeader();
  const pfId = process.env.SOLAPI_KAKAO_PFID;

  if (!authHeader) {
    console.log('[알림톡 미발송 - API 키 미설정]');
    return {
      success: false,
      error: 'API 키가 설정되지 않았습니다.',
    };
  }

  if (!pfId) {
    console.log('[알림톡 미발송 - 카카오 채널 ID 미설정]');
    return {
      success: false,
      error: '카카오 채널 ID(PFID)가 설정되지 않았습니다.',
    };
  }

  const requestBody = {
    message: {
      to: normalizePhone(to),
      from: process.env.SOLAPI_FROM_NUMBER,
      kakaoOptions: {
        pfId,
        templateId,
        variables,
        ...(buttons && buttons.length > 0 ? { buttons } : {}),
        // SMS 대체 발송 설정
        ...(fallbackSMS
          ? {
              disableSms: false,
              content: fallbackMessage,
            }
          : { disableSms: true }),
      },
    },
  };

  try {
    const response = await fetch(SOLAPI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();

    if (response.ok && data.statusCode === '2000') {
      console.log('알림톡 발송 성공:', {
        to,
        messageId: data.messageId,
        templateId,
      });

      return {
        success: true,
        message_id: data.messageId,
        cost: 15, // 알림톡 기본 단가 (협의 필요)
      };
    } else {
      console.error('알림톡 발송 실패:', data);
      return {
        success: false,
        error: data.errorMessage || '알림톡 발송 실패',
      };
    }
  } catch (error) {
    console.error('알림톡 발송 예외:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '알림톡 발송 중 오류 발생',
    };
  }
}

/**
 * 대량 알림톡 발송
 */
export async function sendBulkAlimtalk(
  messages: Array<{
    to: string;
    templateId: string;
    variables?: Record<string, string>;
  }>
): Promise<SendResult[]> {
  const results: SendResult[] = [];

  for (const msg of messages) {
    const result = await sendAlimtalk({
      to: msg.to,
      templateId: msg.templateId,
      variables: msg.variables,
    });
    results.push(result);

    // Rate limiting
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return results;
}

/**
 * 알림톡 설정 확인
 */
export function isAlimtalkConfigured(): boolean {
  return !!(
    process.env.SOLAPI_API_KEY &&
    process.env.SOLAPI_API_SECRET &&
    process.env.SOLAPI_KAKAO_PFID
  );
}

/**
 * 카카오 채널 정보 (환경변수에서)
 */
export function getKakaoChannelInfo() {
  return {
    pfId: process.env.SOLAPI_KAKAO_PFID || '',
    configured: isAlimtalkConfigured(),
  };
}
