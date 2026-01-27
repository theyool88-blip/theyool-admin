/**
 * 팀원 초대 이메일 발송
 */

import { ROLE_DISPLAY_NAMES, MemberRole } from '@/types/tenant';

interface InviteEmailParams {
  to: string;
  inviteUrl: string;
  role: MemberRole;
  tenantName: string;
  inviterName?: string;
  expiresAt: Date;
}

/**
 * 초대 이메일 발송
 */
export async function sendInviteEmail(params: InviteEmailParams): Promise<{ success: boolean; error?: string }> {
  const resendApiKey = process.env.RESEND_API_KEY;

  if (!resendApiKey) {
    console.warn('RESEND_API_KEY not configured');
    return { success: false, error: 'RESEND_API_KEY가 설정되지 않았습니다.' };
  }

  const { to, inviteUrl, role, tenantName, inviterName, expiresAt } = params;
  const roleName = ROLE_DISPLAY_NAMES[role] || role;

  // 만료일 포맷
  const expiresDate = new Date(expiresAt).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const htmlContent = `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f5f5f5;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 500px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">

          <!-- Header -->
          <tr>
            <td style="background-color: #5a7a6b; padding: 32px 40px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 600;">
                팀원 초대
              </h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 24px 0; color: #374151; font-size: 15px; line-height: 1.6;">
                안녕하세요,
              </p>

              <p style="margin: 0 0 24px 0; color: #374151; font-size: 15px; line-height: 1.6;">
                <strong style="color: #1f2937;">${tenantName}</strong>에서 ${inviterName ? `<strong>${inviterName}</strong>님이 ` : ''}회원님을
                <strong style="color: #5a7a6b;">${roleName}</strong>(으)로 초대했습니다.
              </p>

              <p style="margin: 0 0 32px 0; color: #374151; font-size: 15px; line-height: 1.6;">
                아래 버튼을 클릭하여 초대를 수락하고 팀에 합류하세요.
              </p>

              <!-- CTA Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="text-align: center;">
                    <a href="${inviteUrl}"
                       style="display: inline-block; padding: 14px 32px; background-color: #5a7a6b; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; border-radius: 8px;">
                      초대 수락하기
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Link fallback -->
              <p style="margin: 32px 0 0 0; color: #6b7280; font-size: 13px; line-height: 1.5;">
                버튼이 작동하지 않으면 아래 링크를 브라우저에 복사하여 붙여넣으세요:
              </p>
              <p style="margin: 8px 0 0 0; word-break: break-all;">
                <a href="${inviteUrl}" style="color: #5a7a6b; font-size: 12px; text-decoration: underline;">
                  ${inviteUrl}
                </a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 8px 0; color: #9ca3af; font-size: 12px; text-align: center;">
                이 초대는 <strong>${expiresDate}</strong>까지 유효합니다.
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 12px; text-align: center;">
                본인이 요청하지 않은 초대라면 이 이메일을 무시해주세요.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: 'luseed <noreply@theyool.kr>',
        to: [to],
        subject: `[${tenantName}] 팀원으로 초대되었습니다`,
        html: htmlContent,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Resend API error:', errorData);
      return { success: false, error: '이메일 발송에 실패했습니다.' };
    }

    return { success: true };
  } catch (error) {
    console.error('Send invite email error:', error);
    return { success: false, error: '이메일 발송 중 오류가 발생했습니다.' };
  }
}
