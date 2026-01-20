'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Building2,
  Users,
  Briefcase,
  MessageSquare,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  RefreshCw,
  AlertCircle,
  User,
  DollarSign,
  UserMinus,
  BarChart3,
  CheckCircle2,
  XCircle,
  Clock,
  Activity,
} from 'lucide-react';

interface OverviewStats {
  totalTenants: number;
  activeTenants: number;
  newTenantsThisMonth: number;
  totalMembers: number;
  totalCases: number;
  newCasesThisMonth: number;
  totalConsultations: number;
  consultationsThisMonth: number;
  totalClients: number;
}

interface Distribution {
  byPlan: {
    basic: number;
    professional: number;
    enterprise: number;
  };
  byType: {
    individual: number;
    firm: number;
  };
}

interface RecentTenant {
  id: string;
  name: string;
  slug: string;
  type: string;
  plan: string;
  created_at: string;
  status: string;
}

interface KPIStats {
  mrr: number;
  mrrGrowth: number;
  churnRate: number;
  arpu: number;
  monthlyGrowth: number[];
}

interface SystemStatus {
  database: 'healthy' | 'warning' | 'error';
  api: 'healthy' | 'warning' | 'error';
  scourt: 'healthy' | 'warning' | 'error';
  notifications: 'healthy' | 'warning' | 'error';
}

interface StatsData {
  overview: OverviewStats;
  distribution: Distribution;
  recentTenants: RecentTenant[];
  kpi?: KPIStats;
  systemStatus?: SystemStatus;
}

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchStats = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/superadmin/stats');
      const result = await response.json();

      if (!result.success) {
        setError(result.error || '통계 조회에 실패했습니다.');
        return;
      }

      setStats(result.data);
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const yy = String(date.getFullYear()).slice(2);
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yy}.${mm}.${dd}`;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-5 h-5 animate-spin text-[--sa-text-muted] mx-auto mb-3" />
          <p className="text-[13px] text-[--sa-text-tertiary]">데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full bg-[--sa-accent-red-muted] flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-5 h-5 text-[--sa-accent-red]" />
          </div>
          <p className="text-[13px] text-[--sa-text-secondary] mb-4">{error}</p>
          <button
            onClick={fetchStats}
            className="sa-btn sa-btn-secondary"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const kpi = stats.kpi || {
    mrr: 0,
    mrrGrowth: 0,
    churnRate: 0,
    arpu: 0,
    monthlyGrowth: [0, 0, 0, 0, 0, 0],
  };

  const systemStatus = stats.systemStatus || {
    database: 'healthy' as const,
    api: 'healthy' as const,
    scourt: 'healthy' as const,
    notifications: 'healthy' as const,
  };

  const allHealthy = Object.values(systemStatus).every(s => s === 'healthy');

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-[22px] font-semibold text-[--sa-text-primary] tracking-tight">
            대시보드
          </h1>
          <p className="text-[13px] text-[--sa-text-tertiary] mt-1">
            SaaS 플랫폼 운영 현황 개요
          </p>
        </div>
        <button
          onClick={fetchStats}
          className="sa-btn sa-btn-ghost"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          새로고침
        </button>
      </div>

      {/* System Status Banner */}
      <div className={`sa-card p-4 mb-6 flex items-center justify-between ${
        allHealthy ? 'border-[--sa-accent-green]/20' : 'border-[--sa-accent-amber]/20'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            allHealthy ? 'bg-[--sa-accent-green-muted]' : 'bg-[--sa-accent-amber-muted]'
          }`}>
            {allHealthy ? (
              <CheckCircle2 className="w-5 h-5 text-[--sa-accent-green]" />
            ) : (
              <AlertCircle className="w-5 h-5 text-[--sa-accent-amber]" />
            )}
          </div>
          <div>
            <p className="text-[13px] font-medium text-[--sa-text-primary]">
              {allHealthy ? '모든 시스템 정상 운영 중' : '일부 시스템에 주의가 필요합니다'}
            </p>
            <p className="text-[11px] text-[--sa-text-muted]">
              마지막 확인: {new Date().toLocaleTimeString('ko-KR')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {Object.entries(systemStatus).map(([key, status]) => (
            <div key={key} className="flex items-center gap-1.5 px-2 py-1 rounded bg-[--sa-bg-tertiary]">
              <span className={`sa-status-dot ${status}`} />
              <span className="text-[11px] text-[--sa-text-muted] capitalize">
                {key === 'database' ? 'DB' : key === 'api' ? 'API' : key === 'scourt' ? 'SCOURT' : 'Notify'}
              </span>
            </div>
          ))}
          <Link
            href="/superadmin/monitoring"
            className="text-[12px] text-[--sa-text-tertiary] hover:text-[--sa-text-secondary] flex items-center gap-1 ml-2 transition-colors"
          >
            상세 보기
            <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPICard
          title="월간 반복 수익"
          value={formatCurrency(kpi.mrr)}
          change={kpi.mrrGrowth}
          icon={<DollarSign className="w-4 h-4" />}
          accentColor="green"
        />
        <KPICard
          title="활성 테넌트"
          value={stats.overview.activeTenants.toString()}
          change={stats.overview.newTenantsThisMonth}
          changeLabel="신규"
          icon={<Building2 className="w-4 h-4" />}
          accentColor="blue"
        />
        <KPICard
          title="테넌트당 평균 매출"
          value={formatCurrency(kpi.arpu)}
          subtitle="ARPU"
          icon={<BarChart3 className="w-4 h-4" />}
          accentColor="violet"
        />
        <KPICard
          title="월간 이탈률"
          value={`${kpi.churnRate.toFixed(1)}%`}
          subtitle="목표: 5% 이하"
          icon={<UserMinus className="w-4 h-4" />}
          accentColor={kpi.churnRate > 5 ? 'red' : 'green'}
          isNegativeGood
        />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="전체 테넌트"
          value={stats.overview.totalTenants}
          subValue={`활성: ${stats.overview.activeTenants}`}
          icon={<Building2 className="w-4 h-4" />}
        />
        <StatCard
          title="전체 멤버"
          value={stats.overview.totalMembers}
          icon={<Users className="w-4 h-4" />}
        />
        <StatCard
          title="전체 사건"
          value={stats.overview.totalCases}
          trend={stats.overview.newCasesThisMonth}
          trendLabel="이번 달"
          icon={<Briefcase className="w-4 h-4" />}
        />
        <StatCard
          title="전체 상담"
          value={stats.overview.totalConsultations}
          trend={stats.overview.consultationsThisMonth}
          trendLabel="이번 달"
          icon={<MessageSquare className="w-4 h-4" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Distribution */}
        <div className="lg:col-span-2 space-y-4">
          {/* By Plan */}
          <div className="sa-card p-5">
            <h2 className="text-[13px] font-semibold text-[--sa-text-primary] mb-4">플랜별 분포</h2>
            <div className="grid grid-cols-3 gap-3">
              <PlanCard
                name="베이직"
                count={stats.distribution.byPlan.basic}
                total={stats.overview.totalTenants}
                color="default"
              />
              <PlanCard
                name="프로페셔널"
                count={stats.distribution.byPlan.professional}
                total={stats.overview.totalTenants}
                color="blue"
              />
              <PlanCard
                name="엔터프라이즈"
                count={stats.distribution.byPlan.enterprise}
                total={stats.overview.totalTenants}
                color="violet"
              />
            </div>
          </div>

          {/* By Type */}
          <div className="sa-card p-5">
            <h2 className="text-[13px] font-semibold text-[--sa-text-primary] mb-4">유형별 분포</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-3 p-4 bg-[--sa-bg-tertiary] rounded-lg">
                <div className="w-10 h-10 rounded-lg bg-[--sa-bg-hover] border border-[--sa-border-subtle] flex items-center justify-center">
                  <User className="w-4 h-4 text-[--sa-text-tertiary]" />
                </div>
                <div>
                  <div className="text-[20px] font-semibold text-[--sa-text-primary] tracking-tight">
                    {stats.distribution.byType.individual}
                  </div>
                  <div className="text-[12px] text-[--sa-text-muted]">개인 사무소</div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 bg-[--sa-bg-tertiary] rounded-lg">
                <div className="w-10 h-10 rounded-lg bg-[--sa-bg-hover] border border-[--sa-border-subtle] flex items-center justify-center">
                  <Building2 className="w-4 h-4 text-[--sa-text-tertiary]" />
                </div>
                <div>
                  <div className="text-[20px] font-semibold text-[--sa-text-primary] tracking-tight">
                    {stats.distribution.byType.firm}
                  </div>
                  <div className="text-[12px] text-[--sa-text-muted]">법무법인</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Tenants */}
        <div className="sa-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[13px] font-semibold text-[--sa-text-primary]">최근 가입</h2>
            <Link
              href="/superadmin/tenants"
              className="text-[12px] text-[--sa-text-muted] hover:text-[--sa-text-secondary] flex items-center gap-1 transition-colors"
            >
              전체 보기
              <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="space-y-1">
            {stats.recentTenants.length === 0 ? (
              <p className="text-[12px] text-[--sa-text-muted] text-center py-10">
                등록된 테넌트가 없습니다.
              </p>
            ) : (
              stats.recentTenants.map((tenant) => (
                <Link
                  key={tenant.id}
                  href={`/superadmin/tenants/${tenant.id}`}
                  className="flex items-center gap-3 p-2.5 hover:bg-[--sa-bg-hover] rounded-lg transition-colors group"
                >
                  <div className="w-8 h-8 rounded-lg bg-[--sa-bg-tertiary] flex items-center justify-center flex-shrink-0">
                    {tenant.type === 'firm' ? (
                      <Building2 className="w-3.5 h-3.5 text-[--sa-text-muted]" />
                    ) : (
                      <User className="w-3.5 h-3.5 text-[--sa-text-muted]" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium text-[--sa-text-secondary] group-hover:text-[--sa-text-primary] truncate transition-colors">
                      {tenant.name}
                    </p>
                    <p className="text-[10px] text-[--sa-text-muted]">
                      {formatDate(tenant.created_at)}
                    </p>
                  </div>
                  <span
                    className={`sa-badge ${
                      tenant.status === 'active' ? 'sa-badge-green' : 'sa-badge-default'
                    }`}
                  >
                    {tenant.status === 'active' ? '활성' : tenant.status}
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// KPI Card Component
function KPICard({
  title,
  value,
  change,
  changeLabel,
  subtitle,
  icon,
  accentColor,
  isNegativeGood,
}: {
  title: string;
  value: string;
  change?: number;
  changeLabel?: string;
  subtitle?: string;
  icon: React.ReactNode;
  accentColor: 'green' | 'blue' | 'violet' | 'red' | 'amber';
  isNegativeGood?: boolean;
}) {
  const colorMap = {
    green: 'bg-[--sa-accent-green-muted] text-[--sa-accent-green]',
    blue: 'bg-[--sa-accent-blue-muted] text-[--sa-accent-blue]',
    violet: 'bg-[--sa-accent-violet-muted] text-[--sa-accent-violet]',
    red: 'bg-[--sa-accent-red-muted] text-[--sa-accent-red]',
    amber: 'bg-[--sa-accent-amber-muted] text-[--sa-accent-amber]',
  };

  const isPositive = change !== undefined && change >= 0;
  const trendColor = isNegativeGood
    ? (isPositive ? 'text-[--sa-accent-red]' : 'text-[--sa-accent-green]')
    : (isPositive ? 'text-[--sa-accent-green]' : 'text-[--sa-accent-red]');

  return (
    <div className="sa-stat-card">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colorMap[accentColor]}`}>
          {icon}
        </div>
      </div>
      <div className="text-[24px] font-semibold text-[--sa-text-primary] tracking-tight leading-none">
        {value}
      </div>
      <div className="flex items-center justify-between mt-2">
        <span className="text-[12px] text-[--sa-text-muted]">{title}</span>
        {change !== undefined && (
          <div className="sa-stat-trend">
            {isPositive ? (
              <TrendingUp className={`w-3 h-3 ${trendColor}`} />
            ) : (
              <TrendingDown className={`w-3 h-3 ${trendColor}`} />
            )}
            <span className={trendColor}>
              {isPositive ? '+' : ''}{change}{changeLabel ? '' : '%'}
            </span>
            {changeLabel && <span className="text-[--sa-text-muted] ml-0.5">{changeLabel}</span>}
          </div>
        )}
        {subtitle && <span className="text-[11px] text-[--sa-text-muted]">{subtitle}</span>}
      </div>
    </div>
  );
}

// Stat Card Component
function StatCard({
  title,
  value,
  subValue,
  icon,
  trend,
  trendLabel,
}: {
  title: string;
  value: number;
  subValue?: string;
  icon: React.ReactNode;
  trend?: number;
  trendLabel?: string;
}) {
  return (
    <div className="sa-card p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-medium text-[--sa-text-muted] uppercase tracking-wider">{title}</span>
        <span className="text-[--sa-text-muted]">{icon}</span>
      </div>
      <div className="text-[20px] font-semibold text-[--sa-text-primary] tracking-tight">
        {value.toLocaleString()}
      </div>
      {subValue && <p className="text-[11px] text-[--sa-text-muted] mt-1">{subValue}</p>}
      {trend !== undefined && trendLabel && trend > 0 && (
        <div className="flex items-center gap-1.5 mt-2">
          <TrendingUp className="w-3 h-3 text-[--sa-accent-green]" />
          <span className="text-[11px] font-medium text-[--sa-accent-green]">+{trend}</span>
          <span className="text-[11px] text-[--sa-text-muted]">{trendLabel}</span>
        </div>
      )}
    </div>
  );
}

// Plan Card Component
function PlanCard({
  name,
  count,
  total,
  color,
}: {
  name: string;
  count: number;
  total: number;
  color: 'default' | 'blue' | 'violet';
}) {
  const percentage = total > 0 ? Math.round((count / total) * 100) : 0;

  const colorMap = {
    default: {
      badge: 'sa-badge-default',
      progress: 'bg-[--sa-text-muted]',
    },
    blue: {
      badge: 'sa-badge-blue',
      progress: 'bg-[--sa-accent-blue]',
    },
    violet: {
      badge: 'sa-badge-violet',
      progress: 'bg-[--sa-accent-violet]',
    },
  };

  return (
    <div className="p-4 bg-[--sa-bg-tertiary] rounded-lg">
      <div className="flex items-center justify-between mb-3">
        <span className={`sa-badge ${colorMap[color].badge}`}>{name}</span>
        <span className="text-[11px] text-[--sa-text-muted]">{percentage}%</span>
      </div>
      <div className="text-[22px] font-semibold text-[--sa-text-primary] tracking-tight mb-2">
        {count}
      </div>
      <div className="sa-progress">
        <div
          className={`sa-progress-bar ${color === 'default' ? '' : color}`}
          style={{
            width: `${percentage}%`,
            background: color === 'default' ? 'var(--sa-text-muted)' : undefined
          }}
        />
      </div>
    </div>
  );
}
