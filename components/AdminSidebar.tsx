'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useTenant, invalidateTenantCache } from '@/hooks/useTenant'
import { useTheme } from '@/hooks/useTheme'
import { canAccessModule, type PermissionModule } from '@/lib/auth/permissions'
import {
  LayoutDashboard,
  Calendar,
  Briefcase,
  Users,
  MessageSquare,
  CreditCard,
  Wallet,
  BarChart3,
  Settings,
  HelpCircle,
  ChevronDown,
  Globe,
  FileText,
  Trophy,
  Instagram,
  Clock,
  X,
  Moon,
  Sun,
  LogOut,
  HardDrive,
  type LucideIcon,
} from 'lucide-react'

interface MenuItem {
  href: string
  label: string
  icon: LucideIcon
  module?: PermissionModule
  shortcut?: string
  children?: { label: string; href: string }[]
}

// 메뉴 아이템 정의
const menuItems: MenuItem[] = [
  {
    href: '/admin',
    label: '대시보드',
    icon: LayoutDashboard,
    module: 'dashboard',
    shortcut: 'D',
  },
  {
    href: '/schedules',
    label: '일정',
    icon: Calendar,
    module: 'calendar',
    shortcut: 'S',
  },
  {
    href: '/cases',
    label: '사건',
    icon: Briefcase,
    module: 'cases',
    shortcut: 'C',
  },
  {
    href: '/clients',
    label: '의뢰인',
    icon: Users,
    module: 'clients',
  },
  {
    href: '/admin/consultations',
    label: '상담',
    icon: MessageSquare,
    module: 'consultations',
  },
  {
    href: '/drive',
    label: '드라이브',
    icon: HardDrive,
    module: 'drive',
  },
]

const financeMenuItems: MenuItem[] = [
  { href: '/admin/expenses', label: '지출 관리', icon: CreditCard, module: 'expenses' },
  { href: '/admin/payments', label: '입금 관리', icon: Wallet, module: 'payments' },
  { href: '/admin/receivables', label: '미수금', icon: BarChart3, module: 'receivables' },
]

const homepageMenuItems: MenuItem[] = [
  { href: '/admin/homepage', label: '대시보드', icon: Globe },
  { href: '/admin/homepage/availability', label: '상담 시간', icon: Clock },
  { href: '/admin/homepage/blog', label: '블로그', icon: FileText },
  { href: '/admin/homepage/faqs', label: 'FAQ', icon: HelpCircle },
  { href: '/admin/homepage/cases', label: '성공사례', icon: Trophy },
  { href: '/admin/homepage/testimonials', label: '의뢰인 후기', icon: MessageSquare },
  { href: '/admin/homepage/instagram', label: 'Instagram', icon: Instagram },
]

interface AdminSidebarProps {
  isMobileOpen?: boolean
  onMobileClose?: () => void
}

interface SidebarContentProps {
  tenantLogo: string | null
  tenantName: string | null
  memberRole: string
  hasHomepage: boolean
  resolvedTheme: string | undefined
  filteredMenuItems: MenuItem[]
  filteredFinanceItems: MenuItem[]
  canAccessSettings: boolean
  expandedItems: string[]
  handleMenuClick: () => void
  toggleExpanded: (id: string) => void
  toggleTheme: () => void
  handleLogout: () => void
  getRoleDisplayName: (role: string) => string
  isActive: (href: string) => boolean
  isGroupActive: (items: MenuItem[]) => boolean
}

const SidebarContent = ({
  tenantLogo,
  tenantName,
  memberRole,
  hasHomepage,
  resolvedTheme,
  filteredMenuItems,
  filteredFinanceItems,
  canAccessSettings,
  expandedItems,
  handleMenuClick,
  toggleExpanded,
  toggleTheme,
  handleLogout,
  getRoleDisplayName,
  isActive,
  isGroupActive,
}: SidebarContentProps) => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-[var(--border-subtle)]">
        <Link href="/admin" className="flex items-center gap-3" onClick={handleMenuClick}>
          {tenantLogo ? (
            <Image
              src={tenantLogo}
              alt={tenantName || '로고'}
              width={120}
              height={28}
              className="h-7 w-auto object-contain"
              priority
            />
          ) : (
            <>
              <div className="w-8 h-8 rounded-lg bg-[var(--sage-muted)] border border-[var(--border-default)] flex items-center justify-center">
                <span className="text-[13px] font-bold text-[var(--sage-primary)]">L</span>
              </div>
              <div className="flex-1">
                <h1 className="text-[14px] font-semibold text-[var(--text-primary)] tracking-tight">
                  {tenantName || 'Luseed'}
                </h1>
                <p className="text-[11px] text-[var(--text-tertiary)] font-medium">
                  {getRoleDisplayName(memberRole)}
                </p>
              </div>
            </>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <div className="space-y-1">
          {/* 주요 메뉴 */}
          {filteredMenuItems.map(item => {
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={handleMenuClick}
                className={`relative flex items-center justify-between px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-100 group ${
                  active
                    ? 'bg-[var(--sage-muted)] text-[var(--sage-primary)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
                }`}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 bg-[var(--sage-primary)] rounded-r" />
                )}
                <div className="flex items-center gap-3">
                  <item.icon className={`w-4 h-4 ${active ? 'text-[var(--sage-primary)]' : 'text-[var(--text-tertiary)] group-hover:text-[var(--text-secondary)]'}`} />
                  {item.label}
                </div>
                {item.shortcut && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] opacity-0 group-hover:opacity-100 transition-opacity">
                    {item.shortcut}
                  </span>
                )}
              </Link>
            )
          })}

          {/* 회계 그룹 */}
          {filteredFinanceItems.length > 0 && (
            <div className="pt-2">
              <button
                onClick={() => toggleExpanded('finance')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-100 group ${
                  isGroupActive(filteredFinanceItems)
                    ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <CreditCard className="w-4 h-4 text-[var(--text-tertiary)]" />
                  회계
                </div>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-150 text-[var(--text-tertiary)] ${
                    expandedItems.includes('finance') ? 'rotate-0' : '-rotate-90'
                  }`}
                />
              </button>
              <div
                className={`overflow-hidden transition-all duration-150 ease-out ${
                  expandedItems.includes('finance') ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'
                }`}
              >
                <div className="mt-1 ml-6 pl-3 border-l border-[var(--border-subtle)] space-y-0.5">
                  {filteredFinanceItems.map(item => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={handleMenuClick}
                      className={`block px-3 py-1.5 rounded-md text-[12px] transition-all duration-100 ${
                        isActive(item.href)
                          ? 'text-[var(--sage-primary)] bg-[var(--sage-muted)]'
                          : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                      }`}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 홈페이지 그룹 */}
          {hasHomepage && (
            <div className="pt-2">
              <button
                onClick={() => toggleExpanded('homepage')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-100 group ${
                  isGroupActive(homepageMenuItems)
                    ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Globe className="w-4 h-4 text-[var(--text-tertiary)]" />
                  홈페이지
                </div>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-150 text-[var(--text-tertiary)] ${
                    expandedItems.includes('homepage') ? 'rotate-0' : '-rotate-90'
                  }`}
                />
              </button>
              <div
                className={`overflow-hidden transition-all duration-150 ease-out ${
                  expandedItems.includes('homepage') ? 'max-h-60 opacity-100' : 'max-h-0 opacity-0'
                }`}
              >
                <div className="mt-1 ml-6 pl-3 border-l border-[var(--border-subtle)] space-y-0.5">
                  {homepageMenuItems.map(item => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={handleMenuClick}
                      className={`block px-3 py-1.5 rounded-md text-[12px] transition-all duration-100 ${
                        isActive(item.href)
                          ? 'text-[var(--sage-primary)] bg-[var(--sage-muted)]'
                          : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                      }`}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 하단 메뉴 */}
        <div className="mt-4 pt-4 border-t border-[var(--border-subtle)] space-y-1">
          {canAccessSettings && (
            <Link
              href="/admin/settings"
              onClick={handleMenuClick}
              className={`relative flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-100 group ${
                isActive('/admin/settings')
                  ? 'bg-[var(--sage-muted)] text-[var(--sage-primary)]'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
              }`}
            >
              {isActive('/admin/settings') && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 bg-[var(--sage-primary)] rounded-r" />
              )}
              <Settings className="w-4 h-4" />
              설정
            </Link>
          )}
          <a
            href="mailto:support@luseed.io"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-all duration-100"
          >
            <HelpCircle className="w-4 h-4 text-[var(--text-tertiary)]" />
            도움말
          </a>
        </div>
      </nav>

      {/* Theme Toggle */}
      <div className="px-4 py-3 border-t border-[var(--border-subtle)]">
        <button
          onClick={toggleTheme}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-[12px] text-[var(--text-secondary)] bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] transition-colors"
        >
          <div className="flex items-center gap-2">
            {resolvedTheme === 'light' ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
            <span>{resolvedTheme === 'light' ? '다크 모드' : '라이트 모드'}</span>
          </div>
        </button>
      </div>

      {/* Footer - User Info */}
      <div className="px-4 py-4 border-t border-[var(--border-subtle)]">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/settings/profile"
            onClick={handleMenuClick}
            className="flex items-center gap-3 flex-1 min-w-0 p-1 -m-1 rounded-lg hover:bg-[var(--bg-hover)] transition-colors"
          >
            <div className="relative">
              <div className="w-8 h-8 rounded-full bg-[var(--sage-muted)] flex items-center justify-center">
                <span className="text-[11px] font-semibold text-[var(--sage-primary)]">
                  {(tenantName || 'U').charAt(0).toUpperCase()}
                </span>
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[var(--color-success)] border-2 border-[var(--bg-secondary)]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-[var(--text-primary)] truncate">
                {tenantName || 'User'}
              </p>
              <p className="text-[11px] text-[var(--text-tertiary)] truncate">
                {getRoleDisplayName(memberRole)}
              </p>
            </div>
          </Link>
          <button
            onClick={handleLogout}
            className="p-1.5 rounded-md text-[var(--text-tertiary)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-muted)] transition-colors"
            title="로그아웃"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )

export default function AdminSidebar({ isMobileOpen, onMobileClose }: AdminSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const { memberRole, hasHomepage, tenantLogo, tenantName, isLoading } = useTenant()
  const { resolvedTheme, toggleTheme } = useTheme()
  const [expandedItems, setExpandedItems] = useState<string[]>([])

  // 권한에 따라 메뉴 필터링
  const filteredMenuItems = useMemo(() => {
    return menuItems.filter(item => {
      if (!item.module) return true
      return canAccessModule(memberRole, item.module)
    })
  }, [memberRole])

  const filteredFinanceItems = useMemo(() => {
    return financeMenuItems.filter(item => {
      if (!item.module) return true
      return canAccessModule(memberRole, item.module)
    })
  }, [memberRole])

  const canAccessSettings = useMemo(() => {
    return canAccessModule(memberRole, 'settings')
  }, [memberRole])

  const toggleExpanded = (id: string) => {
    setExpandedItems(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    )
  }

  const isActive = (href: string) => {
    if (!pathname) return false
    // 대시보드 페이지는 정확히 일치할 때만 활성화
    if (href === '/admin' || href === '/admin/homepage') {
      return pathname === href
    }
    return pathname.startsWith(href)
  }

  const isGroupActive = (items: MenuItem[]) => {
    return items.some(item => isActive(item.href))
  }

  const handleLogout = async () => {
    invalidateTenantCache()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const getRoleDisplayName = (role: string) => {
    const names: Record<string, string> = {
      owner: '소유자',
      admin: '관리자',
      lawyer: '변호사',
      staff: '직원',
    }
    return names[role] || role
  }

  const handleMenuClick = () => {
    if (onMobileClose) onMobileClose()
  }

  if (isLoading) {
    return (
      <aside className="hidden md:block w-[240px] bg-[var(--bg-secondary)] border-r border-[var(--border-subtle)] h-screen">
        <div className="animate-pulse p-4 space-y-4">
          <div className="h-8 bg-[var(--bg-tertiary)] rounded-lg" />
          <div className="space-y-2">
            <div className="h-6 bg-[var(--bg-tertiary)] rounded w-3/4" />
            <div className="h-6 bg-[var(--bg-tertiary)] rounded w-1/2" />
            <div className="h-6 bg-[var(--bg-tertiary)] rounded w-2/3" />
          </div>
        </div>
      </aside>
    )
  }

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          onClick={onMobileClose}
        />
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:flex-col md:w-[240px] bg-[var(--bg-secondary)] border-r border-[var(--border-subtle)] h-screen sticky top-0">
        <SidebarContent
          tenantLogo={tenantLogo}
          tenantName={tenantName}
          memberRole={memberRole}
          hasHomepage={hasHomepage}
          resolvedTheme={resolvedTheme}
          filteredMenuItems={filteredMenuItems}
          filteredFinanceItems={filteredFinanceItems}
          canAccessSettings={canAccessSettings}
          expandedItems={expandedItems}
          handleMenuClick={handleMenuClick}
          toggleExpanded={toggleExpanded}
          toggleTheme={toggleTheme}
          handleLogout={handleLogout}
          getRoleDisplayName={getRoleDisplayName}
          isActive={isActive}
          isGroupActive={isGroupActive}
        />
      </aside>

      {/* Mobile Sidebar */}
      <aside
        className={`md:hidden fixed inset-y-0 left-0 z-50 w-[280px] bg-[var(--bg-secondary)] border-r border-[var(--border-subtle)] transform transition-transform duration-200 ease-out ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Mobile Close Button */}
        <button
          onClick={onMobileClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-lg hover:bg-[var(--bg-hover)] transition-colors"
        >
          <X className="w-5 h-5 text-[var(--text-secondary)]" />
        </button>
        <SidebarContent
          tenantLogo={tenantLogo}
          tenantName={tenantName}
          memberRole={memberRole}
          hasHomepage={hasHomepage}
          resolvedTheme={resolvedTheme}
          filteredMenuItems={filteredMenuItems}
          filteredFinanceItems={filteredFinanceItems}
          canAccessSettings={canAccessSettings}
          expandedItems={expandedItems}
          handleMenuClick={handleMenuClick}
          toggleExpanded={toggleExpanded}
          toggleTheme={toggleTheme}
          handleLogout={handleLogout}
          getRoleDisplayName={getRoleDisplayName}
          isActive={isActive}
          isGroupActive={isGroupActive}
        />
      </aside>
    </>
  )
}
