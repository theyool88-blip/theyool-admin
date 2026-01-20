'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Link2,
  Calendar,
  FolderOpen,
  RefreshCw,
  Link2Off,
} from 'lucide-react';
import ApiKeyManager from '@/components/ApiKeyManager';
import type { TenantIntegration, GoogleCalendarListItem, IntegrationProvider } from '@/types/integration';

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<TenantIntegration[]>([]);
  const [calendars, setCalendars] = useState<GoogleCalendarListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectingProvider, setConnectingProvider] = useState<IntegrationProvider | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchIntegrations = async () => {
    setLoading(true);
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
      setLoading(false);
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
    fetchIntegrations();

    // URL 파라미터에서 성공/에러 메시지 확인
    const urlParams = new URLSearchParams(window.location.search);
    const successParam = urlParams.get('success');
    const errorParam = urlParams.get('error');

    if (successParam === 'calendar_connected') {
      setSuccess('Google Calendar가 연결되었습니다.');
      setTimeout(() => setSuccess(''), 5000);
      window.history.replaceState({}, '', '/admin/settings/integrations');
    } else if (successParam === 'drive_connected') {
      setSuccess('Google Drive가 연결되었습니다.');
      setTimeout(() => setSuccess(''), 5000);
      window.history.replaceState({}, '', '/admin/settings/integrations');
    } else if (errorParam) {
      setError(`연결 실패: ${errorParam}`);
      window.history.replaceState({}, '', '/admin/settings/integrations');
    }
  }, []);

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
                <div className="w-8 h-8 rounded-lg bg-[var(--color-info-muted)] flex items-center justify-center">
                  <Link2 className="w-4 h-4 text-[var(--color-info)]" />
                </div>
                <h1 className="text-lg font-bold text-[var(--text-primary)]">연동 설정</h1>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 탭 네비게이션 */}
        <div className="flex items-center gap-3 mb-5 text-sm">
          <div className="flex bg-[var(--bg-tertiary)] rounded-lg p-0.5">
            <Link
              href="/admin/settings"
              className="px-3 py-1.5 rounded-md transition-colors text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
            >
              상담 시간
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
            <span className="px-3 py-1.5 rounded-md bg-[var(--bg-secondary)] shadow-sm font-medium text-[var(--text-primary)]">
              연동
            </span>
            <Link
              href="/admin/settings/tenant"
              className="px-3 py-1.5 rounded-md transition-colors text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
            >
              사무소
            </Link>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-6 p-4 bg-[var(--color-danger-muted)] border border-[var(--color-danger)] rounded-lg">
            <p className="text-sm text-[var(--color-danger)]">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-[var(--color-success-muted)] border border-[var(--color-success)] rounded-lg">
            <p className="text-sm text-[var(--color-success)]">{success}</p>
          </div>
        )}

        <div className="space-y-6">
          {/* Google Integrations */}
          <div className="card p-6">
            <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Google 연동</h2>

            {loading ? (
              <div className="flex items-center gap-2 text-[var(--text-tertiary)]">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span className="text-sm">로딩 중...</span>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Google Calendar */}
                <div className="border border-[var(--border-default)] rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-[var(--color-info-muted)] flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-[var(--color-info)]" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[var(--text-primary)]">Google Calendar</p>
                        <p className="text-xs text-[var(--text-tertiary)]">
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
                          className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium text-[var(--color-danger)] bg-[var(--color-danger-muted)] rounded hover:opacity-80 disabled:opacity-50"
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
                          className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium text-white bg-[var(--color-info)] rounded hover:opacity-90 disabled:opacity-50"
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
                    <div className="mt-4 pt-4 border-t border-[var(--border-subtle)]">
                      <label className="form-label mb-2">
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
                        className="form-input"
                      >
                        <option value="">캘린더 선택...</option>
                        {calendars.map((cal) => (
                          <option key={cal.id} value={cal.id}>
                            {cal.summary} {cal.primary && '(기본)'}
                          </option>
                        ))}
                      </select>
                      {(getIntegration('google_calendar')?.settings as { calendarName?: string })?.calendarName && (
                        <p className="mt-1.5 text-xs text-[var(--text-tertiary)]">
                          현재 선택: {(getIntegration('google_calendar')?.settings as { calendarName?: string })?.calendarName}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Google Drive */}
                <div className="border border-[var(--border-default)] rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-[var(--color-success-muted)] flex items-center justify-center">
                        <FolderOpen className="w-5 h-5 text-[var(--color-success)]" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[var(--text-primary)]">Google Drive</p>
                        <p className="text-xs text-[var(--text-tertiary)]">
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
                          className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium text-[var(--color-danger)] bg-[var(--color-danger-muted)] rounded hover:opacity-80 disabled:opacity-50"
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
                          className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium text-white bg-[var(--color-success)] rounded hover:opacity-90 disabled:opacity-50"
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

          {/* API Key Manager */}
          <ApiKeyManager hasHomepage={true} />
        </div>
      </main>
    </div>
  );
}
