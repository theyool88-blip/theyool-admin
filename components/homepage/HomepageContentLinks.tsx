'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  FileText,
  HelpCircle,
  Trophy,
  MessageSquare,
  Instagram,
  LayoutDashboard,
} from 'lucide-react';

interface ContentStats {
  total: number;
  published: number;
  draft: number;
}

interface Stats {
  blog: ContentStats;
  faqs: ContentStats;
  cases: ContentStats;
  testimonials: ContentStats;
  instagram: ContentStats;
}

const contentLinks = [
  {
    key: 'dashboard',
    label: '대시보드',
    href: '/admin/homepage',
    icon: LayoutDashboard,
    exact: true,
  },
  {
    key: 'blog',
    label: '블로그',
    href: '/admin/homepage/blog',
    icon: FileText,
  },
  {
    key: 'faqs',
    label: 'FAQ',
    href: '/admin/homepage/faqs',
    icon: HelpCircle,
  },
  {
    key: 'cases',
    label: '성공사례',
    href: '/admin/homepage/cases',
    icon: Trophy,
  },
  {
    key: 'testimonials',
    label: '후기',
    href: '/admin/homepage/testimonials',
    icon: MessageSquare,
  },
  {
    key: 'instagram',
    label: 'Instagram',
    href: '/admin/homepage/instagram',
    icon: Instagram,
  },
];

export default function HomepageContentLinks() {
  const pathname = usePathname();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/admin/homepage/stats');
        const result = await response.json();
        if (result.success) {
          setStats(result.data.stats);
        }
      } catch (error) {
        console.error('Stats fetch error:', error);
      }
    };

    fetchStats();
  }, []);

  return (
    <nav className="flex items-center gap-1 p-1 bg-sage-50/50 rounded-lg border border-sage-100 overflow-x-auto">
      {contentLinks.map((link) => {
        const Icon = link.icon;
        const isActive = pathname ? (link.exact ? pathname === link.href : pathname.startsWith(link.href)) : false;
        const stat = stats?.[link.key as keyof Stats];

        return (
          <Link
            key={link.key}
            href={link.href}
            className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-all whitespace-nowrap ${
              isActive
                ? 'bg-white text-sage-700 shadow-sm'
                : 'text-neutral-500 hover:text-neutral-700 hover:bg-white/50'
            }`}
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            <span className="hidden sm:inline">{link.label}</span>
            {stat && link.key !== 'dashboard' && (
              <span className={`hidden md:inline text-xs tabular-nums ${isActive ? 'text-sage-500' : 'text-neutral-400'}`}>
                {stat.total}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
