'use client';

import { useState } from 'react';
import {
  Settings,
  Save,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Scale,
  Bell,
  Shield,
} from 'lucide-react';

interface SystemSettings {
  defaultPlan: 'basic' | 'professional' | 'enterprise';
  trialDays: number;
  autoSuspendDays: number;
  scourt: {
    autoSyncEnabled: boolean;
    syncIntervalHours: number;
    maxRetries: number;
  };
  notifications: {
    emailEnabled: boolean;
    smsEnabled: boolean;
    kakaoEnabled: boolean;
    pushEnabled: boolean;
  };
  security: {
    sessionTimeoutMinutes: number;
    maxLoginAttempts: number;
    passwordMinLength: number;
    require2FA: boolean;
  };
}

const defaultSettings: SystemSettings = {
  defaultPlan: 'basic',
  trialDays: 14,
  autoSuspendDays: 30,
  scourt: {
    autoSyncEnabled: true,
    syncIntervalHours: 4,
    maxRetries: 3,
  },
  notifications: {
    emailEnabled: true,
    smsEnabled: true,
    kakaoEnabled: true,
    pushEnabled: true,
  },
  security: {
    sessionTimeoutMinutes: 60,
    maxLoginAttempts: 5,
    passwordMinLength: 8,
    require2FA: false,
  },
};

type SettingSection = 'general' | 'scourt' | 'notifications' | 'security';

export default function SettingsPage() {
  const [settings, setSettings] = useState<SystemSettings>(defaultSettings);
  const [activeSection, setActiveSection] = useState<SettingSection>('general');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess(false);

    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError('설정 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const sections = [
    { id: 'general' as SettingSection, label: '일반 설정', icon: Settings },
    { id: 'scourt' as SettingSection, label: 'SCOURT 설정', icon: Scale },
    { id: 'notifications' as SettingSection, label: '알림 설정', icon: Bell },
    { id: 'security' as SettingSection, label: '보안 설정', icon: Shield },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-[22px] font-semibold text-[--sa-text-primary] tracking-tight">시스템 설정</h1>
          <p className="text-[13px] text-[--sa-text-tertiary] mt-1">플랫폼 전역 설정 관리</p>
        </div>
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
          변경사항 저장
        </button>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="mb-6 p-4 bg-[--sa-accent-green-muted] border border-[--sa-accent-green]/20 rounded-xl flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-[--sa-accent-green] flex-shrink-0" />
          <p className="text-[13px] text-[--sa-accent-green]">설정이 저장되었습니다.</p>
        </div>
      )}
      {error && (
        <div className="mb-6 p-4 bg-[--sa-accent-red-muted] border border-[--sa-accent-red]/20 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-[--sa-accent-red] flex-shrink-0" />
          <p className="text-[13px] text-[--sa-accent-red]">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <div className="sa-card p-2">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[13px] font-medium transition-all ${
                  activeSection === section.id
                    ? 'bg-[--sa-accent] text-white'
                    : 'text-[--sa-text-muted] hover:bg-[--sa-bg-hover] hover:text-[--sa-text-secondary]'
                }`}
              >
                <section.icon className="w-[18px] h-[18px]" />
                {section.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="lg:col-span-3">
          <div className="sa-card p-6">
            {/* General Settings */}
            {activeSection === 'general' && (
              <div>
                <h2 className="text-[16px] font-semibold text-[--sa-text-primary] mb-6">일반 설정</h2>
                <div className="space-y-6">
                  <div>
                    <label className="block text-[12px] font-medium text-[--sa-text-muted] mb-2">
                      기본 플랜
                    </label>
                    <select
                      value={settings.defaultPlan}
                      onChange={(e) =>
                        setSettings({ ...settings, defaultPlan: e.target.value as any })
                      }
                      className="sa-input w-full"
                    >
                      <option value="basic">베이직</option>
                      <option value="professional">프로페셔널</option>
                      <option value="enterprise">엔터프라이즈</option>
                    </select>
                    <p className="text-[11px] text-[--sa-text-muted] mt-2">새 테넌트 가입 시 기본 적용되는 플랜</p>
                  </div>

                  <div>
                    <label className="block text-[12px] font-medium text-[--sa-text-muted] mb-2">
                      체험 기간 (일)
                    </label>
                    <input
                      type="number"
                      value={settings.trialDays}
                      onChange={(e) =>
                        setSettings({ ...settings, trialDays: parseInt(e.target.value) || 0 })
                      }
                      className="sa-input w-full"
                    />
                    <p className="text-[11px] text-[--sa-text-muted] mt-2">유료 플랜 체험 기간</p>
                  </div>

                  <div>
                    <label className="block text-[12px] font-medium text-[--sa-text-muted] mb-2">
                      자동 정지 기간 (일)
                    </label>
                    <input
                      type="number"
                      value={settings.autoSuspendDays}
                      onChange={(e) =>
                        setSettings({ ...settings, autoSuspendDays: parseInt(e.target.value) || 0 })
                      }
                      className="sa-input w-full"
                    />
                    <p className="text-[11px] text-[--sa-text-muted] mt-2">미결제 시 자동 정지까지의 유예 기간</p>
                  </div>
                </div>
              </div>
            )}

            {/* SCOURT Settings */}
            {activeSection === 'scourt' && (
              <div>
                <h2 className="text-[16px] font-semibold text-[--sa-text-primary] mb-6">SCOURT 설정</h2>
                <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 bg-[--sa-bg-tertiary] rounded-xl">
                    <div>
                      <p className="text-[13px] font-medium text-[--sa-text-primary]">자동 동기화</p>
                      <p className="text-[11px] text-[--sa-text-muted] mt-1">법원 사건 자동 동기화 활성화</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.scourt.autoSyncEnabled}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            scourt: { ...settings.scourt, autoSyncEnabled: e.target.checked },
                          })
                        }
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-[--sa-border-default] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[--sa-border-subtle] after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[--sa-accent]"></div>
                    </label>
                  </div>

                  <div>
                    <label className="block text-[12px] font-medium text-[--sa-text-muted] mb-2">
                      동기화 주기 (시간)
                    </label>
                    <input
                      type="number"
                      value={settings.scourt.syncIntervalHours}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          scourt: { ...settings.scourt, syncIntervalHours: parseInt(e.target.value) || 1 },
                        })
                      }
                      className="sa-input w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-[12px] font-medium text-[--sa-text-muted] mb-2">
                      최대 재시도 횟수
                    </label>
                    <input
                      type="number"
                      value={settings.scourt.maxRetries}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          scourt: { ...settings.scourt, maxRetries: parseInt(e.target.value) || 1 },
                        })
                      }
                      className="sa-input w-full"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Notifications Settings */}
            {activeSection === 'notifications' && (
              <div>
                <h2 className="text-[16px] font-semibold text-[--sa-text-primary] mb-6">알림 설정</h2>
                <div className="space-y-3">
                  {[
                    { key: 'emailEnabled', label: '이메일 알림', desc: '이메일을 통한 알림 발송' },
                    { key: 'smsEnabled', label: 'SMS 알림', desc: 'SMS를 통한 알림 발송' },
                    { key: 'kakaoEnabled', label: '카카오 알림톡', desc: '카카오 알림톡을 통한 알림 발송' },
                    { key: 'pushEnabled', label: '푸시 알림', desc: '앱 푸시 알림 발송' },
                  ].map((item) => (
                    <div key={item.key} className="flex items-center justify-between p-4 bg-[--sa-bg-tertiary] rounded-xl">
                      <div>
                        <p className="text-[13px] font-medium text-[--sa-text-primary]">{item.label}</p>
                        <p className="text-[11px] text-[--sa-text-muted] mt-1">{item.desc}</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.notifications[item.key as keyof typeof settings.notifications]}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              notifications: { ...settings.notifications, [item.key]: e.target.checked },
                            })
                          }
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-[--sa-border-default] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[--sa-border-subtle] after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[--sa-accent]"></div>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Security Settings */}
            {activeSection === 'security' && (
              <div>
                <h2 className="text-[16px] font-semibold text-[--sa-text-primary] mb-6">보안 설정</h2>
                <div className="space-y-6">
                  <div>
                    <label className="block text-[12px] font-medium text-[--sa-text-muted] mb-2">
                      세션 타임아웃 (분)
                    </label>
                    <input
                      type="number"
                      value={settings.security.sessionTimeoutMinutes}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          security: { ...settings.security, sessionTimeoutMinutes: parseInt(e.target.value) || 30 },
                        })
                      }
                      className="sa-input w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-[12px] font-medium text-[--sa-text-muted] mb-2">
                      최대 로그인 시도 횟수
                    </label>
                    <input
                      type="number"
                      value={settings.security.maxLoginAttempts}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          security: { ...settings.security, maxLoginAttempts: parseInt(e.target.value) || 3 },
                        })
                      }
                      className="sa-input w-full"
                    />
                    <p className="text-[11px] text-[--sa-text-muted] mt-2">초과 시 계정이 잠금됩니다</p>
                  </div>

                  <div>
                    <label className="block text-[12px] font-medium text-[--sa-text-muted] mb-2">
                      최소 비밀번호 길이
                    </label>
                    <input
                      type="number"
                      value={settings.security.passwordMinLength}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          security: { ...settings.security, passwordMinLength: parseInt(e.target.value) || 8 },
                        })
                      }
                      className="sa-input w-full"
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 bg-[--sa-bg-tertiary] rounded-xl">
                    <div>
                      <p className="text-[13px] font-medium text-[--sa-text-primary]">2단계 인증 필수</p>
                      <p className="text-[11px] text-[--sa-text-muted] mt-1">모든 어드민에게 2FA 필수 적용</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.security.require2FA}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            security: { ...settings.security, require2FA: e.target.checked },
                          })
                        }
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-[--sa-border-default] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[--sa-border-subtle] after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[--sa-accent]"></div>
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
