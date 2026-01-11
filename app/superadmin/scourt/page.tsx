'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertCircle,
  Crown,
  RefreshCw,
  Search,
  Activity,
  Clock,
  Database,
  RotateCw,
} from 'lucide-react'

interface ScourtSettings {
  autoSyncEnabled: boolean
  progressIntervalHours: number
  progressJitterMinutes: number
  generalBackoffHours: number
  schedulerBatchSize: number
  workerBatchSize: number
  workerConcurrency: number
  requestJitterMs: { min: number; max: number }
  rateLimitPerMinute: number | null
  autoCooldownMinutes: number
  manualCooldownMinutes: number
  activeCaseRule: {
    statusAllowList: string[]
    statusBlockList: string[]
    excludeFinalResult: boolean
    requireLinked: boolean
  }
  wmonid: {
    autoRotateEnabled: boolean
    renewalBeforeDays: number
    earlyRotateEnabled: boolean
  }
}

interface QueueStatusData {
  settings: ScourtSettings
  statusCounts: Record<string, number>
  queuedByType: Record<string, number>
  wmonidCounts: Record<string, number>
  oldestQueuedAt: string | null
  recentJobs: Array<{
    id: string
    sync_type: string
    status: string
    attempts: number
    scheduled_at: string
    started_at?: string | null
    finished_at?: string | null
    last_error?: string | null
    legal_case?: {
      case_name?: string | null
      court_case_number?: string | null
    } | null
  }>
  recentLogs: Array<{
    id: string
    action: string
    status: string
    duration_ms: number | null
    cases_synced: number | null
    cases_failed: number | null
    created_at: string
    details: Record<string, unknown> | null
  }>
}

interface CaseSearchResult {
  id: string
  case_name: string
  court_case_number: string | null
  contract_number: string | null
  office: string | null
  client?: { name?: string | null }
}

export default function SuperAdminScourtPage() {
  const [statusData, setStatusData] = useState<QueueStatusData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<CaseSearchResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [manualSyncType, setManualSyncType] = useState('full')
  const [manualCaseIds, setManualCaseIds] = useState('')
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const fetchStatus = async () => {
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/admin/scourt/queue-status?limit=20')
      const result = await response.json()

      if (!result.success) {
        setError(result.error || '상태 조회에 실패했습니다.')
        return
      }

      setStatusData(result.data)
    } catch (err) {
      console.error('Queue status fetch error:', err)
      setError('서버 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus()
  }, [])

  const formatDate = (value: string | null | undefined) => {
    if (!value) return '-'
    const date = new Date(value)
    return date.toLocaleString('ko-KR')
  }

  const formatDuration = (ms: number | null | undefined) => {
    if (!ms) return '-'
    if (ms < 1000) return `${ms}ms`
    return `${Math.round(ms / 1000)}s`
  }

  const formatAge = (value: string | null) => {
    if (!value) return '-'
    const diff = Date.now() - new Date(value).getTime()
    const minutes = Math.floor(diff / 60000)
    if (minutes < 60) return `${minutes}분 전`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}시간 전`
    const days = Math.floor(hours / 24)
    return `${days}일 전`
  }

  const handleSearch = async (event?: React.FormEvent) => {
    if (event) event.preventDefault()

    const query = searchQuery.trim()
    if (!query) {
      setSearchResults([])
      return
    }

    setSearchLoading(true)
    setActionMessage(null)
    setActionError(null)

    try {
      const response = await fetch(`/api/admin/cases/search?q=${encodeURIComponent(query)}&limit=10`)
      const result = await response.json()
      setSearchResults(result.data || [])
    } catch (err) {
      console.error('Case search error:', err)
      setActionError('사건 검색 중 오류가 발생했습니다.')
    } finally {
      setSearchLoading(false)
    }
  }

  const enqueueManualSync = async (caseIds: string[]) => {
    if (!caseIds.length) {
      setActionError('큐에 등록할 사건이 없습니다.')
      return
    }

    setActionLoading(true)
    setActionMessage(null)
    setActionError(null)

    try {
      const response = await fetch('/api/admin/scourt/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseIds,
          syncType: manualSyncType,
        }),
      })

      const result = await response.json()

      if (!result.success) {
        setActionError(result.error || '수동 갱신 요청 실패')
        return
      }

      setActionMessage(`큐 등록 완료: ${result.inserted}건`)
      await fetchStatus()
    } catch (err) {
      console.error('Manual enqueue error:', err)
      setActionError('수동 갱신 요청 중 오류가 발생했습니다.')
    } finally {
      setActionLoading(false)
    }
  }

  const handleManualIdsSubmit = async () => {
    const ids = manualCaseIds
      .split(/[\s,]+/)
      .map((id) => id.trim())
      .filter(Boolean)

    await enqueueManualSync(ids)
  }

  const settingsSummary = useMemo(() => {
    if (!statusData?.settings) return []
    const settings = statusData.settings

    return [
      { label: '자동 갱신', value: settings.autoSyncEnabled ? 'ON' : 'OFF' },
      { label: '진행 주기', value: `${settings.progressIntervalHours}시간` },
      { label: '일반 백오프', value: `${settings.generalBackoffHours}시간` },
      { label: '워커 동시성', value: settings.workerConcurrency },
      { label: '워커 배치', value: settings.workerBatchSize },
      { label: '스케줄 배치', value: settings.schedulerBatchSize },
      { label: '분당 호출', value: settings.rateLimitPerMinute ?? '제한 없음' },
    ]
  }, [statusData])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-sage-600 mx-auto mb-2" />
          <p className="text-sm text-gray-500">로딩 중...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
          <p className="text-sm text-red-600 mb-4">{error}</p>
          <button
            onClick={fetchStatus}
            className="text-sm text-sage-600 hover:underline"
          >
            다시 시도
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Link href="/superadmin" className="text-gray-500 hover:text-gray-700">
                <Crown className="w-6 h-6 text-amber-500" />
              </Link>
              <span className="text-gray-300">/</span>
              <h1 className="text-lg font-bold text-gray-900">SCOURT 관리</h1>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/superadmin/tenants"
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                테넌트 관리
              </Link>
              <button
                onClick={fetchStatus}
                className="p-2 hover:bg-gray-100 rounded"
                title="새로고침"
              >
                <RefreshCw className={`w-4 h-4 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <Activity className="w-5 h-5 text-sage-600" />
              <h2 className="text-sm font-semibold text-gray-900">큐 상태</h2>
            </div>
            <div className="space-y-2 text-sm text-gray-700">
              <div className="flex items-center justify-between">
                <span>대기 중</span>
                <span className="font-semibold">{statusData?.statusCounts.queued || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>실행 중</span>
                <span className="font-semibold">{statusData?.statusCounts.running || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>실패</span>
                <span className="font-semibold text-red-600">{statusData?.statusCounts.failed || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>최근 성공</span>
                <span className="font-semibold">{statusData?.statusCounts.success || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>가장 오래된 대기</span>
                <span>{formatAge(statusData?.oldestQueuedAt || null)}</span>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <Database className="w-5 h-5 text-sage-600" />
              <h2 className="text-sm font-semibold text-gray-900">큐 타입별</h2>
            </div>
            <div className="space-y-2 text-sm text-gray-700">
              <div className="flex items-center justify-between">
                <span>진행(progress)</span>
                <span className="font-semibold">{statusData?.queuedByType.progress || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>일반(general)</span>
                <span className="font-semibold">{statusData?.queuedByType.general || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>전체(full)</span>
                <span className="font-semibold">{statusData?.queuedByType.full || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>WMONID</span>
                <span className="font-semibold">{statusData?.queuedByType.wmonid_renewal || 0}</span>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <RotateCw className="w-5 h-5 text-sage-600" />
              <h2 className="text-sm font-semibold text-gray-900">WMONID 상태</h2>
            </div>
            <div className="space-y-2 text-sm text-gray-700">
              <div className="flex items-center justify-between">
                <span>활성</span>
                <span className="font-semibold">{statusData?.wmonidCounts.active || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>만료 임박</span>
                <span className="font-semibold text-amber-600">{statusData?.wmonidCounts.expiring || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>마이그레이션 중</span>
                <span className="font-semibold">{statusData?.wmonidCounts.migrating || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>만료</span>
                <span className="font-semibold text-gray-500">{statusData?.wmonidCounts.expired || 0}</span>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-6">
            <Clock className="w-5 h-5 text-sage-600" />
            <h2 className="text-sm font-semibold text-gray-900">수동 갱신</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="사건명/사건번호/의뢰인으로 검색"
                    className="w-full h-11 pl-9 pr-4 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-500/20 focus:border-sage-500"
                  />
                </div>
                <button
                  type="submit"
                  className="h-11 px-4 bg-sage-600 text-white rounded-lg hover:bg-sage-700 disabled:opacity-50"
                  disabled={searchLoading}
                >
                  {searchLoading ? '검색 중...' : '검색'}
                </button>
              </form>

              <div className="border border-gray-100 rounded-lg">
                <div className="px-4 py-2 text-xs text-gray-500 border-b border-gray-100">
                  검색 결과 {searchResults.length}건
                </div>
                <div className="divide-y divide-gray-100">
                  {searchResults.map((result) => (
                    <div key={result.id} className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {result.case_name || '사건명 없음'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {result.court_case_number || '사건번호 없음'}
                          {result.client?.name ? ` · ${result.client.name}` : ''}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="px-3 py-1.5 text-xs font-medium bg-sage-50 text-sage-700 rounded hover:bg-sage-100"
                        onClick={() => enqueueManualSync([result.id])}
                        disabled={actionLoading}
                      >
                        큐 등록
                      </button>
                    </div>
                  ))}
                  {searchResults.length === 0 && (
                    <div className="p-4 text-sm text-gray-500">검색 결과가 없습니다.</div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">동기화 타입</label>
                <select
                  value={manualSyncType}
                  onChange={(event) => setManualSyncType(event.target.value)}
                  className="w-full h-11 px-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-500/20 focus:border-sage-500"
                >
                  <option value="progress">진행만</option>
                  <option value="general">일반만</option>
                  <option value="full">전체</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">case_id 직접 입력</label>
                <textarea
                  value={manualCaseIds}
                  onChange={(event) => setManualCaseIds(event.target.value)}
                  rows={6}
                  placeholder="UUID를 쉼표/공백/줄바꿈으로 구분"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-500/20 focus:border-sage-500"
                />
              </div>

              <button
                type="button"
                className="w-full h-11 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50"
                onClick={handleManualIdsSubmit}
                disabled={actionLoading}
              >
                {actionLoading ? '처리 중...' : '직접 큐 등록'}
              </button>

              {actionMessage && (
                <p className="text-sm text-sage-700 bg-sage-50 border border-sage-100 rounded-lg px-3 py-2">
                  {actionMessage}
                </p>
              )}
              {actionError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  {actionError}
                </p>
              )}
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">설정 요약</h2>
            <div className="grid grid-cols-2 gap-3 text-sm text-gray-700">
              {settingsSummary.map((item) => (
                <div key={item.label} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                  <span className="text-xs text-gray-500">{item.label}</span>
                  <span className="font-medium text-gray-900">{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">최근 동기화 로그</h2>
            <div className="space-y-3 text-sm">
              {(statusData?.recentLogs || []).slice(0, 6).map((log) => (
                <div key={log.id} className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-gray-900 font-medium">{log.action}</p>
                    <p className="text-xs text-gray-500">{formatDate(log.created_at)}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-xs font-semibold ${log.status === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                      {log.status}
                    </p>
                    <p className="text-xs text-gray-500">{formatDuration(log.duration_ms)}</p>
                  </div>
                </div>
              ))}
              {(statusData?.recentLogs || []).length === 0 && (
                <p className="text-sm text-gray-500">로그가 없습니다.</p>
              )}
            </div>
          </div>
        </section>

        <section className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">최근 작업</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-xs text-gray-500 uppercase bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left">사건</th>
                  <th className="px-3 py-2 text-left">타입</th>
                  <th className="px-3 py-2 text-left">상태</th>
                  <th className="px-3 py-2 text-left">시작</th>
                  <th className="px-3 py-2 text-left">완료</th>
                  <th className="px-3 py-2 text-left">에러</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(statusData?.recentJobs || []).map((job) => (
                  <tr key={job.id}>
                    <td className="px-3 py-2">
                      <p className="text-gray-900">{job.legal_case?.case_name || '사건명 없음'}</p>
                      <p className="text-xs text-gray-500">{job.legal_case?.court_case_number || '-'}</p>
                    </td>
                    <td className="px-3 py-2 text-gray-700">{job.sync_type}</td>
                    <td className="px-3 py-2">
                      <span className={`text-xs font-semibold ${job.status === 'failed' ? 'text-red-600' : job.status === 'running' ? 'text-amber-600' : 'text-gray-700'}`}>
                        {job.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-500">{formatDate(job.started_at || job.scheduled_at)}</td>
                    <td className="px-3 py-2 text-gray-500">{formatDate(job.finished_at || null)}</td>
                    <td className="px-3 py-2 text-xs text-red-600">
                      {job.last_error ? job.last_error.slice(0, 60) : '-'}
                    </td>
                  </tr>
                ))}
                {(statusData?.recentJobs || []).length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-4 text-center text-sm text-gray-500">
                      최근 작업이 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  )
}
