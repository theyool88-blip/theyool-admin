'use client';

import { useEffect, useState } from 'react';
import {
  Bell,
  Save,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  MessageSquare,
  Calendar,
  AlertTriangle,
  FileText,
  Mail,
  Send,
  TestTube,
} from 'lucide-react';

interface AlertSettingsData {
  slackWebhookUrl?: string;
  slackEnabled: boolean;
  emailEnabled: boolean;
  emailRecipients: string[];
  alertOnNewConsultation: boolean;
  alertOnNewBooking: boolean;
  alertOnAnomaly: boolean;
  dailyReportEnabled: boolean;
  dailyReportTime: string;
}

interface AlertSettingsProps {
  hasHomepage: boolean;
}

export default function AlertSettings({ hasHomepage }: AlertSettingsProps) {
  const [settings, setSettings] = useState<AlertSettingsData>({
    slackEnabled: false,
    emailEnabled: false,
    emailRecipients: [],
    alertOnNewConsultation: true,
    alertOnNewBooking: true,
    alertOnAnomaly: true,
    dailyReportEnabled: false,
    dailyReportTime: '09:00',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<'slack' | 'email' | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // 새 Webhook URL 입력용 (마스킹된 값과 분리)
  const [newWebhookUrl, setNewWebhookUrl] = useState('');
  const [showWebhookInput, setShowWebhookInput] = useState(false);

  // 새 이메일 입력
  const [newEmail, setNewEmail] = useState('');

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/tenant/alerts');
      const result = await response.json();

      if (result.success) {
        setSettings(result.data);
      } else {
        setError(result.error || '설정을 불러올 수 없습니다.');
      }
    } catch (err) {
      console.error('Failed to fetch alert settings:', err);
      setError('서버 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (hasHomepage) {
      fetchSettings();
    } else {
      setLoading(false);
    }
  }, [hasHomepage]);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const payload: Partial<AlertSettingsData> = { ...settings };

      // 새 Webhook URL이 입력된 경우에만 포함
      if (newWebhookUrl) {
        payload.slackWebhookUrl = newWebhookUrl;
      }

      const response = await fetch('/api/admin/tenant/alerts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (result.success) {
        setSuccess('설정이 저장되었습니다.');
        setNewWebhookUrl('');
        setShowWebhookInput(false);
        fetchSettings();
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(result.error || '저장에 실패했습니다.');
      }
    } catch (err) {
      console.error('Failed to save alert settings:', err);
      setError('서버 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (type: 'slack' | 'email') => {
    setTesting(type);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/admin/tenant/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      });

      const result = await response.json();

      if (result.success) {
        setSuccess(`테스트 ${type === 'slack' ? 'Slack' : '이메일'} 알림이 발송되었습니다.`);
        setTimeout(() => setSuccess(''), 5000);
      } else {
        setError(result.error || '테스트 발송에 실패했습니다.');
      }
    } catch (err) {
      console.error('Failed to send test alert:', err);
      setError('서버 오류가 발생했습니다.');
    } finally {
      setTesting(null);
    }
  };

  const addEmail = () => {
    const email = newEmail.trim().toLowerCase();
    if (!email) return;

    // 간단한 이메일 형식 검증
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('올바른 이메일 형식이 아닙니다.');
      return;
    }

    if (settings.emailRecipients.includes(email)) {
      setError('이미 추가된 이메일입니다.');
      return;
    }

    setSettings({
      ...settings,
      emailRecipients: [...settings.emailRecipients, email],
    });
    setNewEmail('');
  };

  const removeEmail = (email: string) => {
    setSettings({
      ...settings,
      emailRecipients: settings.emailRecipients.filter((e) => e !== email),
    });
  };

  if (!hasHomepage) {
    return null;
  }

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[var(--sage-muted)] flex items-center justify-center">
            <Bell className="w-5 h-5 text-[var(--sage-primary)]" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">알림 설정</h2>
            <p className="text-xs text-[var(--text-tertiary)]">Slack, 이메일 알림 설정</p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn btn-primary flex items-center gap-2"
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
      </div>

      {/* Alerts */}
      {error && (
        <div className="mb-4 p-3 bg-[var(--color-danger-muted)] border border-[var(--color-danger)] rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-[var(--color-danger)] flex-shrink-0" />
          <p className="text-sm text-[var(--color-danger)]">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-[var(--color-success-muted)] border border-[var(--color-success)] rounded-lg flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-[var(--color-success)] flex-shrink-0" />
          <p className="text-sm text-[var(--color-success)]">{success}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-[var(--text-tertiary)]">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span className="text-sm">로딩 중...</span>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Slack 설정 */}
          <div className="border border-[var(--border-default)] rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded bg-[#4A154B] flex items-center justify-center">
                  <span className="text-white text-xs font-bold">S</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">Slack</p>
                  <p className="text-xs text-[var(--text-tertiary)]">
                    {settings.slackWebhookUrl ? '연결됨' : '연결되지 않음'}
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.slackEnabled}
                  onChange={(e) =>
                    setSettings({ ...settings, slackEnabled: e.target.checked })
                  }
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-[var(--bg-tertiary)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--sage-primary)]"></div>
              </label>
            </div>

            {settings.slackEnabled && (
              <div className="space-y-3">
                {settings.slackWebhookUrl && !showWebhookInput ? (
                  <div className="flex items-center gap-2">
                    <code className="flex-1 p-2 bg-[var(--bg-primary)] border border-[var(--border-default)] rounded text-xs font-mono text-[var(--text-secondary)] truncate">
                      {settings.slackWebhookUrl}
                    </code>
                    <button
                      onClick={() => setShowWebhookInput(true)}
                      className="text-xs text-[var(--sage-primary)] hover:underline whitespace-nowrap"
                    >
                      변경
                    </button>
                    <button
                      onClick={() => handleTest('slack')}
                      disabled={testing === 'slack'}
                      className="btn btn-secondary h-8 px-3 text-xs flex items-center gap-1"
                    >
                      {testing === 'slack' ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : (
                        <TestTube className="w-3 h-3" />
                      )}
                      테스트
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newWebhookUrl}
                      onChange={(e) => setNewWebhookUrl(e.target.value)}
                      placeholder="https://hooks.slack.com/services/..."
                      className="form-input flex-1"
                    />
                    {showWebhookInput && (
                      <button
                        onClick={() => {
                          setShowWebhookInput(false);
                          setNewWebhookUrl('');
                        }}
                        className="text-xs text-[var(--text-tertiary)] hover:underline"
                      >
                        취소
                      </button>
                    )}
                  </div>
                )}
                <p className="text-caption">
                  Slack 앱에서 Incoming Webhook URL을 생성하세요.
                </p>
              </div>
            )}
          </div>

          {/* 이메일 설정 */}
          <div className="border border-[var(--border-default)] rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded bg-[var(--sage-primary)] flex items-center justify-center">
                  <Mail className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">이메일</p>
                  <p className="text-xs text-[var(--text-tertiary)]">
                    {settings.emailRecipients.length}명 수신
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.emailEnabled}
                  onChange={(e) =>
                    setSettings({ ...settings, emailEnabled: e.target.checked })
                  }
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-[var(--bg-tertiary)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--sage-primary)]"></div>
              </label>
            </div>

            {settings.emailEnabled && (
              <div className="space-y-3">
                {/* 이메일 목록 */}
                {settings.emailRecipients.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {settings.emailRecipients.map((email) => (
                      <span
                        key={email}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-[var(--bg-tertiary)] text-sm text-[var(--text-secondary)] rounded"
                      >
                        {email}
                        <button
                          onClick={() => removeEmail(email)}
                          className="text-[var(--text-muted)] hover:text-[var(--color-danger)]"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* 이메일 추가 */}
                <div className="flex items-center gap-2">
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="이메일 주소 입력"
                    onKeyPress={(e) => e.key === 'Enter' && addEmail()}
                    className="form-input flex-1"
                  />
                  <button
                    onClick={addEmail}
                    disabled={!newEmail.trim()}
                    className="btn btn-secondary h-9 px-3"
                  >
                    추가
                  </button>
                  {settings.emailRecipients.length > 0 && (
                    <button
                      onClick={() => handleTest('email')}
                      disabled={testing === 'email'}
                      className="btn btn-secondary h-9 px-3 text-xs flex items-center gap-1"
                    >
                      {testing === 'email' ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : (
                        <TestTube className="w-3 h-3" />
                      )}
                      테스트
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 알림 유형 설정 */}
          <div>
            <h3 className="text-sm font-medium text-[var(--text-primary)] mb-3">알림 받을 이벤트</h3>
            <div className="space-y-2">
              <label className="flex items-center gap-3 p-3 bg-[var(--bg-primary)] rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.alertOnNewConsultation}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      alertOnNewConsultation: e.target.checked,
                    })
                  }
                  className="w-4 h-4 text-[var(--sage-primary)] rounded focus:ring-[var(--sage-primary)]"
                />
                <MessageSquare className="w-4 h-4 text-[var(--text-muted)]" />
                <span className="text-sm text-[var(--text-secondary)]">새 상담 신청</span>
              </label>

              <label className="flex items-center gap-3 p-3 bg-[var(--bg-primary)] rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.alertOnNewBooking}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      alertOnNewBooking: e.target.checked,
                    })
                  }
                  className="w-4 h-4 text-[var(--sage-primary)] rounded focus:ring-[var(--sage-primary)]"
                />
                <Calendar className="w-4 h-4 text-[var(--text-muted)]" />
                <span className="text-sm text-[var(--text-secondary)]">새 예약</span>
              </label>

              <label className="flex items-center gap-3 p-3 bg-[var(--bg-primary)] rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.alertOnAnomaly}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      alertOnAnomaly: e.target.checked,
                    })
                  }
                  className="w-4 h-4 text-[var(--sage-primary)] rounded focus:ring-[var(--sage-primary)]"
                />
                <AlertTriangle className="w-4 h-4 text-[var(--text-muted)]" />
                <span className="text-sm text-[var(--text-secondary)]">이상 패턴 감지</span>
              </label>

              <label className="flex items-center gap-3 p-3 bg-[var(--bg-primary)] rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.dailyReportEnabled}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      dailyReportEnabled: e.target.checked,
                    })
                  }
                  className="w-4 h-4 text-[var(--sage-primary)] rounded focus:ring-[var(--sage-primary)]"
                />
                <FileText className="w-4 h-4 text-[var(--text-muted)]" />
                <div className="flex-1 flex items-center justify-between">
                  <span className="text-sm text-[var(--text-secondary)]">일일 리포트</span>
                  {settings.dailyReportEnabled && (
                    <input
                      type="time"
                      value={settings.dailyReportTime}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          dailyReportTime: e.target.value,
                        })
                      }
                      className="form-input h-7 px-2 text-xs"
                    />
                  )}
                </div>
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
