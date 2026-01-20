'use client'

import Link from 'next/link'
import ConsultationAvailability from './ConsultationAvailability'

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <div className="max-w-5xl mx-auto pt-6 pb-8 px-4">
        {/* 탭 네비게이션 */}
        <div className="flex items-center gap-3 mb-5 text-sm">
          <div className="flex bg-[var(--bg-tertiary)] rounded-lg p-0.5">
            <span className="px-3 py-1.5 rounded-md bg-[var(--bg-secondary)] shadow-sm font-medium text-[var(--text-primary)]">
              상담 시간
            </span>
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
            <Link
              href="/admin/settings/alerts"
              className="px-3 py-1.5 rounded-md transition-colors text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
            >
              알림
            </Link>
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

        {/* 상담 시간 컴포넌트 */}
        <ConsultationAvailability />
      </div>
    </div>
  )
}
