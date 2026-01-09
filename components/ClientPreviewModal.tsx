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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-sage-600 text-white px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">의뢰인 포털 미리보기</h2>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          {loading && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sage-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">데이터를 불러오는 중...</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
              {error}
            </div>
          )}

          {data && (
            <div className="space-y-6">
              {/* 의뢰인 정보 */}
              <section className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-bold text-gray-800 mb-3">의뢰인 정보</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm text-gray-600">이름:</span>
                    <p className="font-medium">{data.client.name}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">연락처:</span>
                    <p className="font-medium">{data.client.phone}</p>
                  </div>
                  {data.client.email && (
                    <div className="col-span-2">
                      <span className="text-sm text-gray-600">이메일:</span>
                      <p className="font-medium">{data.client.email}</p>
                    </div>
                  )}
                </div>
              </section>

              {/* 다가오는 재판기일 */}
              {data.upcomingHearings.length > 0 && (
                <section>
                  <h3 className="text-lg font-bold text-gray-800 mb-3">
                    다가오는 재판기일 (30일 이내)
                  </h3>
                  <div className="space-y-2">
                    {data.upcomingHearings.map((hearing) => (
                      <div
                        key={hearing.id}
                        className="bg-blue-50 border border-blue-200 rounded-lg p-3"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-semibold text-blue-900">
                              {hearing.case_name}
                            </p>
                            <p className="text-sm text-blue-700">
                              {getCourtAbbrev(hearing.court_name)} | {hearing.case_number}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-blue-900">
                              {hearing.hearing_date}
                            </p>
                            <p className="text-sm text-blue-700">{hearing.hearing_time}</p>
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
                  <h3 className="text-lg font-bold text-gray-800 mb-3">
                    다가오는 기한 (30일 이내)
                  </h3>
                  <div className="space-y-2">
                    {data.upcomingDeadlines.map((deadline) => (
                      <div
                        key={deadline.id}
                        className="bg-amber-50 border border-amber-200 rounded-lg p-3"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-semibold text-amber-900">
                              {deadline.case_name}
                            </p>
                            <p className="text-sm text-amber-700">
                              {deadline.deadline_type} | {deadline.description}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-amber-900">
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
                <h3 className="text-lg font-bold text-gray-800 mb-3">사건 목록</h3>
                <div className="space-y-2">
                  {data.cases.map((caseItem) => (
                    <div
                      key={caseItem.id}
                      className="bg-white border border-gray-300 rounded-lg p-4 hover:border-sage-500 cursor-pointer transition-colors"
                      onClick={() => fetchCaseDetail(caseItem.id)}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold text-gray-900">
                            {caseItem.case_name}
                          </p>
                          <p className="text-sm text-gray-600">
                            계약번호: {caseItem.contract_number} | {caseItem.case_type}
                          </p>
                          <p className="text-sm text-gray-600">
                            사무소: {caseItem.office}
                          </p>
                        </div>
                        <div className="text-right">
                          <span
                            className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                              caseItem.status === '진행중'
                                ? 'bg-green-100 text-green-800'
                                : caseItem.status === '완료'
                                ? 'bg-gray-100 text-gray-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {caseItem.status}
                          </span>
                          <p className="text-sm text-gray-600 mt-1">
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
                <section className="border-t-4 border-sage-500 pt-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-gray-800">사건 상세 정보</h3>
                    <button
                      onClick={() => {
                        setSelectedCaseId(null);
                        setCaseDetail(null);
                      }}
                      className="text-gray-600 hover:text-gray-800"
                    >
                      닫기
                    </button>
                  </div>

                  {/* 재판기일 */}
                  {caseDetail.hearings.length > 0 && (
                    <div className="mb-4">
                      <h4 className="font-semibold text-gray-700 mb-2">재판기일</h4>
                      <div className="space-y-2">
                        {caseDetail.hearings.map((hearing) => (
                          <div
                            key={hearing.id}
                            className="bg-gray-50 border rounded p-3"
                          >
                            <div className="flex justify-between">
                              <div>
                                <p className="font-medium">
                                  {hearing.hearing_date} {hearing.hearing_time}
                                </p>
                                <p className="text-sm text-gray-600">
                                  {getCourtAbbrev(hearing.court_name)} | {hearing.hearing_type}
                                </p>
                                {hearing.hearing_result && (
                                  <p className="text-sm text-gray-600">
                                    결과: {hearing.hearing_result}
                                  </p>
                                )}
                                {hearing.judge_name && (
                                  <p className="text-sm text-gray-600">
                                    판사: {hearing.judge_name}
                                  </p>
                                )}
                                {hearing.hearing_report && (
                                  <p className="text-sm text-gray-600 mt-1">
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
                      <h4 className="font-semibold text-gray-700 mb-2">기한</h4>
                      <div className="space-y-2">
                        {caseDetail.deadlines.map((deadline) => (
                          <div
                            key={deadline.id}
                            className={`border rounded p-3 ${
                              deadline.is_completed
                                ? 'bg-gray-50 opacity-60'
                                : 'bg-yellow-50 border-yellow-300'
                            }`}
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-medium">
                                  {deadline.deadline_type || '기한'}
                                </p>
                                <p className="text-sm text-gray-600">
                                  {deadline.description}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="font-medium">{deadline.deadline_date}</p>
                                {deadline.is_completed && (
                                  <span className="text-xs text-gray-500">완료</span>
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
