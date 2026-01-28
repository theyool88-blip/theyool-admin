'use client';

import { signIn, useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, Suspense } from 'react';

function LoginContent() {
  const { status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const error = searchParams?.get('error');

  useEffect(() => {
    if (status === 'authenticated') {
      router.push('/client');
    }
  }, [status, router]);

  const handleKakaoLogin = () => {
    signIn('kakao', { callbackUrl: '/client' });
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-[var(--sage-primary)] border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--bg-primary)] px-4">
      {/* 로고 */}
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">법무법인 더율</h1>
        <p className="text-sm text-[var(--text-tertiary)] mt-1">의뢰인 전용 페이지</p>
      </div>

      {/* 로그인 카드 */}
      <div className="w-full max-w-sm card rounded-xl shadow-lg p-8">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] text-center mb-6">
          로그인
        </h2>

        {error && (
          <div className="mb-4 p-3 bg-[var(--color-danger-muted)] border border-[var(--color-danger)]/20 rounded-lg">
            <p className="text-sm text-[var(--color-danger)] text-center">
              {error === 'AccessDenied'
                ? '등록된 의뢰인이 아닙니다. 수임 계약 시 등록된 전화번호로 로그인해주세요.'
                : '로그인 중 오류가 발생했습니다.'}
            </p>
          </div>
        )}

        <p className="text-sm text-[var(--text-secondary)] text-center mb-6">
          수임 계약 시 등록된 전화번호가 연결된
          <br />
          카카오 계정으로 로그인해주세요.
        </p>

        {/* 카카오 로그인 버튼 */}
        <button
          onClick={handleKakaoLogin}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium transition-colors"
          style={{ backgroundColor: '#FEE500', color: '#000000' }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M10 2C5.58172 2 2 4.94289 2 8.57143C2 10.8857 3.51472 12.9143 5.8 14.0571L4.95 17.4C4.9 17.5714 4.95 17.7714 5.1 17.8857C5.2 17.9714 5.35 18 5.5 18C5.6 18 5.7 17.9714 5.8 17.9143L9.7 15.0857C9.8 15.1143 9.9 15.1143 10 15.1143C14.4183 15.1143 18 12.1714 18 8.54286C18 4.94289 14.4183 2 10 2Z"
              fill="#000000"
            />
          </svg>
          카카오 로그인
        </button>

        <p className="text-xs text-[var(--text-muted)] text-center mt-4">
          로그인 시 전화번호 제공에 동의해주세요.
        </p>
      </div>

      {/* 안내 */}
      <div className="mt-8 text-center">
        <p className="text-xs text-[var(--text-muted)]">
          문의사항이 있으시면 1661-7633으로 연락주세요.
        </p>
      </div>
    </div>
  );
}

export default function ClientLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-[var(--sage-primary)] border-t-transparent"></div>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
