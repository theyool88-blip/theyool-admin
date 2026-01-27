'use client';

import { useState, useEffect, useCallback } from 'react';
import ConsultationPaymentsModal from '@/components/ConsultationPaymentsModal';
import ConsultationScheduleModal from '@/components/ConsultationScheduleModal';
import type { Consultation, ConsultationStats } from '@/types/consultation';
import type { ConsultationSource } from '@/types/consultation-source';
import { createClient } from '@/lib/supabase/client';

export default function AdminConsultationsPage() {
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [stats, setStats] = useState<ConsultationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [sources, setSources] = useState<ConsultationSource[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedConsultation, setSelectedConsultation] = useState<Consultation | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedConsultationForPayment, setSelectedConsultationForPayment] = useState<Consultation | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedConsultationForSchedule, setSelectedConsultationForSchedule] = useState<Consultation | null>(null);
  const [consultationPayments, setConsultationPayments] = useState<Record<string, number>>({});
  const [visitCounts, setVisitCounts] = useState<Record<string, { count: number; consultations: Consultation[] }>>({});
  const supabase = createClient();

  // Fetch consultation sources
  const fetchSources = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/consultation-sources?active_only=true');
      const data = await response.json();

      if (response.ok) {
        setSources(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching consultation sources:', error);
    }
  }, []);

  // Fetch consultation payments
  const fetchConsultationPayments = useCallback(async (consultationIds: string[]) => {
    if (consultationIds.length === 0) return;
    try {
      const { data: payments, error } = await supabase
        .from('payments')
        .select('consultation_id, amount')
        .in('consultation_id', consultationIds)
        .eq('is_confirmed', true);

      if (error) throw error;

      const paymentMap: Record<string, number> = {};
      payments?.forEach((p) => {
        if (p.consultation_id) {
          paymentMap[p.consultation_id] = (paymentMap[p.consultation_id] || 0) + (p.amount || 0);
        }
      });
      setConsultationPayments(paymentMap);
    } catch (error) {
      console.error('Error fetching consultation payments:', error);
    }
  }, [supabase]);

  // Calculate visit counts by phone number
  const fetchAllConsultationsForVisitCount = useCallback(async () => {
    try {
      const { data: allConsultations, error } = await supabase
        .from('consultations')
        .select('id, phone, name, created_at, status, request_type')
        .order('created_at', { ascending: true });

      if (error) throw error;

      const phoneMap: Record<string, { count: number; consultations: Consultation[] }> = {};
      allConsultations?.forEach((c) => {
        if (!c.phone) return;
        if (!phoneMap[c.phone]) {
          phoneMap[c.phone] = { count: 0, consultations: [] };
        }
        phoneMap[c.phone].count++;
        phoneMap[c.phone].consultations.push(c as Consultation);
      });

      setVisitCounts(phoneMap);
    } catch (error) {
      console.error('Error fetching visit counts:', error);
    }
  }, [supabase]);

  // Fetch consultations and stats
  const fetchConsultations = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (categoryFilter !== 'all') params.append('request_type', categoryFilter);
      if (sourceFilter !== 'all') params.append('source', sourceFilter);
      if (searchQuery) params.append('search', searchQuery);

      const response = await fetch(`/api/admin/consultations?${params.toString()}`);
      const data = await response.json();

      if (response.ok) {
        const consultationData = data.data || [];
        setConsultations(consultationData);
        const ids = consultationData.map((c: Consultation) => c.id);
        fetchConsultationPayments(ids);
      }
    } catch (error) {
      console.error('Error fetching consultations:', error);
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, searchQuery, sourceFilter, statusFilter, fetchConsultationPayments]);

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/consultations/stats');
      const data = await response.json();

      if (response.ok) {
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  }, []);

  useEffect(() => {
    fetchSources();
    fetchConsultations();
    fetchStats();
  }, [categoryFilter, fetchConsultations, fetchSources, fetchStats, searchQuery, sourceFilter, statusFilter]);

  useEffect(() => {
    fetchAllConsultationsForVisitCount();
  }, [fetchAllConsultationsForVisitCount]);

  const updateConsultationStatus = async (id: string, status: string, notes?: string) => {
    try {
      const response = await fetch(`/api/admin/consultations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          admin_notes: notes !== undefined ? notes : undefined
        })
      });

      if (response.ok) {
        await fetchConsultations();
        await fetchStats();
        setShowDetailModal(false);
      } else {
        const data = await response.json();
        alert('상담 상태 업데이트에 실패했습니다: ' + (data.error || '알 수 없는 오류'));
      }
    } catch (_error) {
      console.error('Error updating consultation:', _error);
      alert('상담 상태 업데이트에 실패했습니다.');
    }
  };

  const deleteConsultation = async (id: string) => {
    if (!confirm('이 상담을 삭제하시겠습니까?')) return;

    try {
      const response = await fetch(`/api/admin/consultations/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        fetchConsultations();
        fetchStats();
        setShowDetailModal(false);
      }
    } catch (_error) {
      console.error('Error deleting consultation:', _error);
      alert('상담 삭제에 실패했습니다.');
    }
  };

  const handleScheduleConfirm = async (data: {
    confirmed_date: string;
    confirmed_time: string;
    assigned_lawyer?: string;
    office_location?: string;
    admin_notes?: string;
  }) => {
    if (!selectedConsultationForSchedule) return;

    try {
      const response = await fetch(`/api/admin/consultations/${selectedConsultationForSchedule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          status: 'confirmed'
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '일정 확정에 실패했습니다.');
      }

      await fetchConsultations();
      await fetchStats();

      setShowScheduleModal(false);
      setSelectedConsultationForSchedule(null);

      alert('일정이 확정되었습니다.');
    } catch (error) {
      console.error('Error confirming schedule:', error);
      throw error;
    }
  };

  const exportToCSV = () => {
    const statusLabels: Record<string, string> = {
      pending: '접수',
      contacted: '연락완료',
      confirmed: '일정확정',
      completed: '완료',
      cancelled: '취소'
    };

    const headers = ['날짜', '이름', '전화번호', '이메일', '카테고리', '유입경로', '상태', '메시지'];
    const rows = consultations.map(c => [
      new Date(c.created_at).toLocaleString('ko-KR'),
      c.name,
      c.phone,
      c.email || '',
      c.category || '',
      c.source || '',
      statusLabels[c.status] || c.status,
      (c.message || '').replace(/"/g, '""')
    ]);

    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `consultations_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  const updateConsultationSource = async (consultationId: string, newSource: string) => {
    try {
      const response = await fetch(`/api/admin/consultations/${consultationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: newSource })
      });

      if (response.ok) {
        await fetchConsultations();
      }
    } catch (_error) {
      console.error('Error updating source:', _error);
      alert('유입 경로 업데이트에 실패했습니다.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-[var(--border-default)] border-t-[var(--text-secondary)]"></div>
      </div>
    );
  }

  const requestTypeLabels: Record<string, string> = {
    callback: '전화',
    visit: '방문',
    video: '화상'
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <div className="max-w-5xl mx-auto pt-6 pb-8 px-4">
        {/* Summary */}
        {stats && (
          <div className="flex items-center gap-6 mb-5 text-sm">
            <div>
              <span className="text-[var(--text-tertiary)]">오늘 접수</span>
              <span className="ml-2 text-lg font-bold text-[var(--text-primary)]">{stats.today || 0}</span>
            </div>
            <div className="text-[var(--border-default)]">|</div>
            <div className="text-[var(--text-tertiary)]">
              이번 달 {stats.thisMonth || 0}건
            </div>
            {(stats.pending || 0) > 0 && (
              <span className="px-2 py-0.5 text-xs bg-[var(--color-danger-muted)] text-[var(--color-danger)] rounded font-medium">
                대기 {stats.pending}
              </span>
            )}
            {(stats.contacted || 0) > 0 && (
              <span className="px-2 py-0.5 text-xs bg-[var(--color-info-muted)] text-[var(--color-info)] rounded">
                연락완료 {stats.contacted}
              </span>
            )}
            {(stats.confirmed || 0) > 0 && (
              <span className="px-2 py-0.5 text-xs bg-[var(--color-success-muted)] text-[var(--color-success)] rounded">
                확정 {stats.confirmed}
              </span>
            )}
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-3 mb-4 text-sm flex-wrap">
          {/* Status Tabs */}
          <div className="flex bg-[var(--bg-tertiary)] rounded-lg p-0.5">
            {[
              { value: 'all', label: '전체' },
              { value: 'pending', label: '대기' },
              { value: 'contacted', label: '연락완료' },
              { value: 'confirmed', label: '확정' },
              { value: 'completed', label: '완료' }
            ].map((status) => (
              <button
                key={status.value}
                onClick={() => setStatusFilter(status.value)}
                className={`px-3 py-1 rounded-md transition-all ${
                  statusFilter === status.value
                    ? 'bg-[var(--bg-secondary)] shadow-sm font-medium text-[var(--text-primary)]'
                    : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                }`}
              >
                {status.label}
              </button>
            ))}
          </div>

          {/* Type Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="form-input px-2 py-1 text-sm"
          >
            <option value="all">전체유형</option>
            <option value="callback">전화</option>
            <option value="visit">방문</option>
            <option value="video">화상</option>
          </select>

          {/* Source Filter */}
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="form-input px-2 py-1 text-sm"
          >
            <option value="all">전체경로</option>
            {sources.map((source) => (
              <option key={source.id} value={source.name}>
                {source.name}
              </option>
            ))}
          </select>

          {/* Search */}
          <div className="flex-1 min-w-[150px]">
            <input
              type="text"
              placeholder="이름, 전화번호 검색"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="form-input w-full px-3 py-1 text-sm"
            />
          </div>

          {/* CSV Export */}
          <button
            onClick={exportToCSV}
            className="btn btn-ghost px-2 py-1"
            title="CSV 내보내기"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </button>
        </div>

        {/* Consultations List */}
        <div className="card">
          {consultations.length === 0 ? (
            <div className="py-12 text-center text-[var(--text-muted)]">상담 내역 없음</div>
          ) : (
            <div className="divide-y divide-[var(--border-subtle)]">
              {[...consultations]
                .sort((a, b) => {
                  if (a.status === 'pending' && b.status !== 'pending') return -1;
                  if (a.status !== 'pending' && b.status === 'pending') return 1;
                  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                })
                .map((consultation) => {
                  const hasPaid = consultationPayments[consultation.id] > 0;
                  const hasConfirmedDate = 'confirmed_date' in consultation && consultation.confirmed_date;
                  const visitCount = visitCounts[consultation.phone]?.count || 0;

                  return (
                    <div
                      key={consultation.id}
                      onClick={() => {
                        setSelectedConsultation(consultation);
                        setShowDetailModal(true);
                      }}
                      className={`flex items-center px-4 py-3 hover:bg-[var(--bg-hover)] cursor-pointer ${
                        hasConfirmedDate ? 'bg-[var(--color-success-muted)]/50' : ''
                      }`}
                    >
                      {/* Status Badge */}
                      <div className="w-16 mr-3" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={consultation.status}
                          onChange={(e) => updateConsultationStatus(consultation.id, e.target.value)}
                          className={`w-full px-1.5 py-0.5 text-xs font-medium rounded border-0 cursor-pointer ${
                            consultation.status === 'pending' ? 'bg-[var(--color-danger-muted)] text-[var(--color-danger)]' :
                            consultation.status === 'contacted' ? 'bg-[var(--color-info-muted)] text-[var(--color-info)]' :
                            consultation.status === 'confirmed' ? 'bg-[var(--color-success-muted)] text-[var(--color-success)]' :
                            consultation.status === 'completed' ? 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]' :
                            'bg-[var(--bg-primary)] text-[var(--text-muted)]'
                          }`}
                        >
                          <option value="pending">대기</option>
                          <option value="contacted">연락완료</option>
                          <option value="confirmed">확정</option>
                          <option value="completed">완료</option>
                          <option value="cancelled">취소</option>
                        </select>
                      </div>

                      {/* Main Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-[var(--text-primary)] text-sm">{consultation.name}</span>
                          {visitCount >= 2 && (
                            <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-[var(--color-info)] rounded-full">
                              {visitCount}
                            </span>
                          )}
                          <span className="text-xs text-[var(--text-muted)]">
                            {requestTypeLabels[consultation.request_type] || consultation.request_type}
                            {'office_location' in consultation && consultation.office_location &&
                              `(${consultation.office_location})`}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span
                            className="text-xs text-[var(--text-tertiary)] hover:text-[var(--color-info)] cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.location.href = `tel:${consultation.phone}`;
                            }}
                          >
                            {consultation.phone}
                          </span>
                          {consultation.source && (
                            <span className="text-xs text-[var(--text-muted)]">{consultation.source}</span>
                          )}
                        </div>
                      </div>

                      {/* Schedule Info */}
                      <div
                        className="w-28 text-right mr-3 cursor-pointer hover:bg-[var(--color-info-muted)] px-2 py-1 rounded transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedConsultationForSchedule(consultation);
                          setShowScheduleModal(true);
                        }}
                      >
                        {hasConfirmedDate ? (
                          <div>
                            <div className="text-xs text-[var(--color-success)] font-medium">{consultation.confirmed_date}</div>
                            <div className="text-[10px] text-[var(--color-success)]">{consultation.confirmed_time}</div>
                          </div>
                        ) : 'preferred_date' in consultation && consultation.preferred_date ? (
                          <div>
                            <div className="text-xs text-[var(--text-tertiary)]">{consultation.preferred_date}</div>
                            <div className="text-[10px] text-[var(--text-muted)]">{consultation.preferred_time}</div>
                          </div>
                        ) : (
                          <span className="text-xs text-[var(--color-info)]">시간 설정</span>
                        )}
                      </div>

                      {/* Payment Status */}
                      <div className="w-16 text-right" onClick={(e) => e.stopPropagation()}>
                        {hasPaid ? (
                          <span className="text-xs text-[var(--color-success)] font-medium">입금완료</span>
                        ) : (
                          <button
                            onClick={() => {
                              setSelectedConsultationForPayment(consultation);
                              setShowPaymentModal(true);
                            }}
                            className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                          >
                            입금등록
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      {showDetailModal && selectedConsultation && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--bg-secondary)] rounded-lg w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)]">
              <h3 className="font-bold text-[var(--text-primary)]">상담 상세</h3>
              <button
                onClick={() => setShowDetailModal(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-[var(--text-tertiary)]">이름</span>
                  <p className="font-medium text-[var(--text-primary)]">{selectedConsultation.name}</p>
                </div>
                <div>
                  <span className="text-[var(--text-tertiary)]">연락처</span>
                  <p className="font-medium text-[var(--text-primary)]">
                    <a href={`tel:${selectedConsultation.phone}`} className="hover:text-[var(--color-info)]">
                      {selectedConsultation.phone}
                    </a>
                  </p>
                </div>
                <div>
                  <span className="text-[var(--text-tertiary)]">상담 유형</span>
                  <p className="font-medium text-[var(--text-primary)]">
                    {requestTypeLabels[selectedConsultation.request_type] || selectedConsultation.request_type}
                  </p>
                </div>
                <div>
                  <span className="text-[var(--text-tertiary)]">접수일</span>
                  <p className="font-medium text-[var(--text-primary)]">
                    {(() => {
                      const d = new Date(selectedConsultation.created_at)
                      return `${String(d.getFullYear()).slice(2)}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
                    })()}
                  </p>
                </div>
                {selectedConsultation.email && (
                  <div className="col-span-2">
                    <span className="text-[var(--text-tertiary)]">이메일</span>
                    <p className="font-medium text-[var(--text-primary)]">
                      <a href={`mailto:${selectedConsultation.email}`} className="hover:text-[var(--color-info)]">
                        {selectedConsultation.email}
                      </a>
                    </p>
                  </div>
                )}
              </div>

              {/* Source Selector */}
              <div className="form-group">
                <span className="form-label">유입 경로</span>
                <select
                  value={selectedConsultation.source || ''}
                  onChange={(e) => updateConsultationSource(selectedConsultation.id, e.target.value)}
                  className="form-input"
                >
                  <option value="">선택하세요</option>
                  {sources.map((source) => (
                    <option key={source.id} value={source.name}>
                      {source.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Schedule Info */}
              {'preferred_date' in selectedConsultation && selectedConsultation.preferred_date && (
                <div className="bg-[var(--bg-primary)] rounded-lg p-3">
                  <span className="text-xs text-[var(--text-tertiary)] block mb-1">희망 시간</span>
                  <p className="text-sm font-medium text-[var(--text-primary)]">
                    {selectedConsultation.preferred_date} {selectedConsultation.preferred_time || ''}
                  </p>
                </div>
              )}

              {'confirmed_date' in selectedConsultation && selectedConsultation.confirmed_date && (
                <div className="bg-[var(--color-success-muted)] rounded-lg p-3">
                  <span className="text-xs text-[var(--color-success)] block mb-1">확정 시간</span>
                  <p className="text-sm font-medium text-[var(--color-success)]">
                    {selectedConsultation.confirmed_date} {selectedConsultation.confirmed_time || ''}
                  </p>
                </div>
              )}

              {/* Message */}
              {selectedConsultation.message && (
                <div>
                  <span className="text-sm text-[var(--text-tertiary)] block mb-1">상담 내용</span>
                  <div className="bg-[var(--bg-primary)] rounded-lg p-3">
                    <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap">{selectedConsultation.message}</p>
                  </div>
                </div>
              )}

              {/* Visit History */}
              {visitCounts[selectedConsultation.phone]?.count >= 2 && (
                <div className="bg-[var(--color-info-muted)] rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-[var(--color-info)] rounded-full">
                      {visitCounts[selectedConsultation.phone].count}
                    </span>
                    <span className="text-xs font-medium text-[var(--color-info)]">이전 상담 이력</span>
                  </div>
                  <div className="space-y-1">
                    {visitCounts[selectedConsultation.phone].consultations
                      .filter(c => c.id !== selectedConsultation.id)
                      .map((prevConsultation) => (
                        <button
                          key={prevConsultation.id}
                          onClick={async () => {
                            try {
                              const response = await fetch(`/api/admin/consultations/${prevConsultation.id}`);
                              const data = await response.json();
                              if (response.ok && data.data) {
                                setSelectedConsultation(data.data);
                              }
                            } catch (error) {
                              console.error('Error fetching consultation:', error);
                            }
                          }}
                          className="w-full flex items-center justify-between text-xs bg-[var(--bg-secondary)] rounded px-2 py-1.5 hover:bg-[var(--color-info-muted)] transition-colors text-left"
                        >
                          <span className="text-[var(--text-secondary)]">
                            {requestTypeLabels[prevConsultation.request_type] || prevConsultation.request_type}
                          </span>
                          <span className="text-[var(--text-muted)]">
                            {(() => {
                              const d = new Date(prevConsultation.created_at)
                              return `${String(d.getFullYear()).slice(2)}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
                            })()}
                          </span>
                        </button>
                      ))}
                  </div>
                </div>
              )}

              {/* Admin Notes */}
              <div className="form-group">
                <span className="form-label">관리자 메모</span>
                <textarea
                  defaultValue={selectedConsultation.admin_notes || ''}
                  rows={3}
                  className="form-input resize-none"
                  placeholder="메모 입력..."
                  onBlur={(e) => {
                    if (e.target.value !== (selectedConsultation.admin_notes || '')) {
                      updateConsultationStatus(selectedConsultation.id, selectedConsultation.status, e.target.value);
                    }
                  }}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-2 px-5 py-4 border-t border-[var(--border-subtle)]">
              <button
                onClick={() => deleteConsultation(selectedConsultation.id)}
                className="btn px-3 py-2 text-sm text-[var(--color-danger)] hover:bg-[var(--color-danger-muted)] rounded transition-colors"
              >
                삭제
              </button>
              <div className="flex-1" />
              <button
                onClick={() => setShowDetailModal(false)}
                className="btn btn-secondary"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {selectedConsultationForPayment && (
        <ConsultationPaymentsModal
          isOpen={showPaymentModal}
          onClose={() => {
            setShowPaymentModal(false);
            setSelectedConsultationForPayment(null);
          }}
          consultationId={selectedConsultationForPayment.id}
          consultationName={selectedConsultationForPayment.name}
          onPaymentAdded={() => {
            fetchConsultations();
            fetchStats();
          }}
        />
      )}

      {/* Schedule Modal */}
      {selectedConsultationForSchedule && (
        <ConsultationScheduleModal
          consultation={selectedConsultationForSchedule}
          isOpen={showScheduleModal}
          onClose={() => {
            setShowScheduleModal(false);
            setSelectedConsultationForSchedule(null);
          }}
          onConfirm={handleScheduleConfirm}
        />
      )}
    </div>
  );
}
