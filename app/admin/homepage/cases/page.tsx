'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import HomepageCasesManagement from '@/components/homepage/HomepageCasesManagement';
import { useTenant } from '@/hooks/useTenant';

export default function CasesManagementPage() {
  const router = useRouter();
  const { hasHomepage, isLoading } = useTenant();

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
            <div className="h-12 bg-[var(--bg-secondary)] rounded-lg w-1/3" />
            <div className="h-32 bg-[var(--bg-secondary)] rounded-xl" />
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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <HomepageCasesManagement />
      </main>
    </div>
  );
}
