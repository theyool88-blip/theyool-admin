/**
 * Solapi SMS 발송 라이브러리
 * Solapi API를 통한 SMS/LMS 발송
 */

import type { SendResult, MessageType } from '@/types/notification';
import crypto from 'crypto';

// Solapi API 설정
const SOLAPI_API_URL = 'https://api.solapi.com/messages/v4/send';

// 사무소별 발신번호
export const OFFICE_PHONE_NUMBERS: Record<string, string> = {
  '평택': '0316473777',
  '천안': '0414175551',
  '전국': '16617633',
  'default': '16617633',
};

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

  // Solapi 인증: API Key + Secret을 Base64로 인코딩
  const timestamp = Date.now().toString();
  const salt = Math.random().toString(36).substring(2, 15);

  // HMAC-SHA256 서명 생성
  const signature = crypto
    .createHmac('sha256', apiSecret)
    .update(timestamp + salt)
    .digest('hex');

  return `HMAC-SHA256 apiKey=${apiKey}, date=${timestamp}, salt=${salt}, signature=${signature}`;
}

/**
 * 전화번호 정규화
 * 하이픈 제거, 01012345678 형식으로 변환
 */
function normalizePhone(phone: string): string {
  return phone.replace(/[^0-9]/g, '');
}

/**
 * SMS 발송 파라미터
 */
interface SendSMSParams {
  to: string;           // 수신자 전화번호
  message: string;      // 문자 내용
  from?: string;        // 발신자 번호 (환경변수에서 기본값 사용)
  messageType?: MessageType;
  subject?: string;     // LMS 제목
  office?: string;      // 사무소 (평택/천안) - 발신번호 자동 선택
}

/**
 * 사무소에 따른 발신번호 반환
 */
export function getFromNumberByOffice(office?: string): string {
  if (!office) return OFFICE_PHONE_NUMBERS['default'];
  return OFFICE_PHONE_NUMBERS[office] || OFFICE_PHONE_NUMBERS['default'];
}

/**
 * SMS 발송 함수
 */
export async function sendSMS({
  to,
  message,
  from,
  messageType = 'SMS',
  subject,
  office,
}: SendSMSParams): Promise<SendResult> {
  const authHeader = getAuthHeader();

  if (!authHeader) {
    console.log('[SMS 미발송 - API 키 미설정]');
    console.log(`  수신: ${to}`);
    console.log(`  내용: ${message.substring(0, 50)}...`);
    return {
      success: false,
      error: 'API 키가 설정되지 않았습니다.',
    };
  }

  // 발신번호 결정: 직접 지정 > 사무소별 > 환경변수 > 기본값
  const fromNumber = from || getFromNumberByOffice(office) || process.env.SOLAPI_FROM_NUMBER || '16617633';

  // 메시지 길이에 따라 SMS/LMS 자동 결정
  const actualMessageType = message.length > 90 ? 'LMS' : messageType;

  const requestBody = {
    message: {
      to: normalizePhone(to),
      from: normalizePhone(fromNumber),
      text: message,
      type: actualMessageType,
      ...(actualMessageType === 'LMS' && subject ? { subject } : {}),
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
      console.log('SMS 발송 성공:', {
        to,
        messageId: data.messageId,
        type: actualMessageType,
      });

      return {
        success: true,
        message_id: data.messageId,
        cost: actualMessageType === 'LMS' ? 60 : 20,
      };
    } else {
      console.error('SMS 발송 실패:', data);
      return {
        success: false,
        error: data.errorMessage || 'SMS 발송 실패',
      };
    }
  } catch (error) {
    console.error('SMS 발송 예외:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'SMS 발송 중 오류 발생',
    };
  }
}

/**
 * 대량 SMS 발송
 */
export async function sendBulkSMS(
  messages: Array<{
    to: string;
    message: string;
    subject?: string;
  }>,
  from?: string
): Promise<SendResult[]> {
  const results: SendResult[] = [];

  // 순차적으로 발송 (rate limiting 고려)
  for (const msg of messages) {
    const result = await sendSMS({
      to: msg.to,
      message: msg.message,
      subject: msg.subject,
      from,
    });
    results.push(result);

    // Rate limiting: 100ms 간격
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return results;
}

/**
 * SMS 글자 수 계산
 * 한글: 1자, 영문: 0.5자 (반올림)
 */
export function calculateSMSLength(text: string): {
  length: number;
  type: MessageType;
  cost: number;
} {
  let byteLength = 0;

  for (const char of text) {
    // 한글, 한자 등 멀티바이트 문자
    if (char.charCodeAt(0) > 127) {
      byteLength += 2;
    } else {
      byteLength += 1;
    }
  }

  // SMS: 90byte(한글 45자), LMS: 2000byte(한글 1000자)
  const isLMS = byteLength > 90;

  return {
    length: byteLength,
    type: isLMS ? 'LMS' : 'SMS',
    cost: isLMS ? 60 : 20,
  };
}

/**
 * 발송 가능 여부 확인
 */
export function isSMSConfigured(): boolean {
  return !!(process.env.SOLAPI_API_KEY && process.env.SOLAPI_API_SECRET);
}
