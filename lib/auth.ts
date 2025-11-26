/**
 * NextAuth.js 설정
 * 카카오 로그인을 통한 의뢰인 인증
 */

import { NextAuthOptions } from 'next-auth';
import KakaoProvider from 'next-auth/providers/kakao';
import { createClient } from '@/lib/supabase/server';

export const authOptions: NextAuthOptions = {
  providers: [
    KakaoProvider({
      clientId: process.env.KAKAO_CLIENT_ID!,
      clientSecret: process.env.KAKAO_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'profile_nickname phone_number',
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === 'kakao') {
        try {
          const supabase = await createClient();

          // 카카오에서 받은 전화번호로 의뢰인 조회
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const kakaoProfile = profile as any;
          const phoneNumber = kakaoProfile?.kakao_account?.phone_number;

          if (!phoneNumber) {
            console.log('카카오 전화번호 없음');
            return false;
          }

          // 전화번호 정규화 (+82 10-1234-5678 -> 01012345678)
          const normalizedPhone = normalizePhoneNumber(phoneNumber);

          // clients 테이블에서 전화번호로 조회
          const { data: client, error } = await supabase
            .from('clients')
            .select('id, name, phone')
            .eq('phone', normalizedPhone)
            .single();

          if (error || !client) {
            console.log('등록된 의뢰인이 아닙니다:', normalizedPhone);
            return false;
          }

          // kakao_id 업데이트 (최초 로그인 시)
          const kakaoId = String(kakaoProfile?.id);
          await supabase
            .from('clients')
            .update({ kakao_id: kakaoId })
            .eq('id', client.id);

          // user 객체에 client 정보 추가
          user.id = client.id;
          user.name = client.name;

          return true;
        } catch (error) {
          console.error('로그인 처리 중 오류:', error);
          return false;
        }
      }
      return true;
    },

    async jwt({ token, user, account, profile }) {
      if (account?.provider === 'kakao' && profile) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const kakaoProfile = profile as any;
        token.kakaoId = String(kakaoProfile?.id);
        token.phone = normalizePhoneNumber(kakaoProfile?.kakao_account?.phone_number || '');
      }
      if (user) {
        token.clientId = user.id;
        token.clientName = user.name || undefined;
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.clientId as string;
        session.user.name = token.clientName || undefined;
        session.kakaoId = token.kakaoId;
        session.clientId = token.clientId;
      }
      return session;
    },
  },
  pages: {
    signIn: '/client/login',
    error: '/client/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30일
  },
};

/**
 * 전화번호 정규화
 * +82 10-1234-5678 -> 01012345678
 * 010-1234-5678 -> 01012345678
 */
function normalizePhoneNumber(phone: string): string {
  if (!phone) return '';

  // 숫자만 추출
  let digits = phone.replace(/[^0-9]/g, '');

  // +82로 시작하면 0으로 변환
  if (digits.startsWith('82')) {
    digits = '0' + digits.slice(2);
  }

  return digits;
}
