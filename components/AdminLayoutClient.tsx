'use client'

import { useState, useEffect } from 'react'
import AdminSidebar from '@/components/AdminSidebar'
import { Menu } from 'lucide-react'

interface AdminLayoutClientProps {
  children: React.ReactNode
  /** 캘린더처럼 전체 화면을 꽉 채워야 하는 페이지용 */
  fullHeight?: boolean
}

export default function AdminLayoutClient({ children, fullHeight = false }: AdminLayoutClientProps) {
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  // ESC 키로 모바일 사이드바 닫기
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMobileOpen) {
        setIsMobileOpen(false)
      }
    }

    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [isMobileOpen])

  // 모바일 사이드바 열릴 때 스크롤 방지
  useEffect(() => {
    if (isMobileOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }

    return () => {
      document.body.style.overflow = ''
    }
  }, [isMobileOpen])

  return (
    <div className={`flex bg-[var(--bg-primary)] ${fullHeight ? 'h-screen overflow-hidden' : 'min-h-screen'}`}>
      {/* 모바일 햄버거 버튼 */}
      {!isMobileOpen && (
        <button
          onClick={() => setIsMobileOpen(true)}
          className="md:hidden fixed top-4 left-4 z-30 p-2.5 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-default)] shadow-lg flex items-center justify-center"
          aria-label="메뉴 열기"
        >
          <Menu className="w-5 h-5 text-[var(--text-secondary)]" />
        </button>
      )}

      {/* 사이드바 */}
      <AdminSidebar
        isMobileOpen={isMobileOpen}
        onMobileClose={() => setIsMobileOpen(false)}
      />

      {/* 메인 콘텐츠 */}
      <main className={`flex-1 ${fullHeight ? 'h-full overflow-hidden' : 'min-h-screen'}`}>
        <div className={fullHeight ? 'h-full flex flex-col pt-14 md:pt-2 px-2 md:px-4 pb-2' : 'p-4 md:p-6 pt-16 md:pt-6'}>
          {children}
        </div>
      </main>
    </div>
  )
}
