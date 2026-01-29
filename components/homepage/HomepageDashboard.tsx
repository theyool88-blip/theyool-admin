'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  FileText,
  HelpCircle,
  Trophy,
  MessageSquare,
  Instagram,
  AlertCircle,
  ExternalLink,
  Globe,
  ChevronRight,
  Plus,
  BarChart3,
  Eye,
  EyeOff,
  Settings,
  Activity,
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

interface Summary {
  totalContent: number;
  totalPublished: number;
  totalDraft: number;
}

interface HomepageDashboardProps {
  tenantSlug?: string | null;
}

const contentTypes = [
  {
    key: 'blog',
    label: '블로그',
    description: '칼럼 및 법률 정보',
    icon: FileText,
    href: '/admin/homepage/blog',
  },
  {
    key: 'faqs',
    label: 'FAQ',
    description: '자주 묻는 질문',
    icon: HelpCircle,
    href: '/admin/homepage/faqs',
  },
  {
    key: 'cases',
    label: '성공사례',
    description: '해결한 사례',
    icon: Trophy,
    href: '/admin/homepage/cases',
  },
  {
    key: 'testimonials',
    label: '의뢰인 후기',
    description: '고객 후기',
    icon: MessageSquare,
    href: '/admin/homepage/testimonials',
  },
  {
    key: 'instagram',
    label: 'Instagram',
    description: 'SNS 콘텐츠',
    icon: Instagram,
    href: '/admin/homepage/instagram',
  },
];

export default function HomepageDashboard({ tenantSlug }: HomepageDashboardProps) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchStats = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/admin/homepage/stats');
      const result = await response.json();

      if (!result.success) {
        setError(result.error || '통계를 불러오는데 실패했습니다.');
        return;
      }

      setStats(result.data.stats);
      setSummary(result.data.summary);
    } catch (err) {
      console.error('Stats fetch error:', err);
      setError('서버 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-[var(--border-default)] border-t-[var(--sage-primary)] rounded-full animate-spin mx-auto" />
          <p className="text-sm text-[var(--text-tertiary)]">불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4 max-w-sm">
          <div className="w-12 h-12 rounded-full bg-[var(--color-danger-muted)] flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6 text-[var(--color-danger)]" />
          </div>
          <div>
            <p className="font-medium text-[var(--text-primary)]">오류가 발생했습니다</p>
            <p className="text-sm text-[var(--text-tertiary)] mt-1">{error}</p>
          </div>
          <button
            onClick={fetchStats}
            className="btn btn-secondary"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* 홈페이지 링크 - 더 미니멀하게 */}
      {tenantSlug && (
        <div className="flex items-center justify-between p-4 bg-[var(--sage-muted)]/50 rounded-xl border border-[var(--border-subtle)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--sage-primary)] flex items-center justify-center">
              <Globe className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">{tenantSlug}.luseed.co.kr</p>
              <p className="text-xs text-[var(--text-tertiary)]">내 홈페이지</p>
            </div>
          </div>
          <a
            href={`https://${tenantSlug}.luseed.co.kr`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[var(--sage-primary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded-lg transition-colors"
          >
            <span>방문</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      )}

      {/* 관리 메뉴 */}
      <div className="grid grid-cols-3 gap-4">
        <Link
          href="/admin/homepage/settings"
          className="card p-4 hover:bg-[var(--bg-hover)] transition-colors group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--sage-muted)] flex items-center justify-center group-hover:bg-[var(--sage-primary)]/20 transition-colors">
              <Settings className="w-5 h-5 text-[var(--sage-primary)]" />
            </div>
            <div>
              <p className="font-medium text-[var(--text-primary)]">설정</p>
              <p className="text-xs text-[var(--text-tertiary)]">도메인, 상담 설정</p>
            </div>
          </div>
        </Link>
        <Link
          href="/admin/homepage/monitoring"
          className="card p-4 hover:bg-[var(--bg-hover)] transition-colors group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--color-info-muted)] flex items-center justify-center group-hover:bg-[var(--color-info)]/20 transition-colors">
              <Activity className="w-5 h-5 text-[var(--color-info)]" />
            </div>
            <div>
              <p className="font-medium text-[var(--text-primary)]">모니터링</p>
              <p className="text-xs text-[var(--text-tertiary)]">방문자, 성능</p>
            </div>
          </div>
        </Link>
        <Link
          href="/admin/homepage/analytics"
          className="card p-4 hover:bg-[var(--bg-hover)] transition-colors group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--color-warning-muted)] flex items-center justify-center group-hover:bg-[var(--color-warning)]/20 transition-colors">
              <BarChart3 className="w-5 h-5 text-[var(--color-warning)]" />
            </div>
            <div>
              <p className="font-medium text-[var(--text-primary)]">분석</p>
              <p className="text-xs text-[var(--text-tertiary)]">전환, 유입 분석</p>
            </div>
          </div>
        </Link>
      </div>

      {/* 요약 통계 - Vercel 스타일 */}
      {summary && (
        <div className="grid grid-cols-3 gap-px bg-[var(--border-default)] rounded-xl overflow-hidden border border-[var(--border-default)]">
          <div className="bg-[var(--bg-secondary)] p-5">
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="w-4 h-4 text-[var(--text-muted)]" />
              <span className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">전체</span>
            </div>
            <p className="text-2xl font-semibold text-[var(--text-primary)] tabular-nums">{summary.totalContent}</p>
          </div>
          <div className="bg-[var(--bg-secondary)] p-5">
            <div className="flex items-center gap-2 mb-1">
              <Eye className="w-4 h-4 text-[var(--color-success)]" />
              <span className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">게시됨</span>
            </div>
            <p className="text-2xl font-semibold text-[var(--text-primary)] tabular-nums">{summary.totalPublished}</p>
          </div>
          <div className="bg-[var(--bg-secondary)] p-5">
            <div className="flex items-center gap-2 mb-1">
              <EyeOff className="w-4 h-4 text-[var(--text-muted)]" />
              <span className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">비공개</span>
            </div>
            <p className="text-2xl font-semibold text-[var(--text-primary)] tabular-nums">{summary.totalDraft}</p>
          </div>
        </div>
      )}

      {/* 콘텐츠 관리 - Linear 스타일 리스트 */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-[var(--text-tertiary)] uppercase tracking-wide">콘텐츠 관리</h2>
        </div>
        <div className="card divide-y divide-[var(--border-subtle)]">
          {contentTypes.map((type) => {
            const stat = stats?.[type.key as keyof Stats];
            const Icon = type.icon;

            return (
              <Link
                key={type.key}
                href={type.href}
                className="flex items-center justify-between p-4 hover:bg-[var(--bg-hover)] transition-colors group first:rounded-t-xl last:rounded-b-xl"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-[var(--sage-muted)] flex items-center justify-center group-hover:bg-[var(--bg-hover)] transition-colors">
                    <Icon className="w-5 h-5 text-[var(--sage-primary)]" />
                  </div>
                  <div>
                    <p className="font-medium text-[var(--text-primary)]">{type.label}</p>
                    <p className="text-sm text-[var(--text-tertiary)]">{type.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {stat && (
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-[var(--text-muted)] tabular-nums">{stat.total}개</span>
                      {stat.published > 0 && (
                        <span className="flex items-center gap-1 text-[var(--color-success)]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)]" />
                          {stat.published}
                        </span>
                      )}
                    </div>
                  )}
                  <ChevronRight className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--text-tertiary)] transition-colors" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* 빠른 작업 - 더 심플하게 */}
      <div>
        <h2 className="text-sm font-medium text-[var(--text-tertiary)] uppercase tracking-wide mb-4">빠른 작업</h2>
        <div className="flex flex-wrap gap-2">
          {[
            { href: '/admin/homepage/blog?action=new', label: '블로그 작성' },
            { href: '/admin/homepage/faqs?action=new', label: 'FAQ 추가' },
            { href: '/admin/homepage/cases?action=new', label: '성공사례 추가' },
            { href: '/admin/homepage/testimonials?action=new', label: '후기 추가' },
          ].map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="btn btn-secondary flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              {action.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
