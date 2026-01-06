'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import CaseDocuments from '@/components/client/CaseDocuments';

interface Client {
  id: string;
  name: string;
  phone: string;
}

interface Case {
  id: string;
  case_name: string;
  contract_number: string;
  case_type: string;
  status: string;
  office: string;
  contract_date: string;
  created_at: string;
  onedrive_folder_url: string | null;
}

interface Hearing {
  id: string;
  hearing_date: string;
  hearing_time: string | null;
  court_name: string | null;
  hearing_type: string | null;
  hearing_result: string | null;
  judge_name: string | null;
  hearing_report: string | null;
  case_number: string | null;
}

interface Deadline {
  id: string;
  deadline_date: string;
  deadline_type: string | null;
  description: string | null;
  is_completed: boolean;
}

// 기일 유형 라벨
const HEARING_TYPE_LABELS: Record<string, string> = {
  'TRIAL': '변론기일',
  'MEDIATION': '조정기일',
  'RULING': '선고기일',
  'PREPARATION': '변론준비기일',
  'SETTLEMENT': '화해기일',
  'OTHER': '기타',
};

// 결과 라벨
const HEARING_RESULT_LABELS: Record<string, string> = {
  'CONTINUED': '속행',
  'CONCLUDED': '종결',
  'POSTPONED': '연기',
  'ESTIMATED': '추정',
};

export default function ClientPortalPreview() {
  const params = useParams();
  const clientId = params.clientId as string;

  const [client, setClient] = useState<Client | null>(null);
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);

  // 비밀번호 인증 상태
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState(['', '', '', '']);
  const [authError, setAuthError] = useState('');
  const [isAdminPreview, setIsAdminPreview] = useState(false);

  // 주 사건 상세 정보
  const [primaryCaseHearings, setPrimaryCaseHearings] = useState<Hearing[]>([]);
  const [primaryCaseDeadlines, setPrimaryCaseDeadlines] = useState<Deadline[]>([]);
  const [selectedHearing, setSelectedHearing] = useState<Hearing | null>(null);

  // 주 사건 선택 로직
  const getPrimaryCase = (caseList: Case[]): Case | null => {
    if (caseList.length === 0) return null;

    const activeCases = caseList.filter(c => c.status === '진행중' || c.status === 'active');

    if (activeCases.length === 0) {
      return caseList.sort((a, b) =>
        new Date(a.contract_date || a.created_at).getTime() -
        new Date(b.contract_date || b.created_at).getTime()
      )[0];
    }

    // 가장 최근 사건 반환
    return activeCases.sort((a, b) =>
      new Date(a.contract_date || a.created_at).getTime() -
      new Date(b.contract_date || b.created_at).getTime()
    )[0];
  };

  // URL 파라미터로 관리자 미리보기 모드 확인
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('preview') === 'admin') {
      setIsAdminPreview(true);
      setIsAuthenticated(true);
    }
    // 세션에 인증 정보가 있는지 확인
    const authKey = sessionStorage.getItem(`portal_auth_${clientId}`);
    if (authKey === 'authenticated') {
      setIsAuthenticated(true);
    }
  }, [clientId]);

  useEffect(() => {
    fetchData();
  }, [clientId]);

  // 비밀번호 입력 처리
  const handlePasswordChange = (index: number, value: string) => {
    if (value.length > 1) return;
    if (value && !/^\d$/.test(value)) return;

    const newPassword = [...password];
    newPassword[index] = value;
    setPassword(newPassword);
    setAuthError('');

    // 다음 입력 칸으로 자동 이동
    if (value && index < 3) {
      const nextInput = document.getElementById(`pin-${index + 1}`);
      nextInput?.focus();
    }

    // 4자리 모두 입력되면 자동 검증
    if (index === 3 && value) {
      const fullPassword = [...newPassword.slice(0, 3), value].join('');
      verifyPassword(fullPassword);
    }
  };

  // 백스페이스 처리
  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !password[index] && index > 0) {
      const prevInput = document.getElementById(`pin-${index - 1}`);
      prevInput?.focus();
    }
  };

  // 비밀번호 검증
  const verifyPassword = (inputPassword: string) => {
    if (!client?.phone) {
      setAuthError('전화번호 정보가 없습니다');
      return;
    }

    // 전화번호에서 숫자만 추출하고 뒷 4자리 가져오기
    const phoneDigits = client.phone.replace(/\D/g, '');
    const lastFourDigits = phoneDigits.slice(-4);

    if (inputPassword === lastFourDigits) {
      setIsAuthenticated(true);
      sessionStorage.setItem(`portal_auth_${clientId}`, 'authenticated');
    } else {
      setAuthError('비밀번호가 일치하지 않습니다');
      setPassword(['', '', '', '']);
      // 첫 번째 입력으로 포커스
      setTimeout(() => {
        document.getElementById('pin-0')?.focus();
      }, 100);
    }
  };

  async function fetchData() {
    try {
      const res = await fetch(`/api/admin/client-preview/${clientId}`);
      const data = await res.json();

      if (data.success) {
        setClient(data.client);
        setCases(data.cases || []);

        const primary = getPrimaryCase(data.cases || []);
        if (primary) {
          const caseRes = await fetch(`/api/admin/client-preview/${clientId}/cases/${primary.id}`);
          const caseData = await caseRes.json();

          if (caseData.success) {
            setPrimaryCaseHearings(caseData.hearings || []);
            setPrimaryCaseDeadlines(caseData.deadlines || []);
          }
        }
      }
    } catch (error) {
      console.error('데이터 로딩 실패:', error);
    } finally {
      setLoading(false);
    }
  }

  // 시간대별 인사말
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return '좋은 아침이에요';
    if (hour < 18) return '안녕하세요';
    return '좋은 저녁이에요';
  };

  // D-Day 계산
  const getDDay = (dateStr: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const targetDate = new Date(dateStr);
    targetDate.setHours(0, 0, 0, 0);
    return Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  // 날짜 포맷
  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return { month: 0, day: 0, weekday: '-', full: '-', simple: '-' };
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
    const weekday = weekdays[date.getDay()];
    const yy = String(year).slice(2);
    const mm = String(month).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return {
      month,
      day,
      weekday,
      full: `${yy}.${mm}.${dd}(${weekday})`,
      simple: `${yy}.${mm}.${dd}`
    };
  };


  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-sage-200 border-t-sage-600 rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-sage-600 text-sm">불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <p className="text-gray-500">의뢰인 정보를 찾을 수 없습니다.</p>
      </div>
    );
  }

  // 비밀번호 인증 화면
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* 헤더 */}
        <header className="bg-white border-b border-gray-100 px-5 py-6">
          <div className="max-w-lg mx-auto">
            <Image
              src="/images/logo-sage.png"
              alt="법무법인 더율"
              width={120}
              height={32}
              className="h-7 w-auto"
            />
          </div>
        </header>

        {/* 인증 폼 */}
        <div className="flex-1 flex items-center justify-center px-5">
          <div className="w-full max-w-sm">
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
              {/* 자물쇠 아이콘 */}
              <div className="w-16 h-16 bg-sage-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-sage-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>

              <h2 className="text-xl font-bold text-gray-900 text-center mb-2">
                본인 확인
              </h2>
              <p className="text-sm text-gray-500 text-center mb-6">
                {client.name}님의 정보를 보호하기 위해<br />
                전화번호 뒷자리 4자리를 입력해주세요
              </p>

              {/* PIN 입력 */}
              <div className="flex justify-center gap-3 mb-4">
                {[0, 1, 2, 3].map((index) => (
                  <input
                    key={index}
                    id={`pin-${index}`}
                    type="tel"
                    inputMode="numeric"
                    maxLength={1}
                    value={password[index]}
                    onChange={(e) => handlePasswordChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    className="w-14 h-14 text-center text-2xl font-bold border-2 border-gray-200 rounded-xl focus:border-sage-500 focus:outline-none transition-colors"
                    autoFocus={index === 0}
                  />
                ))}
              </div>

              {/* 에러 메시지 */}
              {authError && (
                <p className="text-red-500 text-sm text-center mb-4">{authError}</p>
              )}

              {/* 안내 문구 */}
              <p className="text-xs text-gray-400 text-center">
                등록된 연락처의 뒷 4자리입니다
              </p>
            </div>

            {/* 보안 안내 */}
            <div className="mt-6 text-center">
              <p className="text-xs text-gray-400">
                <svg className="w-4 h-4 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                안전한 정보 보호를 위해 본인 확인 후 열람 가능합니다
              </p>
            </div>
          </div>
        </div>

        {/* 푸터 */}
        <footer className="py-6 text-center">
          <p className="text-xs text-gray-400">
            © 법무법인 더율
          </p>
        </footer>
      </div>
    );
  }

  const primaryCase = getPrimaryCase(cases);
  const otherCases = primaryCase ? cases.filter(c => c.id !== primaryCase.id) : [];
  const activeCases = cases.filter(c => c.status === '진행중' || c.status === 'active');

  // 사무소별 전화번호
  const getOfficePhone = () => {
    const office = primaryCase?.office || '';
    if (office === '천안') {
      return { number: '041-622-7005', display: '041-622-7005' };
    }
    return { number: '031-652-7005', display: '031-652-7005' };
  };
  const officePhone = getOfficePhone();

  // 과거/미래 재판 분리
  const upcomingHearings = primaryCaseHearings.filter(h => getDDay(h.hearing_date) >= 0);
  const pastHearings = primaryCaseHearings.filter(h => getDDay(h.hearing_date) < 0);

  // 미완료/완료 기한 분리
  const pendingDeadlines = primaryCaseDeadlines.filter(d => !d.is_completed);
  const completedDeadlines = primaryCaseDeadlines.filter(d => d.is_completed);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 관리자 미리보기 배너 - 관리자만 볼 수 있음 */}
      {isAdminPreview && (
        <div className="bg-sage-600 text-white px-4 py-2 text-center text-xs">
          <span className="opacity-80">관리자 미리보기 모드</span>
          <span className="mx-2 opacity-50">|</span>
          <span className="font-medium">{client.name}</span>
          <Link href="/clients" className="ml-3 text-white/80 hover:text-white underline transition-colors">
            ← 돌아가기
          </Link>
        </div>
      )}

      {/* 헤더 */}
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-lg mx-auto px-5 py-6">
          <div className="flex items-center gap-3 mb-5">
            <Image
              src="/images/logo-sage.png"
              alt="법무법인 더율"
              width={120}
              height={32}
              className="h-7 w-auto"
            />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {client.name}<span className="font-normal text-gray-400">님,</span>
            </h1>
            <p className="text-sage-600 mt-1 text-sm">{getGreeting()}</p>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-5 py-6 space-y-5">
        {/* 주 사건 정보 */}
        {primaryCase && (
          <>
            {/* 사건 카드 */}
            <section className="bg-sage-600 rounded-2xl p-5 text-white">
              <div className="flex items-start justify-between mb-3">
                <span className="inline-block px-2 py-0.5 bg-white/20 text-white text-xs font-medium rounded-full">
                  {primaryCase.status === '진행중' || primaryCase.status === 'active' ? '진행중' : '종결'}
                </span>
                {primaryCase.office && (
                  <span className="text-white/70 text-xs">{primaryCase.office}</span>
                )}
              </div>
              <h2 className="text-lg font-bold mb-1">{primaryCase.case_name}</h2>
              {primaryCase.case_type && (
                <p className="text-white/70 text-sm">{primaryCase.case_type}</p>
              )}

              {activeCases.length > 1 && (
                <div className="mt-4 pt-3 border-t border-white/20">
                  <p className="text-white/70 text-xs">
                    진행 중인 사건 <span className="text-white font-semibold">{activeCases.length}건</span>
                  </p>
                </div>
              )}
            </section>

            {/* 사건 상세 정보 */}
            <section className="bg-white rounded-xl border border-gray-100 p-4">
              <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                <span className="w-1 h-4 bg-blue-500 rounded-full"></span>
                사건 정보
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-400 mb-1">사건번호</p>
                  <p className="text-sm font-medium text-gray-900">
                    {primaryCaseHearings[0]?.case_number || '-'}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-400 mb-1">담당판사</p>
                  <p className="text-sm font-medium text-gray-900">
                    {primaryCaseHearings[0]?.judge_name || '-'}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-400 mb-1">사건유형</p>
                  <p className="text-sm font-medium text-gray-900">
                    {primaryCase.case_type || '-'}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-400 mb-1">관할법원</p>
                  <p className="text-sm font-medium text-gray-900">
                    {primaryCaseHearings[0]?.court_name || '-'}
                  </p>
                </div>
              </div>
            </section>

            {/* 소송 서류 */}
            <section className="bg-white rounded-xl border border-gray-100 p-4">
              <CaseDocuments caseId={primaryCase.id} />
            </section>

            {/* 다가오는 기한 */}
            {pendingDeadlines.length > 0 && (
              <section>
                <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                  <span className="w-1 h-4 bg-amber-500 rounded-full"></span>
                  다가오는 기한
                </h3>
                <div className="space-y-2">
                  {pendingDeadlines.map((deadline) => {
                    const dday = getDDay(deadline.deadline_date);
                    const isUrgent = dday <= 3;
                    return (
                      <div
                        key={deadline.id}
                        className={`bg-white rounded-xl p-4 border ${
                          isUrgent ? 'border-red-200' : 'border-gray-100'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center ${
                            isUrgent ? 'bg-red-500' : 'bg-amber-500'
                          } text-white`}>
                            <span className="text-[10px] opacity-80">{formatDate(deadline.deadline_date).month}월</span>
                            <span className="text-lg font-bold">{formatDate(deadline.deadline_date).day}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-900 text-sm">{deadline.deadline_type || '기한'}</p>
                            {deadline.description && (
                              <p className="text-xs text-gray-500 truncate mt-0.5">{deadline.description}</p>
                            )}
                          </div>
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                            isUrgent
                              ? 'bg-red-100 text-red-600'
                              : 'bg-amber-100 text-amber-600'
                          }`}>
                            D-{dday}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* 재판기일 */}
            {primaryCaseHearings.length > 0 && (
              <section>
                <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                  <span className="w-1 h-4 bg-sage-500 rounded-full"></span>
                  재판기일
                </h3>
                <div className="space-y-2">
                  {/* 예정된 재판 */}
                  {upcomingHearings.map((hearing) => (
                    <div
                      key={hearing.id}
                      className="bg-white rounded-xl border border-gray-100 p-4 cursor-pointer hover:border-sage-200 transition-colors"
                      onClick={() => setSelectedHearing(hearing)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-sage-500 rounded-xl flex flex-col items-center justify-center text-white">
                          <span className="text-[10px] opacity-80">{formatDate(hearing.hearing_date).month}월</span>
                          <span className="text-lg font-bold">{formatDate(hearing.hearing_date).day}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="font-semibold text-gray-900 text-sm">
                              {formatDate(hearing.hearing_date).weekday}요일 {hearing.hearing_time || ''}
                            </p>
                            <span className="px-2 py-0.5 bg-sage-100 text-sage-700 text-xs font-bold rounded-full">
                              D-{getDDay(hearing.hearing_date)}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500">{hearing.court_name || '장소 미정'}</p>
                          {hearing.hearing_type && (
                            <span className="inline-block mt-1 text-xs text-sage-600 bg-sage-50 px-2 py-0.5 rounded">
                              {HEARING_TYPE_LABELS[hearing.hearing_type] || hearing.hearing_type}
                            </span>
                          )}
                        </div>
                        <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  ))}

                  {/* 지난 재판 */}
                  {pastHearings.length > 0 && (
                    <div className="pt-2">
                      <p className="text-xs text-gray-400 mb-2">지난 재판</p>
                      {pastHearings.map((hearing) => (
                        <div
                          key={hearing.id}
                          className="bg-gray-100 rounded-xl p-4 cursor-pointer hover:bg-gray-200 transition-colors mb-2"
                          onClick={() => setSelectedHearing(hearing)}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gray-300 rounded-lg flex flex-col items-center justify-center">
                              <span className="text-[9px] text-gray-600">{formatDate(hearing.hearing_date).month}월</span>
                              <span className="text-sm font-bold text-gray-700">{formatDate(hearing.hearing_date).day}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-600">{formatDate(hearing.hearing_date).full}</p>
                              <div className="flex items-center gap-2 mt-1">
                                {hearing.hearing_result && (
                                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                                    {HEARING_RESULT_LABELS[hearing.hearing_result] || hearing.hearing_result}
                                  </span>
                                )}
                                {hearing.hearing_report && (
                                  <span className="text-xs text-sage-600 flex items-center gap-1">
                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                                    </svg>
                                    보고서
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* 완료된 기한 */}
            {completedDeadlines.length > 0 && (
              <section>
                <h3 className="text-sm font-medium text-gray-400 mb-2 flex items-center gap-2">
                  <span className="w-1 h-4 bg-gray-300 rounded-full"></span>
                  완료된 기한
                </h3>
                <div className="bg-gray-100 rounded-xl p-4 space-y-2">
                  {completedDeadlines.map((deadline) => (
                    <div key={deadline.id} className="flex items-center gap-3 opacity-60">
                      <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <p className="text-sm text-gray-500 line-through flex-1">{deadline.deadline_type || '기한'}</p>
                      <span className="text-xs text-gray-400">{formatDate(deadline.deadline_date).simple}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 재판도 기한도 없는 경우 */}
            {primaryCaseHearings.length === 0 && primaryCaseDeadlines.length === 0 && (
              <section className="bg-white rounded-xl border border-gray-100 p-8 text-center">
                <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-7 h-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-gray-500 text-sm">현재 예정된 재판이나 기한이 없습니다.</p>
              </section>
            )}
          </>
        )}

        {/* 다른 사건 목록 */}
        {otherCases.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                <span className="w-1 h-4 bg-gray-400 rounded-full"></span>
                다른 사건
              </h3>
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{otherCases.length}건</span>
            </div>
            <div className="space-y-2">
              {otherCases.map((caseItem) => (
                <Link
                  key={caseItem.id}
                  href={`/admin/client-preview/${clientId}/cases/${caseItem.id}`}
                  className="block bg-white rounded-xl border border-gray-100 p-4 hover:border-sage-200 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      caseItem.status === '진행중' || caseItem.status === 'active'
                        ? 'bg-emerald-100'
                        : 'bg-gray-100'
                    }`}>
                      <svg className={`w-5 h-5 ${
                        caseItem.status === '진행중' || caseItem.status === 'active'
                          ? 'text-emerald-600'
                          : 'text-gray-400'
                      }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm truncate">{caseItem.case_name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{caseItem.case_type || '-'}</p>
                    </div>
                    <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* 사건이 없는 경우 */}
        {cases.length === 0 && (
          <section className="bg-white rounded-xl border border-gray-100 p-8 text-center">
            <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-7 h-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-gray-500 text-sm">등록된 사건이 없습니다.</p>
          </section>
        )}

        {/* 빠른 연락 */}
        <section className="pt-2">
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="p-4 border-b border-gray-50">
              <p className="text-xs text-gray-400 mb-1">문의하기</p>
              <p className="text-sm text-gray-600">궁금한 점이 있으시면 연락주세요</p>
            </div>
            <div className="grid grid-cols-2 divide-x divide-gray-100">
              <a
                href={`tel:${officePhone.number.replace(/-/g, '')}`}
                className="flex flex-col items-center gap-2 p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="w-10 h-10 bg-sage-100 rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-sage-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-gray-900">전화</span>
                <span className="text-xs text-gray-400">{officePhone.display}</span>
              </a>

              <a
                href="#"
                className="flex flex-col items-center gap-2 p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-amber-600" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 3c5.514 0 10 3.592 10 8.007 0 4.917-5.145 7.961-9.91 7.961-1.937 0-3.383-.397-4.394-.644-1 .613-2.594 1.676-4.696 1.676.35-.85.683-2.059.683-3.2 0-.478-.073-.923-.2-1.34C2.162 14.047 2 12.556 2 11.007 2 6.592 6.486 3 12 3z"/>
                  </svg>
                </div>
                <span className="text-sm font-medium text-gray-900">카카오톡</span>
                <span className="text-xs text-gray-400">바로 연결</span>
              </a>
            </div>
          </div>
        </section>

        {/* 하단 안내 */}
        <footer className="text-center pt-2 pb-6">
          <Image
            src="/images/logo-sage.png"
            alt="법무법인 더율"
            width={80}
            height={24}
            className="h-5 w-auto mx-auto opacity-30 mb-2"
          />
          <p className="text-xs text-gray-400">
            평일 09:00 - 18:00 상담 가능
          </p>
        </footer>
      </main>

      {/* 재판 진행 보고서 모달 */}
      {selectedHearing && (
        <div
          className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50"
          onClick={() => setSelectedHearing(null)}
        >
          <div
            className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 모달 헤더 */}
            <div className="bg-white border-b border-gray-100 px-5 py-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900">재판기일 상세</h3>
                <button
                  onClick={() => setSelectedHearing(null)}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* 모달 내용 */}
            <div className="p-5 overflow-y-auto max-h-[calc(90vh-140px)] space-y-4">
              {/* 날짜 카드 */}
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                <div className="w-14 h-14 bg-white rounded-xl flex flex-col items-center justify-center shadow-sm">
                  <span className="text-xs text-gray-400">{formatDate(selectedHearing.hearing_date).month}월</span>
                  <span className="text-2xl font-bold text-gray-800">{formatDate(selectedHearing.hearing_date).day}</span>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{formatDate(selectedHearing.hearing_date).full}</p>
                  <p className="text-sm text-gray-500">{selectedHearing.hearing_time || '시간 미정'}</p>
                </div>
              </div>

              {/* 상세 정보 */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400 mb-1">기일 유형</p>
                  <p className="text-sm font-medium text-gray-900">
                    {selectedHearing.hearing_type ? (HEARING_TYPE_LABELS[selectedHearing.hearing_type] || selectedHearing.hearing_type) : '-'}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400 mb-1">법원/장소</p>
                  <p className="text-sm font-medium text-gray-900">{selectedHearing.court_name || '-'}</p>
                </div>
                {selectedHearing.judge_name && (
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-400 mb-1">담당 판사</p>
                    <p className="text-sm font-medium text-gray-900">{selectedHearing.judge_name}</p>
                  </div>
                )}
                {selectedHearing.hearing_result && (
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-400 mb-1">기일 결과</p>
                    <span className="inline-block px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-lg">
                      {HEARING_RESULT_LABELS[selectedHearing.hearing_result] || selectedHearing.hearing_result}
                    </span>
                  </div>
                )}
              </div>

              {/* 재판 진행 보고서 */}
              {selectedHearing.hearing_report && (
                <div>
                  <p className="text-xs text-gray-400 mb-2">재판 진행 보고서</p>
                  <div className="p-4 bg-sage-50 border border-sage-100 rounded-xl">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                      {selectedHearing.hearing_report}
                    </p>
                  </div>
                </div>
              )}

              {/* D-Day */}
              {getDDay(selectedHearing.hearing_date) >= 0 ? (
                <div className="p-4 bg-sage-100 rounded-xl text-center">
                  <p className="text-sm text-sage-800">
                    재판까지 <span className="font-bold text-sage-900">D-{getDDay(selectedHearing.hearing_date)}</span> 남았습니다
                  </p>
                </div>
              ) : (
                <div className="p-4 bg-gray-100 rounded-xl text-center">
                  <p className="text-sm text-gray-600">
                    {Math.abs(getDDay(selectedHearing.hearing_date))}일 전에 진행된 재판입니다
                  </p>
                </div>
              )}
            </div>

            {/* 닫기 버튼 */}
            <div className="bg-white border-t border-gray-100 p-4">
              <button
                onClick={() => setSelectedHearing(null)}
                className="w-full py-3 bg-sage-600 text-white font-semibold rounded-xl hover:bg-sage-700 transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
