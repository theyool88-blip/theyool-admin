'use client'

/**
 * Luseed Drive - Full-page file explorer
 *
 * A bold, utilitarian file management interface inspired by
 * brutalist design principles with functional clarity.
 */

import { AlertCircle, HardDrive, Loader2 } from 'lucide-react'
import FileExplorer from '@/components/drive/FileExplorer'
import { useTenant } from '@/hooks/useTenant'

export default function DrivePage() {
  const { tenantId, tenantName, isLoading, error } = useTenant()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--text-primary)]" />
          <p className="text-sm font-mono uppercase tracking-wider text-[var(--text-secondary)]">
            Loading Drive
          </p>
        </div>
      </div>
    )
  }

  if (error || !tenantId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
        <div className="max-w-md w-full mx-4">
          <div className="bg-[var(--bg-secondary)] border-2 border-[var(--color-danger)] rounded-lg p-8">
            <div className="flex items-start gap-4">
              <AlertCircle className="w-6 h-6 text-[var(--color-danger)] flex-shrink-0 mt-1" />
              <div>
                <h1 className="text-xl font-bold mb-2 text-[var(--text-primary)]">
                  드라이브 로드 오류
                </h1>
                <p className="text-sm text-[var(--text-secondary)]">
                  {error || '테넌트 정보를 불러올 수 없습니다'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col bg-[var(--bg-primary)]">
      {/* Header */}
      <header className="bg-[var(--bg-secondary)] border-b border-[var(--border-default)]">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <HardDrive className="w-5 h-5 text-[var(--sage-primary)]" />
              <h1 className="text-lg font-semibold text-[var(--text-primary)]">
                드라이브
              </h1>
            </div>
            <div className="text-sm text-[var(--text-secondary)]">
              {tenantName}
            </div>
          </div>
        </div>
      </header>

      {/* Main content area */}
      <main className="flex-1 overflow-hidden">
        <FileExplorer tenantId={tenantId} />
      </main>
    </div>
  )
}
