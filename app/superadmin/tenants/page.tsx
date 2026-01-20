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
  ChevronLeft,
  ChevronRight,
  Plus,
  ArrowUpRight,
  Filter,
  ArrowUpDown,
  MoreHorizontal,
  ExternalLink,
  Trash2,
  Edit3,
  Eye,
  Globe,
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
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

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

  const getPlanBadgeClass = (plan: string) => {
    switch (plan) {
      case 'enterprise':
        return 'sa-badge-violet';
      case 'professional':
        return 'sa-badge-blue';
      default:
        return 'sa-badge-default';
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'active':
        return 'sa-badge-green';
      case 'suspended':
        return 'sa-badge-red';
      case 'cancelled':
        return 'sa-badge-default';
      default:
        return 'sa-badge-default';
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
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-semibold text-[--sa-text-primary] tracking-tight">
            테넌트 관리
          </h1>
          <p className="text-[13px] text-[--sa-text-tertiary] mt-1">
            전체 {pagination.total}개의 테넌트
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchTenants(pagination.page)}
            className="sa-btn sa-btn-ghost"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <Link href="/superadmin/tenants/create" className="sa-btn sa-btn-primary">
            <Plus className="w-4 h-4" />
            테넌트 생성
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="sa-card p-4 mb-4">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search */}
          <form onSubmit={handleSearch} className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[--sa-text-muted]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="이름, 이메일, 슬러그로 검색..."
                className="sa-input w-full pl-9"
              />
            </div>
          </form>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-[--sa-text-muted]" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="sa-input w-auto min-w-[120px]"
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
        <div className="mb-4 p-3 bg-[--sa-accent-red-muted] border border-[--sa-accent-red]/20 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-4 h-4 text-[--sa-accent-red] flex-shrink-0" />
          <p className="text-[12px] text-[--sa-accent-red]">{error}</p>
        </div>
      )}

      {/* Table */}
      <div className="sa-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="sa-table">
            <thead>
              <tr>
                <th className="w-[280px]">
                  <button
                    onClick={() => handleSort('name')}
                    className="flex items-center gap-1.5 hover:text-[--sa-text-secondary] transition-colors"
                  >
                    테넌트
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th>유형</th>
                <th>플랜</th>
                <th>홈페이지</th>
                <th className="text-center">멤버</th>
                <th className="text-center">사건</th>
                <th>상태</th>
                <th>
                  <button
                    onClick={() => handleSort('created_at')}
                    className="flex items-center gap-1.5 hover:text-[--sa-text-secondary] transition-colors"
                  >
                    가입일
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="w-[50px]"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="text-center py-12">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[--sa-text-muted]" />
                    <p className="text-[12px] text-[--sa-text-muted]">데이터를 불러오는 중...</p>
                  </td>
                </tr>
              ) : tenants.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12">
                    <Building2 className="w-8 h-8 mx-auto mb-2 text-[--sa-text-muted]" />
                    <p className="text-[12px] text-[--sa-text-muted]">등록된 테넌트가 없습니다.</p>
                  </td>
                </tr>
              ) : (
                tenants.map((tenant) => (
                  <tr key={tenant.id} className="group">
                    <td>
                      <Link
                        href={`/superadmin/tenants/${tenant.id}`}
                        className="flex items-center gap-3"
                      >
                        <div className="w-9 h-9 rounded-lg bg-[--sa-bg-hover] border border-[--sa-border-subtle] flex items-center justify-center flex-shrink-0">
                          {tenant.type === 'firm' ? (
                            <Building2 className="w-4 h-4 text-[--sa-text-muted]" />
                          ) : (
                            <User className="w-4 h-4 text-[--sa-text-muted]" />
                          )}
                        </div>
                        <div>
                          <p className="text-[13px] font-medium text-[--sa-text-primary] group-hover:text-[--sa-accent-blue] transition-colors">
                            {tenant.name}
                          </p>
                          <p className="text-[11px] text-[--sa-text-muted] sa-mono">{tenant.slug}</p>
                        </div>
                      </Link>
                    </td>
                    <td>
                      <span className="text-[12px] text-[--sa-text-secondary]">
                        {tenant.type === 'firm' ? '법무법인' : '개인'}
                      </span>
                    </td>
                    <td>
                      <span className={`sa-badge ${getPlanBadgeClass(tenant.plan)}`}>
                        {getPlanLabel(tenant.plan)}
                      </span>
                    </td>
                    <td>
                      {tenant.has_homepage ? (
                        <div className="flex items-center gap-1.5">
                          <Globe className="w-3.5 h-3.5 text-[--sa-accent-green]" />
                          <span className="sa-badge sa-badge-green">활성</span>
                        </div>
                      ) : (
                        <span className="text-[12px] text-[--sa-text-muted]">-</span>
                      )}
                    </td>
                    <td className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Users className="w-3.5 h-3.5 text-[--sa-text-muted]" />
                        <span className="text-[12px] text-[--sa-text-secondary]">{tenant.stats.members}</span>
                      </div>
                    </td>
                    <td className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Briefcase className="w-3.5 h-3.5 text-[--sa-text-muted]" />
                        <span className="text-[12px] text-[--sa-text-secondary]">{tenant.stats.cases}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`sa-badge ${getStatusBadgeClass(tenant.status)}`}>
                        {getStatusLabel(tenant.status)}
                      </span>
                    </td>
                    <td>
                      <span className="text-[12px] text-[--sa-text-muted] sa-mono">
                        {formatDate(tenant.created_at)}
                      </span>
                    </td>
                    <td>
                      <div className="relative">
                        <button
                          onClick={() => setActiveMenu(activeMenu === tenant.id ? null : tenant.id)}
                          className="p-1.5 rounded hover:bg-[--sa-bg-hover] text-[--sa-text-muted] hover:text-[--sa-text-secondary] transition-colors"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                        {activeMenu === tenant.id && (
                          <>
                            <div
                              className="fixed inset-0 z-10"
                              onClick={() => setActiveMenu(null)}
                            />
                            <div className="absolute right-0 top-full mt-1 w-40 bg-[--sa-bg-elevated] border border-[--sa-border-default] rounded-lg shadow-lg z-20 py-1">
                              <Link
                                href={`/superadmin/tenants/${tenant.id}`}
                                className="flex items-center gap-2 px-3 py-2 text-[12px] text-[--sa-text-secondary] hover:bg-[--sa-bg-hover] transition-colors"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                상세 보기
                              </Link>
                              <Link
                                href={`/superadmin/tenants/${tenant.id}/edit`}
                                className="flex items-center gap-2 px-3 py-2 text-[12px] text-[--sa-text-secondary] hover:bg-[--sa-bg-hover] transition-colors"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                수정
                              </Link>
                              {tenant.has_homepage && (
                                <a
                                  href={`https://${tenant.slug}.luseed.co.kr`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-2 px-3 py-2 text-[12px] text-[--sa-text-secondary] hover:bg-[--sa-bg-hover] transition-colors"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                  홈페이지 열기
                                </a>
                              )}
                              <div className="h-px bg-[--sa-border-subtle] my-1" />
                              <button className="flex items-center gap-2 px-3 py-2 text-[12px] text-[--sa-accent-red] hover:bg-[--sa-bg-hover] transition-colors w-full">
                                <Trash2 className="w-3.5 h-3.5" />
                                삭제
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[--sa-border-subtle]">
            <p className="text-[12px] text-[--sa-text-muted]">
              전체 {pagination.total}개 중{' '}
              <span className="text-[--sa-text-secondary]">
                {(pagination.page - 1) * pagination.limit + 1}-
                {Math.min(pagination.page * pagination.limit, pagination.total)}
              </span>
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => fetchTenants(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="sa-btn sa-btn-ghost p-2 disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-0.5 px-2">
                {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                  let pageNum;
                  if (pagination.totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (pagination.page <= 3) {
                    pageNum = i + 1;
                  } else if (pagination.page >= pagination.totalPages - 2) {
                    pageNum = pagination.totalPages - 4 + i;
                  } else {
                    pageNum = pagination.page - 2 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => fetchTenants(pageNum)}
                      className={`w-8 h-8 rounded text-[12px] font-medium transition-colors ${
                        pagination.page === pageNum
                          ? 'bg-[--sa-text-primary] text-[--sa-bg-primary]'
                          : 'text-[--sa-text-muted] hover:bg-[--sa-bg-hover]'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => fetchTenants(pagination.page + 1)}
                disabled={pagination.page === pagination.totalPages}
                className="sa-btn sa-btn-ghost p-2 disabled:opacity-30"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
