'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import HomepageDashboard from '@/components/homepage/HomepageDashboard';
import { useTenant } from '@/hooks/useTenant';

export default function HomepageManagementPage() {
  const router = useRouter();
  const { hasHomepage, tenantSlug, isLoading } = useTenant();

  // 홈페이지 미활성화 시 리다이렉트
  useEffect(() => {
    if (!isLoading && !hasHomepage) {
      router.replace('/admin');
    }
  }, [hasHomepage, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)]">
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-32 bg-[var(--bg-secondary)] rounded-xl" />
            <div className="grid grid-cols-3 gap-4">
              <div className="h-24 bg-[var(--bg-secondary)] rounded-xl" />
              <div className="h-24 bg-[var(--bg-secondary)] rounded-xl" />
              <div className="h-24 bg-[var(--bg-secondary)] rounded-xl" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!hasHomepage) {
    return null; // Will redirect
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <HomepageDashboard tenantSlug={tenantSlug} />
      </main>
    </div>
  );
}
