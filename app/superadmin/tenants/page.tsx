'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Building2,
  Users,
  Briefcase,
  User,
  Search,
  RefreshCw,
  AlertCircle,
  Crown,
  ChevronLeft,
  ChevronRight,
  Filter,
  ArrowUpDown,
} from 'lucide-react';
import { TenantStatus, SubscriptionPlan, TenantType } from '@/types/tenant';

interface TenantWithStats {
  id: string;
  name: string;
  slug: string;
  type: TenantType;
  email?: string;
  phone?: string;
  has_homepage: boolean;
  plan: SubscriptionPlan;
  status: TenantStatus;
  created_at: string;
  stats: {
    members: number;
    cases: number;
    clients: number;
  };
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function TenantsListPage() {
  const [tenants, setTenants] = useState<TenantWithStats[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const fetchTenants = async (page = 1) => {
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString(),
        sort_by: sortBy,
        sort_order: sortOrder,
      });

      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);

      const response = await fetch(`/api/superadmin/tenants?${params}`);
      const result = await response.json();

      if (!result.success) {
        setError(result.error || '테넌트 목록 조회에 실패했습니다.');
        return;
      }

      setTenants(result.data.tenants);
      setPagination(result.data.pagination);
    } catch (err) {
      console.error('Tenants fetch error:', err);
      setError('서버 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenants();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, sortBy, sortOrder]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTenants(1);
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const yy = String(date.getFullYear()).slice(2);
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yy}.${mm}.${dd}`;
  };

  const getPlanBadgeStyle = (plan: string) => {
    switch (plan) {
      case 'enterprise':
        return 'bg-purple-100 text-purple-700';
      case 'professional':
        return 'bg-blue-100 text-blue-700';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-700';
      case 'suspended':
        return 'bg-red-100 text-red-700';
      case 'cancelled':
        return 'bg-gray-100 text-gray-600';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active':
        return '활성';
      case 'suspended':
        return '정지';
      case 'cancelled':
        return '해지';
      default:
        return status;
    }
  };

  const getPlanLabel = (plan: string) => {
    switch (plan) {
      case 'enterprise':
        return '엔터프라이즈';
      case 'professional':
        return '프로페셔널';
      default:
        return '베이직';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Link href="/superadmin" className="text-gray-500 hover:text-gray-700">
                <Crown className="w-6 h-6 text-amber-500" />
              </Link>
              <span className="text-gray-300">/</span>
              <h1 className="text-lg font-bold text-gray-900">테넌트 관리</h1>
            </div>
            <button
              onClick={() => fetchTenants(pagination.page)}
              className="p-2 hover:bg-gray-100 rounded"
              title="새로고침"
            >
              <RefreshCw className={`w-4 h-4 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <form onSubmit={handleSearch} className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="이름, 이메일, 슬러그로 검색"
                  className="w-full h-10 pl-10 pr-4 text-sm border border-gray-200 rounded focus:outline-none focus:border-sage-500 focus:ring-1 focus:ring-sage-500"
                />
              </div>
            </form>

            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-10 px-3 text-sm border border-gray-200 rounded focus:outline-none focus:border-sage-500"
              >
                <option value="">전체 상태</option>
                <option value="active">활성</option>
                <option value="suspended">정지</option>
                <option value="cancelled">해지</option>
              </select>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500" />
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Table */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">
                    <button
                      onClick={() => handleSort('name')}
                      className="flex items-center gap-1 hover:text-gray-700"
                    >
                      테넌트
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">유형</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">플랜</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">멤버</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">사건</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">의뢰인</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">상태</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">
                    <button
                      onClick={() => handleSort('created_at')}
                      className="flex items-center gap-1 hover:text-gray-700"
                    >
                      가입일
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                      로딩 중...
                    </td>
                  </tr>
                ) : tenants.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                      테넌트가 없습니다.
                    </td>
                  </tr>
                ) : (
                  tenants.map((tenant) => (
                    <tr key={tenant.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-sage-100 flex items-center justify-center flex-shrink-0">
                            {tenant.type === 'firm' ? (
                              <Building2 className="w-4 h-4 text-sage-600" />
                            ) : (
                              <User className="w-4 h-4 text-sage-600" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{tenant.name}</p>
                            <p className="text-xs text-gray-500">{tenant.slug}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-gray-600">
                          {tenant.type === 'firm' ? '법무법인' : '개인'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs px-2 py-0.5 rounded ${getPlanBadgeStyle(tenant.plan)}`}
                        >
                          {getPlanLabel(tenant.plan)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Users className="w-3 h-3 text-gray-400" />
                          <span className="text-gray-600">{tenant.stats.members}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Briefcase className="w-3 h-3 text-gray-400" />
                          <span className="text-gray-600">{tenant.stats.cases}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-gray-600">{tenant.stats.clients}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs px-2 py-0.5 rounded ${getStatusBadgeStyle(tenant.status)}`}
                        >
                          {getStatusLabel(tenant.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {formatDate(tenant.created_at)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
              <p className="text-sm text-gray-500">
                전체 {pagination.total}개 중 {(pagination.page - 1) * pagination.limit + 1}-
                {Math.min(pagination.page * pagination.limit, pagination.total)}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fetchTenants(pagination.page - 1)}
                  disabled={pagination.page === 1}
                  className="p-2 border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-gray-600">
                  {pagination.page} / {pagination.totalPages}
                </span>
                <button
                  onClick={() => fetchTenants(pagination.page + 1)}
                  disabled={pagination.page === pagination.totalPages}
                  className="p-2 border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
