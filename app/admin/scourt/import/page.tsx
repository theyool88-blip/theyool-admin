'use client'

import { useState, useCallback, useEffect, useRef } from 'react'

interface ParsedCase {
  caseNumber: string
  courtName: string
  courtFullName: string
  caseYear: string
  caseType: string
  caseSerial: string
  caseName: string
  clientName: string
  clientRole: string | null
  clientRoleKorean: string
  opponentName: string
  isImportant: boolean
  parseError?: string
}

interface BatchProgress {
  total: number
  processed: number
  success: number
  failed: number
  skipped: number
  percentage: number
}

interface BatchStatusResponse {
  batchId: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: BatchProgress
  createdAt: string
  startedAt: string | null
  completedAt: string | null
}

export default function ScourtImportPage() {
  const [csvContent, setCsvContent] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [parsedCases, setParsedCases] = useState<ParsedCase[]>([])
  const [parseError, setParseError] = useState<string | null>(null)

  // Import options
  const [skipExisting, setSkipExisting] = useState(true)
  const [dryRun, setDryRun] = useState(false)

  // Import state
  const [importing, setImporting] = useState(false)
  const [batchId, setBatchId] = useState<string | null>(null)
  const [batchStatus, setBatchStatus] = useState<BatchStatusResponse | null>(null)
  const pollingRef = useRef<NodeJS.Timeout | null>(null)

  // Parse CSV on client side for preview
  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setFileName(file.name)
    setParseError(null)
    setParsedCases([])
    setBatchId(null)
    setBatchStatus(null)

    try {
      const content = await file.text()
      setCsvContent(content)

      // Call parsing API for preview
      const res = await fetch('/api/admin/scourt/batch-import/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvContent: content }),
      })

      if (!res.ok) {
        // Fallback to simple parsing
        const lines = content.split('\n').filter(l => l.trim())
        const cases: ParsedCase[] = []

        for (let i = 3; i < lines.length; i++) {
          const cols = lines[i].split(',')
          if (cols.length >= 3) {
            const caseInfo = cols[1]?.split(' / ') || []
            const partyInfo = cols[2]?.split(' / ') || []

            const caseNumberMatch = caseInfo[1]?.match(/^([가-힣]+)(\d{4})([가-힣]+)(\d+)$/)
            if (caseNumberMatch) {
              cases.push({
                caseName: caseInfo[0]?.trim() || '',
                courtName: caseNumberMatch[1],
                courtFullName: caseNumberMatch[1],
                caseYear: caseNumberMatch[2],
                caseType: caseNumberMatch[3],
                caseSerial: caseNumberMatch[4],
                caseNumber: `${caseNumberMatch[2]}${caseNumberMatch[3]}${caseNumberMatch[4]}`,
                clientName: partyInfo[0]?.replace(/\[.*\]/, '').trim() || '',
                clientRole: null,
                clientRoleKorean: partyInfo[0]?.match(/\[(.+?)\]/)?.[1] || '',
                opponentName: partyInfo[1]?.trim() || '',
                isImportant: !!cols[0],
              })
            }
          }
        }
        setParsedCases(cases)
      } else {
        const data = await res.json()
        setParsedCases(data.cases || [])
      }
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'CSV 파싱 실패')
    }
  }, [])

  // Poll for batch status
  const pollBatchStatus = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/admin/onboarding/batch-status/${id}`)
      if (res.ok) {
        const data: BatchStatusResponse = await res.json()
        setBatchStatus(data)

        // Stop polling if completed or failed
        if (data.status === 'completed' || data.status === 'failed') {
          if (pollingRef.current) {
            clearInterval(pollingRef.current)
            pollingRef.current = null
          }
          setImporting(false)
        }
      }
    } catch (err) {
      console.error('Failed to poll batch status:', err)
    }
  }, [])

  // Start polling when batchId is set
  useEffect(() => {
    if (batchId && importing) {
      // Initial fetch wrapped in async IIFE to avoid synchronous setState
      void (async () => {
        await pollBatchStatus(batchId)
      })()

      // Poll every 3 seconds
      pollingRef.current = setInterval(() => {
        pollBatchStatus(batchId)
      }, 3000)

      return () => {
        if (pollingRef.current) {
          clearInterval(pollingRef.current)
          pollingRef.current = null
        }
      }
    }
  }, [batchId, importing, pollBatchStatus])

  // Start import
  const handleImport = useCallback(async () => {
    if (!csvContent || importing) return

    setImporting(true)
    setBatchId(null)
    setBatchStatus(null)

    try {
      // Convert parsed cases to rows format
      const rows = parsedCases.map(pc => ({
        court_case_number: pc.caseNumber,
        court_name: pc.courtFullName,
        client_name: pc.clientName,
        client_role: pc.clientRoleKorean,
        opponent_name: pc.opponentName,
        case_name: pc.caseName,
      }))

      const res = await fetch('/api/admin/onboarding/batch-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rows,
          options: {
            duplicateHandling: skipExisting ? 'skip' : 'update',
            dryRun,
            createNewClients: true,
          },
        }),
      })

      const data = await res.json()

      if (data.success) {
        if (data.dryRun) {
          setBatchStatus({
            batchId: 'dry-run',
            status: 'completed',
            progress: {
              total: data.totalRows,
              processed: data.totalRows,
              success: data.totalRows,
              failed: 0,
              skipped: 0,
              percentage: 100,
            },
            createdAt: new Date().toISOString(),
            startedAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
          })
          setImporting(false)
        } else {
          setBatchId(data.batchId)
          // Polling will start via useEffect
        }
      } else {
        setParseError(data.error || '가져오기 실패')
        setImporting(false)
      }
    } catch (err) {
      setParseError(err instanceof Error ? err.message : '가져오기 실패')
      setImporting(false)
    }
  }, [csvContent, importing, parsedCases, skipExisting, dryRun])

  // Cancel batch
  const handleCancel = useCallback(async () => {
    if (!batchId) return

    try {
      const res = await fetch(`/api/admin/onboarding/batch-status/${batchId}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        // Stop polling
        if (pollingRef.current) {
          clearInterval(pollingRef.current)
          pollingRef.current = null
        }
        setImporting(false)
        // Fetch final status
        pollBatchStatus(batchId)
      }
    } catch (err) {
      console.error('Failed to cancel batch:', err)
    }
  }, [batchId, pollBatchStatus])

  // Stats summary
  const stats = {
    total: parsedCases.length,
    byCourtType: {} as Record<string, number>,
    byCaseType: {} as Record<string, number>,
  }

  for (const pc of parsedCases) {
    stats.byCourtType[pc.courtName] = (stats.byCourtType[pc.courtName] || 0) + 1
    stats.byCaseType[pc.caseType] = (stats.byCaseType[pc.caseType] || 0) + 1
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <main className="max-w-6xl mx-auto p-6">
        {/* Upload Section */}
        <div className="card p-6 mb-6">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">CSV 파일 업로드</h2>

          <div className="flex items-center gap-4 mb-4">
            <label className="flex-1">
              <div className="flex items-center justify-center w-full h-32 border-2 border-dashed border-[var(--border-default)] rounded-lg cursor-pointer hover:border-[var(--sage-primary)] transition-colors">
                <div className="text-center">
                  <svg className="mx-auto h-12 w-12 text-[var(--text-muted)]" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                    <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <p className="mt-2 text-sm text-[var(--text-secondary)]">
                    {fileName ? fileName : '케이스노트 CSV 파일을 선택하세요'}
                  </p>
                </div>
              </div>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          </div>

          {parseError && (
            <div className="bg-[var(--color-danger-muted)] text-[var(--color-danger)] p-3 rounded-lg text-sm mb-4">
              {parseError}
            </div>
          )}

          {parsedCases.length > 0 && (
            <div className="text-sm text-[var(--text-secondary)]">
              <span className="font-medium text-[var(--text-primary)]">{parsedCases.length}건</span> 파싱 완료
              <span className="mx-2">|</span>
              법원: {Object.keys(stats.byCourtType).length}곳
              <span className="mx-2">|</span>
              사건유형: {Object.keys(stats.byCaseType).length}종
            </div>
          )}
        </div>

        {/* Preview Section */}
        {parsedCases.length > 0 && !batchStatus && (
          <div className="card p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                미리보기 ({parsedCases.length}건)
              </h2>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={skipExisting}
                    onChange={(e) => setSkipExisting(e.target.checked)}
                    className="form-input rounded border-[var(--border-default)] text-[var(--sage-primary)] focus:ring-[var(--sage-primary)]"
                  />
                  <span className="text-[var(--text-secondary)]">이미 연동된 사건 스킵</span>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={dryRun}
                    onChange={(e) => setDryRun(e.target.checked)}
                    className="form-input rounded border-[var(--border-default)] text-[var(--sage-primary)] focus:ring-[var(--sage-primary)]"
                  />
                  <span className="text-[var(--text-secondary)]">테스트 모드</span>
                </label>
              </div>
            </div>

            <div className="overflow-x-auto max-h-96 border border-[var(--border-default)] rounded-lg">
              <table className="min-w-full divide-y divide-[var(--border-default)] text-sm">
                <thead className="bg-[var(--bg-primary)] sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-[var(--text-tertiary)]">#</th>
                    <th className="px-4 py-3 text-left font-medium text-[var(--text-tertiary)]">사건번호</th>
                    <th className="px-4 py-3 text-left font-medium text-[var(--text-tertiary)]">법원</th>
                    <th className="px-4 py-3 text-left font-medium text-[var(--text-tertiary)]">의뢰인</th>
                    <th className="px-4 py-3 text-left font-medium text-[var(--text-tertiary)]">역할</th>
                    <th className="px-4 py-3 text-left font-medium text-[var(--text-tertiary)]">상대방</th>
                  </tr>
                </thead>
                <tbody className="bg-[var(--bg-secondary)] divide-y divide-[var(--border-default)]">
                  {parsedCases.slice(0, 50).map((pc, idx) => (
                    <tr key={idx} className={pc.parseError ? 'bg-[var(--color-danger-muted)]' : ''}>
                      <td className="px-4 py-2 text-[var(--text-tertiary)]">{idx + 1}</td>
                      <td className="px-4 py-2 font-mono text-[var(--text-primary)]">{pc.caseNumber}</td>
                      <td className="px-4 py-2 text-[var(--text-secondary)]">{pc.courtName}</td>
                      <td className="px-4 py-2 text-[var(--text-primary)]">{pc.clientName}</td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          pc.clientRoleKorean === '원고' || pc.clientRoleKorean === '신청인' || pc.clientRoleKorean === '청구인' || pc.clientRoleKorean === '채권자'
                            ? 'bg-[var(--color-info-muted)] text-[var(--color-info)]'
                            : 'bg-[var(--color-warning-muted)] text-[var(--color-warning)]'
                        }`}>
                          {pc.clientRoleKorean || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-[var(--text-secondary)]">{pc.opponentName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsedCases.length > 50 && (
                <div className="text-center py-2 text-[var(--text-tertiary)] text-sm bg-[var(--bg-primary)]">
                  ... 외 {parsedCases.length - 50}건 더 있음
                </div>
              )}
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={handleImport}
                disabled={importing}
                className={`btn ${
                  importing
                    ? 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] cursor-not-allowed'
                    : 'btn-primary'
                }`}
              >
                {importing ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    대기열 추가 중...
                  </span>
                ) : dryRun ? (
                  '테스트 실행'
                ) : (
                  `${parsedCases.length}건 가져오기 시작`
                )}
              </button>
            </div>
          </div>
        )}

        {/* Progress Section */}
        {batchStatus && batchStatus.status !== 'completed' && (
          <div className="card p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                {batchStatus.status === 'pending' ? '대기 중...' : '처리 중...'}
              </h2>
              {importing && (
                <button
                  onClick={handleCancel}
                  className="btn bg-[var(--color-danger-muted)] text-[var(--color-danger)] hover:bg-[var(--color-danger)] hover:text-white"
                >
                  취소
                </button>
              )}
            </div>

            <div className="w-full bg-[var(--bg-tertiary)] rounded-full h-3 mb-2">
              <div
                className="bg-[var(--sage-primary)] h-3 rounded-full transition-all duration-300"
                style={{ width: `${batchStatus.progress.percentage}%` }}
              />
            </div>

            <div className="flex justify-between text-sm text-[var(--text-tertiary)]">
              <span>
                {batchStatus.progress.processed} / {batchStatus.progress.total}건 처리됨
              </span>
              <span>{batchStatus.progress.percentage}%</span>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
              <div className="bg-[var(--color-success-muted)] rounded-lg p-3 text-center">
                <div className="font-semibold text-[var(--color-success)]">{batchStatus.progress.success}</div>
                <div className="text-[var(--color-success)]">성공</div>
              </div>
              <div className="bg-[var(--color-danger-muted)] rounded-lg p-3 text-center">
                <div className="font-semibold text-[var(--color-danger)]">{batchStatus.progress.failed}</div>
                <div className="text-[var(--color-danger)]">실패</div>
              </div>
              <div className="bg-[var(--color-warning-muted)] rounded-lg p-3 text-center">
                <div className="font-semibold text-[var(--color-warning)]">{batchStatus.progress.skipped}</div>
                <div className="text-[var(--color-warning)]">스킵</div>
              </div>
            </div>

            <p className="text-sm text-[var(--text-tertiary)] mt-4">
              백그라운드에서 처리 중입니다. 페이지를 닫아도 처리가 계속됩니다.
              완료 시 알림을 받게 됩니다.
            </p>
          </div>
        )}

        {/* Results Section */}
        {batchStatus && batchStatus.status === 'completed' && (
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">가져오기 완료</h2>

            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="bg-[var(--bg-primary)] rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-[var(--text-primary)]">{batchStatus.progress.total}</div>
                <div className="text-sm text-[var(--text-tertiary)]">전체</div>
              </div>
              <div className="bg-[var(--color-success-muted)] rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-[var(--color-success)]">{batchStatus.progress.success}</div>
                <div className="text-sm text-[var(--color-success)]">성공</div>
              </div>
              <div className="bg-[var(--color-danger-muted)] rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-[var(--color-danger)]">{batchStatus.progress.failed}</div>
                <div className="text-sm text-[var(--color-danger)]">실패</div>
              </div>
              <div className="bg-[var(--color-warning-muted)] rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-[var(--color-warning)]">{batchStatus.progress.skipped}</div>
                <div className="text-sm text-[var(--color-warning)]">스킵</div>
              </div>
            </div>

            {batchStatus.completedAt && (
              <p className="text-sm text-[var(--text-tertiary)]">
                완료 시간: {new Date(batchStatus.completedAt).toLocaleString('ko-KR')}
              </p>
            )}

            <div className="mt-4">
              <button
                onClick={() => {
                  setBatchId(null)
                  setBatchStatus(null)
                  setParsedCases([])
                  setCsvContent('')
                  setFileName(null)
                }}
                className="btn btn-primary"
              >
                새 파일 가져오기
              </button>
            </div>
          </div>
        )}

        {/* Help Section */}
        <div className="mt-6 bg-[var(--sage-muted)] rounded-lg p-4 text-sm text-[var(--sage-primary)]">
          <h3 className="font-semibold mb-2">사용 방법</h3>
          <ol className="list-decimal list-inside space-y-1">
            <li>케이스노트에서 소송리스트를 CSV로 내보내기</li>
            <li>위 파일 선택 영역에 CSV 파일 업로드</li>
            <li>미리보기에서 파싱 결과 확인</li>
            <li>&quot;가져오기 시작&quot; 버튼 클릭</li>
            <li>백그라운드에서 자동 처리 (완료 시 알림)</li>
          </ol>
          <p className="mt-2 text-[var(--sage-primary)] opacity-80">
            * 대량 등록은 백그라운드에서 처리되므로 페이지를 닫아도 됩니다.
          </p>
          <p className="text-[var(--sage-primary)] opacity-80">
            * 처리 완료 시 알림을 받게 됩니다.
          </p>
        </div>
      </main>
    </div>
  )
}
