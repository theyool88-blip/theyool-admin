'use client';

import { useState, useEffect } from 'react';
import type { Consultation, LawyerName, OfficeLocation } from '@/types/consultation';
import { useTenantOptions } from '@/hooks/useTenantOptions';

interface ConsultationScheduleModalProps {
  consultation: Consultation;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: {
    confirmed_date: string;
    confirmed_time: string;
    assigned_lawyer?: LawyerName;
    office_location?: OfficeLocation;
    admin_notes?: string;
  }) => Promise<void>;
}

interface TimeSlot {
  time: string;
  available: boolean;
  remaining: number;
  maxCapacity: number;
}

export default function ConsultationScheduleModal({
  consultation,
  isOpen,
  onClose,
  onConfirm,
}: ConsultationScheduleModalProps) {
  // 테넌트 옵션 동적 로드
  const { lawyerNames, officeLocations } = useTenantOptions();

  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [selectedLawyer, setSelectedLawyer] = useState<LawyerName | ''>('');
  const [selectedOffice, setSelectedOffice] = useState<OfficeLocation | ''>('');
  const [adminNotes, setAdminNotes] = useState('');
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Initialize values
  useEffect(() => {
    if (!isOpen) return;

    if ('confirmed_date' in consultation && consultation.confirmed_date) {
      setSelectedDate(consultation.confirmed_date);
    } else if ('preferred_date' in consultation && consultation.preferred_date) {
      setSelectedDate(consultation.preferred_date);
    } else {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setSelectedDate(tomorrow.toISOString().split('T')[0]);
    }

    if ('confirmed_time' in consultation && consultation.confirmed_time) {
      setSelectedTime(consultation.confirmed_time);
    } else if ('preferred_time' in consultation && consultation.preferred_time) {
      setSelectedTime(consultation.preferred_time);
    }

    if (consultation.assigned_lawyer) {
      setSelectedLawyer(consultation.assigned_lawyer);
    }

    if ('office_location' in consultation && consultation.office_location) {
      setSelectedOffice(consultation.office_location);
    }

    if (consultation.admin_notes) {
      setAdminNotes(consultation.admin_notes);
    }
  }, [consultation, isOpen]);

  // Load available slots when date changes
  useEffect(() => {
    if (!selectedDate) return;
    loadAvailableSlots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, selectedLawyer, selectedOffice]);

  const loadAvailableSlots = async () => {
    setLoadingSlots(true);
    setError('');

    try {
      const params = new URLSearchParams({ date: selectedDate });
      if (selectedLawyer) params.append('lawyer_name', selectedLawyer);
      if (selectedOffice) params.append('office_location', selectedOffice);

      const response = await fetch(`/api/admin/availability/slots?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '예약 가능 시간을 불러오지 못했습니다.');
      }

      if (data.isBlocked) {
        setAvailableSlots([]);
        setError(data.message || '해당 날짜는 휴무입니다.');
      } else {
        setAvailableSlots(data.slots || []);
      }
    } catch (err) {
      console.error('Error loading available slots:', err);
      setError(err instanceof Error ? err.message : '예약 가능 시간을 불러오지 못했습니다.');
      setAvailableSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedDate || !selectedTime) {
      setError('날짜와 시간을 선택해주세요.');
      return;
    }

    if (consultation.request_type === 'visit' && !selectedOffice) {
      setError('방문 상담은 사무소 위치를 선택해야 합니다.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      await onConfirm({
        confirmed_date: selectedDate,
        confirmed_time: selectedTime,
        assigned_lawyer: selectedLawyer || undefined,
        office_location: selectedOffice || undefined,
        admin_notes: adminNotes || undefined,
      });

      onClose();
    } catch (err) {
      console.error('Error confirming schedule:', err);
      setError(err instanceof Error ? err.message : '일정 확정에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('확정된 일정을 삭제하시겠습니까?')) {
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      await onConfirm({
        confirmed_date: '',
        confirmed_time: '',
        assigned_lawyer: selectedLawyer || undefined,
        office_location: selectedOffice || undefined,
        admin_notes: adminNotes || undefined,
      });

      onClose();
    } catch (err) {
      console.error('Error deleting schedule:', err);
      setError(err instanceof Error ? err.message : '일정 삭제에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const requestTypeLabels: Record<string, string> = {
    callback: '전화',
    visit: '방문',
    video: '화상'
  };

  // Split slots into morning/afternoon
  const morningSlots = availableSlots.filter((slot) => {
    const hour = parseInt(slot.time.split(':')[0]);
    return hour < 12;
  });

  const afternoonSlots = availableSlots.filter((slot) => {
    const hour = parseInt(slot.time.split(':')[0]);
    return hour >= 13;
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--bg-secondary)] rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)]">
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">상담 일정 확정</h3>
          <button
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
            disabled={submitting}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Customer Info */}
          <div className="bg-[var(--bg-tertiary)] rounded-lg p-4 border border-[var(--border-subtle)]">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-xs text-[var(--text-muted)]">이름</span>
                <p className="text-sm text-[var(--text-primary)] font-medium">{consultation.name}</p>
              </div>
              <div>
                <span className="text-xs text-[var(--text-muted)]">연락처</span>
                <p className="text-sm text-[var(--text-primary)]">{consultation.phone}</p>
              </div>
              <div>
                <span className="text-xs text-[var(--text-muted)]">유형</span>
                <p className="text-sm text-[var(--text-primary)]">
                  {requestTypeLabels[consultation.request_type] || consultation.request_type}
                </p>
              </div>
              {'preferred_date' in consultation && consultation.preferred_date && (
                <div>
                  <span className="text-xs text-[var(--text-muted)]">희망</span>
                  <p className="text-sm text-[var(--text-primary)]">
                    {consultation.preferred_date} {consultation.preferred_time}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Date Selection */}
          <div className="form-group">
            <label className="form-label">
              확정 날짜 <span className="text-[var(--color-danger)]">*</span>
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="form-input"
              style={{ colorScheme: 'light' }}
            />
          </div>

          {/* Time Selection */}
          {selectedDate && (
            <div className="form-group">
              <label className="form-label">
                확정 시간 <span className="text-[var(--color-danger)]">*</span>
              </label>

              {loadingSlots ? (
                <div className="text-center py-6 text-[var(--text-muted)] text-sm">시간 불러오는 중...</div>
              ) : availableSlots.length === 0 ? (
                <div className="text-center py-6 bg-[var(--color-danger-muted)] rounded-lg text-[var(--color-danger)] text-sm border border-[var(--color-danger)]/20">
                  예약 가능한 시간이 없습니다.
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Morning */}
                  {morningSlots.length > 0 && (
                    <div>
                      <p className="text-xs text-[var(--text-muted)] mb-2">오전</p>
                      <div className="grid grid-cols-5 gap-2">
                        {morningSlots.map((slot) => (
                          <button
                            key={slot.time}
                            onClick={() => setSelectedTime(slot.time)}
                            disabled={!slot.available}
                            className={`min-h-[40px] px-2 py-2 rounded-lg text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--sage-primary)] focus:ring-offset-1 ${
                              selectedTime === slot.time
                                ? 'bg-[var(--sage-primary)] text-white'
                                : slot.available
                                  ? 'bg-[var(--bg-secondary)] border border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--sage-primary)] hover:bg-[var(--bg-hover)]'
                                  : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)] cursor-not-allowed'
                            }`}
                          >
                            {slot.time}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Afternoon */}
                  {afternoonSlots.length > 0 && (
                    <div>
                      <p className="text-xs text-[var(--text-muted)] mb-2">오후</p>
                      <div className="grid grid-cols-5 gap-2">
                        {afternoonSlots.map((slot) => (
                          <button
                            key={slot.time}
                            onClick={() => setSelectedTime(slot.time)}
                            disabled={!slot.available}
                            className={`min-h-[40px] px-2 py-2 rounded-lg text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--sage-primary)] focus:ring-offset-1 ${
                              selectedTime === slot.time
                                ? 'bg-[var(--sage-primary)] text-white'
                                : slot.available
                                  ? 'bg-[var(--bg-secondary)] border border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--sage-primary)] hover:bg-[var(--bg-hover)]'
                                  : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)] cursor-not-allowed'
                            }`}
                          >
                            {slot.time}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Lawyer Selection */}
          <div className="form-group">
            <label className="form-label">담당 변호사</label>
            <select
              value={selectedLawyer}
              onChange={(e) => setSelectedLawyer(e.target.value as LawyerName | '')}
              className="form-input"
            >
              <option value="">선택 안 함</option>
              {lawyerNames.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>

          {/* Office Selection (for visit consultations) */}
          {consultation.request_type === 'visit' && (
            <div className="form-group">
              <label className="form-label">
                사무소 위치 <span className="text-[var(--color-danger)]">*</span>
              </label>
              <div className="flex gap-2">
                {officeLocations.map((location) => (
                  <button
                    key={location}
                    onClick={() => setSelectedOffice(location)}
                    className={`flex-1 min-h-[44px] px-3 py-2 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--sage-primary)] focus:ring-offset-1 ${
                      selectedOffice === location
                        ? 'bg-[var(--sage-primary)] text-white'
                        : 'bg-[var(--bg-secondary)] border border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--sage-primary)] hover:bg-[var(--bg-hover)]'
                    }`}
                  >
                    {location}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="form-group">
            <label className="form-label">메모</label>
            <textarea
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              rows={2}
              placeholder="메모 입력..."
              className="form-input resize-none"
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-[var(--color-danger-muted)] rounded-lg p-3 text-[var(--color-danger)] text-sm border border-[var(--color-danger)]/20">
              {error}
            </div>
          )}

          {/* Selection Summary */}
          {selectedDate && selectedTime && (
            <div className="bg-[var(--sage-muted)] rounded-lg p-4 border border-[var(--border-subtle)]">
              <p className="text-xs text-[var(--text-muted)] font-medium mb-2">선택 내용</p>
              <div className="text-sm text-[var(--text-primary)] space-y-1">
                <p>날짜: {selectedDate}</p>
                <p>시간: {selectedTime}</p>
                {selectedLawyer && <p>변호사: {selectedLawyer}</p>}
                {selectedOffice && <p>사무소: {selectedOffice}</p>}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
          <button
            onClick={onClose}
            disabled={submitting}
            className="btn btn-secondary"
          >
            취소
          </button>

          {'confirmed_date' in consultation && consultation.confirmed_date && (
            <button
              onClick={handleDelete}
              disabled={submitting}
              className="btn btn-danger-ghost"
            >
              {submitting ? '삭제 중...' : '일정 삭제'}
            </button>
          )}

          <div className="flex-1" />

          <button
            onClick={handleSubmit}
            disabled={submitting || !selectedDate || !selectedTime}
            className="btn btn-primary"
          >
            {submitting ? '확정 중...' : '일정 확정'}
          </button>
        </div>
      </div>
    </div>
  );
}
