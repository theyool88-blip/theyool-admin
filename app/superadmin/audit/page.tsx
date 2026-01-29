'use client';

import { useEffect, useState } from 'react';
import {
  FileText,
  RefreshCw,
  AlertCircle,
  Search,
  Filter,
  Calendar,
  Building2,
  Settings,
  CreditCard,
  Shield,
  ChevronLeft,
  ChevronRight,
  Download,
} from 'lucide-react';

interface AuditLog {
  id: string;
  actor_type: 'user' | 'system' | 'admin';
  actor_id: string | null;
  actor_name: string;
  action: string;
  target_type: string;
  target_id: string | null;
  target_name: string;
  details: Record<string, unknown> | null;
  ip_address: string;
  created_at: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  const fetchLogs = async (_page = 1) => {
    setLoading(true);
    setError('');

    try {
      const mockLogs: AuditLog[] = [
        {
          id: '1',
          actor_type: 'admin',
          actor_id: 'admin-1',
          actor_name: '시스템 관리자',
          action: 'tenant.update',
          target_type: 'tenant',
          target_id: 'tenant-1',
          target_name: '법무법인 더윤',
          details: { field: 'status', old: 'active', new: 'suspended' },
          ip_address: '192.168.1.1',
          created_at: new Date(Date.now() - 3600000).toISOString(),
        },
        {
          id: '2',
          actor_type: 'admin',
          actor_id: 'admin-1',
          actor_name: '시스템 관리자',
          action: 'tenant.plan_change',
          target_type: 'tenant',
          target_id: 'tenant-2',
          target_name: '김변호사 사무소',
          details: { old_plan: 'basic', new_plan: 'professional' },
          ip_address: '192.168.1.1',
          created_at: new Date(Date.now() - 7200000).toISOString(),
        },
        {
          id: '3',
          actor_type: 'system',
          actor_id: null,
          actor_name: '시스템',
          action: 'scourt.sync_complete',
          target_type: 'scourt',
          target_id: null,
          target_name: 'SCOURT 동기화',
          details: { synced: 150, failed: 2 },
          ip_address: '-',
          created_at: new Date(Date.now() - 10800000).toISOString(),
        },
        {
          id: '4',
          actor_type: 'admin',
          actor_id: 'admin-2',
          actor_name: '고객 지원',
          action: 'admin.login',
          target_type: 'session',
          target_id: null,
          target_name: '로그인',
          details: null,
          ip_address: '203.234.56.78',
          created_at: new Date(Date.now() - 14400000).toISOString(),
        },
        {
          id: '5',
          actor_type: 'admin',
          actor_id: 'admin-1',
          actor_name: '시스템 관리자',
          action: 'settings.update',
          target_type: 'settings',
          target_id: null,
          target_name: '시스템 설정',
          details: { setting: 'scourt.auto_sync', value: true },
          ip_address: '192.168.1.1',
          created_at: new Date(Date.now() - 18000000).toISOString(),
        },
      ];

      setLogs(mockLogs);
      setPagination({
        page: 1,
        limit: 20,
        total: 5,
        totalPages: 1,
      });
    } catch (err) {
      console.error('Audit logs fetch error:', err);
      setError('감사 로그 조회에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('ko-KR');
  };

  const getActionLabel = (action: string) => {
    const actionMap: Record<string, string> = {
      'tenant.create': '테넌트 생성',
      'tenant.update': '테넌트 수정',
      'tenant.delete': '테넌트 삭제',
      'tenant.plan_change': '플랜 변경',
      'admin.login': '관리자 로그인',
      'admin.logout': '관리자 로그아웃',
      'admin.create': '관리자 추가',
      'admin.update': '관리자 수정',
      'settings.update': '설정 변경',
      'scourt.sync_complete': 'SCOURT 동기화 완료',
      'scourt.sync_error': 'SCOURT 동기화 오류',
    };
    return actionMap[action] || action;
  };

  const getActionIcon = (action: string) => {
    if (action.startsWith('tenant')) return <Building2 className="w-4 h-4" />;
    if (action.startsWith('admin')) return <Shield className="w-4 h-4" />;
    if (action.startsWith('settings')) return <Settings className="w-4 h-4" />;
    if (action.startsWith('scourt')) return <CreditCard className="w-4 h-4" />;
    return <FileText className="w-4 h-4" />;
  };

  const getActionColor = (action: string) => {
    if (action.includes('delete') || action.includes('error')) return 'text-[--sa-accent-red] bg-[--sa-accent-red-muted]';
    if (action.includes('create') || action.includes('complete')) return 'text-[--sa-accent-green] bg-[--sa-accent-green-muted]';
    if (action.includes('update') || action.includes('change')) return 'text-[--sa-accent-blue] bg-[--sa-accent-blue-muted]';
    if (action.includes('login') || action.includes('logout')) return 'text-[--sa-accent-violet] bg-[--sa-accent-violet-muted]';
    return 'text-[--sa-text-secondary] bg-[--sa-bg-tertiary]';
  };

  const filteredLogs = logs.filter((log) => {
    if (search) {
      const searchLower = search.toLowerCase();
      if (
        !log.actor_name.toLowerCase().includes(searchLower) &&
        !log.target_name.toLowerCase().includes(searchLower) &&
        !log.action.toLowerCase().includes(searchLower)
      ) {
        return false;
      }
    }
    if (actionFilter && !log.action.startsWith(actionFilter)) {
      return false;
    }
    return true;
  });

  if (loading && logs.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-5 h-5 animate-spin text-[--sa-text-muted] mx-auto mb-3" />
          <p className="text-[13px] text-[--sa-text-tertiary]">데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-semibold text-[--sa-text-primary] tracking-tight">감사 로그</h1>
          <p className="text-[13px] text-[--sa-text-tertiary] mt-1">시스템 활동 기록</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => fetchLogs()} className="sa-btn sa-btn-ghost">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button className="sa-btn sa-btn-secondary">
            <Download className="w-4 h-4" />
            내보내기
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 bg-[--sa-accent-red-muted] border border-[--sa-accent-red]/20 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-[--sa-accent-red] flex-shrink-0" />
          <p className="text-[13px] text-[--sa-accent-red]">{error}</p>
        </div>
      )}

      {/* Filters */}
      <div className="sa-card p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[--sa-text-muted]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="검색 (행위자, 대상, 액션)"
              className="sa-input w-full pl-11"
            />
          </div>
          <div className="flex items-center gap-3">
            <Filter className="w-4 h-4 text-[--sa-text-muted]" />
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="sa-input"
            >
              <option value="">전체 액션</option>
              <option value="tenant">테넌트</option>
              <option value="admin">어드민</option>
              <option value="settings">설정</option>
              <option value="scourt">SCOURT</option>
            </select>
          </div>
        </div>
      </div>

      {/* Logs List */}
      <div className="sa-card overflow-hidden">
        <div className="divide-y divide-[--sa-border-subtle]">
          {filteredLogs.length === 0 ? (
            <div className="p-8 text-center text-[13px] text-[--sa-text-muted]">
              감사 로그가 없습니다.
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div
                key={log.id}
                className="p-5 hover:bg-[--sa-bg-hover] transition-colors"
              >
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${getActionColor(log.action).split(' ')[1]}`}>
                    <span className={getActionColor(log.action).split(' ')[0]}>
                      {getActionIcon(log.action)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[11px] font-medium px-2.5 py-1 rounded-lg ${getActionColor(log.action)}`}>
                        {getActionLabel(log.action)}
                      </span>
                    </div>
                    <p className="text-[13px] text-[--sa-text-primary]">
                      <span className="font-medium">{log.actor_name}</span>
                      {log.target_name && (
                        <>
                          <span className="text-[--sa-text-muted]"> → </span>
                          <span className="font-medium">{log.target_name}</span>
                        </>
                      )}
                    </p>
                    {log.details && (
                      <p className="text-[11px] text-[--sa-text-tertiary] mt-1">
                        {JSON.stringify(log.details)}
                      </p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-[11px] text-[--sa-text-muted]">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDateTime(log.created_at)}
                      </span>
                      {log.ip_address !== '-' && (
                        <span>IP: {log.ip_address}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-4 border-t border-[--sa-border-default]">
            <p className="text-[12px] text-[--sa-text-tertiary]">
              전체 {pagination.total}개 중 {(pagination.page - 1) * pagination.limit + 1}-
              {Math.min(pagination.page * pagination.limit, pagination.total)}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchLogs(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="p-2 bg-[--sa-bg-tertiary] rounded-lg hover:bg-[--sa-bg-hover] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4 text-[--sa-text-muted]" />
              </button>
              <span className="text-[12px] text-[--sa-text-secondary] px-3">
                {pagination.page} / {pagination.totalPages}
              </span>
              <button
                onClick={() => fetchLogs(pagination.page + 1)}
                disabled={pagination.page === pagination.totalPages}
                className="p-2 bg-[--sa-bg-tertiary] rounded-lg hover:bg-[--sa-bg-hover] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4 text-[--sa-text-muted]" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
