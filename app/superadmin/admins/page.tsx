'use client';

import { useEffect, useState } from 'react';
import {
  RefreshCw,
  AlertCircle,
  Search,
  Plus,
  User,
  Mail,
  Calendar,
  MoreVertical,
  Shield,
  Key,
} from 'lucide-react';

interface SuperAdmin {
  id: string;
  email: string;
  name: string;
  role: 'super_admin' | 'admin' | 'viewer';
  last_login: string | null;
  created_at: string;
  status: 'active' | 'inactive';
}

export default function AdminsPage() {
  const [admins, setAdmins] = useState<SuperAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [_showAddModal, setShowAddModal] = useState(false);
  const [_selectedAdmin, setSelectedAdmin] = useState<SuperAdmin | null>(null);

  const fetchAdmins = async () => {
    setLoading(true);
    setError('');

    try {
      setAdmins([
        {
          id: '1',
          email: 'admin@luseed.co.kr',
          name: '시스템 관리자',
          role: 'super_admin',
          last_login: new Date(Date.now() - 3600000).toISOString(),
          created_at: new Date('2024-01-01').toISOString(),
          status: 'active',
        },
        {
          id: '2',
          email: 'support@luseed.co.kr',
          name: '고객 지원',
          role: 'admin',
          last_login: new Date(Date.now() - 86400000).toISOString(),
          created_at: new Date('2024-06-15').toISOString(),
          status: 'active',
        },
      ]);
    } catch (err) {
      console.error('Admins fetch error:', err);
      setError('관리자 목록 조회에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('ko-KR');
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'super_admin': return '슈퍼 어드민';
      case 'admin': return '어드민';
      case 'viewer': return '뷰어';
      default: return role;
    }
  };

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case 'super_admin': return 'sa-badge-violet';
      case 'admin': return 'sa-badge-blue';
      default: return 'sa-badge-default';
    }
  };

  const filteredAdmins = admins.filter((admin) =>
    admin.name.toLowerCase().includes(search.toLowerCase()) ||
    admin.email.toLowerCase().includes(search.toLowerCase())
  );

  if (loading && admins.length === 0) {
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
    <div className="p-6 lg:p-8 max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-semibold text-[--sa-text-primary] tracking-tight">어드민 관리</h1>
          <p className="text-[13px] text-[--sa-text-tertiary] mt-1">슈퍼 어드민 계정 관리</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="sa-btn sa-btn-primary"
        >
          <Plus className="w-4 h-4" />
          어드민 추가
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 bg-[--sa-accent-red-muted] border border-[--sa-accent-red]/20 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-[--sa-accent-red] flex-shrink-0" />
          <p className="text-[13px] text-[--sa-accent-red]">{error}</p>
        </div>
      )}

      {/* Search */}
      <div className="sa-card p-4 mb-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[--sa-text-muted]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="이름 또는 이메일로 검색"
            className="sa-input w-full pl-11"
          />
        </div>
      </div>

      {/* Admin List */}
      <div className="sa-card overflow-hidden">
        <div className="divide-y divide-[--sa-border-subtle]">
          {filteredAdmins.length === 0 ? (
            <div className="p-8 text-center text-[13px] text-[--sa-text-muted]">
              등록된 어드민이 없습니다.
            </div>
          ) : (
            filteredAdmins.map((admin) => (
              <div
                key={admin.id}
                className="p-5 hover:bg-[--sa-bg-hover] transition-colors"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-[--sa-bg-tertiary] flex items-center justify-center flex-shrink-0">
                    <User className="w-6 h-6 text-[--sa-text-muted]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-[14px] font-semibold text-[--sa-text-primary]">{admin.name}</h3>
                      <span className={`sa-badge ${getRoleBadgeClass(admin.role)}`}>
                        {getRoleLabel(admin.role)}
                      </span>
                      {admin.status === 'inactive' && (
                        <span className="sa-badge sa-badge-default">비활성</span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-[12px] text-[--sa-text-muted]">
                      <span className="flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5" />
                        {admin.email}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        가입: {formatDate(admin.created_at)}
                      </span>
                    </div>
                    <p className="text-[11px] text-[--sa-text-tertiary] mt-2">
                      마지막 로그인: {admin.last_login ? formatDateTime(admin.last_login) : '기록 없음'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedAdmin(admin)}
                      className="p-2 text-[--sa-text-muted] hover:text-[--sa-text-secondary] hover:bg-[--sa-bg-tertiary] rounded-lg transition-colors"
                    >
                      <MoreVertical className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Role Permissions Info */}
      <div className="mt-8 sa-card p-6">
        <h2 className="text-[15px] font-semibold text-[--sa-text-primary] mb-4">역할별 권한</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-[--sa-accent-violet-muted] rounded-xl">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-5 h-5 text-[--sa-accent-violet]" />
              <h3 className="font-semibold text-[--sa-accent-violet]">슈퍼 어드민</h3>
            </div>
            <ul className="text-[12px] text-[--sa-accent-violet] space-y-1">
              <li>- 모든 기능 접근</li>
              <li>- 어드민 관리</li>
              <li>- 시스템 설정</li>
              <li>- 테넌트 삭제</li>
            </ul>
          </div>

          <div className="p-4 bg-[--sa-accent-blue-muted] rounded-xl">
            <div className="flex items-center gap-2 mb-3">
              <Key className="w-5 h-5 text-[--sa-accent-blue]" />
              <h3 className="font-semibold text-[--sa-accent-blue]">어드민</h3>
            </div>
            <ul className="text-[12px] text-[--sa-accent-blue] space-y-1">
              <li>- 테넌트 관리</li>
              <li>- 구독 관리</li>
              <li>- 모니터링</li>
              <li>- 감사 로그 조회</li>
            </ul>
          </div>

          <div className="p-4 bg-[--sa-bg-tertiary] rounded-xl">
            <div className="flex items-center gap-2 mb-3">
              <User className="w-5 h-5 text-[--sa-text-muted]" />
              <h3 className="font-semibold text-[--sa-text-secondary]">뷰어</h3>
            </div>
            <ul className="text-[12px] text-[--sa-text-muted] space-y-1">
              <li>- 대시보드 조회</li>
              <li>- 테넌트 목록 조회</li>
              <li>- 모니터링 조회</li>
              <li>- 읽기 전용</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
