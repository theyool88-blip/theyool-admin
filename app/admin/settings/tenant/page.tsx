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
  Crown,
  Shield,
  Scale,
  UserCircle,
  Upload,
  Image as ImageIcon,
  Trash2,
  Calendar,
  FolderOpen,
  Link2,
  Link2Off,
} from 'lucide-react';
import Image from 'next/image';
import { TenantSettings, MemberRole, ROLE_DISPLAY_NAMES } from '@/types/tenant';
import type { TenantIntegration, GoogleCalendarListItem, IntegrationProvider } from '@/types/integration';
import StaffLawyerAssignments from '@/components/StaffLawyerAssignments';
import HomepageSettings from '@/components/HomepageSettings';
import ApiKeyManager from '@/components/ApiKeyManager';
import HomepageMonitoring from '@/components/HomepageMonitoring';
import AlertSettings from '@/components/AlertSettings';
import DomainSettings from '@/components/DomainSettings';
import AnalyticsDashboard from '@/components/AnalyticsDashboard';

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

  // Google Integrations state
  const [integrations, setIntegrations] = useState<TenantIntegration[]>([]);
  const [calendars, setCalendars] = useState<GoogleCalendarListItem[]>([]);
  const [loadingIntegrations, setLoadingIntegrations] = useState(false);
  const [connectingProvider, setConnectingProvider] = useState<IntegrationProvider | null>(null);

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

  // Google Integrations 관련 함수들
  const fetchIntegrations = async () => {
    setLoadingIntegrations(true);
    try {
      const response = await fetch('/api/admin/tenant/integrations');
      const result = await response.json();

      if (result.success) {
        setIntegrations(result.data || []);

        // Calendar 연동이 있으면 캘린더 목록도 가져오기
        const calendarIntegration = result.data?.find(
          (i: TenantIntegration) => i.provider === 'google_calendar' && i.status === 'connected'
        );

        if (calendarIntegration) {
          const calendarResponse = await fetch('/api/admin/tenant/integrations/google_calendar');
          const calendarResult = await calendarResponse.json();
          if (calendarResult.success && calendarResult.calendars) {
            setCalendars(calendarResult.calendars);
          }
        }
      }
    } catch (err) {
      console.error('Integrations fetch error:', err);
    } finally {
      setLoadingIntegrations(false);
    }
  };

  const handleConnectIntegration = async (provider: IntegrationProvider) => {
    setConnectingProvider(provider);
    setError('');

    try {
      const response = await fetch('/api/admin/tenant/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      });

      const result = await response.json();

      if (!result.success) {
        setError(result.error || '연결에 실패했습니다.');
        return;
      }

      // OAuth URL로 리다이렉트
      if (result.authUrl) {
        window.location.href = result.authUrl;
      }
    } catch (err) {
      console.error('Connect integration error:', err);
      setError('연결 중 오류가 발생했습니다.');
    } finally {
      setConnectingProvider(null);
    }
  };

  const handleDisconnectIntegration = async (provider: IntegrationProvider) => {
    if (!confirm('연동을 해제하시겠습니까?')) return;

    setConnectingProvider(provider);
    setError('');

    try {
      const response = await fetch(`/api/admin/tenant/integrations?provider=${provider}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (!result.success) {
        setError(result.error || '연동 해제에 실패했습니다.');
        return;
      }

      setSuccess('연동이 해제되었습니다.');
      fetchIntegrations();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Disconnect integration error:', err);
      setError('연동 해제 중 오류가 발생했습니다.');
    } finally {
      setConnectingProvider(null);
    }
  };

  const handleSelectCalendar = async (calendarId: string, calendarName: string) => {
    setError('');

    try {
      const response = await fetch('/api/admin/tenant/integrations/google_calendar', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: { calendarId, calendarName },
        }),
      });

      const result = await response.json();

      if (!result.success) {
        setError(result.error || '캘린더 설정에 실패했습니다.');
        return;
      }

      setSuccess('캘린더가 설정되었습니다.');
      fetchIntegrations();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Select calendar error:', err);
      setError('캘린더 설정 중 오류가 발생했습니다.');
    }
  };

  const getIntegration = (provider: IntegrationProvider) => {
    return integrations.find((i) => i.provider === provider);
  };

  useEffect(() => {
    fetchTenantInfo();
    fetchIntegrations();

    // URL 파라미터에서 성공/에러 메시지 확인
    const urlParams = new URLSearchParams(window.location.search);
    const successParam = urlParams.get('success');
    const errorParam = urlParams.get('error');

    if (successParam === 'calendar_connected') {
      setSuccess('Google Calendar가 연결되었습니다.');
      setTimeout(() => setSuccess(''), 5000);
      // URL에서 파라미터 제거
      window.history.replaceState({}, '', '/admin/settings/tenant');
    } else if (successParam === 'drive_connected') {
      setSuccess('Google Drive가 연결되었습니다.');
      setTimeout(() => setSuccess(''), 5000);
      window.history.replaceState({}, '', '/admin/settings/tenant');
    } else if (errorParam) {
      setError(`연결 실패: ${errorParam}`);
      window.history.replaceState({}, '', '/admin/settings/tenant');
    }
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

  const getRoleIcon = (role: MemberRole) => {
    switch (role) {
      case 'owner':
        return <Crown className="w-4 h-4 text-amber-500" />;
      case 'admin':
        return <Shield className="w-4 h-4 text-blue-500" />;
      case 'lawyer':
        return <Scale className="w-4 h-4 text-sage-500" />;
      default:
        return <UserCircle className="w-4 h-4 text-gray-400" />;
    }
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

  if (error && !info) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
          <p className="text-sm text-red-600 mb-4">{error}</p>
          <button
            onClick={fetchTenantInfo}
            className="text-sm text-sage-600 hover:underline"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  if (!info) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Link
                href="/admin/settings"
                className="p-2 hover:bg-gray-100 rounded -ml-2"
              >
                <ArrowLeft className="w-4 h-4 text-gray-500" />
              </Link>
              <h1 className="text-lg font-bold text-gray-900">사무소 설정</h1>
            </div>
            {canEdit && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="h-9 px-4 text-sm font-medium text-white bg-sage-600 rounded hover:bg-sage-700 disabled:opacity-50 flex items-center gap-2"
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
        {/* Alerts */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
            <p className="text-sm text-green-600">{success}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Settings */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Info */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">기본 정보</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    사무소명
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      disabled={!canEdit}
                      className="w-full h-10 pl-10 pr-3 text-sm border border-gray-200 rounded focus:outline-none focus:border-sage-500 focus:ring-1 focus:ring-sage-500 disabled:bg-gray-50 disabled:text-gray-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">
                      전화번호
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        disabled={!canEdit}
                        className="w-full h-10 pl-10 pr-3 text-sm border border-gray-200 rounded focus:outline-none focus:border-sage-500 focus:ring-1 focus:ring-sage-500 disabled:bg-gray-50 disabled:text-gray-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">
                      이메일
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        disabled={!canEdit}
                        className="w-full h-10 pl-10 pr-3 text-sm border border-gray-200 rounded focus:outline-none focus:border-sage-500 focus:ring-1 focus:ring-sage-500 disabled:bg-gray-50 disabled:text-gray-500"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    주소
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      disabled={!canEdit}
                      className="w-full h-10 pl-10 pr-3 text-sm border border-gray-200 rounded focus:outline-none focus:border-sage-500 focus:ring-1 focus:ring-sage-500 disabled:bg-gray-50 disabled:text-gray-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Logo Settings */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">로고</h2>

              <div className="flex items-start gap-6">
                {/* Current Logo Preview */}
                <div className="flex-shrink-0">
                  <div className="w-32 h-32 border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center bg-gray-50 overflow-hidden">
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
                        <ImageIcon className="w-8 h-8 text-gray-300 mx-auto mb-1" />
                        <p className="text-xs text-gray-400">로고 없음</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Upload Controls */}
                <div className="flex-1">
                  <p className="text-sm text-gray-600 mb-3">
                    관리자 화면 헤더에 표시될 로고를 업로드하세요.
                  </p>
                  <ul className="text-xs text-gray-500 mb-4 space-y-1">
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
                        <span className="inline-flex items-center gap-2 h-9 px-4 text-sm font-medium text-white bg-sage-600 rounded hover:bg-sage-700 disabled:opacity-50">
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
                          className="inline-flex items-center gap-2 h-9 px-4 text-sm font-medium text-red-600 bg-red-50 rounded hover:bg-red-100 disabled:opacity-50"
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

            {/* Google Integrations */}
            {canEdit && (
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h2 className="text-sm font-semibold text-gray-900 mb-4">Google 연동</h2>

                {loadingIntegrations ? (
                  <div className="flex items-center gap-2 text-gray-500">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span className="text-sm">로딩 중...</span>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Google Calendar */}
                    <div className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                            <Calendar className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">Google Calendar</p>
                            <p className="text-xs text-gray-500">
                              {getIntegration('google_calendar')?.status === 'connected'
                                ? '연결됨'
                                : '연결되지 않음'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {getIntegration('google_calendar')?.status === 'connected' ? (
                            <button
                              onClick={() => handleDisconnectIntegration('google_calendar')}
                              disabled={connectingProvider === 'google_calendar'}
                              className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium text-red-600 bg-red-50 rounded hover:bg-red-100 disabled:opacity-50"
                            >
                              {connectingProvider === 'google_calendar' ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Link2Off className="w-3.5 h-3.5" />
                              )}
                              연결 해제
                            </button>
                          ) : (
                            <button
                              onClick={() => handleConnectIntegration('google_calendar')}
                              disabled={connectingProvider === 'google_calendar'}
                              className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
                            >
                              {connectingProvider === 'google_calendar' ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Link2 className="w-3.5 h-3.5" />
                              )}
                              연결하기
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Calendar Selection */}
                      {getIntegration('google_calendar')?.status === 'connected' && calendars.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-gray-100">
                          <label className="block text-xs font-medium text-gray-700 mb-2">
                            동기화할 캘린더
                          </label>
                          <select
                            value={(getIntegration('google_calendar')?.settings as { calendarId?: string })?.calendarId || ''}
                            onChange={(e) => {
                              const selected = calendars.find((c) => c.id === e.target.value);
                              if (selected) {
                                handleSelectCalendar(selected.id, selected.summary);
                              }
                            }}
                            className="w-full h-9 px-3 text-sm border border-gray-200 rounded focus:outline-none focus:border-sage-500 focus:ring-1 focus:ring-sage-500"
                          >
                            <option value="">캘린더 선택...</option>
                            {calendars.map((cal) => (
                              <option key={cal.id} value={cal.id}>
                                {cal.summary} {cal.primary && '(기본)'}
                              </option>
                            ))}
                          </select>
                          {(getIntegration('google_calendar')?.settings as { calendarName?: string })?.calendarName && (
                            <p className="mt-1.5 text-xs text-gray-500">
                              현재 선택: {(getIntegration('google_calendar')?.settings as { calendarName?: string })?.calendarName}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Google Drive */}
                    <div className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
                            <FolderOpen className="w-5 h-5 text-green-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">Google Drive</p>
                            <p className="text-xs text-gray-500">
                              {getIntegration('google_drive')?.status === 'connected'
                                ? '연결됨'
                                : '연결되지 않음'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {getIntegration('google_drive')?.status === 'connected' ? (
                            <button
                              onClick={() => handleDisconnectIntegration('google_drive')}
                              disabled={connectingProvider === 'google_drive'}
                              className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium text-red-600 bg-red-50 rounded hover:bg-red-100 disabled:opacity-50"
                            >
                              {connectingProvider === 'google_drive' ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Link2Off className="w-3.5 h-3.5" />
                              )}
                              연결 해제
                            </button>
                          ) : (
                            <button
                              onClick={() => handleConnectIntegration('google_drive')}
                              disabled={connectingProvider === 'google_drive'}
                              className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700 disabled:opacity-50"
                            >
                              {connectingProvider === 'google_drive' ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Link2 className="w-3.5 h-3.5" />
                              )}
                              연결하기
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Members List */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-gray-900">팀원</h2>
                {info.tenant.type === 'firm' && canEdit && (
                  <button
                    className="text-xs text-sage-600 hover:underline"
                    onClick={() => {
                      // TODO: 팀원 초대 모달
                      alert('팀원 초대 기능은 추후 지원됩니다.');
                    }}
                  >
                    + 팀원 초대
                  </button>
                )}
              </div>

              <div className="space-y-3">
                {info.members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="w-10 h-10 rounded-full bg-sage-100 flex items-center justify-center flex-shrink-0">
                      {getRoleIcon(member.role)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {member.display_name || '이름 없음'}
                        </p>
                        <span className="text-xs px-1.5 py-0.5 bg-gray-200 text-gray-600 rounded">
                          {ROLE_DISPLAY_NAMES[member.role]}
                        </span>
                        {member.id === info.currentMember.id && (
                          <span className="text-xs text-sage-600">(나)</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 truncate">
                        {member.email || member.bar_number || '-'}
                      </p>
                    </div>
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${
                        member.status === 'active'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {member.status === 'active' ? '활성' : member.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Staff-Lawyer Assignments */}
            {canEdit && <StaffLawyerAssignments />}

            {/* Domain Settings */}
            {canEdit && <DomainSettings hasHomepage={info.tenant.has_homepage} />}

            {/* Homepage Settings */}
            {canEdit && <HomepageSettings hasHomepage={info.tenant.has_homepage} />}

            {/* API Key Manager */}
            {canEdit && <ApiKeyManager hasHomepage={info.tenant.has_homepage} />}

            {/* Homepage Monitoring */}
            {canEdit && <HomepageMonitoring hasHomepage={info.tenant.has_homepage} />}

            {/* Alert Settings */}
            {canEdit && <AlertSettings hasHomepage={info.tenant.has_homepage} />}

            {/* Analytics Dashboard */}
            {canEdit && <AnalyticsDashboard hasHomepage={info.tenant.has_homepage} />}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Stats */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">현황</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-gray-500">
                    <Briefcase className="w-4 h-4" />
                    <span className="text-sm">사건</span>
                  </div>
                  <span className="text-sm font-medium text-gray-900">
                    {info.stats.cases}건
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-gray-500">
                    <User className="w-4 h-4" />
                    <span className="text-sm">의뢰인</span>
                  </div>
                  <span className="text-sm font-medium text-gray-900">
                    {info.stats.clients}명
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-gray-500">
                    <MessageSquare className="w-4 h-4" />
                    <span className="text-sm">상담</span>
                  </div>
                  <span className="text-sm font-medium text-gray-900">
                    {info.stats.consultations}건
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-gray-500">
                    <Users className="w-4 h-4" />
                    <span className="text-sm">팀원</span>
                  </div>
                  <span className="text-sm font-medium text-gray-900">
                    {info.stats.members}명
                  </span>
                </div>
              </div>
            </div>

            {/* Plan Info */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">플랜</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">현재 플랜</span>
                  <span className="text-sm font-medium text-sage-600">
                    {info.tenant.plan === 'basic' && '베이직'}
                    {info.tenant.plan === 'professional' && '프로페셔널'}
                    {info.tenant.plan === 'enterprise' && '엔터프라이즈'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">가입일</span>
                  <span className="text-sm text-gray-900">
                    {formatDate(info.tenant.created_at)}
                  </span>
                </div>
                {info.tenant.has_homepage && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 text-gray-500">
                      <Globe className="w-4 h-4" />
                      <span className="text-sm">홈페이지</span>
                    </div>
                    <span className="text-sm text-sage-600">연결됨</span>
                  </div>
                )}
              </div>
            </div>

            {/* Account Info */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="text-xs text-gray-500">
                슬러그: <span className="font-mono">{info.tenant.slug}</span>
              </p>
              <p className="text-xs text-gray-500 mt-1">
                유형: {info.tenant.type === 'firm' ? '법무법인' : '개인 사무소'}
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
