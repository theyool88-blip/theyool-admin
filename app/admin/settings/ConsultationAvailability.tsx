'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ConsultationWeeklySchedule,
  ConsultationDateException,
  DAY_OF_WEEK_LABELS,
  DayOfWeek,
  CreateWeeklyScheduleInput,
  CreateDateExceptionInput,
} from '@/types/consultation-availability';
import type { LawyerName, OfficeLocation } from '@/types/consultation';
import { useTenantOptions } from '@/hooks/useTenantOptions';

// 설정 타입 정의
interface PhoneAvailabilitySettings {
  enabled: boolean;
  fallback_to_form: boolean;
  fallback_delay_seconds: number;
  business_hours: {
    start: string;
    end: string;
    lunch_start?: string;
    lunch_end?: string;
    days: number[];
  };
  holiday_fallback: boolean;
}

interface ModalConfigSettings {
  phone_modal_enabled: boolean;
  form_modal_enabled: boolean;
  show_countdown: boolean;
  countdown_seconds: number;
  auto_fallback_on_busy: boolean;
}

export default function ConsultationAvailability() {
  // 테넌트 옵션 동적 로드
  const { lawyerNames, officeLocations } = useTenantOptions();

  const [activeSubTab, setActiveSubTab] = useState<'weekly' | 'exceptions' | 'modal_settings'>(
    'weekly'
  );
  const [weeklySchedules, setWeeklySchedules] = useState<
    ConsultationWeeklySchedule[]
  >([]);
  const [dateExceptions, setDateExceptions] = useState<
    ConsultationDateException[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showExceptionModal, setShowExceptionModal] = useState(false);

  // 모달 설정 상태
  const [phoneSettings, setPhoneSettings] = useState<PhoneAvailabilitySettings>({
    enabled: true,
    fallback_to_form: true,
    fallback_delay_seconds: 10,
    business_hours: {
      start: '09:00',
      end: '18:00',
      lunch_start: '12:00',
      lunch_end: '13:00',
      days: [1, 2, 3, 4, 5],
    },
    holiday_fallback: true,
  });
  const [modalConfig, setModalConfig] = useState<ModalConfigSettings>({
    phone_modal_enabled: true,
    form_modal_enabled: true,
    show_countdown: true,
    countdown_seconds: 5,
    auto_fallback_on_busy: true,
  });
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);

  // Load consultation settings
  const loadSettings = useCallback(async () => {
    setSettingsLoading(true);
    try {
      const res = await fetch('/api/admin/settings/consultation');
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data) {
          if (data.data.phone_availability?.value) {
            setPhoneSettings(data.data.phone_availability.value);
          }
          if (data.data.modal_config?.value) {
            setModalConfig(data.data.modal_config.value);
          }
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setSettingsLoading(false);
    }
  }, []);

  // Save settings
  const saveSettings = async (key: string, value: PhoneAvailabilitySettings | ModalConfigSettings) => {
    setSettingsSaving(true);
    try {
      const res = await fetch('/api/admin/settings/consultation', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setting_key: key, setting_value: value }),
      });

      if (res.ok) {
        alert('설정이 저장되었습니다.');
      } else {
        alert('저장에 실패했습니다.');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setSettingsSaving(false);
    }
  };

  // Load data
  useEffect(() => {
    loadData();
  }, []);

  // Load settings when modal_settings tab is active
  useEffect(() => {
    if (activeSubTab === 'modal_settings') {
      loadSettings();
    }
  }, [activeSubTab, loadSettings]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Load weekly schedules
      const weeklyRes = await fetch('/api/admin/availability/weekly');
      if (weeklyRes.ok) {
        const weeklyData = await weeklyRes.json();
        setWeeklySchedules(weeklyData.schedules || []);
      }

      // Load exceptions
      const exceptionsRes = await fetch('/api/admin/availability/exceptions');
      if (exceptionsRes.ok) {
        const exceptionsData = await exceptionsRes.json();
        setDateExceptions(exceptionsData.exceptions || []);
      }
    } catch (error) {
      console.error('Error loading availability data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    if (!confirm('이 일정을 삭제하시겠습니까?')) return;

    try {
      const res = await fetch(`/api/admin/availability/weekly/${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setWeeklySchedules(weeklySchedules.filter((s) => s.id !== id));
      } else {
        alert('삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('Error deleting schedule:', error);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  const handleDeleteException = async (id: string) => {
    if (!confirm('이 예외 설정을 삭제하시겠습니까?')) return;

    try {
      const res = await fetch(`/api/admin/availability/exceptions/${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setDateExceptions(dateExceptions.filter((e) => e.id !== id));
      } else {
        alert('삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('Error deleting exception:', error);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  // Group schedules by day
  const schedulesByDay: Record<DayOfWeek, ConsultationWeeklySchedule[]> = {
    0: [],
    1: [],
    2: [],
    3: [],
    4: [],
    5: [],
    6: [],
  };

  weeklySchedules.forEach((schedule) => {
    schedulesByDay[schedule.day_of_week as DayOfWeek].push(schedule);
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-[var(--border-default)] border-t-[var(--text-secondary)]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex bg-[var(--bg-tertiary)] rounded-lg p-0.5 w-fit">
        <button
          onClick={() => setActiveSubTab('weekly')}
          className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
            activeSubTab === 'weekly'
              ? 'bg-[var(--bg-secondary)] shadow-sm font-medium text-[var(--text-primary)]'
              : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
          }`}
        >
          주간 일정
        </button>
        <button
          onClick={() => setActiveSubTab('exceptions')}
          className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
            activeSubTab === 'exceptions'
              ? 'bg-[var(--bg-secondary)] shadow-sm font-medium text-[var(--text-primary)]'
              : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
          }`}
        >
          예외 날짜
        </button>
        <button
          onClick={() => setActiveSubTab('modal_settings')}
          className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
            activeSubTab === 'modal_settings'
              ? 'bg-[var(--bg-secondary)] shadow-sm font-medium text-[var(--text-primary)]'
              : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
          }`}
        >
          모달 설정
        </button>
      </div>

      {/* Weekly Schedule Tab */}
      {activeSubTab === 'weekly' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-caption">
              매주 반복되는 기본 상담 가능 시간을 설정합니다.
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="btn btn-primary text-sm"
            >
              + 일정 추가
            </button>
          </div>

          {/* Display schedules by day */}
          <div className="card divide-y divide-[var(--border-subtle)]">
            {([1, 2, 3, 4, 5, 0, 6] as DayOfWeek[]).map((dayOfWeek) => {
              const daySchedules = schedulesByDay[dayOfWeek];
              const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

              return (
                <div key={dayOfWeek} className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-medium ${isWeekend ? 'text-[var(--color-danger)]' : 'text-[var(--text-primary)]'}`}>
                      {DAY_OF_WEEK_LABELS[dayOfWeek]}
                    </span>
                    {daySchedules.length === 0 && (
                      <span className="text-xs text-[var(--text-muted)]">휴무</span>
                    )}
                  </div>

                  {daySchedules.length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      {daySchedules.map((schedule) => (
                        <div
                          key={schedule.id}
                          className="flex items-center justify-between py-1.5 px-3 bg-[var(--bg-primary)] rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-[var(--text-secondary)]">
                              {schedule.start_time} - {schedule.end_time}
                            </span>
                            {schedule.lawyer_name && (
                              <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">
                                {schedule.lawyer_name}
                              </span>
                            )}
                            {schedule.office_location && (
                              <span className="text-xs px-1.5 py-0.5 bg-[var(--color-success-muted)] text-[var(--color-success)] rounded">
                                {schedule.office_location}
                              </span>
                            )}
                            {!schedule.is_available && (
                              <span className="text-xs px-1.5 py-0.5 bg-[var(--color-danger-muted)] text-[var(--color-danger)] rounded">
                                비활성
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => handleDeleteSchedule(schedule.id)}
                            className="text-[var(--color-danger)] hover:opacity-80 text-xs"
                          >
                            삭제
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Exceptions Tab */}
      {activeSubTab === 'exceptions' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-caption">
              특정 날짜의 휴무 또는 특별 운영 시간을 설정합니다.
            </p>
            <button
              onClick={() => setShowExceptionModal(true)}
              className="btn btn-primary text-sm"
            >
              + 예외 추가
            </button>
          </div>

          <div className="card">
            {dateExceptions.length === 0 ? (
              <div className="py-12 text-center text-[var(--text-muted)] text-sm">
                설정된 예외가 없습니다.
              </div>
            ) : (
              <div className="divide-y divide-[var(--border-subtle)]">
                {dateExceptions.map((exception) => (
                  <div
                    key={exception.id}
                    className="flex items-center justify-between px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-[var(--text-primary)]">
                        {exception.exception_date}
                      </span>
                      {exception.start_time && exception.end_time && (
                        <span className="text-xs text-[var(--text-tertiary)]">
                          {exception.start_time} - {exception.end_time}
                        </span>
                      )}
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded ${
                          exception.is_blocked
                            ? 'bg-[var(--color-danger-muted)] text-[var(--color-danger)]'
                            : 'bg-[var(--color-success-muted)] text-[var(--color-success)]'
                        }`}
                      >
                        {exception.is_blocked ? '휴무' : '특별 운영'}
                      </span>
                      {exception.reason && (
                        <span className="text-xs text-[var(--text-tertiary)]">
                          {exception.reason}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteException(exception.id)}
                      className="text-[var(--color-danger)] hover:opacity-80 text-xs"
                    >
                      삭제
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Settings Tab */}
      {activeSubTab === 'modal_settings' && (
        <div className="space-y-4">
          {settingsLoading ? (
            <div className="py-12 text-center">
              <div className="animate-spin inline-block rounded-full h-6 w-6 border-2 border-[var(--border-default)] border-t-[var(--text-secondary)]"></div>
            </div>
          ) : (
            <>
              {/* 전화 응대 설정 */}
              <div className="card p-4">
                <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">
                  전화 응대 설정
                </h3>
                <p className="text-caption mb-4">
                  홈페이지에서 전화 상담 모달의 동작을 설정합니다.
                </p>

                <div className="space-y-4">
                  {/* 전화 상담 활성화 */}
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <label className="text-sm text-[var(--text-secondary)]">전화 상담 활성화</label>
                      <p className="text-xs text-[var(--text-muted)]">비활성화 시 홈페이지에서 전화 모달이 표시되지 않습니다.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={phoneSettings.enabled}
                        onChange={(e) =>
                          setPhoneSettings({ ...phoneSettings, enabled: e.target.checked })
                        }
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-[var(--bg-tertiary)] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[var(--border-default)] after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--sage-primary)]"></div>
                    </label>
                  </div>

                  {/* 부재시 자동 전환 */}
                  <div className="flex items-center justify-between py-2 border-t border-[var(--border-subtle)]">
                    <div>
                      <label className="text-sm text-[var(--text-secondary)]">부재시 자동 전환</label>
                      <p className="text-xs text-[var(--text-muted)]">영업시간 외 또는 전화를 받지 못할 때 상담 예약 폼으로 안내합니다.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={phoneSettings.fallback_to_form}
                        onChange={(e) =>
                          setPhoneSettings({ ...phoneSettings, fallback_to_form: e.target.checked })
                        }
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-[var(--bg-tertiary)] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[var(--border-default)] after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--sage-primary)]"></div>
                    </label>
                  </div>

                  {/* 전환 대기 시간 */}
                  <div className="py-2 border-t border-[var(--border-subtle)]">
                    <label className="form-label mb-1">전환 대기 시간 (초)</label>
                    <p className="text-xs text-[var(--text-muted)] mb-2">전화 연결 후 지정된 시간이 지나면 상담 예약 폼 안내가 표시됩니다.</p>
                    <input
                      type="number"
                      value={phoneSettings.fallback_delay_seconds}
                      onChange={(e) =>
                        setPhoneSettings({
                          ...phoneSettings,
                          fallback_delay_seconds: parseInt(e.target.value) || 10,
                        })
                      }
                      min="5"
                      max="60"
                      className="form-input w-24"
                    />
                  </div>

                  {/* 영업 시간 */}
                  <div className="py-2 border-t border-[var(--border-subtle)]">
                    <label className="form-label mb-3">전화 응대 가능 시간</label>

                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="block text-xs text-[var(--text-tertiary)] mb-1">시작</label>
                        <input
                          type="time"
                          value={phoneSettings.business_hours.start}
                          onChange={(e) =>
                            setPhoneSettings({
                              ...phoneSettings,
                              business_hours: { ...phoneSettings.business_hours, start: e.target.value },
                            })
                          }
                          className="form-input w-full"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-[var(--text-tertiary)] mb-1">종료</label>
                        <input
                          type="time"
                          value={phoneSettings.business_hours.end}
                          onChange={(e) =>
                            setPhoneSettings({
                              ...phoneSettings,
                              business_hours: { ...phoneSettings.business_hours, end: e.target.value },
                            })
                          }
                          className="form-input w-full"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="block text-xs text-[var(--text-tertiary)] mb-1">점심 시작</label>
                        <input
                          type="time"
                          value={phoneSettings.business_hours.lunch_start || '12:00'}
                          onChange={(e) =>
                            setPhoneSettings({
                              ...phoneSettings,
                              business_hours: { ...phoneSettings.business_hours, lunch_start: e.target.value },
                            })
                          }
                          className="form-input w-full"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-[var(--text-tertiary)] mb-1">점심 종료</label>
                        <input
                          type="time"
                          value={phoneSettings.business_hours.lunch_end || '13:00'}
                          onChange={(e) =>
                            setPhoneSettings({
                              ...phoneSettings,
                              business_hours: { ...phoneSettings.business_hours, lunch_end: e.target.value },
                            })
                          }
                          className="form-input w-full"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs text-[var(--text-tertiary)] mb-2">영업일</label>
                      <div className="flex gap-1.5">
                        {['일', '월', '화', '수', '목', '금', '토'].map((day, index) => (
                          <button
                            key={index}
                            type="button"
                            onClick={() => {
                              const days = phoneSettings.business_hours.days.includes(index)
                                ? phoneSettings.business_hours.days.filter((d) => d !== index)
                                : [...phoneSettings.business_hours.days, index];
                              setPhoneSettings({
                                ...phoneSettings,
                                business_hours: { ...phoneSettings.business_hours, days },
                              });
                            }}
                            className={`w-8 h-8 rounded-full text-xs font-medium transition-colors ${
                              phoneSettings.business_hours.days.includes(index)
                                ? 'bg-[var(--sage-primary)] text-white'
                                : 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)]'
                            }`}
                          >
                            {day}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* 공휴일 자동 전환 */}
                  <div className="flex items-center justify-between py-2 border-t border-[var(--border-subtle)]">
                    <div>
                      <label className="text-sm text-[var(--text-secondary)]">공휴일 자동 전환</label>
                      <p className="text-xs text-[var(--text-muted)]">공휴일에는 자동으로 상담 예약 폼으로 안내합니다.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={phoneSettings.holiday_fallback}
                        onChange={(e) =>
                          setPhoneSettings({ ...phoneSettings, holiday_fallback: e.target.checked })
                        }
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-[var(--bg-tertiary)] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[var(--border-default)] after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--sage-primary)]"></div>
                    </label>
                  </div>

                  <button
                    onClick={() => saveSettings('phone_availability', phoneSettings)}
                    disabled={settingsSaving}
                    className="btn btn-primary w-full"
                  >
                    {settingsSaving ? '저장 중...' : '전화 응대 설정 저장'}
                  </button>
                </div>
              </div>

              {/* 모달 동작 설정 */}
              <div className="card p-4">
                <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">
                  모달 동작 설정
                </h3>
                <p className="text-caption mb-4">
                  홈페이지 상담 모달의 표시 방식을 설정합니다.
                </p>

                <div className="space-y-4">
                  {/* 전화 모달 활성화 */}
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <label className="text-sm text-[var(--text-secondary)]">전화 연결 모달 표시</label>
                      <p className="text-xs text-[var(--text-muted)]">홈페이지에서 전화 버튼 클릭 시 카운트다운 모달을 표시합니다.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={modalConfig.phone_modal_enabled}
                        onChange={(e) =>
                          setModalConfig({ ...modalConfig, phone_modal_enabled: e.target.checked })
                        }
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-[var(--bg-tertiary)] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[var(--border-default)] after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--sage-primary)]"></div>
                    </label>
                  </div>

                  {/* 상담 예약 폼 모달 */}
                  <div className="flex items-center justify-between py-2 border-t border-[var(--border-subtle)]">
                    <div>
                      <label className="text-sm text-[var(--text-secondary)]">상담 예약 폼 모달 표시</label>
                      <p className="text-xs text-[var(--text-muted)]">홈페이지에서 상담 예약 버튼 클릭 시 예약 폼 모달을 표시합니다.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={modalConfig.form_modal_enabled}
                        onChange={(e) =>
                          setModalConfig({ ...modalConfig, form_modal_enabled: e.target.checked })
                        }
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-[var(--bg-tertiary)] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[var(--border-default)] after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--sage-primary)]"></div>
                    </label>
                  </div>

                  {/* 카운트다운 표시 */}
                  <div className="flex items-center justify-between py-2 border-t border-[var(--border-subtle)]">
                    <div>
                      <label className="text-sm text-[var(--text-secondary)]">카운트다운 표시</label>
                      <p className="text-xs text-[var(--text-muted)]">전화 연결 전 카운트다운 애니메이션을 표시합니다.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={modalConfig.show_countdown}
                        onChange={(e) =>
                          setModalConfig({ ...modalConfig, show_countdown: e.target.checked })
                        }
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-[var(--bg-tertiary)] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[var(--border-default)] after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--sage-primary)]"></div>
                    </label>
                  </div>

                  {/* 카운트다운 시간 */}
                  <div className="py-2 border-t border-[var(--border-subtle)]">
                    <label className="form-label mb-1">카운트다운 시간 (초)</label>
                    <p className="text-xs text-[var(--text-muted)] mb-2">전화 연결 전 표시되는 카운트다운 시간입니다.</p>
                    <input
                      type="number"
                      value={modalConfig.countdown_seconds}
                      onChange={(e) =>
                        setModalConfig({
                          ...modalConfig,
                          countdown_seconds: parseInt(e.target.value) || 5,
                        })
                      }
                      min="3"
                      max="10"
                      className="form-input w-24"
                    />
                  </div>

                  <button
                    onClick={() => saveSettings('modal_config', modalConfig)}
                    disabled={settingsSaving}
                    className="btn btn-primary w-full"
                  >
                    {settingsSaving ? '저장 중...' : '모달 설정 저장'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Add Weekly Schedule Modal */}
      {showAddModal && (
        <AddWeeklyScheduleModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            loadData();
          }}
          lawyerNames={lawyerNames}
          officeLocations={officeLocations}
        />
      )}

      {/* Add Exception Modal */}
      {showExceptionModal && (
        <AddExceptionModal
          onClose={() => setShowExceptionModal(false)}
          onSuccess={() => {
            setShowExceptionModal(false);
            loadData();
          }}
        />
      )}
    </div>
  );
}

// Add Weekly Schedule Modal Component
function AddWeeklyScheduleModal({
  onClose,
  onSuccess,
  lawyerNames,
  officeLocations,
}: {
  onClose: () => void;
  onSuccess: () => void;
  lawyerNames: string[];
  officeLocations: string[];
}) {
  const [formData, setFormData] = useState<CreateWeeklyScheduleInput>({
    day_of_week: 1,
    start_time: '09:00',
    end_time: '18:00',
    slot_duration_minutes: 30,
    is_available: true,
    max_bookings_per_slot: 1,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const res = await fetch('/api/admin/availability/weekly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        onSuccess();
      } else {
        alert('추가에 실패했습니다.');
      }
    } catch (error) {
      console.error('Error adding schedule:', error);
      alert('추가 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="card w-full max-w-sm">
        <div className="px-5 py-4 border-b border-[var(--border-subtle)]">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">주간 일정 추가</h3>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          <div>
            <label className="form-label mb-1.5">요일</label>
            <select
              value={formData.day_of_week}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  day_of_week: parseInt(e.target.value) as DayOfWeek,
                })
              }
              className="form-input w-full"
            >
              {Object.entries(DAY_OF_WEEK_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label mb-1.5">시작</label>
              <input
                type="time"
                value={formData.start_time}
                onChange={(e) =>
                  setFormData({ ...formData, start_time: e.target.value })
                }
                className="form-input w-full"
                required
              />
            </div>
            <div>
              <label className="form-label mb-1.5">종료</label>
              <input
                type="time"
                value={formData.end_time}
                onChange={(e) =>
                  setFormData({ ...formData, end_time: e.target.value })
                }
                className="form-input w-full"
                required
              />
            </div>
          </div>

          <div>
            <label className="form-label mb-1.5">예약 단위 (분)</label>
            <input
              type="number"
              value={formData.slot_duration_minutes}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  slot_duration_minutes: parseInt(e.target.value),
                })
              }
              min="15"
              step="15"
              className="form-input w-full"
            />
          </div>

          <div>
            <label className="form-label mb-1.5">변호사 (선택)</label>
            <select
              value={formData.lawyer_name || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  lawyer_name: (e.target.value as LawyerName) || undefined,
                })
              }
              className="form-input w-full"
            >
              <option value="">모든 변호사</option>
              {lawyerNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label mb-1.5">사무소 (선택)</label>
            <select
              value={formData.office_location || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  office_location: (e.target.value as OfficeLocation) || undefined,
                })
              }
              className="form-input w-full"
            >
              <option value="">모든 사무소</option>
              {officeLocations.map((location) => (
                <option key={location} value={location}>
                  {location}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label mb-1.5">메모 (선택)</label>
            <textarea
              value={formData.notes || ''}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              className="form-input w-full resize-none"
              rows={2}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary flex-1"
            >
              취소
            </button>
            <button
              type="submit"
              className="btn btn-primary flex-1"
            >
              추가
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Add Exception Modal Component
function AddExceptionModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState<CreateDateExceptionInput>({
    exception_date: '',
    is_blocked: true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const res = await fetch('/api/admin/availability/exceptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        onSuccess();
      } else {
        alert('추가에 실패했습니다.');
      }
    } catch (error) {
      console.error('Error adding exception:', error);
      alert('추가 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="card w-full max-w-sm">
        <div className="px-5 py-4 border-b border-[var(--border-subtle)]">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">예외 날짜 추가</h3>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          <div>
            <label className="form-label mb-1.5">날짜</label>
            <input
              type="date"
              value={formData.exception_date}
              onChange={(e) =>
                setFormData({ ...formData, exception_date: e.target.value })
              }
              className="form-input w-full"
              required
            />
          </div>

          <div>
            <label className="form-label mb-1.5">유형</label>
            <select
              value={formData.is_blocked ? 'blocked' : 'available'}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  is_blocked: e.target.value === 'blocked',
                })
              }
              className="form-input w-full"
            >
              <option value="blocked">휴무 (예약 불가)</option>
              <option value="available">특별 운영 (예약 가능)</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label mb-1.5">시작 (선택)</label>
              <input
                type="time"
                value={formData.start_time || ''}
                onChange={(e) =>
                  setFormData({ ...formData, start_time: e.target.value })
                }
                className="form-input w-full"
              />
            </div>
            <div>
              <label className="form-label mb-1.5">종료 (선택)</label>
              <input
                type="time"
                value={formData.end_time || ''}
                onChange={(e) =>
                  setFormData({ ...formData, end_time: e.target.value })
                }
                className="form-input w-full"
              />
            </div>
          </div>

          <div>
            <label className="form-label mb-1.5">사유</label>
            <input
              type="text"
              value={formData.reason || ''}
              onChange={(e) =>
                setFormData({ ...formData, reason: e.target.value })
              }
              placeholder="예: 설날 연휴, 임시 휴무"
              className="form-input w-full"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary flex-1"
            >
              취소
            </button>
            <button
              type="submit"
              className="btn btn-primary flex-1"
            >
              추가
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
