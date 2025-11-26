'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface CaseDetail {
  id: string;
  case_name: string;
  case_number: string;
  case_type: string;
  status: string;
  office_location: string;
  court_name: string;
  opponent_name: string;
  lawyer_name: string;
  description: string;
  created_at: string;
}

interface Hearing {
  id: string;
  hearing_date: string;
  hearing_time: string;
  court_name: string;
  hearing_type: string;
  hearing_result: string;
  judge_name: string;
  hearing_report: string;
}

interface Deadline {
  id: string;
  deadline_date: string;
  deadline_type: string;
  description: string;
  is_completed: boolean;
}

export default function CasePreviewPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.clientId as string;
  const caseId = params.caseId as string;

  const [caseDetail, setCaseDetail] = useState<CaseDetail | null>(null);
  const [hearings, setHearings] = useState<Hearing[]>([]);
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'hearings' | 'deadlines'>('overview');

  useEffect(() => {
    fetchData();
  }, [clientId, caseId]);

  async function fetchData() {
    try {
      const res = await fetch(`/api/admin/client-preview/${clientId}/cases/${caseId}`);
      const data = await res.json();

      if (data.success) {
        setCaseDetail(data.case);
        setHearings(data.hearings || []);
        setDeadlines(data.deadlines || []);
      } else {
        router.push(`/admin/client-preview/${clientId}`);
      }
    } catch (error) {
      console.error('데이터 로딩 실패:', error);
      router.push(`/admin/client-preview/${clientId}`);
    } finally {
      setLoading(false);
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700">진행중</span>;
      case 'completed':
        return <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">완료</span>;
      case 'suspended':
        return <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-100 text-yellow-700">중단</span>;
      default:
        return <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">{status}</span>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-sage-500 border-t-transparent"></div>
      </div>
    );
  }

  if (!caseDetail) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 관리자 미리보기 배너 */}
      <div className="bg-amber-500 text-white px-4 py-2 text-center text-sm font-medium">
        관리자 미리보기 모드 - 의뢰인 포털 사건 상세 화면
        <Link href={`/admin/client-preview/${clientId}`} className="ml-4 underline hover:no-underline">
          목록으로
        </Link>
        <Link href="/admin/clients" className="ml-2 underline hover:no-underline">
          관리자로 돌아가기
        </Link>
      </div>

      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Link href={`/admin/client-preview/${clientId}`} className="text-gray-400 hover:text-gray-600">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-gray-900">{caseDetail.case_name}</h1>
                {getStatusBadge(caseDetail.status)}
              </div>
              {caseDetail.case_number && (
                <p className="text-xs text-gray-500">{caseDetail.case_number}</p>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* 탭 */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4">
          <div className="flex gap-6">
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'overview'
                  ? 'border-sage-500 text-sage-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              개요
            </button>
            <button
              onClick={() => setActiveTab('hearings')}
              className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'hearings'
                  ? 'border-sage-500 text-sage-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              재판기일 ({hearings.length})
            </button>
            <button
              onClick={() => setActiveTab('deadlines')}
              className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'deadlines'
                  ? 'border-sage-500 text-sage-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              기한 ({deadlines.length})
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 py-6">
        {/* 개요 탭 */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h2 className="text-sm font-semibold text-gray-900 mb-3">사건 정보</h2>
              <div className="space-y-2 text-sm">
                <div className="flex">
                  <span className="w-20 text-gray-500">사건유형</span>
                  <span className="text-gray-900">{caseDetail.case_type}</span>
                </div>
                <div className="flex">
                  <span className="w-20 text-gray-500">관할법원</span>
                  <span className="text-gray-900">{caseDetail.court_name || '-'}</span>
                </div>
                <div className="flex">
                  <span className="w-20 text-gray-500">상대방</span>
                  <span className="text-gray-900">{caseDetail.opponent_name || '-'}</span>
                </div>
                <div className="flex">
                  <span className="w-20 text-gray-500">담당변호사</span>
                  <span className="text-gray-900">{caseDetail.lawyer_name || '-'}</span>
                </div>
                <div className="flex">
                  <span className="w-20 text-gray-500">사무소</span>
                  <span className="text-gray-900">{caseDetail.office_location}</span>
                </div>
              </div>
            </div>

            {caseDetail.description && (
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h2 className="text-sm font-semibold text-gray-900 mb-2">사건 설명</h2>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{caseDetail.description}</p>
              </div>
            )}
          </div>
        )}

        {/* 재판기일 탭 */}
        {activeTab === 'hearings' && (
          <div className="space-y-3">
            {hearings.length === 0 ? (
              <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
                <p className="text-sm text-gray-500">등록된 재판기일이 없습니다.</p>
              </div>
            ) : (
              hearings.map((hearing) => (
                <div key={hearing.id} className="bg-white rounded-lg border border-gray-200 p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {hearing.hearing_date} {hearing.hearing_time}
                      </p>
                      <p className="text-xs text-gray-500">{hearing.court_name}</p>
                    </div>
                    {hearing.hearing_result && (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700">
                        {hearing.hearing_result}
                      </span>
                    )}
                  </div>

                  {hearing.hearing_type && (
                    <p className="text-xs text-gray-500 mb-2">기일유형: {hearing.hearing_type}</p>
                  )}

                  {hearing.judge_name && (
                    <p className="text-xs text-gray-500 mb-2">담당판사: {hearing.judge_name}</p>
                  )}

                  {/* 재판진행보고서 */}
                  {hearing.hearing_report && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <p className="text-xs font-medium text-gray-700 mb-1">재판진행보고서</p>
                      <p className="text-sm text-gray-600 whitespace-pre-wrap bg-gray-50 rounded p-3">
                        {hearing.hearing_report}
                      </p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* 기한 탭 */}
        {activeTab === 'deadlines' && (
          <div className="space-y-3">
            {deadlines.length === 0 ? (
              <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
                <p className="text-sm text-gray-500">등록된 기한이 없습니다.</p>
              </div>
            ) : (
              deadlines.map((deadline) => (
                <div
                  key={deadline.id}
                  className={`bg-white rounded-lg border p-4 ${
                    deadline.is_completed ? 'border-gray-200 opacity-60' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{deadline.deadline_date}</p>
                      <p className="text-xs text-gray-500 mt-1">{deadline.deadline_type}</p>
                      {deadline.description && (
                        <p className="text-sm text-gray-600 mt-2">{deadline.description}</p>
                      )}
                    </div>
                    {deadline.is_completed ? (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700">
                        완료
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-700">
                        진행중
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* 문의 안내 */}
        <section className="mt-8 p-4 bg-sage-50 rounded-lg">
          <p className="text-sm text-sage-700 text-center">
            문의사항이 있으시면 <strong>1661-7633</strong>으로 연락주세요.
          </p>
        </section>
      </main>
    </div>
  );
}
