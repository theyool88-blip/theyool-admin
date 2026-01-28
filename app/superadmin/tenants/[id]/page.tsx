'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Building2,
  Users,
  Briefcase,
  User,
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  Mail,
  Phone,
  Calendar,
  Globe,
  CreditCard,
  Activity,
  Settings,
  Edit2,
  Save,
  X,
  MessageSquare,
  UserPlus,
  ExternalLink,
  LogIn,
  FileText,
  HelpCircle,
  Trophy,
  Star,
  Instagram,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';

interface TenantDetail {
  id: string;
  name: string;
  slug: string;
  type: 'individual' | 'firm';
  email?: string;
  phone?: string;
  has_homepage: boolean;
  homepage_domain?: string;
  homepage_subdomain?: string;
  plan: 'basic' | 'professional' | 'enterprise';
  status: 'active' | 'suspended' | 'cancelled';
  created_at: string;
  updated_at: string;
}

interface HomepageStats {
  blogs: number;
  faqs: number;
  cases: number;
  testimonials: number;
  instagram: number;
}

interface TenantStats {
  members: number;
  cases: number;
  clients: number;
  consultations: number;
}

interface TenantMember {
  id: string;
  name: string;
  email: string;
  role: string;
  created_at: string;
}

type TabType = 'info' | 'subscription' | 'members' | 'usage' | 'activity';

export default function TenantDetailPage() {
  const params = useParams();
  const router = useRouter();
  const tenantId = params?.id as string;

  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [stats, setStats] = useState<TenantStats | null>(null);
  const [homepageStats, setHomepageStats] = useState<HomepageStats | null>(null);
  const [members, setMembers] = useState<TenantMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('info');
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    phone: '',
    status: '',
    plan: '',
  });
  const [saving, setSaving] = useState(false);
  const [impersonating, setImpersonating] = useState(false);
  const [togglingHomepage, setTogglingHomepage] = useState(false);

  const fetchTenant = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/superadmin/tenants/${tenantId}`);
      const result = await response.json();

      if (!result.success) {
        setError(result.error || '테넌트 정보를 조회할 수 없습니다.');
        return;
      }

      setTenant(result.data.tenant);
      setStats(result.data.stats);
      setHomepageStats(result.data.homepageStats || null);
      setMembers(result.data.members || []);
      setEditForm({
        name: result.data.tenant.name,
        email: result.data.tenant.email || '',
        phone: result.data.tenant.phone || '',
        status: result.data.tenant.status,
        plan: result.data.tenant.plan,
      });
    } catch (err) {
      console.error('Tenant fetch error:', err);
      setError('서버 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleHomepage = async () => {
    if (!tenant) return;

    setTogglingHomepage(true);
    setError('');

    try {
      const response = await fetch(`/api/superadmin/tenants/${tenantId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ has_homepage: !tenant.has_homepage }),
      });
      const result = await response.json();

      if (!result.success) {
        setError(result.error || '홈페이지 상태 변경에 실패했습니다.');
        return;
      }

      setTenant(result.data);
    } catch (err) {
      console.error('Toggle homepage error:', err);
      setError('홈페이지 상태 변경 중 오류가 발생했습니다.');
    } finally {
      setTogglingHomepage(false);
    }
  };

  useEffect(() => {
    if (tenantId) {
      fetchTenant();
    }
  }, [tenantId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/superadmin/tenants/${tenantId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      const result = await response.json();

      if (!result.success) {
        setError(result.error || '수정에 실패했습니다.');
        return;
      }

      setTenant(result.data);
      setIsEditing(false);
    } catch (err) {
      console.error('Save error:', err);
      setError('저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleImpersonate = async () => {
    setImpersonating(true);
    try {
      const response = await fetch('/api/superadmin/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId }),
        credentials: 'include',
      });
      const result = await response.json();

      if (!result.success) {
        setError(result.error || '대리 접속에 실패했습니다.');
        return;
      }

      setTimeout(() => {
        window.open('/admin', '_blank');
      }, 100);
    } catch (err) {
      console.error('Impersonate error:', err);
      setError('대리 접속 중 오류가 발생했습니다.');
    } finally {
      setImpersonating(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('ko-KR');
  };

  const getPlanLabel = (plan: string) => {
    switch (plan) {
      case 'enterprise': return '엔터프라이즈';
      case 'professional': return '프로페셔널';
      default: return '베이직';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return '활성';
      case 'suspended': return '정지';
      case 'cancelled': return '해지';
      default: return status;
    }
  };

  const getPlanBadgeClass = (plan: string) => {
    switch (plan) {
      case 'enterprise': return 'sa-badge-violet';
      case 'professional': return 'sa-badge-blue';
      default: return 'sa-badge-default';
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'active': return 'sa-badge-green';
      case 'suspended': return 'sa-badge-red';
      case 'cancelled': return 'sa-badge-default';
      default: return 'sa-badge-default';
    }
  };

  const tabs = [
    { id: 'info' as TabType, label: '기본 정보', icon: Settings },
    { id: 'subscription' as TabType, label: '구독', icon: CreditCard },
    { id: 'members' as TabType, label: '멤버', icon: Users },
    { id: 'usage' as TabType, label: '사용량', icon: Activity },
    { id: 'activity' as TabType, label: '활동 로그', icon: Calendar },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-6 h-6 animate-spin text-[--sa-text-muted] mx-auto mb-3" />
          <p className="text-[13px] text-[--sa-text-muted]">불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error && !tenant) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full bg-[--sa-accent-red-muted] flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-6 h-6 text-[--sa-accent-red]" />
          </div>
          <p className="text-[13px] text-[--sa-text-secondary] mb-4">{error}</p>
          <button
            onClick={() => router.back()}
            className="text-[13px] text-[--sa-text-muted] hover:text-[--sa-text-secondary] underline underline-offset-4"
          >
            뒤로 가기
          </button>
        </div>
      </div>
    );
  }

  if (!tenant) return null;

  return (
    <div className="p-6 lg:p-8 max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-[--sa-bg-hover] rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-[--sa-text-muted]" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-[--sa-bg-hover] border border-[--sa-border-subtle] flex items-center justify-center">
              {tenant.type === 'firm' ? (
                <Building2 className="w-5 h-5 text-[--sa-text-muted]" />
              ) : (
                <User className="w-5 h-5 text-[--sa-text-muted]" />
              )}
            </div>
            <div>
              <h1 className="text-[22px] font-semibold text-[--sa-text-primary] tracking-tight">{tenant.name}</h1>
              <p className="text-[13px] text-[--sa-text-muted] sa-mono">{tenant.slug}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`sa-badge ${getPlanBadgeClass(tenant.plan)}`}>
            {getPlanLabel(tenant.plan)}
          </span>
          <span className={`sa-badge ${getStatusBadgeClass(tenant.status)}`}>
            {getStatusLabel(tenant.status)}
          </span>
          {tenant.status === 'active' && (
            <button
              onClick={handleImpersonate}
              disabled={impersonating}
              className="sa-btn sa-btn-primary ml-2"
            >
              {impersonating ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <LogIn className="w-4 h-4" />
              )}
              테넌트로 접속
              <ExternalLink className="w-3.5 h-3.5 opacity-70" />
            </button>
          )}
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-6 p-3 bg-[--sa-accent-red-muted] border border-[--sa-accent-red]/20 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-4 h-4 text-[--sa-accent-red] flex-shrink-0" />
          <p className="text-[12px] text-[--sa-accent-red]">{error}</p>
        </div>
      )}

      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="sa-card p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[--sa-accent-blue-muted] flex items-center justify-center">
                <Users className="w-4 h-4 text-[--sa-accent-blue]" />
              </div>
              <div>
                <p className="text-xl font-semibold text-[--sa-text-primary]">{stats.members}</p>
                <p className="text-[11px] text-[--sa-text-muted]">멤버</p>
              </div>
            </div>
          </div>
          <div className="sa-card p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[--sa-accent-green-muted] flex items-center justify-center">
                <Briefcase className="w-4 h-4 text-[--sa-accent-green]" />
              </div>
              <div>
                <p className="text-xl font-semibold text-[--sa-text-primary]">{stats.cases}</p>
                <p className="text-[11px] text-[--sa-text-muted]">사건</p>
              </div>
            </div>
          </div>
          <div className="sa-card p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[--sa-accent-violet-muted] flex items-center justify-center">
                <UserPlus className="w-4 h-4 text-[--sa-accent-violet]" />
              </div>
              <div>
                <p className="text-xl font-semibold text-[--sa-text-primary]">{stats.clients}</p>
                <p className="text-[11px] text-[--sa-text-muted]">의뢰인</p>
              </div>
            </div>
          </div>
          <div className="sa-card p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[--sa-accent-orange-muted] flex items-center justify-center">
                <MessageSquare className="w-4 h-4 text-[--sa-accent-orange]" />
              </div>
              <div>
                <p className="text-xl font-semibold text-[--sa-text-primary]">{stats.consultations}</p>
                <p className="text-[11px] text-[--sa-text-muted]">상담</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="sa-card overflow-hidden">
        <div className="border-b border-[--sa-border-subtle]">
          <div className="flex overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-3.5 text-[13px] font-medium whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'text-[--sa-text-primary] border-b-2 border-[--sa-text-primary]'
                    : 'text-[--sa-text-muted] hover:text-[--sa-text-secondary]'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-5">
          {/* Info Tab */}
          {activeTab === 'info' && (
            <div>
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-[15px] font-semibold text-[--sa-text-primary]">기본 정보</h3>
                {!isEditing ? (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="sa-btn sa-btn-ghost"
                  >
                    <Edit2 className="w-4 h-4" />
                    수정
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsEditing(false)}
                      className="sa-btn sa-btn-ghost"
                    >
                      <X className="w-4 h-4" />
                      취소
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="sa-btn sa-btn-primary"
                    >
                      {saving ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                      저장
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-[11px] font-medium text-[--sa-text-muted] uppercase tracking-wider mb-2">
                      테넌트 이름
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        className="sa-input w-full"
                      />
                    ) : (
                      <p className="text-[14px] text-[--sa-text-primary]">{tenant.name}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[--sa-text-muted] uppercase tracking-wider mb-2">
                      슬러그
                    </label>
                    <p className="text-[14px] text-[--sa-text-primary] sa-mono">{tenant.slug}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-[11px] font-medium text-[--sa-text-muted] uppercase tracking-wider mb-2">
                      <span className="inline-flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        이메일
                      </span>
                    </label>
                    {isEditing ? (
                      <input
                        type="email"
                        value={editForm.email}
                        onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                        className="sa-input w-full"
                      />
                    ) : (
                      <p className="text-[14px] text-[--sa-text-primary]">{tenant.email || '-'}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[--sa-text-muted] uppercase tracking-wider mb-2">
                      <span className="inline-flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        전화번호
                      </span>
                    </label>
                    {isEditing ? (
                      <input
                        type="tel"
                        value={editForm.phone}
                        onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                        className="sa-input w-full"
                      />
                    ) : (
                      <p className="text-[14px] text-[--sa-text-primary]">{tenant.phone || '-'}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-[11px] font-medium text-[--sa-text-muted] uppercase tracking-wider mb-2">
                      유형
                    </label>
                    <p className="text-[14px] text-[--sa-text-primary]">
                      {tenant.type === 'firm' ? '법무법인' : '개인 사무소'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[--sa-text-muted] uppercase tracking-wider mb-2">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        가입일
                      </span>
                    </label>
                    <p className="text-[14px] text-[--sa-text-primary]">{formatDate(tenant.created_at)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-[11px] font-medium text-[--sa-text-muted] uppercase tracking-wider mb-2">
                      최근 수정일
                    </label>
                    <p className="text-[14px] text-[--sa-text-primary]">{formatDateTime(tenant.updated_at)}</p>
                  </div>
                </div>
              </div>

              {/* Homepage Section */}
              <div className="mt-6 pt-6 border-t border-[--sa-border-subtle]">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-[15px] font-semibold text-[--sa-text-primary] flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    홈페이지 설정
                  </h3>
                  <button
                    onClick={handleToggleHomepage}
                    disabled={togglingHomepage || tenant.plan === 'basic'}
                    className={`sa-btn sa-btn-ghost ${
                      tenant.has_homepage ? 'text-[--sa-accent-red]' : 'text-[--sa-accent-green]'
                    }`}
                    title={tenant.plan === 'basic' ? '베이직 플랜에서는 홈페이지를 사용할 수 없습니다' : ''}
                  >
                    {togglingHomepage ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : tenant.has_homepage ? (
                      <ToggleRight className="w-5 h-5" />
                    ) : (
                      <ToggleLeft className="w-5 h-5" />
                    )}
                    {tenant.has_homepage ? '비활성화' : '활성화'}
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-[11px] font-medium text-[--sa-text-muted] uppercase tracking-wider mb-2">
                        홈페이지 상태
                      </label>
                      <span className={`sa-badge ${tenant.has_homepage ? 'sa-badge-green' : 'sa-badge-default'}`}>
                        {tenant.has_homepage ? '활성' : '비활성'}
                      </span>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-[--sa-text-muted] uppercase tracking-wider mb-2">
                        도메인
                      </label>
                      {tenant.has_homepage ? (
                        <a
                          href={`https://${tenant.homepage_domain || `${tenant.slug}.luseed.co.kr`}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[14px] text-[--sa-accent-blue] hover:underline flex items-center gap-1"
                        >
                          {tenant.homepage_domain || `${tenant.slug}.luseed.co.kr`}
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      ) : (
                        <p className="text-[14px] text-[--sa-text-muted]">-</p>
                      )}
                    </div>
                  </div>

                  {/* Homepage Content Stats */}
                  {tenant.has_homepage && homepageStats && (
                    <div className="bg-[--sa-bg-hover] rounded-lg p-4">
                      <h4 className="text-[12px] font-medium text-[--sa-text-secondary] mb-3">콘텐츠 현황</h4>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-[--sa-accent-blue-muted] flex items-center justify-center">
                            <FileText className="w-3.5 h-3.5 text-[--sa-accent-blue]" />
                          </div>
                          <div>
                            <p className="text-[14px] font-semibold text-[--sa-text-primary]">{homepageStats.blogs}</p>
                            <p className="text-[10px] text-[--sa-text-muted]">블로그</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-[--sa-accent-orange-muted] flex items-center justify-center">
                            <HelpCircle className="w-3.5 h-3.5 text-[--sa-accent-orange]" />
                          </div>
                          <div>
                            <p className="text-[14px] font-semibold text-[--sa-text-primary]">{homepageStats.faqs}</p>
                            <p className="text-[10px] text-[--sa-text-muted]">FAQ</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-[--sa-accent-green-muted] flex items-center justify-center">
                            <Trophy className="w-3.5 h-3.5 text-[--sa-accent-green]" />
                          </div>
                          <div>
                            <p className="text-[14px] font-semibold text-[--sa-text-primary]">{homepageStats.cases}</p>
                            <p className="text-[10px] text-[--sa-text-muted]">성공사례</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-[--sa-accent-violet-muted] flex items-center justify-center">
                            <Star className="w-3.5 h-3.5 text-[--sa-accent-violet]" />
                          </div>
                          <div>
                            <p className="text-[14px] font-semibold text-[--sa-text-primary]">{homepageStats.testimonials}</p>
                            <p className="text-[10px] text-[--sa-text-muted]">후기</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-[--sa-accent-pink-muted] flex items-center justify-center">
                            <Instagram className="w-3.5 h-3.5 text-[--sa-accent-pink]" />
                          </div>
                          <div>
                            <p className="text-[14px] font-semibold text-[--sa-text-primary]">{homepageStats.instagram}</p>
                            <p className="text-[10px] text-[--sa-text-muted]">Instagram</p>
                          </div>
                        </div>
                      </div>
                      <p className="mt-3 text-[11px] text-[--sa-text-muted]">
                        콘텐츠를 관리하려면 &quot;테넌트로 접속&quot; 버튼을 클릭하여 해당 테넌트의 관리자 페이지에서 관리하세요.
                      </p>
                    </div>
                  )}

                  {tenant.plan === 'basic' && !tenant.has_homepage && (
                    <div className="bg-[--sa-accent-orange-muted] border border-[--sa-accent-orange]/20 rounded-lg p-3">
                      <p className="text-[12px] text-[--sa-accent-orange]">
                        베이직 플랜에서는 홈페이지 기능을 사용할 수 없습니다.
                        프로페셔널 또는 엔터프라이즈 플랜으로 업그레이드하면 홈페이지 기능을 활성화할 수 있습니다.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Subscription Tab */}
          {activeTab === 'subscription' && (
            <div>
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-[15px] font-semibold text-[--sa-text-primary]">구독 정보</h3>
              </div>

              <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-[11px] font-medium text-[--sa-text-muted] uppercase tracking-wider mb-2">
                      현재 플랜
                    </label>
                    {isEditing ? (
                      <select
                        value={editForm.plan}
                        onChange={(e) => setEditForm({ ...editForm, plan: e.target.value })}
                        className="sa-input w-full"
                      >
                        <option value="basic">베이직</option>
                        <option value="professional">프로페셔널</option>
                        <option value="enterprise">엔터프라이즈</option>
                      </select>
                    ) : (
                      <span className={`sa-badge ${getPlanBadgeClass(tenant.plan)}`}>
                        {getPlanLabel(tenant.plan)}
                      </span>
                    )}
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[--sa-text-muted] uppercase tracking-wider mb-2">
                      상태
                    </label>
                    {isEditing ? (
                      <select
                        value={editForm.status}
                        onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                        className="sa-input w-full"
                      >
                        <option value="active">활성</option>
                        <option value="suspended">정지</option>
                        <option value="cancelled">해지</option>
                      </select>
                    ) : (
                      <span className={`sa-badge ${getStatusBadgeClass(tenant.status)}`}>
                        {getStatusLabel(tenant.status)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="bg-[--sa-bg-hover] rounded-lg p-4">
                  <h4 className="text-[12px] font-medium text-[--sa-text-secondary] mb-3">플랜 기능</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-[13px]">
                    <div>
                      <p className="text-[10px] text-[--sa-text-muted] uppercase tracking-wider mb-1">멤버 수</p>
                      <p className="text-[--sa-text-primary]">
                        {tenant.plan === 'enterprise' ? '무제한' : tenant.plan === 'professional' ? '10명' : '3명'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[--sa-text-muted] uppercase tracking-wider mb-1">저장 용량</p>
                      <p className="text-[--sa-text-primary]">
                        {tenant.plan === 'enterprise' ? '무제한' : tenant.plan === 'professional' ? '50GB' : '10GB'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[--sa-text-muted] uppercase tracking-wider mb-1">홈페이지</p>
                      <p className="text-[--sa-text-primary]">{tenant.plan === 'basic' ? '불가' : '가능'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[--sa-text-muted] uppercase tracking-wider mb-1">API 접근</p>
                      <p className="text-[--sa-text-primary]">{tenant.plan === 'enterprise' ? '가능' : '불가'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Members Tab */}
          {activeTab === 'members' && (
            <div>
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-[15px] font-semibold text-[--sa-text-primary]">
                  멤버 목록 ({members.length})
                </h3>
              </div>

              {members.length === 0 ? (
                <div className="text-center py-10 text-[13px] text-[--sa-text-muted]">
                  등록된 멤버가 없습니다.
                </div>
              ) : (
                <div className="space-y-2">
                  {members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center gap-4 p-3 bg-[--sa-bg-hover] rounded-lg"
                    >
                      <div className="w-9 h-9 rounded-lg bg-[--sa-bg-secondary] border border-[--sa-border-subtle] flex items-center justify-center">
                        <User className="w-4 h-4 text-[--sa-text-muted]" />
                      </div>
                      <div className="flex-1">
                        <p className="text-[13px] font-medium text-[--sa-text-primary]">{member.name}</p>
                        <p className="text-[11px] text-[--sa-text-muted]">{member.email}</p>
                      </div>
                      <div className="text-right">
                        <span className="sa-badge sa-badge-default text-[10px]">
                          {member.role === 'owner' ? '소유자' : member.role === 'admin' ? '관리자' : '멤버'}
                        </span>
                        <p className="text-[10px] text-[--sa-text-muted] mt-1">
                          {formatDate(member.created_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Usage Tab */}
          {activeTab === 'usage' && (
            <div>
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-[15px] font-semibold text-[--sa-text-primary]">사용량 통계</h3>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-[--sa-bg-hover] rounded-lg p-4">
                    <h4 className="text-[12px] font-medium text-[--sa-text-secondary] mb-3">사건 관리</h4>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] text-[--sa-text-muted]">전체 사건</span>
                        <span className="text-[12px] font-medium text-[--sa-text-primary]">{stats?.cases || 0}건</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] text-[--sa-text-muted]">진행 중</span>
                        <span className="text-[12px] font-medium text-[--sa-text-primary]">-</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] text-[--sa-text-muted]">완료</span>
                        <span className="text-[12px] font-medium text-[--sa-text-primary]">-</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-[--sa-bg-hover] rounded-lg p-4">
                    <h4 className="text-[12px] font-medium text-[--sa-text-secondary] mb-3">의뢰인 관리</h4>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] text-[--sa-text-muted]">전체 의뢰인</span>
                        <span className="text-[12px] font-medium text-[--sa-text-primary]">{stats?.clients || 0}명</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] text-[--sa-text-muted]">개인</span>
                        <span className="text-[12px] font-medium text-[--sa-text-primary]">-</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] text-[--sa-text-muted]">법인</span>
                        <span className="text-[12px] font-medium text-[--sa-text-primary]">-</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-[--sa-bg-hover] rounded-lg p-4">
                  <h4 className="text-[12px] font-medium text-[--sa-text-secondary] mb-3">상담 현황</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] text-[--sa-text-muted]">전체 상담</span>
                      <span className="text-[12px] font-medium text-[--sa-text-primary]">{stats?.consultations || 0}건</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] text-[--sa-text-muted]">이번 달</span>
                      <span className="text-[12px] font-medium text-[--sa-text-primary]">-</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] text-[--sa-text-muted]">수임 전환</span>
                      <span className="text-[12px] font-medium text-[--sa-text-primary]">-</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Activity Tab */}
          {activeTab === 'activity' && (
            <div>
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-[15px] font-semibold text-[--sa-text-primary]">활동 로그</h3>
              </div>

              <div className="text-center py-10 text-[13px] text-[--sa-text-muted]">
                활동 로그 기능이 준비 중입니다.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
