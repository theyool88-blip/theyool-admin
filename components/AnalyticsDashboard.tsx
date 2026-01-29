'use client';

import { useEffect, useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Users,
  MessageSquare,
  Calendar,
  RefreshCw,
  Filter,
  BarChart3,
  PieChart,
  Clock,
  Target,
  Lightbulb,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';

interface FunnelStep {
  name: string;
  count: number;
  rate: number;
  dropoff: number;
}

interface SourceAnalysis {
  source: string;
  visitors: number;
  consultations: number;
  bookings: number;
  conversionRate: number;
}

interface PagePerformance {
  pagePath: string;
  pageType: string;
  views: number;
  avgTimeOnPage: number;
  avgScrollDepth: number;
}

interface TimeAnalysis {
  hour: number;
  dayOfWeek: number;
  visitors: number;
  consultations: number;
  conversionRate: number;
}

interface OverviewData {
  current: {
    visitors: number;
    consultations: number;
    bookings: number;
    conversionRate: number;
  };
  changes: {
    visitors: number;
    consultations: number;
    conversionRate: number;
  };
}

interface AnalyticsDashboardProps {
  hasHomepage: boolean;
}

type TabType = 'overview' | 'funnel' | 'sources' | 'pages' | 'time';

export default function AnalyticsDashboard({ hasHomepage }: AnalyticsDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // 데이터 상태
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [funnel, setFunnel] = useState<{ funnel: FunnelStep[]; insights: string[] } | null>(null);
  const [sources, setSources] = useState<SourceAnalysis[]>([]);
  const [pages, setPages] = useState<PagePerformance[]>([]);
  const [timeData, setTimeData] = useState<{
    hourly: TimeAnalysis[];
    daily: TimeAnalysis[];
    bestTimes: string[];
  } | null>(null);

  const fetchData = async (type: TabType) => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(
        `/api/admin/tenant/analytics?period=${period}&type=${type}`
      );
      const result = await response.json();

      if (result.success) {
        switch (type) {
          case 'overview':
            setOverview(result.data);
            break;
          case 'funnel':
            setFunnel(result.data);
            break;
          case 'sources':
            setSources(result.data);
            break;
          case 'pages':
            setPages(result.data);
            break;
          case 'time':
            setTimeData(result.data);
            break;
        }
      } else {
        setError(result.error || '데이터를 불러올 수 없습니다.');
      }
    } catch (err) {
      console.error('Analytics fetch error:', err);
      setError('서버 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (hasHomepage) {
      fetchData(activeTab);
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasHomepage, activeTab, period]);

  if (!hasHomepage) {
    return null;
  }

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: '개요', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'funnel', label: '퍼널', icon: <Filter className="w-4 h-4" /> },
    { id: 'sources', label: '유입 경로', icon: <ExternalLink className="w-4 h-4" /> },
    { id: 'pages', label: '페이지', icon: <Target className="w-4 h-4" /> },
    { id: 'time', label: '시간대', icon: <Clock className="w-4 h-4" /> },
  ];

  const formatChange = (value: number) => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
  };

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}초`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}분 ${secs}초`;
  };

  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[var(--color-info-muted)] flex items-center justify-center">
            <PieChart className="w-5 h-5 text-[var(--color-info)]" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">고급 분석</h2>
            <p className="text-caption">전환율 및 상세 인사이트</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as '7d' | '30d' | '90d')}
            className="form-input h-8 px-2 text-xs"
          >
            <option value="7d">최근 7일</option>
            <option value="30d">최근 30일</option>
            <option value="90d">최근 90일</option>
          </select>
          <button
            onClick={() => fetchData(activeTab)}
            disabled={loading}
            className="btn-ghost p-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 탭 네비게이션 */}
      <div className="flex gap-1 mb-6 border-b border-[var(--border-default)]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'text-[var(--sage-primary)] border-[var(--sage-primary)]'
                : 'text-[var(--text-tertiary)] border-transparent hover:text-[var(--text-secondary)]'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-[var(--color-danger-muted)] border border-[var(--color-danger)] rounded-lg">
          <p className="text-sm text-[var(--color-danger)]">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-6 h-6 animate-spin text-[var(--text-muted)]" />
        </div>
      ) : (
        <div>
          {/* 개요 탭 */}
          {activeTab === 'overview' && overview && (
            <div className="space-y-6">
              {/* 주요 지표 */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 bg-[var(--bg-primary)] rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <Users className="w-5 h-5 text-[var(--color-info)]" />
                    <span
                      className={`text-xs font-medium ${
                        overview.changes.visitors >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'
                      }`}
                    >
                      {overview.changes.visitors >= 0 ? (
                        <TrendingUp className="w-3 h-3 inline mr-0.5" />
                      ) : (
                        <TrendingDown className="w-3 h-3 inline mr-0.5" />
                      )}
                      {formatChange(overview.changes.visitors)}
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-[var(--text-primary)]">
                    {overview.current.visitors.toLocaleString()}
                  </p>
                  <p className="text-caption mt-1">방문자</p>
                </div>

                <div className="p-4 bg-[var(--bg-primary)] rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <MessageSquare className="w-5 h-5 text-[var(--color-success)]" />
                    <span
                      className={`text-xs font-medium ${
                        overview.changes.consultations >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'
                      }`}
                    >
                      {overview.changes.consultations >= 0 ? (
                        <TrendingUp className="w-3 h-3 inline mr-0.5" />
                      ) : (
                        <TrendingDown className="w-3 h-3 inline mr-0.5" />
                      )}
                      {formatChange(overview.changes.consultations)}
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-[var(--text-primary)]">
                    {overview.current.consultations.toLocaleString()}
                  </p>
                  <p className="text-caption mt-1">상담 신청</p>
                </div>

                <div className="p-4 bg-[var(--bg-primary)] rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <Calendar className="w-5 h-5 text-[var(--color-info)]" />
                  </div>
                  <p className="text-2xl font-bold text-[var(--text-primary)]">
                    {overview.current.bookings.toLocaleString()}
                  </p>
                  <p className="text-caption mt-1">예약 완료</p>
                </div>

                <div className="p-4 bg-[var(--sage-muted)] rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <Target className="w-5 h-5 text-[var(--sage-primary)]" />
                    <span
                      className={`text-xs font-medium ${
                        overview.changes.conversionRate >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'
                      }`}
                    >
                      {overview.changes.conversionRate >= 0 ? '+' : ''}
                      {overview.changes.conversionRate.toFixed(2)}%p
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-[var(--sage-primary)]">
                    {overview.current.conversionRate.toFixed(2)}%
                  </p>
                  <p className="text-caption mt-1">전환율</p>
                </div>
              </div>
            </div>
          )}

          {/* 퍼널 탭 */}
          {activeTab === 'funnel' && funnel && (
            <div className="space-y-6">
              {/* 퍼널 시각화 */}
              <div className="space-y-3">
                {funnel.funnel.map((step, idx) => {
                  const maxCount = funnel.funnel[0].count || 1;
                  const width = (step.count / maxCount) * 100;

                  return (
                    <div key={step.name} className="relative">
                      <div className="flex items-center gap-3">
                        <div className="w-24 text-right">
                          <span className="text-sm font-medium text-[var(--text-secondary)]">{step.name}</span>
                        </div>
                        <div className="flex-1 h-10 bg-[var(--bg-tertiary)] rounded-lg overflow-hidden relative">
                          <div
                            className="h-full bg-gradient-to-r from-[var(--sage-primary)] to-[var(--sage-secondary)] transition-all duration-500"
                            style={{ width: `${width}%` }}
                          />
                          <div className="absolute inset-0 flex items-center px-3">
                            <span className="text-sm font-bold text-white drop-shadow">
                              {step.count.toLocaleString()}
                            </span>
                          </div>
                        </div>
                        <div className="w-20 text-right">
                          <span className="text-sm text-[var(--text-tertiary)]">{step.rate.toFixed(1)}%</span>
                        </div>
                      </div>
                      {idx < funnel.funnel.length - 1 && step.dropoff > 0 && (
                        <div className="ml-28 my-1 text-xs text-[var(--color-danger)] flex items-center gap-1">
                          <ArrowRight className="w-3 h-3" />
                          {step.dropoff.toFixed(1)}% 이탈
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* 인사이트 */}
              {funnel.insights.length > 0 && (
                <div className="p-4 bg-[var(--color-warning-muted)] rounded-lg">
                  <h4 className="text-sm font-medium text-[var(--color-warning)] mb-2 flex items-center gap-1">
                    <Lightbulb className="w-4 h-4" />
                    인사이트
                  </h4>
                  <ul className="space-y-1">
                    {funnel.insights.map((insight, idx) => (
                      <li key={idx} className="text-sm text-[var(--color-warning)]">
                        • {insight}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* 유입 경로 탭 */}
          {activeTab === 'sources' && sources.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-default)]">
                    <th className="text-left py-2 px-3 font-medium text-[var(--text-secondary)]">소스</th>
                    <th className="text-right py-2 px-3 font-medium text-[var(--text-secondary)]">방문자</th>
                    <th className="text-right py-2 px-3 font-medium text-[var(--text-secondary)]">상담</th>
                    <th className="text-right py-2 px-3 font-medium text-[var(--text-secondary)]">예약</th>
                    <th className="text-right py-2 px-3 font-medium text-[var(--text-secondary)]">전환율</th>
                  </tr>
                </thead>
                <tbody>
                  {sources.map((source) => (
                    <tr key={source.source} className="border-b border-[var(--border-subtle)]">
                      <td className="py-2 px-3 font-medium text-[var(--text-primary)]">{source.source}</td>
                      <td className="py-2 px-3 text-right text-[var(--text-secondary)]">
                        {source.visitors.toLocaleString()}
                      </td>
                      <td className="py-2 px-3 text-right text-[var(--text-secondary)]">
                        {source.consultations.toLocaleString()}
                      </td>
                      <td className="py-2 px-3 text-right text-[var(--text-secondary)]">
                        {source.bookings.toLocaleString()}
                      </td>
                      <td className="py-2 px-3 text-right">
                        <span
                          className={`font-medium ${
                            source.conversionRate >= 3
                              ? 'text-[var(--color-success)]'
                              : source.conversionRate >= 1
                                ? 'text-[var(--color-warning)]'
                                : 'text-[var(--text-secondary)]'
                          }`}
                        >
                          {source.conversionRate.toFixed(2)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 페이지 성과 탭 */}
          {activeTab === 'pages' && pages.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-default)]">
                    <th className="text-left py-2 px-3 font-medium text-[var(--text-secondary)]">페이지</th>
                    <th className="text-right py-2 px-3 font-medium text-[var(--text-secondary)]">조회수</th>
                    <th className="text-right py-2 px-3 font-medium text-[var(--text-secondary)]">평균 체류</th>
                    <th className="text-right py-2 px-3 font-medium text-[var(--text-secondary)]">스크롤</th>
                  </tr>
                </thead>
                <tbody>
                  {pages.map((page) => (
                    <tr key={page.pagePath} className="border-b border-[var(--border-subtle)]">
                      <td className="py-2 px-3">
                        <div>
                          <p className="font-medium text-[var(--text-primary)] truncate max-w-xs">
                            {page.pagePath}
                          </p>
                          <p className="text-caption">{page.pageType}</p>
                        </div>
                      </td>
                      <td className="py-2 px-3 text-right text-[var(--text-secondary)]">
                        {page.views.toLocaleString()}
                      </td>
                      <td className="py-2 px-3 text-right text-[var(--text-secondary)]">
                        {formatTime(page.avgTimeOnPage)}
                      </td>
                      <td className="py-2 px-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[var(--sage-primary)]"
                              style={{ width: `${page.avgScrollDepth}%` }}
                            />
                          </div>
                          <span className="text-[var(--text-secondary)]">{page.avgScrollDepth}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 시간대 분석 탭 */}
          {activeTab === 'time' && timeData && (
            <div className="space-y-6">
              {/* 최적 시간대 */}
              {timeData.bestTimes.length > 0 && (
                <div className="p-4 bg-[var(--color-success-muted)] rounded-lg">
                  <h4 className="text-sm font-medium text-[var(--color-success)] mb-2">최적 시간대</h4>
                  <ul className="space-y-1">
                    {timeData.bestTimes.map((time, idx) => (
                      <li key={idx} className="text-sm text-[var(--color-success)]">
                        • {time}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 시간대별 히트맵 */}
              <div>
                <h4 className="text-sm font-medium text-[var(--text-secondary)] mb-3">시간대별 방문</h4>
                <div className="flex gap-1">
                  {timeData.hourly.map((h) => {
                    const maxVisitors = Math.max(...timeData.hourly.map((x) => x.visitors)) || 1;
                    const intensity = h.visitors / maxVisitors;

                    return (
                      <div
                        key={h.hour}
                        className="flex-1 h-12 rounded relative group"
                        style={{
                          backgroundColor: `rgba(139, 92, 246, ${0.1 + intensity * 0.8})`,
                        }}
                        title={`${h.hour}시: ${h.visitors}명 방문, ${h.consultations}건 상담`}
                      >
                        <span className="absolute bottom-0 left-1/2 -translate-x-1/2 text-[10px] text-[var(--text-tertiary)]">
                          {h.hour}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 요일별 */}
              <div>
                <h4 className="text-sm font-medium text-[var(--text-secondary)] mb-3">요일별 방문</h4>
                <div className="flex gap-2">
                  {timeData.daily.map((d) => {
                    const maxVisitors = Math.max(...timeData.daily.map((x) => x.visitors)) || 1;
                    const height = (d.visitors / maxVisitors) * 100;

                    return (
                      <div key={d.dayOfWeek} className="flex-1 flex flex-col items-center">
                        <div className="w-full h-20 bg-[var(--bg-tertiary)] rounded relative flex items-end">
                          <div
                            className="w-full bg-[var(--sage-secondary)] rounded transition-all"
                            style={{ height: `${height}%` }}
                          />
                        </div>
                        <span className="text-caption mt-1">
                          {dayNames[d.dayOfWeek]}
                        </span>
                        <span className="text-xs font-medium text-[var(--text-secondary)]">{d.visitors}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* 데이터 없음 */}
          {((activeTab === 'sources' && sources.length === 0) ||
            (activeTab === 'pages' && pages.length === 0)) && (
            <div className="text-center py-8">
              <BarChart3 className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-3" />
              <p className="text-body text-[var(--text-tertiary)]">분석할 데이터가 없습니다</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
