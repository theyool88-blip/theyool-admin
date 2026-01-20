'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BarChart3, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import AnalyticsDashboard from '@/components/AnalyticsDashboard';
import { useTenant } from '@/hooks/useTenant';

export default function HomepageAnalyticsPage() {
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
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-48 bg-[var(--bg-secondary)] rounded" />
            <div className="h-96 bg-[var(--bg-secondary)] rounded-xl" />
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
        {/* 헤더 */}
        <div className="mb-8">
          <Link
            href="/admin/homepage"
            className="inline-flex items-center gap-1.5 text-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)] mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            홈페이지 관리
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--color-warning-muted)] flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-[var(--color-warning)]" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-[var(--text-primary)]">분석</h1>
              <p className="text-sm text-[var(--text-tertiary)]">방문자 행동 및 전환 분석</p>
            </div>
          </div>
        </div>

        {/* 애널리틱스 컴포넌트 */}
        <AnalyticsDashboard hasHomepage={true} />
      </main>
    </div>
  );
}
