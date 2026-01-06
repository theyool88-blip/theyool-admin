'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Building2,
  Users,
  Briefcase,
  MessageSquare,
  TrendingUp,
  UserPlus,
  ArrowUpRight,
  RefreshCw,
  AlertCircle,
  User,
  Scale,
  Crown,
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

interface StatsData {
  overview: OverviewStats;
  distribution: Distribution;
  recentTenants: RecentTenant[];
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-sage-600 mx-auto mb-2" />
          <p className="text-sm text-gray-500">로딩 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
          <p className="text-sm text-red-600 mb-4">{error}</p>
          <button
            onClick={fetchStats}
            className="text-sm text-sage-600 hover:underline"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Crown className="w-6 h-6 text-amber-500" />
              <h1 className="text-lg font-bold text-gray-900">슈퍼 어드민</h1>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/superadmin/tenants"
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                테넌트 관리
              </Link>
              <button
                onClick={fetchStats}
                className="p-2 hover:bg-gray-100 rounded"
                title="새로고침"
              >
                <RefreshCw className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            title="전체 테넌트"
            value={stats.overview.totalTenants}
            subValue={`활성: ${stats.overview.activeTenants}`}
            icon={<Building2 className="w-5 h-5" />}
            trend={stats.overview.newTenantsThisMonth}
            trendLabel="이번 달 신규"
          />
          <StatCard
            title="전체 멤버"
            value={stats.overview.totalMembers}
            icon={<Users className="w-5 h-5" />}
          />
          <StatCard
            title="전체 사건"
            value={stats.overview.totalCases}
            icon={<Briefcase className="w-5 h-5" />}
            trend={stats.overview.newCasesThisMonth}
            trendLabel="이번 달 신규"
          />
          <StatCard
            title="전체 상담"
            value={stats.overview.totalConsultations}
            icon={<MessageSquare className="w-5 h-5" />}
            trend={stats.overview.consultationsThisMonth}
            trendLabel="이번 달"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Distribution */}
          <div className="lg:col-span-2 space-y-6">
            {/* By Plan */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">플랜별 분포</h2>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-gray-900">
                    {stats.distribution.byPlan.basic}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">베이직</div>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {stats.distribution.byPlan.professional}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">프로페셔널</div>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">
                    {stats.distribution.byPlan.enterprise}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">엔터프라이즈</div>
                </div>
              </div>
            </div>

            {/* By Type */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">유형별 분포</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                  <div className="w-10 h-10 rounded-full bg-sage-100 flex items-center justify-center">
                    <User className="w-5 h-5 text-sage-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">
                      {stats.distribution.byType.individual}
                    </div>
                    <div className="text-xs text-gray-500">개인 사무소</div>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                    <Scale className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">
                      {stats.distribution.byType.firm}
                    </div>
                    <div className="text-xs text-gray-500">법무법인</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Tenants */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-900">최근 가입</h2>
              <Link
                href="/superadmin/tenants"
                className="text-xs text-sage-600 hover:underline flex items-center gap-1"
              >
                전체 보기
                <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="space-y-3">
              {stats.recentTenants.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  등록된 테넌트가 없습니다.
                </p>
              ) : (
                stats.recentTenants.map((tenant) => (
                  <div
                    key={tenant.id}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="w-8 h-8 rounded-full bg-sage-100 flex items-center justify-center flex-shrink-0">
                      {tenant.type === 'firm' ? (
                        <Building2 className="w-4 h-4 text-sage-600" />
                      ) : (
                        <User className="w-4 h-4 text-sage-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {tenant.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatDate(tenant.created_at)}
                      </p>
                    </div>
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${
                        tenant.status === 'active'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {tenant.status === 'active' ? '활성' : tenant.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>
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
    <div className="bg-white border border-gray-200 rounded-lg p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-gray-500">{title}</span>
        <div className="text-gray-400">{icon}</div>
      </div>
      <div className="text-2xl font-bold text-gray-900">{value.toLocaleString()}</div>
      {subValue && <p className="text-xs text-gray-500 mt-1">{subValue}</p>}
      {trend !== undefined && trendLabel && (
        <div className="flex items-center gap-1 mt-2">
          {trend > 0 && <TrendingUp className="w-3 h-3 text-green-500" />}
          {trend > 0 && <UserPlus className="w-3 h-3 text-green-500" />}
          <span className="text-xs text-green-600">+{trend}</span>
          <span className="text-xs text-gray-400">{trendLabel}</span>
        </div>
      )}
    </div>
  );
}
