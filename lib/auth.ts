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
          scope: 'profile_nickname',
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === 'kakao') {
        try {
          const supabase = await createClient();

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const kakaoProfile = profile as any;
          const kakaoId = String(kakaoProfile?.id);

          if (!kakaoId) {
            console.log('카카오 ID 없음');
            return false;
          }

          // 1. 먼저 kakao_id로 기존 의뢰인 조회
          const { data: existingClient } = await supabase
            .from('clients')
            .select('id, name')
            .eq('kakao_id', kakaoId)
            .single();

          if (existingClient) {
            // 이미 연동된 의뢰인
            user.id = existingClient.id;
            user.name = existingClient.name;
            return true;
          }

          // 2. kakao_id가 없으면 - 최초 로그인
          // 관리자가 미리 등록한 의뢰인 중 kakao_id가 null인 건 있는지 확인
          // (의뢰인이 처음 로그인할 때 연동되도록)
          // 이 경우 의뢰인에게 초대 코드를 사용하도록 안내
          console.log('신규 카카오 로그인 시도:', kakaoId);

          // 신규 사용자는 /client/register 페이지로 리다이렉트하여 초대코드 입력하도록
          // 여기서는 일단 로그인 허용하고, 페이지에서 처리
          user.id = `kakao_${kakaoId}`;
          user.name = kakaoProfile?.kakao_account?.profile?.nickname || '의뢰인';

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
        token.nickname = kakaoProfile?.kakao_account?.profile?.nickname;
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
