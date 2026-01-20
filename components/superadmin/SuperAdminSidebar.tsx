'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Building2,
  CreditCard,
  Activity,
  ShieldCheck,
  FileText,
  Settings,
  ChevronDown,
  Menu,
  X,
  Command,
  LogOut,
} from 'lucide-react';

interface MenuItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  shortcut?: string;
  children?: { label: string; href: string }[];
}

const menuItems: MenuItem[] = [
  {
    label: '대시보드',
    href: '/superadmin',
    icon: <LayoutDashboard className="w-4 h-4" />,
    shortcut: 'D',
  },
  {
    label: '테넌트 관리',
    href: '/superadmin/tenants',
    icon: <Building2 className="w-4 h-4" />,
    shortcut: 'T',
  },
  {
    label: '구독 관리',
    href: '/superadmin/subscriptions',
    icon: <CreditCard className="w-4 h-4" />,
    children: [
      { label: '구독 현황', href: '/superadmin/subscriptions' },
      { label: '플랜 설정', href: '/superadmin/subscriptions/plans' },
    ],
  },
  {
    label: '모니터링',
    href: '/superadmin/monitoring',
    icon: <Activity className="w-4 h-4" />,
    children: [
      { label: '시스템 상태', href: '/superadmin/monitoring' },
      { label: 'SCOURT 연동', href: '/superadmin/monitoring/scourt' },
      { label: '알림 시스템', href: '/superadmin/monitoring/notifications' },
    ],
  },
  {
    label: '어드민 관리',
    href: '/superadmin/admins',
    icon: <ShieldCheck className="w-4 h-4" />,
  },
  {
    label: '감사 로그',
    href: '/superadmin/audit',
    icon: <FileText className="w-4 h-4" />,
    shortcut: 'L',
  },
  {
    label: '시스템 설정',
    href: '/superadmin/settings',
    icon: <Settings className="w-4 h-4" />,
  },
];

export default function SuperAdminSidebar() {
  const pathname = usePathname();
  const [expandedItems, setExpandedItems] = useState<string[]>([
    '/superadmin/subscriptions',
    '/superadmin/monitoring',
  ]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toggleExpanded = (href: string) => {
    setExpandedItems((prev) =>
      prev.includes(href) ? prev.filter((item) => item !== href) : [...prev, href]
    );
  };

  const isActive = (href: string, children?: { label: string; href: string }[]) => {
    if (children) {
      return children.some((child) => pathname === child.href);
    }
    return pathname === href;
  };

  const isChildActive = (href: string) => pathname === href;

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-[--sa-border-subtle]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-white/10 to-white/5 border border-[--sa-border-default] flex items-center justify-center">
            <span className="text-[13px] font-bold text-white">L</span>
          </div>
          <div className="flex-1">
            <h1 className="text-[14px] font-semibold text-[--sa-text-primary] tracking-tight">
              Luseed
            </h1>
            <p className="text-[11px] text-[--sa-text-muted] font-medium">Super Admin</p>
          </div>
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-[--sa-bg-hover] border border-[--sa-border-subtle]">
            <span className="w-1.5 h-1.5 rounded-full bg-[--sa-accent-green] shadow-[0_0_6px_var(--sa-accent-green)]" />
            <span className="text-[10px] text-[--sa-text-muted] font-medium">Online</span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <div className="space-y-1">
          {menuItems.map((item) => {
            const active = isActive(item.href, item.children);
            const expanded = expandedItems.includes(item.href);

            return (
              <div key={item.href}>
                {item.children ? (
                  <>
                    <button
                      onClick={() => toggleExpanded(item.href)}
                      className={`relative w-full flex items-center justify-between px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-100 group ${
                        active
                          ? 'bg-[--sa-bg-active] text-[--sa-text-primary]'
                          : 'text-[--sa-text-tertiary] hover:bg-[--sa-bg-hover] hover:text-[--sa-text-secondary]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={active ? 'text-[--sa-text-primary]' : 'text-[--sa-text-muted] group-hover:text-[--sa-text-tertiary]'}>
                          {item.icon}
                        </span>
                        {item.label}
                      </div>
                      <ChevronDown
                        className={`w-3.5 h-3.5 transition-transform duration-150 ${
                          expanded ? 'rotate-0' : '-rotate-90'
                        } ${active ? 'text-[--sa-text-tertiary]' : 'text-[--sa-text-muted]'}`}
                      />
                    </button>
                    <div
                      className={`overflow-hidden transition-all duration-150 ease-out ${
                        expanded ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'
                      }`}
                    >
                      <div className="mt-1 ml-6 pl-3 border-l border-[--sa-border-subtle] space-y-0.5">
                        {item.children.map((child) => (
                          <Link
                            key={child.href}
                            href={child.href}
                            onClick={() => setMobileMenuOpen(false)}
                            className={`block px-3 py-1.5 rounded-md text-[12px] transition-all duration-100 ${
                              isChildActive(child.href)
                                ? 'text-[--sa-text-primary] bg-[--sa-bg-hover]'
                                : 'text-[--sa-text-muted] hover:text-[--sa-text-secondary] hover:bg-[--sa-bg-hover]'
                            }`}
                          >
                            {child.label}
                          </Link>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <Link
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`relative flex items-center justify-between px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-100 group ${
                      active
                        ? 'bg-[--sa-bg-active] text-[--sa-text-primary]'
                        : 'text-[--sa-text-tertiary] hover:bg-[--sa-bg-hover] hover:text-[--sa-text-secondary]'
                    }`}
                  >
                    {active && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 bg-[--sa-text-primary] rounded-r" />
                    )}
                    <div className="flex items-center gap-3">
                      <span className={active ? 'text-[--sa-text-primary]' : 'text-[--sa-text-muted] group-hover:text-[--sa-text-tertiary]'}>
                        {item.icon}
                      </span>
                      {item.label}
                    </div>
                    {item.shortcut && (
                      <span className="sa-kbd opacity-0 group-hover:opacity-100 transition-opacity">
                        {item.shortcut}
                      </span>
                    )}
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      </nav>

      {/* Command Palette Hint */}
      <div className="px-4 py-3 border-t border-[--sa-border-subtle]">
        <button className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-[12px] text-[--sa-text-muted] bg-[--sa-bg-tertiary] hover:bg-[--sa-bg-hover] transition-colors">
          <div className="flex items-center gap-2">
            <Command className="w-3.5 h-3.5" />
            <span>명령 팔레트</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="sa-kbd">Cmd</span>
            <span className="sa-kbd">K</span>
          </div>
        </button>
      </div>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-[--sa-border-subtle]">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[--sa-accent-blue] to-[--sa-accent-violet] flex items-center justify-center">
              <span className="text-[11px] font-semibold text-white">SA</span>
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[--sa-accent-green] border-2 border-[--sa-bg-secondary]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-[--sa-text-primary] truncate">
              System Admin
            </p>
            <p className="text-[11px] text-[--sa-text-muted] truncate">
              admin@luseed.co.kr
            </p>
          </div>
          <button className="p-1.5 rounded-md text-[--sa-text-muted] hover:text-[--sa-text-secondary] hover:bg-[--sa-bg-hover] transition-colors">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2.5 bg-[--sa-bg-elevated] rounded-lg border border-[--sa-border-default] shadow-lg"
      >
        {mobileMenuOpen ? (
          <X className="w-5 h-5 text-[--sa-text-secondary]" />
        ) : (
          <Menu className="w-5 h-5 text-[--sa-text-secondary]" />
        )}
      </button>

      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-[240px] bg-[--sa-bg-secondary] border-r border-[--sa-border-subtle] h-screen sticky top-0">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar */}
      <aside
        className={`lg:hidden fixed inset-y-0 left-0 z-50 w-[280px] bg-[--sa-bg-secondary] border-r border-[--sa-border-subtle] transform transition-transform duration-200 ease-out ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <SidebarContent />
      </aside>
    </>
  );
}
