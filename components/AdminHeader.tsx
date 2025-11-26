'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface AdminHeaderProps {
  title: string
  subtitle?: string
}

export default function AdminHeader({ title, subtitle }: AdminHeaderProps) {
  const router = useRouter()
  const supabase = createClient()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const canPortal = typeof document !== 'undefined'

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const menuItems = [
    { href: '/admin', label: 'ADMIN' },
    { href: '/schedules', label: '일정' },
    { href: '/cases', label: '사건' },
    { href: '/admin/consultations', label: '상담' },
    { href: '/admin/expenses', label: '지출 관리' },
    { href: '/admin/payments', label: '입금 관리' },
    { href: '/admin/receivables', label: '미수금' },
    { href: '/admin/notifications', label: '알림' },
    { href: '/admin/settings', label: '설정' }
  ]

  return (
    <header className="fixed top-0 left-0 right-0 z-[19998] bg-white/95 backdrop-blur-sm border-b border-sage-200">
      <nav className="max-w-[1200px] mx-auto px-8 sm:px-16 md:px-20">
        <div className="flex justify-between items-center h-16">
          {/* 왼쪽: 햄버거 메뉴 (모바일) + 로고 (데스크톱) */}
          <div className="flex items-center gap-4">
            {/* 모바일 햄버거 버튼 */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2.5 text-sage-600 hover:text-sage-800 hover:bg-sage-100 rounded-xl transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-expanded={isMobileMenuOpen}
              aria-label="모바일 메뉴 열기"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* 로고 (데스크톱) */}
            <Link href="/" className="hidden lg:flex items-center gap-3">
              <Image
                src="/images/logo-horizontal.png"
                alt="법무법인 더율"
                width={180}
                height={45}
                className="h-6 md:h-7 w-auto"
                style={{ filter: 'brightness(0) saturate(100%) invert(46%) sepia(13%) saturate(1243%) hue-rotate(118deg) brightness(93%) contrast(87%)' }}
                priority
              />
              <div className="border-l border-sage-300 pl-3">
                <div className="text-sm font-semibold text-sage-800">{title}</div>
                {subtitle && (
                  <div className="text-xs text-sage-600">{subtitle}</div>
                )}
              </div>
            </Link>
          </div>

          {/* 중앙: 로고 (모바일) */}
          <div className="absolute left-1/2 transform -translate-x-1/2 lg:hidden">
            <Link href="/">
              <Image
                src="/images/logo-horizontal.png"
                alt="법무법인 더율"
                width={180}
                height={45}
                className="h-6 w-auto cursor-pointer"
                style={{ filter: 'brightness(0) saturate(100%) invert(46%) sepia(13%) saturate(1243%) hue-rotate(118deg) brightness(93%) contrast(87%)' }}
                priority
              />
            </Link>
          </div>

          {/* 오른쪽: 데스크톱 네비게이션 */}
          <div className="hidden lg:flex items-center gap-2">
            {menuItems.map((item) => (
              <Link
                key={`${item.href}-${item.label}`}
                href={item.href}
                className="px-3 py-2 text-sm font-medium text-sage-700 hover:text-sage-900 hover:bg-sage-50 rounded-lg transition-colors"
              >
                {item.label}
              </Link>
            ))}
            <button
              onClick={handleLogout}
              className="ml-2 px-4 py-2 text-sm font-medium text-white bg-sage-600 rounded-lg hover:bg-sage-700 transition-colors shadow-sm"
            >
              로그아웃
            </button>
          </div>

          {/* 오른쪽: 로그아웃 버튼 (모바일 - 간소화) */}
          <div className="flex items-center lg:hidden">
            <button
              onClick={handleLogout}
              className="text-sm font-semibold text-sage-700 hover:text-sage-800 transition-colors"
            >
              로그아웃
            </button>
          </div>
        </div>
      </nav>

      {/* 모바일 메뉴 오버레이 */}
      {canPortal && isMobileMenuOpen && createPortal(
        <>
          <div
            className="fixed inset-0 bg-black/40 z-[19999] lg:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="fixed top-0 left-0 bottom-0 w-[280px] bg-white shadow-xl z-[20000] lg:hidden overflow-y-auto">
            {/* 헤더 */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-sage-200">
              <div>
                <div className="text-base font-semibold text-sage-800">{title}</div>
                {subtitle && (
                  <div className="text-xs text-sage-500 mt-0.5">{subtitle}</div>
                )}
              </div>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 text-sage-400 hover:text-sage-600 hover:bg-sage-50 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label="모바일 메뉴 닫기"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {/* 메뉴 아이템 */}
            <div className="p-3 space-y-1">
              {menuItems.map((item) => (
                <Link
                  key={`${item.href}-${item.label}-mobile`}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center px-4 py-3 text-sage-700 hover:bg-sage-50 hover:text-sage-900 rounded-xl transition-colors min-h-[48px]"
                >
                  <span className="text-sm font-medium">{item.label}</span>
                </Link>
              ))}
            </div>
            {/* 하단 로그아웃 */}
            <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-sage-100 bg-sage-50">
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false)
                  handleLogout()
                }}
                className="w-full py-3 text-sm font-medium text-white bg-sage-600 rounded-xl hover:bg-sage-700 transition-colors min-h-[48px]"
              >
                로그아웃
              </button>
            </div>
          </div>
        </>,
        document.body
      )}
    </header>
  )
}
