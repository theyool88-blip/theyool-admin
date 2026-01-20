'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  CreditCard,
  Building2,
  User,
  RefreshCw,
  AlertCircle,
  ArrowUpRight,
  ChevronRight,
  Settings,
  Check,
  X,
  Sparkles,
  Crown,
  Zap,
} from 'lucide-react';

interface PlanStats {
  basic: number;
  professional: number;
  enterprise: number;
}

interface TenantSubscription {
  id: string;
  name: string;
  slug: string;
  type: 'individual' | 'firm';
  plan: 'basic' | 'professional' | 'enterprise';
  status: 'active' | 'suspended' | 'cancelled';
  created_at: string;
}

interface SubscriptionData {
  planStats: PlanStats;
  recentChanges: TenantSubscription[];
  totalRevenue: number;
}

export default function SubscriptionsPage() {
  const [data, setData] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/superadmin/stats');
      const result = await response.json();

      if (!result.success) {
        setError(result.error || '데이터 조회에 실패했습니다.');
        return;
      }

      setData({
        planStats: result.data.distribution?.byPlan || { basic: 0, professional: 0, enterprise: 0 },
        recentChanges: result.data.recentTenants || [],
        totalRevenue: 0,
      });
    } catch (err) {
      console.error('Subscriptions fetch error:', err);
      setError('서버 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const yy = String(date.getFullYear()).slice(2);
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yy}.${mm}.${dd}`;
  };

  const getPlanLabel = (plan: string) => {
    switch (plan) {
      case 'enterprise': return '엔터프라이즈';
      case 'professional': return '프로페셔널';
      default: return '베이직';
    }
  };

  const getPlanBadgeClass = (plan: string) => {
    switch (plan) {
      case 'enterprise': return 'sa-badge-violet';
      case 'professional': return 'sa-badge-blue';
      default: return 'sa-badge-default';
    }
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
          <button onClick={fetchData} className="sa-btn sa-btn-secondary">
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const totalTenants = data.planStats.basic + data.planStats.professional + data.planStats.enterprise;

  // Calculate estimated MRR
  const estimatedMRR = (data.planStats.professional * 49000) + (data.planStats.enterprise * 99000);

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-semibold text-[--sa-text-primary] tracking-tight">
            구독 관리
          </h1>
          <p className="text-[13px] text-[--sa-text-tertiary] mt-1">
            플랜별 현황 및 구독 설정
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchData} className="sa-btn sa-btn-ghost">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <Link href="/superadmin/subscriptions/plans" className="sa-btn sa-btn-primary">
            <Settings className="w-4 h-4" />
            플랜 설정
          </Link>
        </div>
      </div>

      {/* Revenue Overview */}
      <div className="sa-card p-5 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] text-[--sa-text-muted] uppercase tracking-wider mb-1">
              예상 월간 수익 (MRR)
            </p>
            <p className="text-[28px] font-semibold text-[--sa-text-primary] tracking-tight">
              {new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(estimatedMRR)}
            </p>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-[11px] text-[--sa-text-muted] mb-1">유료 전환율</p>
              <p className="text-[18px] font-semibold text-[--sa-text-primary]">
                {totalTenants > 0 ? Math.round(((data.planStats.professional + data.planStats.enterprise) / totalTenants) * 100) : 0}%
              </p>
            </div>
            <div className="w-px h-10 bg-[--sa-border-subtle]" />
            <div className="text-right">
              <p className="text-[11px] text-[--sa-text-muted] mb-1">유료 테넌트</p>
              <p className="text-[18px] font-semibold text-[--sa-text-primary]">
                {data.planStats.professional + data.planStats.enterprise}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Plan Distribution Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <PlanDistributionCard
          name="베이직"
          icon={<Zap className="w-4 h-4" />}
          count={data.planStats.basic}
          total={totalTenants}
          price="무료"
          color="default"
        />
        <PlanDistributionCard
          name="프로페셔널"
          icon={<Sparkles className="w-4 h-4" />}
          count={data.planStats.professional}
          total={totalTenants}
          price="49,000원/월"
          color="blue"
          highlight
        />
        <PlanDistributionCard
          name="엔터프라이즈"
          icon={<Crown className="w-4 h-4" />}
          count={data.planStats.enterprise}
          total={totalTenants}
          price="99,000원/월"
          color="violet"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Plan Features Comparison */}
        <div className="sa-card p-5">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-[13px] font-semibold text-[--sa-text-primary]">플랜 비교</h2>
            <Link
              href="/superadmin/subscriptions/plans"
              className="text-[11px] text-[--sa-text-muted] hover:text-[--sa-text-secondary] flex items-center gap-1 transition-colors"
            >
              설정
              <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="space-y-0">
            {/* Header */}
            <div className="grid grid-cols-4 gap-3 pb-3 border-b border-[--sa-border-subtle]">
              <div className="text-[11px] font-medium text-[--sa-text-muted] uppercase tracking-wider">기능</div>
              <div className="text-center text-[11px] font-medium text-[--sa-text-muted]">베이직</div>
              <div className="text-center text-[11px] font-medium text-[--sa-accent-blue]">프로</div>
              <div className="text-center text-[11px] font-medium text-[--sa-accent-violet]">엔터</div>
            </div>

            {/* Features */}
            <FeatureRow feature="멤버 수" basic="3명" pro="10명" enterprise="무제한" />
            <FeatureRow feature="저장 용량" basic="10GB" pro="50GB" enterprise="무제한" />
            <FeatureRow feature="홈페이지" basic={false} pro={true} enterprise={true} />
            <FeatureRow feature="API 접근" basic={false} pro={false} enterprise={true} />
            <FeatureRow feature="우선 지원" basic={false} pro={true} enterprise={true} />
            <FeatureRow feature="화이트 라벨" basic={false} pro={false} enterprise={true} />

            {/* Pricing */}
            <div className="grid grid-cols-4 gap-3 pt-3 border-t border-[--sa-border-subtle] mt-3">
              <div className="text-[12px] font-medium text-[--sa-text-secondary]">월 요금</div>
              <div className="text-center text-[12px] font-medium text-[--sa-text-primary]">무료</div>
              <div className="text-center text-[12px] font-semibold text-[--sa-accent-blue]">49,000원</div>
              <div className="text-center text-[12px] font-semibold text-[--sa-accent-violet]">99,000원</div>
            </div>
          </div>
        </div>

        {/* Recent Tenants */}
        <div className="sa-card p-5">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-[13px] font-semibold text-[--sa-text-primary]">최근 가입</h2>
            <Link
              href="/superadmin/tenants"
              className="text-[11px] text-[--sa-text-muted] hover:text-[--sa-text-secondary] flex items-center gap-1 transition-colors"
            >
              전체 보기
              <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="space-y-1">
            {data.recentChanges.length === 0 ? (
              <div className="text-center py-10">
                <CreditCard className="w-8 h-8 mx-auto mb-2 text-[--sa-text-muted]" />
                <p className="text-[12px] text-[--sa-text-muted]">최근 변경 내역이 없습니다.</p>
              </div>
            ) : (
              data.recentChanges.slice(0, 6).map((tenant) => (
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
                    <p className="text-[10px] text-[--sa-text-muted]">{formatDate(tenant.created_at)}</p>
                  </div>
                  <span className={`sa-badge ${getPlanBadgeClass(tenant.plan)}`}>
                    {getPlanLabel(tenant.plan)}
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

// Plan Distribution Card Component
function PlanDistributionCard({
  name,
  icon,
  count,
  total,
  price,
  color,
  highlight,
}: {
  name: string;
  icon: React.ReactNode;
  count: number;
  total: number;
  price: string;
  color: 'default' | 'blue' | 'violet';
  highlight?: boolean;
}) {
  const percentage = total > 0 ? Math.round((count / total) * 100) : 0;

  const colorMap = {
    default: {
      iconBg: 'bg-[--sa-bg-hover]',
      iconColor: 'text-[--sa-text-muted]',
      badge: 'sa-badge-default',
      progress: 'bg-[--sa-text-muted]',
    },
    blue: {
      iconBg: 'bg-[--sa-accent-blue-muted]',
      iconColor: 'text-[--sa-accent-blue]',
      badge: 'sa-badge-blue',
      progress: 'bg-[--sa-accent-blue]',
    },
    violet: {
      iconBg: 'bg-[--sa-accent-violet-muted]',
      iconColor: 'text-[--sa-accent-violet]',
      badge: 'sa-badge-violet',
      progress: 'bg-[--sa-accent-violet]',
    },
  };

  return (
    <div className={`sa-card p-5 ${highlight ? 'border-[--sa-accent-blue]/30' : ''}`}>
      <div className="flex items-center justify-between mb-4">
        <div className={`w-9 h-9 rounded-lg ${colorMap[color].iconBg} flex items-center justify-center`}>
          <span className={colorMap[color].iconColor}>{icon}</span>
        </div>
        <span className={`sa-badge ${colorMap[color].badge}`}>{name}</span>
      </div>
      <div className="text-[26px] font-semibold text-[--sa-text-primary] tracking-tight mb-1">
        {count}
      </div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[12px] text-[--sa-text-muted]">테넌트</span>
        <span className="text-[11px] text-[--sa-text-muted]">{percentage}%</span>
      </div>
      <div className="sa-progress mb-3">
        <div
          className={`sa-progress-bar`}
          style={{
            width: `${percentage}%`,
            background: color === 'default' ? 'var(--sa-text-muted)' :
                       color === 'blue' ? 'var(--sa-accent-blue)' : 'var(--sa-accent-violet)'
          }}
        />
      </div>
      <div className="pt-3 border-t border-[--sa-border-subtle]">
        <span className="text-[11px] text-[--sa-text-muted]">{price}</span>
      </div>
    </div>
  );
}

// Feature Row Component
function FeatureRow({
  feature,
  basic,
  pro,
  enterprise,
}: {
  feature: string;
  basic: string | boolean;
  pro: string | boolean;
  enterprise: string | boolean;
}) {
  const renderValue = (value: string | boolean) => {
    if (typeof value === 'boolean') {
      return value ? (
        <Check className="w-3.5 h-3.5 text-[--sa-accent-green] mx-auto" />
      ) : (
        <X className="w-3.5 h-3.5 text-[--sa-text-muted] mx-auto" />
      );
    }
    return <span className="text-[12px] text-[--sa-text-secondary]">{value}</span>;
  };

  return (
    <div className="grid grid-cols-4 gap-3 py-2.5 border-b border-[--sa-border-subtle] last:border-0">
      <div className="text-[12px] text-[--sa-text-muted]">{feature}</div>
      <div className="text-center">{renderValue(basic)}</div>
      <div className="text-center">{renderValue(pro)}</div>
      <div className="text-center">{renderValue(enterprise)}</div>
    </div>
  );
}
