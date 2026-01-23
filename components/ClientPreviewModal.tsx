/**
 * 의뢰인 포털 미리보기 모달 컴포넌트
 * @description 관리자가 의뢰인에게 보여질 포털 화면을 미리 확인할 수 있는 모달
 */

'use client';

import { useState, useEffect } from 'react';
import type {
  ClientPreviewResponse,
  CaseDetailResponse,
  ErrorResponse
} from '@/types/client-preview';
import { getCourtAbbrev } from '@/lib/scourt/court-codes';

interface ClientPreviewModalProps {
  clientId: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function ClientPreviewModal({
  clientId,
  isOpen,
  onClose
}: ClientPreviewModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ClientPreviewResponse | null>(null);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [caseDetail, setCaseDetail] = useState<CaseDetailResponse | null>(null);

  // 의뢰인 포털 미리보기 데이터 가져오기
  useEffect(() => {
    if (!isOpen || !clientId) return;

    const fetchClientPreview = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/admin/client-preview/${clientId}`);

        if (!response.ok) {
          const errorData: ErrorResponse = await response.json();
          throw new Error(errorData.error);
        }

        const result: ClientPreviewResponse = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : '데이터를 불러오는데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchClientPreview();
  }, [clientId, isOpen]);

  // 사건 상세 정보 가져오기
  const fetchCaseDetail = async (caseId: string) => {
    setSelectedCaseId(caseId);
    setCaseDetail(null);

    try {
      const response = await fetch(
        `/api/admin/client-preview/${clientId}/cases/${caseId}`
      );

      if (!response.ok) {
        const errorData: ErrorResponse = await response.json();
        throw new Error(errorData.error);
      }

      const result: CaseDetailResponse = await response.json();
      setCaseDetail(result);
    } catch (err) {
      alert(err instanceof Error ? err.message : '사건 정보를 불러오는데 실패했습니다.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-[var(--bg-secondary)] rounded-xl shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-[var(--sage-primary)] text-white px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">의뢰인 포털 미리보기</h2>
          <button
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-white/80 hover:text-white text-2xl font-bold rounded-lg transition-colors"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          {loading && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-2 border-[var(--border-subtle)] border-t-[var(--sage-primary)] mx-auto"></div>
              <p className="mt-4 text-[var(--text-muted)]">데이터를 불러오는 중...</p>
            </div>
          )}

          {error && (
            <div className="bg-[var(--color-danger-muted)] border border-[var(--color-danger)]/20 rounded-lg p-4 text-[var(--color-danger)]">
              {error}
            </div>
          )}

          {data && (
            <div className="space-y-6">
              {/* 의뢰인 정보 */}
              <section className="bg-[var(--bg-tertiary)] rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-bold text-[var(--text-primary)]">의뢰인 정보</h3>
                  {data.client.client_type && (
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      data.client.client_type === 'corporation'
                        ? 'bg-[var(--color-info-muted)] text-[var(--color-info)]'
                        : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]'
                    }`}>
                      {data.client.client_type === 'corporation' ? '법인' : '개인'}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm text-[var(--text-muted)]">이름:</span>
                    <p className="font-medium text-[var(--text-primary)]">{data.client.name}</p>
                  </div>
                  <div>
                    <span className="text-sm text-[var(--text-muted)]">연락처:</span>
                    <p className="font-medium text-[var(--text-primary)]">{data.client.phone || '-'}</p>
                  </div>
                  {data.client.email && (
                    <div>
                      <span className="text-sm text-[var(--text-muted)]">이메일:</span>
                      <p className="font-medium text-[var(--text-primary)]">{data.client.email}</p>
                    </div>
                  )}
                  {data.client.birth_date && (
                    <div>
                      <span className="text-sm text-[var(--text-muted)]">생년월일:</span>
                      <p className="font-medium text-[var(--text-primary)]">{data.client.birth_date}</p>
                    </div>
                  )}
                  {data.client.address && (
                    <div className="col-span-2">
                      <span className="text-sm text-[var(--text-muted)]">주소:</span>
                      <p className="font-medium text-[var(--text-primary)]">{data.client.address}</p>
                    </div>
                  )}
                  {data.client.bank_account && (
                    <div className="col-span-2">
                      <span className="text-sm text-[var(--text-muted)]">계좌번호:</span>
                      <p className="font-medium text-[var(--text-primary)]">{data.client.bank_account}</p>
                    </div>
                  )}

                  {/* 법인 정보 (법인인 경우에만 표시) */}
                  {data.client.client_type === 'corporation' && (
                    <>
                      {data.client.company_name && (
                        <div>
                          <span className="text-sm text-[var(--text-muted)]">회사명:</span>
                          <p className="font-medium text-[var(--text-primary)]">{data.client.company_name}</p>
                        </div>
                      )}
                      {data.client.registration_number && (
                        <div>
                          <span className="text-sm text-[var(--text-muted)]">사업자등록번호:</span>
                          <p className="font-medium text-[var(--text-primary)]">{data.client.registration_number}</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </section>

              {/* 다가오는 재판기일 */}
              {data.upcomingHearings.length > 0 && (
                <section>
                  <h3 className="text-lg font-bold text-[var(--text-primary)] mb-3">
                    다가오는 재판기일 (30일 이내)
                  </h3>
                  <div className="space-y-2">
                    {data.upcomingHearings.map((hearing) => (
                      <div
                        key={hearing.id}
                        className="bg-[var(--color-info-muted)] border border-[var(--color-info)]/20 rounded-lg p-3"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-semibold text-[var(--color-info)]">
                              {hearing.case_name}
                            </p>
                            <p className="text-sm text-[var(--text-secondary)]">
                              {getCourtAbbrev(hearing.court_name)} | {hearing.case_number}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-[var(--color-info)]">
                              {hearing.hearing_date}
                            </p>
                            <p className="text-sm text-[var(--text-secondary)]">{hearing.hearing_time}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* 다가오는 기한 */}
              {data.upcomingDeadlines.length > 0 && (
                <section>
                  <h3 className="text-lg font-bold text-[var(--text-primary)] mb-3">
                    다가오는 기한 (30일 이내)
                  </h3>
                  <div className="space-y-2">
                    {data.upcomingDeadlines.map((deadline) => (
                      <div
                        key={deadline.id}
                        className="bg-[var(--color-warning-muted)] border border-[var(--color-warning)]/20 rounded-lg p-3"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-semibold text-[var(--color-warning)]">
                              {deadline.case_name}
                            </p>
                            <p className="text-sm text-[var(--text-secondary)]">
                              {deadline.deadline_type} | {deadline.description}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-[var(--color-warning)]">
                              {deadline.deadline_date}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* 사건 목록 */}
              <section>
                <h3 className="text-lg font-bold text-[var(--text-primary)] mb-3">사건 목록</h3>
                <div className="space-y-2">
                  {data.cases.map((caseItem) => (
                    <div
                      key={caseItem.id}
                      className="bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg p-4 hover:border-[var(--sage-primary)] cursor-pointer transition-colors"
                      onClick={() => fetchCaseDetail(caseItem.id)}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold text-[var(--text-primary)]">
                            {caseItem.case_name}
                          </p>
                          <p className="text-sm text-[var(--text-muted)]">
                            계약번호: {caseItem.contract_number} | {caseItem.case_type}
                          </p>
                          <p className="text-sm text-[var(--text-muted)]">
                            사무소: {caseItem.office}
                          </p>
                        </div>
                        <div className="text-right">
                          <span
                            className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                              caseItem.status === '진행중'
                                ? 'bg-[var(--color-success-muted)] text-[var(--color-success)]'
                                : caseItem.status === '완료'
                                ? 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]'
                                : 'bg-[var(--color-info-muted)] text-[var(--color-info)]'
                            }`}
                          >
                            {caseItem.status}
                          </span>
                          <p className="text-sm text-[var(--text-muted)] mt-1">
                            {caseItem.contract_date}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* 사건 상세 정보 (선택 시) */}
              {selectedCaseId && caseDetail && (
                <section className="border-t-4 border-[var(--sage-primary)] pt-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-[var(--text-primary)]">사건 상세 정보</h3>
                    <button
                      onClick={() => {
                        setSelectedCaseId(null);
                        setCaseDetail(null);
                      }}
                      className="btn btn-sm btn-secondary"
                    >
                      닫기
                    </button>
                  </div>

                  {/* 재판기일 */}
                  {caseDetail.hearings.length > 0 && (
                    <div className="mb-4">
                      <h4 className="font-semibold text-[var(--text-secondary)] mb-2">재판기일</h4>
                      <div className="space-y-2">
                        {caseDetail.hearings.map((hearing) => (
                          <div
                            key={hearing.id}
                            className="bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] rounded p-3"
                          >
                            <div className="flex justify-between">
                              <div>
                                <p className="font-medium text-[var(--text-primary)]">
                                  {hearing.hearing_date} {hearing.hearing_time}
                                </p>
                                <p className="text-sm text-[var(--text-muted)]">
                                  {getCourtAbbrev(hearing.court_name)} | {hearing.hearing_type}
                                </p>
                                {hearing.hearing_result && (
                                  <p className="text-sm text-[var(--text-muted)]">
                                    결과: {hearing.hearing_result}
                                  </p>
                                )}
                                {hearing.judge_name && (
                                  <p className="text-sm text-[var(--text-muted)]">
                                    판사: {hearing.judge_name}
                                  </p>
                                )}
                                {hearing.hearing_report && (
                                  <p className="text-sm text-[var(--text-muted)] mt-1">
                                    {hearing.hearing_report}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 기한 */}
                  {caseDetail.deadlines.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-[var(--text-secondary)] mb-2">기한</h4>
                      <div className="space-y-2">
                        {caseDetail.deadlines.map((deadline) => (
                          <div
                            key={deadline.id}
                            className={`border rounded p-3 ${
                              deadline.is_completed
                                ? 'bg-[var(--bg-tertiary)] border-[var(--border-subtle)] opacity-60'
                                : 'bg-[var(--color-warning-muted)] border-[var(--color-warning)]/30'
                            }`}
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-medium text-[var(--text-primary)]">
                                  {deadline.deadline_type || '기한'}
                                </p>
                                <p className="text-sm text-[var(--text-muted)]">
                                  {deadline.description}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="font-medium text-[var(--text-primary)]">{deadline.deadline_date}</p>
                                {deadline.is_completed && (
                                  <span className="text-xs text-[var(--text-muted)]">완료</span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </section>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
