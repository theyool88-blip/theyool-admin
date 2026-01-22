'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Building2,
  Users,
  Briefcase,
  MessageSquare,
  User,
  Mail,
  Phone,
  MapPin,
  Globe,
  Save,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  ArrowLeft,
  Upload,
  Image as ImageIcon,
  Trash2,
} from 'lucide-react';
import Image from 'next/image';
import { TenantSettings, MemberRole } from '@/types/tenant';
import HomepageContentLinks from '@/components/homepage/HomepageContentLinks';

interface TenantData {
  id: string;
  name: string;
  slug: string;
  type: string;
  phone?: string;
  email?: string;
  address?: string;
  has_homepage: boolean;
  homepage_domain?: string;
  plan: string;
  features: Record<string, unknown>;
  settings: TenantSettings;
  status: string;
  created_at: string;
  logo_url?: string;
  logo_dark_url?: string;
}

interface MemberData {
  id: string;
  user_id: string;
  role: MemberRole;
  display_name?: string;
  email?: string;
  phone?: string;
  bar_number?: string;
  status: string;
  joined_at?: string;
}

interface Stats {
  cases: number;
  clients: number;
  consultations: number;
  members: number;
}

interface TenantInfo {
  tenant: TenantData;
  members: MemberData[];
  stats: Stats;
  currentMember: {
    id: string;
    role: MemberRole;
  };
}

export default function TenantSettingsPage() {
  const [info, setInfo] = useState<TenantInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
  });

  // Logo upload handler
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file
    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      setError('PNG, JPG, WebP, SVG 파일만 업로드 가능합니다.');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError('파일 크기는 2MB 이하여야 합니다.');
      return;
    }

    setUploadingLogo(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('logo', file);
      formData.append('type', 'light');

      const response = await fetch('/api/admin/tenant/logo', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!result.success) {
        setError(result.error || '로고 업로드에 실패했습니다.');
        return;
      }

      setSuccess('로고가 업로드되었습니다.');
      fetchTenantInfo();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Logo upload error:', err);
      setError('로고 업로드 중 오류가 발생했습니다.');
    } finally {
      setUploadingLogo(false);
      // Reset file input
      e.target.value = '';
    }
  };

  // Logo delete handler
  const handleLogoDelete = async () => {
    if (!confirm('로고를 삭제하시겠습니까?')) return;

    setUploadingLogo(true);
    setError('');

    try {
      const response = await fetch('/api/admin/tenant/logo?type=light', {
        method: 'DELETE',
      });

      const result = await response.json();

      if (!result.success) {
        setError(result.error || '로고 삭제에 실패했습니다.');
        return;
      }

      setSuccess('로고가 삭제되었습니다.');
      fetchTenantInfo();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Logo delete error:', err);
      setError('로고 삭제 중 오류가 발생했습니다.');
    } finally {
      setUploadingLogo(false);
    }
  };

  const fetchTenantInfo = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/admin/tenant');
      const result = await response.json();

      if (!result.success) {
        setError(result.error || '테넌트 정보를 가져올 수 없습니다.');
        return;
      }

      setInfo(result.data);
      setFormData({
        name: result.data.tenant.name || '',
        phone: result.data.tenant.phone || '',
        email: result.data.tenant.email || '',
        address: result.data.tenant.address || '',
      });
    } catch (err) {
      console.error('Tenant info fetch error:', err);
      setError('서버 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenantInfo();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/admin/tenant', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (!result.success) {
        setError(result.error || '저장에 실패했습니다.');
        return;
      }

      setSuccess('저장되었습니다.');
      fetchTenantInfo();

      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Save error:', err);
      setError('서버 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const canEdit = info && ['owner', 'admin'].includes(info.currentMember.role);

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const yy = String(date.getFullYear()).slice(2);
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yy}.${mm}.${dd}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-[var(--sage-primary)] mx-auto mb-2" />
          <p className="text-sm text-[var(--text-tertiary)]">로딩 중...</p>
        </div>
      </div>
    );
  }

  if (error && !info) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-8 h-8 text-[var(--color-danger)] mx-auto mb-2" />
          <p className="text-sm text-[var(--color-danger)] mb-4">{error}</p>
          <button
            onClick={fetchTenantInfo}
            className="text-sm text-[var(--sage-primary)] hover:underline"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  if (!info) return null;

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Header */}
      <header className="bg-[var(--bg-secondary)] border-b border-[var(--border-default)]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Link
                href="/admin/settings"
                className="p-2 hover:bg-[var(--bg-hover)] rounded -ml-2"
              >
                <ArrowLeft className="w-4 h-4 text-[var(--text-tertiary)]" />
              </Link>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[var(--sage-muted)] flex items-center justify-center">
                  <Building2 className="w-4 h-4 text-[var(--sage-primary)]" />
                </div>
                <h1 className="text-lg font-bold text-[var(--text-primary)]">사무소 설정</h1>
              </div>
            </div>
            {canEdit && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="btn btn-primary h-9 px-4 text-sm font-medium flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    저장 중...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    저장
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 탭 네비게이션 */}
        <div className="flex items-center gap-3 mb-5 text-sm overflow-x-auto">
          <div className="flex bg-[var(--bg-tertiary)] rounded-lg p-0.5">
            <Link
              href="/admin/settings/profile"
              className="px-3 py-1.5 rounded-md transition-colors text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
            >
              내 정보
            </Link>
            <Link
              href="/admin/settings/sources"
              className="px-3 py-1.5 rounded-md transition-colors text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
            >
              유입 경로
            </Link>
            <Link
              href="/admin/settings/team"
              className="px-3 py-1.5 rounded-md transition-colors text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
            >
              팀원 관리
            </Link>
            <Link
              href="/admin/settings/alerts"
              className="px-3 py-1.5 rounded-md transition-colors text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
            >
              알림
            </Link>
            <Link
              href="/admin/settings/integrations"
              className="px-3 py-1.5 rounded-md transition-colors text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
            >
              연동
            </Link>
            <span className="px-3 py-1.5 rounded-md bg-[var(--bg-secondary)] shadow-sm font-medium text-[var(--text-primary)]">
              사무소
            </span>
            <Link
              href="/admin/onboarding/import"
              className="px-3 py-1.5 rounded-md transition-colors text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
            >
              데이터 가져오기
            </Link>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-6 p-4 bg-[var(--color-danger-muted)] border border-[var(--color-danger)] rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-[var(--color-danger)] flex-shrink-0" />
            <p className="text-sm text-[var(--color-danger)]">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-[var(--color-success-muted)] border border-[var(--color-success)] rounded-lg flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-[var(--color-success)] flex-shrink-0" />
            <p className="text-sm text-[var(--color-success)]">{success}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Settings */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Info */}
            <div className="card p-6">
              <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">기본 정보</h2>

              <div className="space-y-4">
                <div className="form-group">
                  <label className="form-label">
                    사무소명
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      disabled={!canEdit}
                      className="form-input pl-10"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="form-group">
                    <label className="form-label">
                      전화번호
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        disabled={!canEdit}
                        className="form-input pl-10"
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      이메일
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        disabled={!canEdit}
                        className="form-input pl-10"
                      />
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    주소
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                    <input
                      type="text"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      disabled={!canEdit}
                      className="form-input pl-10"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Logo Settings */}
            <div className="card p-6">
              <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">로고</h2>

              <div className="flex items-start gap-6">
                {/* Current Logo Preview */}
                <div className="flex-shrink-0">
                  <div className="w-32 h-32 border-2 border-dashed border-[var(--border-default)] rounded-lg flex items-center justify-center bg-[var(--bg-primary)] overflow-hidden">
                    {info.tenant.logo_url ? (
                      <Image
                        src={info.tenant.logo_url}
                        alt="사무소 로고"
                        width={120}
                        height={120}
                        className="object-contain"
                      />
                    ) : (
                      <div className="text-center">
                        <ImageIcon className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-1" />
                        <p className="text-xs text-[var(--text-muted)]">로고 없음</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Upload Controls */}
                <div className="flex-1">
                  <p className="text-sm text-[var(--text-secondary)] mb-3">
                    관리자 화면 헤더에 표시될 로고를 업로드하세요.
                  </p>
                  <ul className="text-xs text-[var(--text-tertiary)] mb-4 space-y-1">
                    <li>- 권장 크기: 200x60px 이상</li>
                    <li>- 지원 형식: PNG, JPG, WebP, SVG</li>
                    <li>- 최대 크기: 2MB</li>
                  </ul>

                  {canEdit && (
                    <div className="flex items-center gap-2">
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/svg+xml"
                          onChange={handleLogoUpload}
                          disabled={uploadingLogo}
                          className="hidden"
                        />
                        <span className="btn btn-primary inline-flex items-center gap-2 h-9 px-4 text-sm font-medium">
                          {uploadingLogo ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              업로드 중...
                            </>
                          ) : (
                            <>
                              <Upload className="w-4 h-4" />
                              로고 업로드
                            </>
                          )}
                        </span>
                      </label>

                      {info.tenant.logo_url && (
                        <button
                          onClick={handleLogoDelete}
                          disabled={uploadingLogo}
                          className="inline-flex items-center gap-2 h-9 px-4 text-sm font-medium text-[var(--color-danger)] bg-[var(--color-danger-muted)] rounded hover:opacity-80 disabled:opacity-50"
                        >
                          <Trash2 className="w-4 h-4" />
                          삭제
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Homepage Content Links */}
            {canEdit && info.tenant.has_homepage && <HomepageContentLinks />}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Stats */}
            <div className="card p-6">
              <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">현황</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[var(--text-tertiary)]">
                    <Briefcase className="w-4 h-4" />
                    <span className="text-sm">사건</span>
                  </div>
                  <span className="text-sm font-medium text-[var(--text-primary)]">
                    {info.stats.cases}건
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[var(--text-tertiary)]">
                    <User className="w-4 h-4" />
                    <span className="text-sm">의뢰인</span>
                  </div>
                  <span className="text-sm font-medium text-[var(--text-primary)]">
                    {info.stats.clients}명
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[var(--text-tertiary)]">
                    <MessageSquare className="w-4 h-4" />
                    <span className="text-sm">상담</span>
                  </div>
                  <span className="text-sm font-medium text-[var(--text-primary)]">
                    {info.stats.consultations}건
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[var(--text-tertiary)]">
                    <Users className="w-4 h-4" />
                    <span className="text-sm">팀원</span>
                  </div>
                  <span className="text-sm font-medium text-[var(--text-primary)]">
                    {info.stats.members}명
                  </span>
                </div>
              </div>
            </div>

            {/* Plan Info */}
            <div className="card p-6">
              <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">플랜</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[var(--text-tertiary)]">현재 플랜</span>
                  <span className="text-sm font-medium text-[var(--sage-primary)]">
                    {info.tenant.plan === 'basic' && '베이직'}
                    {info.tenant.plan === 'professional' && '프로페셔널'}
                    {info.tenant.plan === 'enterprise' && '엔터프라이즈'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[var(--text-tertiary)]">가입일</span>
                  <span className="text-sm text-[var(--text-primary)]">
                    {formatDate(info.tenant.created_at)}
                  </span>
                </div>
                {info.tenant.has_homepage && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 text-[var(--text-tertiary)]">
                      <Globe className="w-4 h-4" />
                      <span className="text-sm">홈페이지</span>
                    </div>
                    <span className="text-sm text-[var(--sage-primary)]">연결됨</span>
                  </div>
                )}
              </div>
            </div>

            {/* Account Info */}
            <div className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg p-4">
              <p className="text-xs text-[var(--text-tertiary)]">
                슬러그: <span className="font-mono">{info.tenant.slug}</span>
              </p>
              <p className="text-xs text-[var(--text-tertiary)] mt-1">
                유형: {info.tenant.type === 'firm' ? '법무법인' : '개인 사무소'}
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
