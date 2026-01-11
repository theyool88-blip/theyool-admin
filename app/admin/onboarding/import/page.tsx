'use client'

import { useState, useCallback, useRef } from 'react'
import AdminHeader from '@/components/AdminHeader'
import type { ImportOptions, ImportReport } from '@/types/onboarding'
import { downloadReport } from '@/lib/onboarding/import-report-generator'
import { downloadTemplate } from '@/lib/onboarding/template-generator'
import { getCourtAbbrev } from '@/lib/scourt/court-codes'

type Step = 'input' | 'mapping' | 'preview' | 'importing' | 'complete'

interface ParsedData {
  columns: string[]
  rows: Record<string, string>[]
  fileType: string
  format: string
  needsAIMapping: boolean
  autoMapping: Record<string, string>
}

interface ProgressInfo {
  phase: 'processing'
  current: number
  total: number
  currentCase: string
  status: string
}

export default function OnboardingImportPage() {
  const [step, setStep] = useState<Step>('input')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [parsedData, setParsedData] = useState<ParsedData | null>(null)
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({})
  const [fileName, setFileName] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [options, setOptions] = useState<ImportOptions>({
    duplicateHandling: 'skip',
    createNewClients: true,
    linkScourt: true,
    scourtDelayMs: 2500,
    dryRun: false
  })

  const [report, setReport] = useState<ImportReport | null>(null)
  const [progress, setProgress] = useState<ProgressInfo | null>(null)

  // 파일 처리
  const processFile = useCallback(async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!['csv', 'xlsx', 'xls'].includes(ext || '')) {
      setError('CSV 또는 Excel 파일만 업로드 가능합니다.')
      return
    }

    setFileName(file.name)
    setLoading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/admin/onboarding/parse', {
        method: 'POST',
        body: formData
      })

      const json = await response.json()
      if (!response.ok) {
        throw new Error(json.error || '파일 파싱 실패')
      }

      setParsedData(json.data)
      setColumnMapping(json.data.autoMapping || {})

      if (json.data.needsAIMapping) {
        setStep('mapping')
        await requestAIMapping(json.data.columns, json.data.rows)
      } else {
        setStep('preview')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '파일 처리 중 오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 파일 선택
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      processFile(file)
    }
    e.target.value = ''
  }, [processFile])

  // 드래그 앤 드롭
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    if (!loading) {
      setIsDragging(true)
    }
  }, [loading])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    if (loading) return

    const files = e.dataTransfer.files
    if (files.length > 0) {
      processFile(files[0])
    }
  }, [loading, processFile])

  // AI 매핑
  const requestAIMapping = useCallback(async (columns: string[], rows: Record<string, string>[]) => {
    try {
      const response = await fetch('/api/admin/onboarding/ai-map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ columns, sampleRows: rows.slice(0, 5) })
      })

      const json = await response.json()
      if (response.ok) {
        const newMapping: Record<string, string> = {}
        for (const m of json.data.mappings) {
          if (m.targetField) {
            newMapping[m.sourceColumn] = m.targetField
          }
        }
        setColumnMapping(newMapping)
      }
    } catch (err) {
      console.error('AI 매핑 실패:', err)
    }
  }, [])

  // 가져오기 실행 (SSE 스트리밍)
  const handleImport = useCallback(async () => {
    if (!parsedData) return

    setLoading(true)
    setError(null)
    setStep('importing')
    setProgress(null)

    try {
      const response = await fetch('/api/admin/onboarding/batch-create-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rows: parsedData.rows,
          columnMapping,
          options
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '가져오기 실패')
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('스트림을 읽을 수 없습니다')
      }

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // SSE 이벤트 파싱
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        let eventType = ''
        let eventData = ''

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7)
          } else if (line.startsWith('data: ')) {
            eventData = line.slice(6)
          } else if (line === '' && eventType && eventData) {
            // 이벤트 처리
            try {
              const data = JSON.parse(eventData)

              switch (eventType) {
                case 'phase':
                  setProgress(_prev => ({
                    phase: data.phase,
                    current: 0,
                    total: data.total,
                    currentCase: '',
                    status: ''
                  }))
                  break

                case 'progress':
                  setProgress({
                    phase: data.phase,
                    current: data.current,
                    total: data.total,
                    currentCase: data.caseName || '',
                    status: data.status
                  })
                  break

                case 'complete':
                  setReport({
                    summary: data.summary,
                    results: data.results,
                    missingInfoSummary: data.missingInfoSummary,
                    createdAt: data.createdAt,
                    importOptions: options
                  })
                  setStep('complete')
                  break

                case 'error':
                  throw new Error(data.message)
              }
            } catch (parseErr) {
              console.error('이벤트 파싱 오류:', parseErr)
            }

            eventType = ''
            eventData = ''
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '가져오기 중 오류가 발생했습니다')
      setStep('preview')
    } finally {
      setLoading(false)
    }
  }, [parsedData, columnMapping, options])

  // 처음으로
  const handleReset = useCallback(() => {
    setStep('input')
    setParsedData(null)
    setColumnMapping({})
    setFileName(null)
    setReport(null)
    setError(null)
    setProgress(null)
  }, [])

  // 미리보기 셀 값 포맷팅 (법원명은 약어로 표시)
  const formatPreviewValue = useCallback((col: string, value: string | undefined) => {
    if (!value) return '-'
    // 해당 컬럼이 court_name에 매핑되어 있으면 약어로 변환
    if (columnMapping[col] === 'court_name') {
      return getCourtAbbrev(value)
    }
    return value
  }, [columnMapping])

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader
        title="사건 일괄 등록"
        subtitle="CSV/Excel 파일로 여러 사건을 한 번에 등록합니다"
      />

      <main className="max-w-4xl mx-auto py-6 px-4">
        {/* 진행 단계 */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[
            { key: 'input', label: '파일 선택' },
            { key: 'mapping', label: '컬럼 매핑' },
            { key: 'preview', label: '미리보기' },
            { key: 'complete', label: '완료' }
          ].map((s, idx, arr) => {
            const steps: Step[] = ['input', 'mapping', 'preview', 'complete']
            const currentIdx = steps.indexOf(step === 'importing' ? 'preview' : step)
            const thisIdx = steps.indexOf(s.key as Step)
            const isActive = thisIdx <= currentIdx
            const isCurrent = s.key === step || (step === 'importing' && s.key === 'preview')

            return (
              <div key={s.key} className="flex items-center">
                <div className={`
                  flex items-center justify-center w-7 h-7 rounded-full text-xs font-medium
                  ${isCurrent ? 'bg-sage-600 text-white' : isActive ? 'bg-sage-100 text-sage-700' : 'bg-gray-200 text-gray-500'}
                `}>
                  {idx + 1}
                </div>
                <span className={`ml-1.5 text-sm ${isCurrent ? 'text-sage-700 font-medium' : 'text-gray-500'}`}>
                  {s.label}
                </span>
                {idx < arr.length - 1 && (
                  <div className={`w-12 h-0.5 mx-3 ${isActive ? 'bg-sage-300' : 'bg-gray-200'}`} />
                )}
              </div>
            )
          })}
        </div>

        {/* 에러 */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Step 1: 파일 선택 */}
        {step === 'input' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900">파일 업로드</h2>
                <button
                  onClick={downloadTemplate}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-sage-600 hover:bg-sage-50 rounded-lg border border-sage-200"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  템플릿
                </button>
              </div>

              <div
                onClick={() => !loading && fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`
                  flex flex-col items-center justify-center w-full h-48
                  border-2 border-dashed rounded-xl cursor-pointer transition-colors
                  ${isDragging ? 'border-sage-500 bg-sage-50' : loading ? 'border-sage-300 bg-sage-50' : 'border-gray-300 hover:border-sage-400 hover:bg-gray-50'}
                `}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileChange}
                  disabled={loading}
                  className="hidden"
                />
                {loading ? (
                  <div className="flex flex-col items-center">
                    <svg className="animate-spin h-8 w-8 text-sage-600" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span className="mt-2 text-sm text-sage-600">파일 분석 중...</span>
                  </div>
                ) : isDragging ? (
                  <div className="flex flex-col items-center">
                    <svg className="w-10 h-10 text-sage-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <span className="mt-2 text-sm font-medium text-sage-600">
                      여기에 파일을 놓으세요
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <span className="mt-2 text-sm font-medium text-gray-700">
                      클릭하여 파일 선택
                    </span>
                    <span className="mt-1 text-xs text-gray-500">
                      또는 파일을 드래그하여 놓으세요
                    </span>
                    <span className="mt-1 text-xs text-gray-400">
                      CSV, Excel (.xlsx, .xls) 지원
                    </span>
                  </div>
                )}
              </div>

              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-600">
                  <strong>필수 컬럼:</strong> 사건번호, 법원명, 의뢰인명
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  선택 컬럼: 상대방명, 의뢰인연락처, 담당변호사, 착수금, 생년월일, 계좌번호 등
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  * 사건유형은 사건번호로 자동 분류됩니다
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: 컬럼 매핑 */}
        {step === 'mapping' && parsedData && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">컬럼 매핑</h2>
              <p className="text-sm text-gray-500 mb-6">
                파일의 컬럼을 시스템 필드에 매핑해주세요
              </p>

              <div className="space-y-3">
                {parsedData.columns.map(col => (
                  <div key={col} className="flex items-center gap-3">
                    <div className="w-40 text-sm font-medium text-gray-700 truncate">{col}</div>
                    <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                    <select
                      value={columnMapping[col] || ''}
                      onChange={(e) => setColumnMapping(prev => ({ ...prev, [col]: e.target.value }))}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-sage-500 focus:border-sage-500"
                    >
                      <option value="">매핑 안함</option>
                      <optgroup label="필수">
                        <option value="court_case_number">사건번호</option>
                        <option value="court_name">법원명</option>
                        <option value="client_name">의뢰인명</option>
                      </optgroup>
                      <optgroup label="사건 정보">
                        <option value="case_name">사건명</option>
                        <option value="client_role">의뢰인역할</option>
                        <option value="opponent_name">상대방명</option>
                        <option value="assigned_lawyer">담당변호사</option>
                        <option value="assigned_staff">담당직원</option>
                        <option value="contract_date">계약일</option>
                      </optgroup>
                      <optgroup label="금액">
                        <option value="retainer_fee">착수금</option>
                        <option value="success_fee_agreement">성공보수약정</option>
                        <option value="earned_success_fee">발생성공보수</option>
                      </optgroup>
                      <optgroup label="의뢰인 정보">
                        <option value="client_phone">의뢰인연락처</option>
                        <option value="client_email">의뢰인이메일</option>
                        <option value="client_birth_date">생년월일</option>
                        <option value="client_address">주소</option>
                        <option value="client_bank_account">계좌번호</option>
                      </optgroup>
                      <optgroup label="기타">
                        <option value="notes">메모</option>
                      </optgroup>
                    </select>
                  </div>
                ))}
              </div>

              <div className="flex justify-between mt-6 pt-4 border-t">
                <button onClick={handleReset} className="text-sm text-gray-500 hover:text-gray-700">
                  취소
                </button>
                <button
                  onClick={() => setStep('preview')}
                  className="px-5 py-2 bg-sage-600 text-white rounded-lg text-sm font-medium hover:bg-sage-700"
                >
                  다음
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: 미리보기 */}
        {step === 'preview' && parsedData && (
          <div className="space-y-4">
            {/* 요약 카드 */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {fileName || '업로드된 파일'}
                  </h2>
                  <p className="text-sm text-gray-500 mt-0.5">
                    총 {parsedData.rows.length}건의 사건
                  </p>
                </div>
                <div className="flex items-center gap-6 text-sm">
                  <div className="text-center">
                    <div className="text-xl font-bold text-sage-600">{parsedData.rows.length}</div>
                    <div className="text-gray-500">전체</div>
                  </div>
                </div>
              </div>
            </div>

            {/* 데이터 미리보기 */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto max-h-72">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">#</th>
                      {parsedData.columns.slice(0, 5).map(col => (
                        <th key={col} className="px-3 py-2 text-left text-xs font-medium text-gray-500 truncate max-w-[150px]">
                          {columnMapping[col] || col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {parsedData.rows.slice(0, 10).map((row, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-400">{idx + 1}</td>
                        {parsedData.columns.slice(0, 5).map(col => (
                          <td key={col} className="px-3 py-2 text-gray-900 truncate max-w-[150px]">
                            {formatPreviewValue(col, row[col])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsedData.rows.length > 10 && (
                <div className="px-4 py-2 bg-gray-50 text-xs text-gray-500 text-center border-t">
                  외 {parsedData.rows.length - 10}건 더 있음
                </div>
              )}
            </div>

            {/* 옵션 */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">옵션</h3>
              <div>
                <label className="block text-sm text-gray-600 mb-1">중복 사건 처리</label>
                <select
                  value={options.duplicateHandling}
                  onChange={(e) => setOptions(prev => ({ ...prev, duplicateHandling: e.target.value as ImportOptions['duplicateHandling'] }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="skip">건너뛰기</option>
                  <option value="update">업데이트</option>
                  <option value="error">오류 표시</option>
                </select>
              </div>
              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <p className="text-xs text-blue-700">
                  <strong>대법원 자동 연결:</strong> 대법원에서 사건을 찾으면 자동연동됩니다.
                </p>
              </div>
              <p className="mt-3 text-xs text-gray-500">
                * 의뢰인 연락처가 있으면 신규 의뢰인이 자동 생성됩니다
              </p>
            </div>

            {/* 버튼 */}
            <div className="flex justify-between">
              <button
                onClick={() => parsedData.needsAIMapping ? setStep('mapping') : handleReset()}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                이전
              </button>
              <button
                onClick={handleImport}
                disabled={loading}
                className="px-6 py-2.5 bg-sage-600 text-white rounded-lg font-medium hover:bg-sage-700 disabled:opacity-50"
              >
                {parsedData.rows.length}건 등록하기
              </button>
            </div>
          </div>
        )}

        {/* Step 4: 가져오기 중 */}
        {step === 'importing' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <div className="text-center mb-6">
              <svg className="animate-spin h-10 w-10 mx-auto text-sage-600" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <h2 className="text-lg font-semibold text-gray-900 mt-4">
                사건 등록 중...
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                대법원 연동 → 사건 생성 → 데이터 동기화
              </p>
            </div>

            {progress && (
              <div className="space-y-4">
                {/* 진행률 바 */}
                <div className="relative pt-1">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-sage-700">진행 상황</span>
                    <span className="text-sm font-medium text-sage-700">
                      {progress.current} / {progress.total}
                    </span>
                  </div>
                  <div className="overflow-hidden h-3 rounded-full bg-sage-100">
                    <div
                      style={{ width: `${(progress.current / progress.total) * 100}%` }}
                      className="h-full rounded-full bg-sage-500 transition-all duration-300"
                    />
                  </div>
                </div>

                {/* 현재 처리 중인 사건 */}
                {progress.currentCase && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">현재:</span>
                    <span className="text-gray-700 font-medium truncate max-w-[300px]">
                      {progress.currentCase}
                    </span>
                    {/* 실패한 경우에만 상태 표시 */}
                    {progress.status === 'failed' && (
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
                        실패
                      </span>
                    )}
                  </div>
                )}

                {/* 진행 시간 및 예상 소요 시간 */}
                <div className="flex items-center justify-between text-xs text-gray-500 mt-3">
                  <span>
                    경과: {Math.floor((progress.current * 2.5) / 60)}분 {Math.round((progress.current * 2.5) % 60)}초
                  </span>
                  <span>
                    예상 남은 시간: {Math.floor(((progress.total - progress.current) * 2.5) / 60)}분 {Math.round(((progress.total - progress.current) * 2.5) % 60)}초
                  </span>
                </div>

                <p className="text-xs text-gray-500 text-center mt-4">
                  대법원 나의사건 연동은 건당 약 2.5초가 소요됩니다
                </p>
              </div>
            )}
          </div>
        )}

        {/* Step 5: 완료 */}
        {step === 'complete' && report && (
          <div className="space-y-4">
            {/* 성공 메시지 */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
              <div className="w-14 h-14 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-900 mt-3">등록 완료</h2>
              <p className="text-sm text-gray-500 mt-1">
                {report.summary.success + (report.summary.partial || 0)}건 성공 / {report.summary.total}건 중
              </p>
            </div>

            {/* 결과 요약 */}
            <div className="grid grid-cols-4 gap-3">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-center">
                <div className="text-2xl font-bold text-green-600">
                  {report.summary.success + (report.summary.partial || 0)}
                </div>
                <div className="text-xs text-gray-500">성공</div>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-center">
                <div className="text-2xl font-bold text-red-600">{report.summary.failed}</div>
                <div className="text-xs text-gray-500">실패</div>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-center">
                <div className="text-2xl font-bold text-yellow-600">{report.summary.skipped}</div>
                <div className="text-xs text-gray-500">건너뜀</div>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-center">
                <div className="text-2xl font-bold text-blue-600">{report.summary.newClientsCreated}</div>
                <div className="text-xs text-gray-500">신규 의뢰인</div>
              </div>
            </div>

            {/* SCOURT 결과 */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">대법원 연동</h3>
              <div className="flex gap-6 text-sm">
                <div>
                  <span className="text-gray-500">연동 성공:</span>
                  <span className="ml-2 font-medium text-green-600">{report.summary.scourtLinked}건</span>
                </div>
                {report.summary.scourtFailed > 0 && (
                  <div>
                    <span className="text-gray-500">연동 안됨:</span>
                    <span className="ml-2 font-medium text-orange-600">{report.summary.scourtFailed}건</span>
                  </div>
                )}
              </div>

              {/* 연동 안된 사건 목록 */}
              {report.summary.scourtFailed > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs text-gray-500 mb-2">연동되지 않은 사건:</p>
                  <div className="max-h-32 overflow-y-auto">
                    <ul className="text-xs text-gray-600 space-y-1">
                      {report.results
                        .filter(r => !r.scourtLinked && (r.status === 'success' || r.status === 'partial'))
                        .slice(0, 20)
                        .map((r, idx) => (
                          <li key={idx} className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-orange-400 rounded-full flex-shrink-0" />
                            <span>{r.created?.caseName || r.originalData?.court_case_number || `행 ${r.rowIndex + 1}`}</span>
                          </li>
                        ))}
                      {report.results.filter(r => !r.scourtLinked && (r.status === 'success' || r.status === 'partial')).length > 20 && (
                        <li className="text-gray-400">외 {report.results.filter(r => !r.scourtLinked && (r.status === 'success' || r.status === 'partial')).length - 20}건</li>
                      )}
                    </ul>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    * 사건 상세 페이지에서 수동으로 대법원 연동할 수 있습니다.
                  </p>
                </div>
              )}
            </div>

            {/* 버튼 */}
            <div className="flex justify-between items-center pt-2">
              <button onClick={handleReset} className="text-sm text-gray-500 hover:text-gray-700">
                새로 등록하기
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => downloadReport(report, 'xlsx')}
                  className="px-4 py-2 bg-sage-600 text-white rounded-lg text-sm font-medium hover:bg-sage-700"
                >
                  결과 다운로드
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
