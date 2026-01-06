'use client'

import { useState, useCallback } from 'react'
import AdminHeader from '@/components/AdminHeader'

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

interface ImportResult {
  caseNumber: string
  courtName: string
  clientName: string
  status: 'success' | 'failed' | 'skipped'
  error?: string
  encCsNo?: string
  legalCaseId?: string
}

interface ImportResponse {
  total: number
  processed: number
  success: number
  failed: number
  skipped: number
  results: ImportResult[]
  parseErrors: Array<{ caseNumber: string; error: string }>
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
  const [importResult, setImportResult] = useState<ImportResponse | null>(null)
  const [importProgress, setImportProgress] = useState(0)

  // Parse CSV on client side for preview
  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setFileName(file.name)
    setParseError(null)
    setParsedCases([])
    setImportResult(null)

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

  // Start import
  const handleImport = useCallback(async () => {
    if (!csvContent || importing) return

    setImporting(true)
    setImportResult(null)
    setImportProgress(0)

    try {
      const res = await fetch('/api/admin/scourt/batch-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csvContent,
          options: {
            skipExisting,
            dryRun,
            delayMs: 2500,
          },
        }),
      })

      const data: ImportResponse = await res.json()
      setImportResult(data)
      setImportProgress(100)
    } catch (err) {
      setParseError(err instanceof Error ? err.message : '가져오기 실패')
    } finally {
      setImporting(false)
    }
  }, [csvContent, importing, skipExisting, dryRun])

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
    <div className="min-h-screen bg-gray-50">
      <AdminHeader
        title="SCOURT 사건 가져오기"
        subtitle="케이스노트 CSV에서 사건 일괄 가져오기"
      />

      <main className="max-w-6xl mx-auto p-6">
        {/* Upload Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">CSV 파일 업로드</h2>

          <div className="flex items-center gap-4 mb-4">
            <label className="flex-1">
              <div className="flex items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-sage-500 transition-colors">
                <div className="text-center">
                  <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                    <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <p className="mt-2 text-sm text-gray-600">
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
            <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm mb-4">
              {parseError}
            </div>
          )}

          {parsedCases.length > 0 && (
            <div className="text-sm text-gray-600">
              <span className="font-medium text-gray-800">{parsedCases.length}건</span> 파싱 완료
              <span className="mx-2">|</span>
              법원: {Object.keys(stats.byCourtType).length}곳
              <span className="mx-2">|</span>
              사건유형: {Object.keys(stats.byCaseType).length}종
            </div>
          )}
        </div>

        {/* Preview Section */}
        {parsedCases.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-800">
                미리보기 ({parsedCases.length}건)
              </h2>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={skipExisting}
                    onChange={(e) => setSkipExisting(e.target.checked)}
                    className="rounded border-gray-300 text-sage-600 focus:ring-sage-500"
                  />
                  <span className="text-gray-600">이미 연동된 사건 스킵</span>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={dryRun}
                    onChange={(e) => setDryRun(e.target.checked)}
                    className="rounded border-gray-300 text-sage-600 focus:ring-sage-500"
                  />
                  <span className="text-gray-600">테스트 모드</span>
                </label>
              </div>
            </div>

            <div className="overflow-x-auto max-h-96 border border-gray-200 rounded-lg">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">#</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">사건번호</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">법원</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">의뢰인</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">역할</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">상대방</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {parsedCases.slice(0, 50).map((pc, idx) => (
                    <tr key={idx} className={pc.parseError ? 'bg-red-50' : ''}>
                      <td className="px-4 py-2 text-gray-500">{idx + 1}</td>
                      <td className="px-4 py-2 font-mono text-gray-800">{pc.caseNumber}</td>
                      <td className="px-4 py-2 text-gray-600">{pc.courtName}</td>
                      <td className="px-4 py-2 text-gray-800">{pc.clientName}</td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          pc.clientRoleKorean === '원고' || pc.clientRoleKorean === '신청인' || pc.clientRoleKorean === '청구인' || pc.clientRoleKorean === '채권자'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-orange-100 text-orange-700'
                        }`}>
                          {pc.clientRoleKorean || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-gray-600">{pc.opponentName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsedCases.length > 50 && (
                <div className="text-center py-2 text-gray-500 text-sm bg-gray-50">
                  ... 외 {parsedCases.length - 50}건 더 있음
                </div>
              )}
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={handleImport}
                disabled={importing}
                className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                  importing
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-sage-600 text-white hover:bg-sage-700'
                }`}
              >
                {importing ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    가져오는 중...
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

        {/* Import Progress */}
        {importing && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">가져오기 진행 중...</h2>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-sage-600 h-3 rounded-full transition-all duration-300"
                style={{ width: `${importProgress}%` }}
              />
            </div>
            <p className="text-sm text-gray-500 mt-2">
              API 호출 간격 2.5초... 전체 약 {Math.ceil(parsedCases.length * 2.5 / 60)}분 소요 예상
            </p>
          </div>
        )}

        {/* Results Section */}
        {importResult && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">가져오기 결과</h2>

            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-gray-800">{importResult.total}</div>
                <div className="text-sm text-gray-500">전체</div>
              </div>
              <div className="bg-green-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-green-600">{importResult.success}</div>
                <div className="text-sm text-green-600">성공</div>
              </div>
              <div className="bg-red-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-red-600">{importResult.failed}</div>
                <div className="text-sm text-red-600">실패</div>
              </div>
              <div className="bg-yellow-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-yellow-600">{importResult.skipped}</div>
                <div className="text-sm text-yellow-600">스킵</div>
              </div>
            </div>

            {importResult.results.length > 0 && (
              <div className="overflow-x-auto max-h-96 border border-gray-200 rounded-lg">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-gray-500">상태</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500">사건번호</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500">법원</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500">의뢰인</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500">비고</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {importResult.results.map((r, idx) => (
                      <tr key={idx} className={
                        r.status === 'success' ? 'bg-green-50' :
                        r.status === 'failed' ? 'bg-red-50' :
                        'bg-yellow-50'
                      }>
                        <td className="px-4 py-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            r.status === 'success' ? 'bg-green-100 text-green-700' :
                            r.status === 'failed' ? 'bg-red-100 text-red-700' :
                            'bg-yellow-100 text-yellow-700'
                          }`}>
                            {r.status === 'success' ? '성공' : r.status === 'failed' ? '실패' : '스킵'}
                          </span>
                        </td>
                        <td className="px-4 py-2 font-mono text-gray-800">{r.caseNumber}</td>
                        <td className="px-4 py-2 text-gray-600">{r.courtName}</td>
                        <td className="px-4 py-2 text-gray-800">{r.clientName}</td>
                        <td className="px-4 py-2 text-gray-500 text-xs">
                          {r.error || (r.encCsNo ? `encCsNo: ${r.encCsNo}` : '')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Help Section */}
        <div className="mt-6 bg-sage-50 rounded-lg p-4 text-sm text-sage-700">
          <h3 className="font-semibold mb-2">사용 방법</h3>
          <ol className="list-decimal list-inside space-y-1">
            <li>케이스노트에서 소송리스트를 CSV로 내보내기</li>
            <li>위 파일 선택 영역에 CSV 파일 업로드</li>
            <li>미리보기에서 파싱 결과 확인</li>
            <li>&quot;가져오기 시작&quot; 버튼 클릭</li>
            <li>각 사건별 SCOURT 검색 및 encCsNo 획득 (건당 약 2.5초)</li>
          </ol>
          <p className="mt-2 text-sage-600">
            * 이미 시스템에 등록된 사건만 SCOURT 연동됩니다. 신규 사건은 먼저 등록해주세요.
          </p>
        </div>
      </main>
    </div>
  )
}
