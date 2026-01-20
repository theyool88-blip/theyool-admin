'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Settings, Globe, Clock, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import DomainSettings from '@/components/DomainSettings';
import HomepageSettings from '@/components/HomepageSettings';
import { useTenant } from '@/hooks/useTenant';

type TabType = 'domain' | 'consultation';

export default function HomepageSettingsPage() {
  const router = useRouter();
  const { hasHomepage, isLoading } = useTenant();
  const [activeTab, setActiveTab] = useState<TabType>('domain');

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

  const tabs: { id: TabType; label: string; icon: React.ElementType }[] = [
    { id: 'domain', label: '도메인', icon: Globe },
    { id: 'consultation', label: '상담 설정', icon: Clock },
  ];

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
            <div className="w-10 h-10 rounded-lg bg-[var(--sage-muted)] flex items-center justify-center">
              <Settings className="w-5 h-5 text-[var(--sage-primary)]" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-[var(--text-primary)]">홈페이지 설정</h1>
              <p className="text-sm text-[var(--text-tertiary)]">도메인 및 상담 설정을 관리합니다</p>
            </div>
          </div>
        </div>

        {/* 탭 네비게이션 */}
        <div className="border-b border-[var(--border-default)] mb-6">
          <nav className="flex gap-6">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 pb-3 border-b-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'border-[var(--sage-primary)] text-[var(--sage-primary)]'
                      : 'border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:border-[var(--border-default)]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* 탭 콘텐츠 */}
        <div>
          {activeTab === 'domain' && <DomainSettings hasHomepage={true} />}
          {activeTab === 'consultation' && <HomepageSettings hasHomepage={true} />}
        </div>
      </main>
    </div>
  );
}
