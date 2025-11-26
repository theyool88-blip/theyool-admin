'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Case {
  id: string;
  case_name: string;
  case_number: string;
  case_type: string;
  status: string;
  office_location: string;
  created_at: string;
  opponent_name?: string;
}

interface Hearing {
  id: string;
  hearing_date: string;
  hearing_time: string;
  court_name: string;
  case_number: string;
  case_name: string;
}

export default function ClientDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [cases, setCases] = useState<Case[]>([]);
  const [upcomingHearings, setUpcomingHearings] = useState<Hearing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/client/login');
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.id) {
      fetchClientData();
    }
  }, [session]);

  async function fetchClientData() {
    try {
      const res = await fetch(`/api/client/dashboard`);
      const data = await res.json();

      if (data.success) {
        setCases(data.cases || []);
        setUpcomingHearings(data.upcomingHearings || []);
      }
    } catch (error) {
      console.error('데이터 로딩 실패:', error);
    } finally {
      setLoading(false);
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-sage-500 border-t-transparent"></div>
      </div>
    );
  }

  if (!session) {
    return null;
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">법무법인 더율</h1>
            <p className="text-xs text-gray-500">의뢰인 포털</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">{session.user?.name}님</span>
            <button
              onClick={() => signOut({ callbackUrl: '/client/login' })}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        {/* 다가오는 재판 */}
        {upcomingHearings.length > 0 && (
          <section className="mb-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">다가오는 재판</h2>
            <div className="space-y-2">
              {upcomingHearings.map((hearing) => (
                <div
                  key={hearing.id}
                  className="bg-white rounded-lg border border-gray-200 p-4"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {hearing.hearing_date} {hearing.hearing_time}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">{hearing.court_name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{hearing.case_name}</p>
                    </div>
                    <span className="px-2 py-0.5 text-xs rounded-full bg-purple-100 text-purple-700">
                      예정
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 내 사건 목록 */}
        <section>
          <h2 className="text-sm font-semibold text-gray-900 mb-3">내 사건</h2>

          {cases.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
              <p className="text-sm text-gray-500">등록된 사건이 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {cases.map((caseItem) => (
                <Link
                  key={caseItem.id}
                  href={`/client/cases/${caseItem.id}`}
                  className="block bg-white rounded-lg border border-gray-200 p-4 hover:border-sage-300 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {caseItem.case_name}
                        </p>
                        {getStatusBadge(caseItem.status)}
                      </div>
                      {caseItem.case_number && (
                        <p className="text-xs text-gray-500 mt-1">{caseItem.case_number}</p>
                      )}
                      <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                        <span>{caseItem.case_type}</span>
                        <span>·</span>
                        <span>{caseItem.office_location}</span>
                      </div>
                    </div>
                    <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

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
