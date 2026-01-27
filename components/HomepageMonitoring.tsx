'use client';

import { useEffect, useState } from 'react';
import {
  BarChart3,
  TrendingUp,
  Users,
  MessageSquare,
  Calendar,
  Eye,
  AlertTriangle,
  RefreshCw,
  ChevronDown,
  Activity,
  Key,
} from 'lucide-react';

interface DailyStats {
  date: string;
  consultations: number;
  bookings: number;
  visitors: number;
  pageViews: number;
}

interface ApiKeyStats {
  keyId: string;
  keyPrefix: string;
  name: string;
  usageCount: number;
  lastUsedAt: string | null;
  isActive: boolean;
}

interface AnomalyAlert {
  type: 'spike' | 'unusual_origin' | 'rate_limit' | 'error_rate';
  severity: 'low' | 'medium' | 'high';
  message: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

interface StatsData {
  period: string;
  summary: {
    totalConsultations: number;
    totalBookings: number;
    totalVisitors: number;
    totalPageViews: number;
    conversionRate: string;
    avgDailyConsultations: string;
    avgDailyVisitors: string;
  };
  dailyStats: DailyStats[];
  apiKeyStats: ApiKeyStats[];
  anomalies: AnomalyAlert[];
}

interface HomepageMonitoringProps {
  hasHomepage: boolean;
}

export default function HomepageMonitoring({ hasHomepage }: HomepageMonitoringProps) {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('7d');

  const fetchStats = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/admin/tenant/api-stats?period=${period}`);
      const result = await response.json();

      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error || '통계를 불러올 수 없습니다.');
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
      setError('서버 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (hasHomepage) {
      fetchStats();
    } else {
      setLoading(false);
    }
  }, [hasHomepage, period]);

  if (!hasHomepage) {
    return null;
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getMaxValue = (stats: DailyStats[], key: keyof DailyStats) => {
    return Math.max(...stats.map((s) => s[key] as number), 1);
  };

  const getSeverityColor = (severity: AnomalyAlert['severity']) => {
    switch (severity) {
      case 'high':
        return 'bg-[var(--color-danger-muted)] border-[var(--color-danger)] text-[var(--color-danger)]';
      case 'medium':
        return 'bg-[var(--color-warning-muted)] border-[var(--color-warning)] text-[var(--color-warning)]';
      case 'low':
        return 'bg-[var(--color-info-muted)] border-[var(--color-info)] text-[var(--color-info)]';
    }
  };

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[var(--color-info-muted)] flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-[var(--color-info)]" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">홈페이지 분석</h2>
            <p className="text-caption">방문자 및 상담 통계</p>
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
            onClick={fetchStats}
            disabled={loading}
            className="p-2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] rounded"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
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
      ) : data ? (
        <div className="space-y-6">
          {/* 이상 패턴 알림 */}
          {data.anomalies.length > 0 && (
            <div className="space-y-2">
              {data.anomalies.map((anomaly, idx) => (
                <div
                  key={idx}
                  className={`p-3 border rounded-lg flex items-start gap-2 ${getSeverityColor(anomaly.severity)}`}
                >
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">{anomaly.message}</p>
                    {anomaly.details && (
                      <p className="text-xs opacity-75 mt-0.5">
                        {JSON.stringify(anomaly.details)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 요약 카드 */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-4 bg-[var(--bg-primary)] rounded-lg">
              <div className="flex items-center gap-2 text-[var(--text-tertiary)] mb-1">
                <Users className="w-4 h-4" />
                <span className="text-xs">방문자</span>
              </div>
              <p className="text-xl font-bold text-[var(--text-primary)]">
                {data.summary.totalVisitors.toLocaleString()}
              </p>
              <p className="text-caption mt-1">
                일 평균 {data.summary.avgDailyVisitors}
              </p>
            </div>

            <div className="p-4 bg-[var(--bg-primary)] rounded-lg">
              <div className="flex items-center gap-2 text-[var(--text-tertiary)] mb-1">
                <Eye className="w-4 h-4" />
                <span className="text-xs">페이지뷰</span>
              </div>
              <p className="text-xl font-bold text-[var(--text-primary)]">
                {data.summary.totalPageViews.toLocaleString()}
              </p>
              <p className="text-caption mt-1">
                방문당 {data.summary.totalVisitors > 0
                  ? (data.summary.totalPageViews / data.summary.totalVisitors).toFixed(1)
                  : '0'}페이지
              </p>
            </div>

            <div className="p-4 bg-[var(--bg-primary)] rounded-lg">
              <div className="flex items-center gap-2 text-[var(--text-tertiary)] mb-1">
                <MessageSquare className="w-4 h-4" />
                <span className="text-xs">상담 신청</span>
              </div>
              <p className="text-xl font-bold text-[var(--text-primary)]">
                {data.summary.totalConsultations.toLocaleString()}
              </p>
              <p className="text-caption mt-1">
                일 평균 {data.summary.avgDailyConsultations}
              </p>
            </div>

            <div className="p-4 bg-[var(--bg-primary)] rounded-lg">
              <div className="flex items-center gap-2 text-[var(--text-tertiary)] mb-1">
                <TrendingUp className="w-4 h-4" />
                <span className="text-xs">전환율</span>
              </div>
              <p className="text-xl font-bold text-[var(--sage-primary)]">
                {data.summary.conversionRate}
              </p>
              <p className="text-caption mt-1">
                예약 {data.summary.totalBookings}건 포함
              </p>
            </div>
          </div>

          {/* 일별 추이 차트 (간단한 바 차트) */}
          <div>
            <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-3 flex items-center gap-2">
              <Activity className="w-4 h-4 text-[var(--text-muted)]" />
              일별 추이
            </h3>
            <div className="h-32 flex items-end gap-1">
              {data.dailyStats.slice(-14).map((stat, idx) => {
                const maxVisitors = getMaxValue(data.dailyStats.slice(-14), 'visitors');
                const maxConsultations = getMaxValue(data.dailyStats.slice(-14), 'consultations');
                const visitorHeight = (stat.visitors / maxVisitors) * 100;
                const consultationHeight = (stat.consultations / maxConsultations) * 100;

                return (
                  <div
                    key={stat.date}
                    className="flex-1 flex flex-col items-center gap-0.5"
                    title={`${formatDate(stat.date)}: 방문 ${stat.visitors}, 상담 ${stat.consultations}`}
                  >
                    <div className="w-full flex gap-0.5 items-end h-24">
                      <div
                        className="flex-1 bg-[var(--color-info-muted)] rounded-t transition-all hover:bg-[var(--color-info)]"
                        style={{ height: `${visitorHeight}%`, minHeight: stat.visitors > 0 ? '4px' : '0' }}
                      />
                      <div
                        className="flex-1 bg-[var(--sage-primary)] rounded-t transition-all hover:opacity-80"
                        style={{ height: `${consultationHeight}%`, minHeight: stat.consultations > 0 ? '4px' : '0' }}
                      />
                    </div>
                    <span className="text-[10px] text-[var(--text-muted)]">
                      {formatDate(stat.date)}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-center gap-4 mt-2">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-[var(--color-info-muted)] rounded" />
                <span className="text-caption">방문자</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-[var(--sage-primary)] rounded" />
                <span className="text-caption">상담</span>
              </div>
            </div>
          </div>

          {/* API 키 사용량 */}
          {data.apiKeyStats.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-3 flex items-center gap-2">
                <Key className="w-4 h-4 text-[var(--text-muted)]" />
                API 키 사용량
              </h3>
              <div className="space-y-2">
                {data.apiKeyStats.map((key) => (
                  <div
                    key={key.keyId}
                    className="flex items-center justify-between p-3 bg-[var(--bg-primary)] rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          key.isActive ? 'bg-[var(--color-success)]' : 'bg-[var(--text-muted)]'
                        }`}
                      />
                      <div>
                        <p className="text-sm font-medium text-[var(--text-primary)]">{key.name}</p>
                        <p className="text-caption font-mono">{key.keyPrefix}...</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-[var(--text-primary)]">
                        {key.usageCount.toLocaleString()}회
                      </p>
                      <p className="text-caption">
                        {key.lastUsedAt ? `최근: ${formatDateTime(key.lastUsedAt)}` : '미사용'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-8">
          <BarChart3 className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-3" />
          <p className="text-body">통계 데이터가 없습니다</p>
        </div>
      )}
    </div>
  );
}
