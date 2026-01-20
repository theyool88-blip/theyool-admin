'use client';

import Link from 'next/link';
import { ArrowLeft, Bell } from 'lucide-react';
import AlertSettings from '@/components/AlertSettings';

export default function AlertSettingsPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Header */}
      <header className="bg-[var(--bg-secondary)] border-b border-[var(--border-default)]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Link
                href="/admin/settings"
                className="p-2 hover:bg-[var(--bg-hover)] rounded -ml-2"
              >
                <ArrowLeft className="w-4 h-4 text-[var(--text-tertiary)]" />
              </Link>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[var(--color-warning-muted)] flex items-center justify-center">
                  <Bell className="w-4 h-4 text-[var(--color-warning)]" />
                </div>
                <h1 className="text-lg font-bold text-[var(--text-primary)]">알림 설정</h1>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 탭 네비게이션 */}
        <div className="flex items-center gap-3 mb-5 text-sm">
          <div className="flex bg-[var(--bg-tertiary)] rounded-lg p-0.5">
            <Link
              href="/admin/settings"
              className="px-3 py-1.5 rounded-md transition-colors text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
            >
              상담 시간
            </Link>
            <Link
              href="/admin/settings/sources"
              className="px-3 py-1.5 rounded-md transition-colors text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
            >
              유입 경로
            </Link>
            <Link
              href="/admin/settings/team"
              className="px-3 py-1.5 rounded-md transition-colors text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
            >
              팀원 관리
            </Link>
            <span className="px-3 py-1.5 rounded-md bg-[var(--bg-secondary)] shadow-sm font-medium text-[var(--text-primary)]">
              알림
            </span>
            <Link
              href="/admin/settings/integrations"
              className="px-3 py-1.5 rounded-md transition-colors text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
            >
              연동
            </Link>
            <Link
              href="/admin/settings/tenant"
              className="px-3 py-1.5 rounded-md transition-colors text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
            >
              사무소
            </Link>
          </div>
        </div>

        {/* AlertSettings Component */}
        <AlertSettings hasHomepage={true} />
      </main>
    </div>
  );
}
