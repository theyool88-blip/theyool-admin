'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  RefreshCw,
  Search,
  Activity,
  Clock,
  Database,
  RotateCw,
  CheckCircle2,
  XCircle,
  Play,
} from 'lucide-react';

interface ScourtSettings {
  autoSyncEnabled: boolean;
  progressIntervalHours: number;
  progressJitterMinutes: number;
  generalBackoffHours: number;
  schedulerBatchSize: number;
  workerBatchSize: number;
  workerConcurrency: number;
  requestJitterMs: { min: number; max: number };
  rateLimitPerMinute: number | null;
  autoCooldownMinutes: number;
  manualCooldownMinutes: number;
  activeCaseRule: {
    statusAllowList: string[];
    statusBlockList: string[];
    excludeFinalResult: boolean;
    requireLinked: boolean;
  };
  wmonid: {
    autoRotateEnabled: boolean;
    renewalBeforeDays: number;
    earlyRotateEnabled: boolean;
  };
}

interface QueueStatusData {
  settings: ScourtSettings;
  statusCounts: Record<string, number>;
  queuedByType: Record<string, number>;
  wmonidCounts: Record<string, number>;
  oldestQueuedAt: string | null;
  recentJobs: Array<{
    id: string;
    sync_type: string;
    status: string;
    attempts: number;
    scheduled_at: string;
    started_at?: string | null;
    finished_at?: string | null;
    last_error?: string | null;
    legal_case?: {
      case_name?: string | null;
      court_case_number?: string | null;
    } | null;
  }>;
  recentLogs: Array<{
    id: string;
    action: string;
    status: string;
    duration_ms: number | null;
    cases_synced: number | null;
    cases_failed: number | null;
    created_at: string;
    details: Record<string, unknown> | null;
  }>;
}

interface CaseSearchResult {
  id: string;
  case_name: string;
  court_case_number: string | null;
  contract_number: string | null;
  office: string | null;
  client?: { name?: string | null };
}

export default function ScourtMonitoringPage() {
  const [statusData, setStatusData] = useState<QueueStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CaseSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [manualSyncType, setManualSyncType] = useState('full');
  const [manualCaseIds, setManualCaseIds] = useState('');
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchStatus = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/admin/scourt/queue-status?limit=20');
      const result = await response.json();

      if (!result.success) {
        setError(result.error || '상태 조회에 실패했습니다.');
        return;
      }

      setStatusData(result.data);
    } catch (err) {
      console.error('Queue status fetch error:', err);
      setError('서버 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const formatDate = (value: string | null | undefined) => {
    if (!value) return '-';
    const date = new Date(value);
    return date.toLocaleString('ko-KR');
  };

  const formatDuration = (ms: number | null | undefined) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    return `${Math.round(ms / 1000)}s`;
  };

  const formatAge = (value: string | null) => {
    if (!value) return '-';
    const diff = Date.now() - new Date(value).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}분 전`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}시간 전`;
    const days = Math.floor(hours / 24);
    return `${days}일 전`;
  };

  const handleSearch = async (event?: React.FormEvent) => {
    if (event) event.preventDefault();

    const query = searchQuery.trim();
    if (!query) {
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    setActionMessage(null);
    setActionError(null);

    try {
      const response = await fetch(`/api/admin/cases/search?q=${encodeURIComponent(query)}&limit=10`);
      const result = await response.json();
      setSearchResults(result.data || []);
    } catch (err) {
      console.error('Case search error:', err);
      setActionError('사건 검색 중 오류가 발생했습니다.');
    } finally {
      setSearchLoading(false);
    }
  };

  const enqueueManualSync = async (caseIds: string[]) => {
    if (!caseIds.length) {
      setActionError('큐에 등록할 사건이 없습니다.');
      return;
    }

    setActionLoading(true);
    setActionMessage(null);
    setActionError(null);

    try {
      const response = await fetch('/api/admin/scourt/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseIds,
          syncType: manualSyncType,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        setActionError(result.error || '수동 갱신 요청 실패');
        return;
      }

      setActionMessage(`큐 등록 완료: ${result.inserted}건`);
      await fetchStatus();
    } catch (err) {
      console.error('Manual enqueue error:', err);
      setActionError('수동 갱신 요청 중 오류가 발생했습니다.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleManualIdsSubmit = async () => {
    const ids = manualCaseIds
      .split(/[\s,]+/)
      .map((id) => id.trim())
      .filter(Boolean);

    await enqueueManualSync(ids);
  };

  const settingsSummary = useMemo(() => {
    if (!statusData?.settings) return [];
    const settings = statusData.settings;

    return [
      { label: '자동 갱신', value: settings.autoSyncEnabled ? 'ON' : 'OFF' },
      { label: '진행 주기', value: `${settings.progressIntervalHours}시간` },
      { label: '일반 백오프', value: `${settings.generalBackoffHours}시간` },
      { label: '워커 동시성', value: settings.workerConcurrency },
      { label: '워커 배치', value: settings.workerBatchSize },
      { label: '스케줄 배치', value: settings.schedulerBatchSize },
      { label: '분당 호출', value: settings.rateLimitPerMinute ?? '제한 없음' },
    ];
  }, [statusData]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-5 h-5 animate-spin text-[--sa-text-muted] mx-auto mb-3" />
          <p className="text-[13px] text-[--sa-text-tertiary]">데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-6 h-6 text-[--sa-accent-red] mx-auto mb-3" />
          <p className="text-[13px] text-[--sa-accent-red] mb-4">{error}</p>
          <button
            onClick={fetchStatus}
            className="text-[13px] text-[--sa-text-secondary] hover:text-[--sa-text-primary] underline"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-semibold text-[--sa-text-primary] tracking-tight">SCOURT 모니터링</h1>
          <p className="text-[13px] text-[--sa-text-tertiary] mt-1">법원 사건 동기화 시스템 상태</p>
        </div>
        <button onClick={fetchStatus} className="sa-btn sa-btn-secondary">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          새로고침
        </button>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="sa-card p-5">
          <div className="flex items-center gap-3 mb-4">
            <Activity className="w-5 h-5 text-[--sa-accent-blue]" />
            <h2 className="text-[13px] font-semibold text-[--sa-text-primary]">큐 상태</h2>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-[--sa-text-muted]">대기 중</span>
              <span className="text-[14px] font-semibold text-[--sa-text-primary]">{statusData?.statusCounts.queued || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-[--sa-text-muted]">실행 중</span>
              <span className="text-[14px] font-semibold text-[--sa-accent-yellow]">{statusData?.statusCounts.running || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-[--sa-text-muted]">실패</span>
              <span className="text-[14px] font-semibold text-[--sa-accent-red]">{statusData?.statusCounts.failed || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-[--sa-text-muted]">최근 성공</span>
              <span className="text-[14px] font-semibold text-[--sa-accent-green]">{statusData?.statusCounts.success || 0}</span>
            </div>
            <div className="pt-2 border-t border-[--sa-border-default]">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[--sa-text-tertiary]">가장 오래된 대기</span>
                <span className="text-[--sa-text-muted]">{formatAge(statusData?.oldestQueuedAt || null)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="sa-card p-5">
          <div className="flex items-center gap-3 mb-4">
            <Database className="w-5 h-5 text-[--sa-accent-blue]" />
            <h2 className="text-[13px] font-semibold text-[--sa-text-primary]">타입별 대기</h2>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-[--sa-text-muted]">진행(progress)</span>
              <span className="text-[14px] font-semibold text-[--sa-text-primary]">{statusData?.queuedByType.progress || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-[--sa-text-muted]">일반(general)</span>
              <span className="text-[14px] font-semibold text-[--sa-text-primary]">{statusData?.queuedByType.general || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-[--sa-text-muted]">전체(full)</span>
              <span className="text-[14px] font-semibold text-[--sa-text-primary]">{statusData?.queuedByType.full || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-[--sa-text-muted]">WMONID 갱신</span>
              <span className="text-[14px] font-semibold text-[--sa-text-primary]">{statusData?.queuedByType.wmonid_renewal || 0}</span>
            </div>
          </div>
        </div>

        <div className="sa-card p-5">
          <div className="flex items-center gap-3 mb-4">
            <RotateCw className="w-5 h-5 text-[--sa-accent-blue]" />
            <h2 className="text-[13px] font-semibold text-[--sa-text-primary]">WMONID 상태</h2>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-[--sa-text-muted]">활성</span>
              <span className="text-[14px] font-semibold text-[--sa-accent-green]">{statusData?.wmonidCounts.active || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-[--sa-text-muted]">만료 임박</span>
              <span className="text-[14px] font-semibold text-[--sa-accent-yellow]">{statusData?.wmonidCounts.expiring || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-[--sa-text-muted]">마이그레이션</span>
              <span className="text-[14px] font-semibold text-[--sa-text-primary]">{statusData?.wmonidCounts.migrating || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-[--sa-text-muted]">만료</span>
              <span className="text-[14px] font-semibold text-[--sa-text-muted]">{statusData?.wmonidCounts.expired || 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Manual Sync Section */}
      <div className="sa-card p-6 mb-6">
        <div className="flex items-center gap-3 mb-6">
          <Clock className="w-5 h-5 text-[--sa-accent-blue]" />
          <h2 className="text-[15px] font-semibold text-[--sa-text-primary]">수동 갱신</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <form onSubmit={handleSearch} className="flex gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[--sa-text-muted]" />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="사건명/사건번호/의뢰인으로 검색"
                  className="sa-input w-full pl-11"
                />
              </div>
              <button
                type="submit"
                className="sa-btn sa-btn-primary"
                disabled={searchLoading}
              >
                {searchLoading ? '검색 중...' : '검색'}
              </button>
            </form>

            <div className="bg-[--sa-bg-tertiary] rounded-xl overflow-hidden">
              <div className="px-4 py-3 text-[11px] text-[--sa-text-tertiary] border-b border-[--sa-border-default]">
                검색 결과 {searchResults.length}건
              </div>
              <div className="divide-y divide-[--sa-border-default]">
                {searchResults.map((result) => (
                  <div key={result.id} className="p-4 flex items-center justify-between gap-3 hover:bg-[--sa-bg-hover] transition-colors">
                    <div>
                      <p className="text-[13px] font-medium text-[--sa-text-primary]">
                        {result.case_name || '사건명 없음'}
                      </p>
                      <p className="text-[11px] text-[--sa-text-tertiary]">
                        {result.court_case_number || '사건번호 없음'}
                        {result.client?.name ? ` · ${result.client.name}` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="sa-btn sa-btn-secondary text-[12px]"
                      onClick={() => enqueueManualSync([result.id])}
                      disabled={actionLoading}
                    >
                      <Play className="w-3 h-3" />
                      큐 등록
                    </button>
                  </div>
                ))}
                {searchResults.length === 0 && (
                  <div className="p-8 text-center text-[13px] text-[--sa-text-muted]">검색 결과가 없습니다.</div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-[12px] font-medium text-[--sa-text-muted] mb-2">동기화 타입</label>
              <select
                value={manualSyncType}
                onChange={(event) => setManualSyncType(event.target.value)}
                className="sa-input w-full"
              >
                <option value="progress">진행만</option>
                <option value="general">일반만</option>
                <option value="full">전체</option>
              </select>
            </div>

            <div>
              <label className="block text-[12px] font-medium text-[--sa-text-muted] mb-2">case_id 직접 입력</label>
              <textarea
                value={manualCaseIds}
                onChange={(event) => setManualCaseIds(event.target.value)}
                rows={6}
                placeholder="UUID를 쉼표/공백/줄바꿈으로 구분"
                className="sa-input w-full resize-none"
              />
            </div>

            <button
              type="button"
              className="sa-btn sa-btn-primary w-full"
              onClick={handleManualIdsSubmit}
              disabled={actionLoading}
            >
              {actionLoading ? '처리 중...' : '직접 큐 등록'}
            </button>

            {actionMessage && (
              <div className="p-3 bg-[--sa-accent-green-muted] border border-[--sa-accent-green]/20 rounded-xl">
                <p className="text-[12px] text-[--sa-accent-green] flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  {actionMessage}
                </p>
              </div>
            )}
            {actionError && (
              <div className="p-3 bg-[--sa-accent-red-muted] border border-[--sa-accent-red]/20 rounded-xl">
                <p className="text-[12px] text-[--sa-accent-red] flex items-center gap-2">
                  <XCircle className="w-4 h-4" />
                  {actionError}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Settings Summary */}
        <div className="sa-card p-6">
          <h2 className="text-[15px] font-semibold text-[--sa-text-primary] mb-4">설정 요약</h2>
          <div className="grid grid-cols-2 gap-3">
            {settingsSummary.map((item) => (
              <div key={item.label} className="flex items-center justify-between bg-[--sa-bg-tertiary] rounded-xl px-4 py-3">
                <span className="text-[11px] text-[--sa-text-tertiary]">{item.label}</span>
                <span className="text-[13px] font-medium text-[--sa-text-primary]">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Logs */}
        <div className="sa-card p-6">
          <h2 className="text-[15px] font-semibold text-[--sa-text-primary] mb-4">최근 동기화 로그</h2>
          <div className="space-y-3">
            {(statusData?.recentLogs || []).slice(0, 6).map((log) => (
              <div key={log.id} className="flex items-start justify-between gap-3 p-3 bg-[--sa-bg-tertiary] rounded-xl">
                <div>
                  <p className="text-[13px] font-medium text-[--sa-text-primary]">{log.action}</p>
                  <p className="text-[11px] text-[--sa-text-tertiary]">{formatDate(log.created_at)}</p>
                </div>
                <div className="text-right">
                  <span className={`text-[11px] font-semibold px-2 py-1 rounded-lg ${
                    log.status === 'success' ? 'bg-[--sa-accent-green-muted] text-[--sa-accent-green]' : 'bg-[--sa-accent-red-muted] text-[--sa-accent-red]'
                  }`}>
                    {log.status}
                  </span>
                  <p className="text-[11px] text-[--sa-text-tertiary] mt-1">{formatDuration(log.duration_ms)}</p>
                </div>
              </div>
            ))}
            {(statusData?.recentLogs || []).length === 0 && (
              <p className="text-[13px] text-[--sa-text-muted] text-center py-4">로그가 없습니다.</p>
            )}
          </div>
        </div>
      </div>

      {/* Recent Jobs Table */}
      <div className="sa-card p-6">
        <h2 className="text-[15px] font-semibold text-[--sa-text-primary] mb-4">최근 작업</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[--sa-border-default]">
                <th className="text-left py-3 px-4 font-medium text-[--sa-text-tertiary]">사건</th>
                <th className="text-left py-3 px-4 font-medium text-[--sa-text-tertiary]">타입</th>
                <th className="text-left py-3 px-4 font-medium text-[--sa-text-tertiary]">상태</th>
                <th className="text-left py-3 px-4 font-medium text-[--sa-text-tertiary]">시작</th>
                <th className="text-left py-3 px-4 font-medium text-[--sa-text-tertiary]">완료</th>
                <th className="text-left py-3 px-4 font-medium text-[--sa-text-tertiary]">에러</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[--sa-border-subtle]">
              {(statusData?.recentJobs || []).map((job) => (
                <tr key={job.id} className="hover:bg-[--sa-bg-hover]">
                  <td className="py-3 px-4">
                    <p className="text-[--sa-text-primary]">{job.legal_case?.case_name || '사건명 없음'}</p>
                    <p className="text-[11px] text-[--sa-text-tertiary]">{job.legal_case?.court_case_number || '-'}</p>
                  </td>
                  <td className="py-3 px-4 text-[--sa-text-muted]">{job.sync_type}</td>
                  <td className="py-3 px-4">
                    <span className={`text-[11px] font-semibold px-2 py-1 rounded-lg ${
                      job.status === 'failed' ? 'bg-[--sa-accent-red-muted] text-[--sa-accent-red]' :
                      job.status === 'running' ? 'bg-[--sa-accent-yellow-muted] text-[--sa-accent-yellow]' :
                      job.status === 'success' ? 'bg-[--sa-accent-green-muted] text-[--sa-accent-green]' :
                      'bg-[--sa-bg-tertiary] text-[--sa-text-secondary]'
                    }`}>
                      {job.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-[--sa-text-tertiary] text-[11px]">{formatDate(job.started_at || job.scheduled_at)}</td>
                  <td className="py-3 px-4 text-[--sa-text-tertiary] text-[11px]">{formatDate(job.finished_at || null)}</td>
                  <td className="py-3 px-4 text-[11px] text-[--sa-accent-red] max-w-[200px] truncate">
                    {job.last_error ? job.last_error.slice(0, 60) : '-'}
                  </td>
                </tr>
              ))}
              {(statusData?.recentJobs || []).length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[13px] text-[--sa-text-muted]">
                    최근 작업이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
