'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTenant } from '@/hooks/useTenant';
import ConsultationAvailability from '@/app/admin/settings/ConsultationAvailability';

export default function HomepageAvailabilityPage() {
  const router = useRouter();
  const { hasHomepage, isLoading } = useTenant();

  // 홈페이지 미활성화 시 리다이렉트
  useEffect(() => {
    if (!isLoading && !hasHomepage) {
      router.replace('/admin');
    }
  }, [hasHomepage, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)]">
        <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-[var(--bg-secondary)] rounded w-1/4" />
            <div className="h-64 bg-[var(--bg-secondary)] rounded-xl" />
          </div>
        </main>
      </div>
    );
  }

  if (!hasHomepage) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-[var(--text-primary)]">상담 시간 설정</h1>
          <p className="text-sm text-[var(--text-tertiary)] mt-1">
            홈페이지 예약 시스템에서 사용할 상담 가능 시간을 설정합니다.
          </p>
        </div>
        <ConsultationAvailability />
      </main>
    </div>
  );
}
