'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Settings,
  Save,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Scale,
  Bell,
  Shield,
  Calendar,
  Plus,
  Pencil,
  Trash2,
  X,
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

type SettingSection = 'general' | 'holidays' | 'scourt' | 'notifications' | 'security';

interface Holiday {
  id: string;
  holiday_date: string;
  holiday_name: string;
  year: number;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SystemSettings>(defaultSettings);
  const [activeSection, setActiveSection] = useState<SettingSection>('general');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // Holidays state
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [holidaysLoading, setHolidaysLoading] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [holidayModalOpen, setHolidayModalOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
  const [holidayForm, setHolidayForm] = useState({ date: '', name: '' });
  const [holidaySaving, setHolidaySaving] = useState(false);

  const fetchHolidays = useCallback(async () => {
    try {
      setHolidaysLoading(true);
      const response = await fetch(`/api/superadmin/holidays?year=${selectedYear}`);
      const result = await response.json();
      if (result.success) {
        setHolidays(result.data);
      }
    } catch (err) {
      console.error('공휴일 조회 실패:', err);
    } finally {
      setHolidaysLoading(false);
    }
  }, [selectedYear]);

  const handleAddHoliday = () => {
    setEditingHoliday(null);
    setHolidayForm({ date: `${selectedYear}-01-01`, name: '' });
    setHolidayModalOpen(true);
  };

  const handleEditHoliday = (holiday: Holiday) => {
    setEditingHoliday(holiday);
    setHolidayForm({ date: holiday.holiday_date, name: holiday.holiday_name });
    setHolidayModalOpen(true);
  };

  const handleDeleteHoliday = async (holiday: Holiday) => {
    if (!confirm(`"${holiday.holiday_name}" 공휴일을 삭제하시겠습니까?`)) return;

    try {
      const response = await fetch(`/api/superadmin/holidays/${holiday.id}`, {
        method: 'DELETE',
      });
      const result = await response.json();
      if (result.success) {
        fetchHolidays();
      } else {
        alert(result.error || '삭제 실패');
      }
    } catch (err) {
      console.error('공휴일 삭제 실패:', err);
      alert('공휴일 삭제에 실패했습니다.');
    }
  };

  const handleSaveHoliday = async () => {
    if (!holidayForm.date || !holidayForm.name) {
      alert('날짜와 공휴일명을 입력하세요.');
      return;
    }

    setHolidaySaving(true);
    try {
      const url = editingHoliday
        ? `/api/superadmin/holidays/${editingHoliday.id}`
        : '/api/superadmin/holidays';
      const method = editingHoliday ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          holiday_date: holidayForm.date,
          holiday_name: holidayForm.name,
        }),
      });

      const result = await response.json();
      if (result.success) {
        setHolidayModalOpen(false);
        fetchHolidays();
      } else {
        alert(result.error || '저장 실패');
      }
    } catch (err) {
      console.error('공휴일 저장 실패:', err);
      alert('공휴일 저장에 실패했습니다.');
    } finally {
      setHolidaySaving(false);
    }
  };

  const handleRestoreDefaults = async () => {
    if (!confirm(`${selectedYear}년 기본 공휴일 데이터를 복구하시겠습니까?`)) return;

    // 기본 공휴일 데이터
    const defaultHolidays: Record<number, Array<{ date: string; name: string }>> = {
      2025: [
        { date: '2025-01-01', name: '신정' },
        { date: '2025-01-28', name: '설날 연휴' },
        { date: '2025-01-29', name: '설날' },
        { date: '2025-01-30', name: '설날 연휴' },
        { date: '2025-03-01', name: '삼일절' },
        { date: '2025-05-05', name: '어린이날' },
        { date: '2025-05-06', name: '부처님오신날' },
        { date: '2025-06-06', name: '현충일' },
        { date: '2025-08-15', name: '광복절' },
        { date: '2025-10-03', name: '개천절' },
        { date: '2025-10-05', name: '추석 연휴' },
        { date: '2025-10-06', name: '추석' },
        { date: '2025-10-07', name: '추석 연휴' },
        { date: '2025-10-08', name: '대체공휴일(추석)' },
        { date: '2025-10-09', name: '한글날' },
        { date: '2025-12-25', name: '크리스마스' },
      ],
      2026: [
        { date: '2026-01-01', name: '신정' },
        { date: '2026-02-16', name: '설날 연휴' },
        { date: '2026-02-17', name: '설날' },
        { date: '2026-02-18', name: '설날 연휴' },
        { date: '2026-03-01', name: '삼일절' },
        { date: '2026-03-02', name: '대체공휴일(삼일절)' },
        { date: '2026-05-05', name: '어린이날' },
        { date: '2026-05-24', name: '부처님오신날' },
        { date: '2026-05-25', name: '대체공휴일(부처님오신날)' },
        { date: '2026-06-06', name: '현충일' },
        { date: '2026-08-15', name: '광복절' },
        { date: '2026-08-17', name: '대체공휴일(광복절)' },
        { date: '2026-09-24', name: '추석 연휴' },
        { date: '2026-09-25', name: '추석' },
        { date: '2026-09-26', name: '추석 연휴' },
        { date: '2026-10-03', name: '개천절' },
        { date: '2026-10-05', name: '대체공휴일(개천절)' },
        { date: '2026-10-09', name: '한글날' },
        { date: '2026-12-25', name: '크리스마스' },
      ],
      2027: [
        { date: '2027-01-01', name: '신정' },
        { date: '2027-02-06', name: '설날 연휴' },
        { date: '2027-02-07', name: '설날' },
        { date: '2027-02-08', name: '설날 연휴' },
        { date: '2027-02-09', name: '대체공휴일(설날)' },
        { date: '2027-03-01', name: '삼일절' },
        { date: '2027-05-05', name: '어린이날' },
        { date: '2027-05-13', name: '부처님오신날' },
        { date: '2027-06-06', name: '현충일' },
        { date: '2027-08-15', name: '광복절' },
        { date: '2027-08-16', name: '대체공휴일(광복절)' },
        { date: '2027-10-03', name: '개천절' },
        { date: '2027-10-04', name: '대체공휴일(개천절)' },
        { date: '2027-10-09', name: '한글날' },
        { date: '2027-10-14', name: '추석 연휴' },
        { date: '2027-10-15', name: '추석' },
        { date: '2027-10-16', name: '추석 연휴' },
        { date: '2027-12-25', name: '크리스마스' },
      ],
    };

    const yearData = defaultHolidays[selectedYear];
    if (!yearData) {
      alert('해당 연도의 기본 데이터가 없습니다.');
      return;
    }

    try {
      const response = await fetch('/api/superadmin/holidays/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          holidays: yearData.map(h => ({
            holiday_date: h.date,
            holiday_name: h.name,
          })),
        }),
      });

      const result = await response.json();
      if (result.success) {
        alert(`${result.count}개의 공휴일이 복구되었습니다.`);
        fetchHolidays();
      } else {
        alert(result.error || '복구 실패');
      }
    } catch (err) {
      console.error('공휴일 복구 실패:', err);
      alert('공휴일 복구에 실패했습니다.');
    }
  };

  useEffect(() => {
    if (activeSection === 'holidays') {
      fetchHolidays();
    }
  }, [activeSection, fetchHolidays]);

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
    { id: 'holidays' as SettingSection, label: '공휴일 관리', icon: Calendar },
    { id: 'scourt' as SettingSection, label: 'SCOURT 설정', icon: Scale },
    { id: 'notifications' as SettingSection, label: '알림 설정', icon: Bell },
    { id: 'security' as SettingSection, label: '보안 설정', icon: Shield },
  ];

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 1 + i);

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

            {/* Holidays Settings */}
            {activeSection === 'holidays' && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-[16px] font-semibold text-[--sa-text-primary]">공휴일 관리</h2>
                    <p className="text-[11px] text-[--sa-text-muted] mt-1">
                      법정 기간 계산에 사용되는 공휴일입니다. 모든 테넌트에 적용됩니다.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                      className="sa-input"
                    >
                      {years.map((year) => (
                        <option key={year} value={year}>
                          {year}년
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={handleRestoreDefaults}
                      className="sa-btn sa-btn-secondary text-[12px]"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      기본값 복구
                    </button>
                    <button
                      onClick={handleAddHoliday}
                      className="sa-btn sa-btn-primary text-[12px]"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      공휴일 추가
                    </button>
                  </div>
                </div>

                {holidaysLoading ? (
                  <div className="py-12 text-center">
                    <RefreshCw className="w-6 h-6 animate-spin text-[--sa-text-muted] mx-auto" />
                  </div>
                ) : holidays.length === 0 ? (
                  <div className="py-12 text-center">
                    <p className="text-[--sa-text-muted] text-[13px] mb-4">등록된 공휴일이 없습니다.</p>
                    <button
                      onClick={handleRestoreDefaults}
                      className="sa-btn sa-btn-secondary text-[12px]"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      {selectedYear}년 기본 공휴일 복구
                    </button>
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-[--sa-border-subtle]">
                    <table className="w-full text-[13px]">
                      <thead className="bg-[--sa-bg-tertiary] text-[--sa-text-muted] text-[11px]">
                        <tr>
                          <th className="px-4 py-3 text-left font-medium">날짜</th>
                          <th className="px-4 py-3 text-left font-medium">공휴일명</th>
                          <th className="px-4 py-3 text-left font-medium">요일</th>
                          <th className="px-4 py-3 text-right font-medium w-24">관리</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[--sa-border-subtle]">
                        {holidays.map((holiday) => {
                          const date = new Date(holiday.holiday_date);
                          const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
                          const isWeekend = date.getDay() === 0 || date.getDay() === 6;

                          return (
                            <tr key={holiday.id} className="hover:bg-[--sa-bg-hover]">
                              <td className="px-4 py-3 font-medium text-[--sa-text-primary]">
                                {holiday.holiday_date}
                              </td>
                              <td className="px-4 py-3 text-[--sa-text-secondary]">
                                {holiday.holiday_name}
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={`text-[11px] ${
                                    isWeekend ? 'text-[--sa-accent-red]' : 'text-[--sa-text-muted]'
                                  }`}
                                >
                                  {dayOfWeek}요일
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    onClick={() => handleEditHoliday(holiday)}
                                    className="p-1.5 rounded-lg hover:bg-[--sa-bg-tertiary] text-[--sa-text-muted] hover:text-[--sa-text-primary] transition-colors"
                                    title="수정"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteHoliday(holiday)}
                                    className="p-1.5 rounded-lg hover:bg-[--sa-accent-red-muted] text-[--sa-text-muted] hover:text-[--sa-accent-red] transition-colors"
                                    title="삭제"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                <p className="mt-4 text-[11px] text-[--sa-text-muted]">
                  * 공휴일 데이터는 모든 테넌트의 법정 기간 계산 및 캘린더에 적용됩니다.
                </p>

                {/* Holiday Add/Edit Modal */}
                {holidayModalOpen && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="sa-card w-full max-w-md p-6">
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-[16px] font-semibold text-[--sa-text-primary]">
                          {editingHoliday ? '공휴일 수정' : '공휴일 추가'}
                        </h3>
                        <button
                          onClick={() => setHolidayModalOpen(false)}
                          className="p-1 rounded-lg hover:bg-[--sa-bg-tertiary] text-[--sa-text-muted]"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <label className="block text-[12px] font-medium text-[--sa-text-muted] mb-2">
                            날짜
                          </label>
                          <input
                            type="date"
                            value={holidayForm.date}
                            onChange={(e) => setHolidayForm({ ...holidayForm, date: e.target.value })}
                            className="sa-input w-full"
                          />
                        </div>
                        <div>
                          <label className="block text-[12px] font-medium text-[--sa-text-muted] mb-2">
                            공휴일명
                          </label>
                          <input
                            type="text"
                            value={holidayForm.name}
                            onChange={(e) => setHolidayForm({ ...holidayForm, name: e.target.value })}
                            placeholder="예: 신정, 설날, 추석"
                            className="sa-input w-full"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 mt-6">
                        <button
                          onClick={() => setHolidayModalOpen(false)}
                          className="sa-btn sa-btn-secondary"
                        >
                          취소
                        </button>
                        <button
                          onClick={handleSaveHoliday}
                          disabled={holidaySaving}
                          className="sa-btn sa-btn-primary"
                        >
                          {holidaySaving ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <Save className="w-4 h-4" />
                          )}
                          {editingHoliday ? '수정' : '추가'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
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
