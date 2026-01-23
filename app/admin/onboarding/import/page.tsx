'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import Link from 'next/link'
import type { ImportOptions, ImportReport } from '@/types/onboarding'
import { downloadReport } from '@/lib/onboarding/import-report-generator'
import { downloadTemplate } from '@/lib/onboarding/template-generator'
import { getCourtAbbrev } from '@/lib/scourt/court-codes'

type Step = 'input' | 'mapping' | 'preview' | 'importing' | 'complete'

interface TenantMember {
  id: string
  display_name: string
  role: string
}

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
  const [teamMembers, setTeamMembers] = useState<TenantMember[]>([])
  const [importStartTime, setImportStartTime] = useState<number | null>(null)

  // 팀 멤버 목록 조회
  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const res = await fetch('/api/admin/tenant/members')
        const data = await res.json()
        if (data.success && data.data.members) {
          setTeamMembers(data.data.members as TenantMember[])
        }
      } catch (err) {
        console.error('팀 멤버 조회 실패:', err)
      }
    }
    fetchMembers()
  }, [])

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
    setImportStartTime(Date.now())

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

      // 이벤트 처리 함수
      const handleEvent = (eventType: string, eventData: string) => {
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
          console.error('이벤트 파싱 오류:', parseErr, { eventType, eventData })
        }
      }

      // SSE 이벤트 처리 함수 (이벤트 블록 단위로 파싱)
      const processBuffer = (text: string, isFinal: boolean = false) => {
        buffer += text

        // SSE 이벤트는 두 개의 줄바꿈(\n\n)으로 구분됨
        const eventBlocks = buffer.split('\n\n')

        // 마지막 항목이 불완전할 수 있으므로 보존 (isFinal이 아닌 경우)
        if (!isFinal) {
          buffer = eventBlocks.pop() || ''
        } else {
          buffer = ''
        }

        for (const eventBlock of eventBlocks) {
          if (!eventBlock.trim()) continue

          const lines = eventBlock.split('\n')
          let eventType = ''
          let eventData = ''

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              eventType = line.slice(7)
            } else if (line.startsWith('data: ')) {
              eventData = line.slice(6)
            }
          }

          if (eventType && eventData) {
            handleEvent(eventType, eventData)
          }
        }
      }

      while (true) {
        const { done, value } = await reader.read()

        if (done) {
          // 스트림 종료 시 남은 버퍼 처리 (complete 이벤트 포함)
          processBuffer(decoder.decode(), true)
          break
        }

        processBuffer(decoder.decode(value, { stream: true }))
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
    setImportStartTime(null)
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
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <main className="max-w-4xl mx-auto py-6 px-4">
        {/* 탭 네비게이션 */}
        <div className="flex items-center gap-3 mb-5 text-sm overflow-x-auto">
          <div className="flex bg-[var(--bg-tertiary)] rounded-lg p-0.5">
            <Link
              href="/admin/settings/profile"
              className="px-3 py-1.5 rounded-md transition-colors text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
            >
              내 정보
            </Link>
            <Link
              href="/admin/settings"
              className="px-3 py-1.5 rounded-md transition-colors text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
            >
              상담 시간
            </Link>
            <Link
              href="/admin/settings/sources"
              className="px-3 py-1.5 rounded-md transition-colors text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
            >
              유입 경로
            </Link>
            <Link
              href="/admin/settings/team"
              className="px-3 py-1.5 rounded-md transition-colors text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
            >
              팀원 관리
            </Link>
            <Link
              href="/admin/settings/alerts"
              className="px-3 py-1.5 rounded-md transition-colors text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
            >
              알림
            </Link>
            <Link
              href="/admin/settings/integrations"
              className="px-3 py-1.5 rounded-md transition-colors text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
            >
              연동
            </Link>
            <Link
              href="/admin/settings/tenant"
              className="px-3 py-1.5 rounded-md transition-colors text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
            >
              사무소
            </Link>
            <span className="px-3 py-1.5 rounded-md bg-[var(--bg-secondary)] shadow-sm font-medium text-[var(--text-primary)]">
              데이터 가져오기
            </span>
          </div>
        </div>

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
                  ${isCurrent ? 'bg-[var(--sage-primary)] text-white' : isActive ? 'bg-[var(--sage-muted)] text-[var(--sage-primary)]' : 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]'}
                `}>
                  {idx + 1}
                </div>
                <span className={`ml-1.5 text-sm ${isCurrent ? 'text-[var(--sage-primary)] font-medium' : 'text-[var(--text-tertiary)]'}`}>
                  {s.label}
                </span>
                {idx < arr.length - 1 && (
                  <div className={`w-12 h-0.5 mx-3 ${isActive ? 'bg-[var(--sage-primary)]/30' : 'bg-[var(--bg-tertiary)]'}`} />
                )}
              </div>
            )
          })}
        </div>

        {/* 에러 */}
        {error && (
          <div className="mb-4 p-3 bg-[var(--color-danger-muted)] border border-[var(--color-danger)]/20 rounded-lg text-sm text-[var(--color-danger)]">
            {error}
          </div>
        )}

        {/* Step 1: 파일 선택 */}
        {step === 'input' && (
          <div className="card">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">파일 업로드</h2>
                <button
                  onClick={downloadTemplate}
                  className="btn btn-secondary flex items-center gap-1.5 px-3 py-1.5 text-sm"
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
                  ${isDragging ? 'border-[var(--sage-primary)] bg-[var(--sage-muted)]' : loading ? 'border-[var(--sage-primary)]/30 bg-[var(--sage-muted)]' : 'border-[var(--border-default)] hover:border-[var(--sage-primary)] hover:bg-[var(--bg-hover)]'}
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
                    <svg className="animate-spin h-8 w-8 text-[var(--sage-primary)]" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span className="mt-2 text-sm text-[var(--sage-primary)]">파일 분석 중...</span>
                  </div>
                ) : isDragging ? (
                  <div className="flex flex-col items-center">
                    <svg className="w-10 h-10 text-[var(--sage-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <span className="mt-2 text-sm font-medium text-[var(--sage-primary)]">
                      여기에 파일을 놓으세요
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <svg className="w-10 h-10 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <span className="mt-2 text-sm font-medium text-[var(--text-secondary)]">
                      클릭하여 파일 선택
                    </span>
                    <span className="mt-1 text-xs text-[var(--text-tertiary)]">
                      또는 파일을 드래그하여 놓으세요
                    </span>
                    <span className="mt-1 text-xs text-[var(--text-muted)]">
                      CSV, Excel (.xlsx, .xls) 지원
                    </span>
                  </div>
                )}
              </div>

              {/* 컬럼 안내 통합 */}
              <div className="mt-4 p-4 bg-[var(--bg-primary)] rounded-lg border border-[var(--border-subtle)]">
                <div className="space-y-3">
                  {/* 필수 컬럼 */}
                  <div className="flex items-start gap-2">
                    <span className="text-xs font-medium text-[var(--color-danger)] whitespace-nowrap mt-0.5">필수</span>
                    <div className="flex flex-wrap gap-1.5">
                      {['사건번호', '법원명', '의뢰인명'].map(col => (
                        <span key={col} className="text-xs px-2 py-0.5 bg-[var(--color-danger-muted)] text-[var(--color-danger)] rounded">
                          {col}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* 담당자 안내 */}
                  {teamMembers.length > 0 && (
                    <div className="flex items-start gap-2 pt-2 border-t border-[var(--border-subtle)]">
                      <span className="text-xs font-medium text-[var(--sage-primary)] whitespace-nowrap mt-0.5">담당자</span>
                      <div>
                        <div className="flex flex-wrap gap-1.5">
                          {teamMembers.map(member => (
                            <span
                              key={member.id}
                              className="text-xs px-2 py-0.5 bg-[var(--sage-muted)] text-[var(--sage-primary)] rounded cursor-pointer hover:bg-[var(--sage-primary)] hover:text-white transition-colors"
                              title="클릭하여 복사"
                              onClick={() => {
                                navigator.clipboard.writeText(member.display_name)
                              }}
                            >
                              {member.display_name}
                            </span>
                          ))}
                        </div>
                        <p className="text-xs text-[var(--text-muted)] mt-1.5">
                          클릭하여 복사 · 담당변호사/담당직원 컬럼에 입력
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <p className="text-xs text-[var(--text-muted)] mt-3 pt-2 border-t border-[var(--border-subtle)]">
                  * 사건유형은 사건번호로 자동 분류됩니다
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: 컬럼 매핑 */}
        {step === 'mapping' && parsedData && (
          <div className="card">
            <div className="p-6">
              <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">컬럼 매핑</h2>
              <p className="text-sm text-[var(--text-tertiary)] mb-6">
                파일의 컬럼을 시스템 필드에 매핑해주세요
              </p>

              <div className="space-y-3">
                {parsedData.columns.map(col => (
                  <div key={col} className="flex items-center gap-3">
                    <div className="w-40 text-sm font-medium text-[var(--text-secondary)] truncate">{col}</div>
                    <svg className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                    <select
                      value={columnMapping[col] || ''}
                      onChange={(e) => setColumnMapping(prev => ({ ...prev, [col]: e.target.value }))}
                      className="form-input flex-1"
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
                        <option value="client_type">의뢰인유형</option>
                        <option value="client_resident_number">주민등록번호</option>
                        <option value="client_company_name">회사명</option>
                        <option value="client_registration_number">사업자등록번호</option>
                      </optgroup>
                      <optgroup label="기타">
                        <option value="notes">메모</option>
                      </optgroup>
                    </select>
                  </div>
                ))}
              </div>

              <div className="flex justify-between mt-6 pt-4 border-t border-[var(--border-subtle)]">
                <button onClick={handleReset} className="text-sm text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]">
                  취소
                </button>
                <button
                  onClick={() => setStep('preview')}
                  className="btn btn-primary"
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
            <div className="card p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                    {fileName || '업로드된 파일'}
                  </h2>
                  <p className="text-sm text-[var(--text-tertiary)] mt-0.5">
                    총 {parsedData.rows.length}건의 사건
                  </p>
                </div>
                <div className="flex items-center gap-6 text-sm">
                  <div className="text-center">
                    <div className="text-xl font-bold text-[var(--sage-primary)]">{parsedData.rows.length}</div>
                    <div className="text-[var(--text-tertiary)]">전체</div>
                  </div>
                </div>
              </div>
            </div>

            {/* 데이터 미리보기 */}
            <div className="card overflow-hidden">
              <div className="overflow-x-auto max-h-72">
                <table className="min-w-full divide-y divide-[var(--border-default)] text-sm">
                  <thead className="bg-[var(--bg-primary)] sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-[var(--text-tertiary)]">#</th>
                      {parsedData.columns.slice(0, 5).map(col => (
                        <th key={col} className="px-3 py-2 text-left text-xs font-medium text-[var(--text-tertiary)] truncate max-w-[150px]">
                          {columnMapping[col] || col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {parsedData.rows.slice(0, 10).map((row, idx) => (
                      <tr key={idx} className="hover:bg-[var(--bg-hover)]">
                        <td className="px-3 py-2 text-[var(--text-muted)]">{idx + 1}</td>
                        {parsedData.columns.slice(0, 5).map(col => (
                          <td key={col} className="px-3 py-2 text-[var(--text-primary)] truncate max-w-[150px]">
                            {formatPreviewValue(col, row[col])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsedData.rows.length > 10 && (
                <div className="px-4 py-2 bg-[var(--bg-primary)] text-xs text-[var(--text-tertiary)] text-center border-t border-[var(--border-subtle)]">
                  외 {parsedData.rows.length - 10}건 더 있음
                </div>
              )}
            </div>

            {/* 옵션 */}
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">옵션</h3>
              <div>
                <label className="form-label">중복 사건 처리</label>
                <select
                  value={options.duplicateHandling}
                  onChange={(e) => setOptions(prev => ({ ...prev, duplicateHandling: e.target.value as ImportOptions['duplicateHandling'] }))}
                  className="form-input w-full"
                >
                  <option value="skip">건너뛰기</option>
                  <option value="update">업데이트</option>
                  <option value="error">오류 표시</option>
                </select>
              </div>
              <div className="mt-4 p-3 bg-[var(--color-info-muted)] rounded-lg">
                <p className="text-xs text-[var(--color-info)]">
                  <strong>대법원 자동 연결:</strong> 대법원에서 사건을 찾으면 자동연동됩니다.
                </p>
              </div>
              <p className="mt-3 text-xs text-[var(--text-tertiary)]">
                * 의뢰인 연락처가 있으면 신규 의뢰인이 자동 생성됩니다
              </p>
            </div>

            {/* 버튼 */}
            <div className="flex justify-between">
              <button
                onClick={() => parsedData.needsAIMapping ? setStep('mapping') : handleReset()}
                className="text-sm text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
              >
                이전
              </button>
              <button
                onClick={handleImport}
                disabled={loading}
                className="btn btn-primary"
              >
                {parsedData.rows.length}건 등록하기
              </button>
            </div>
          </div>
        )}

        {/* Step 4: 가져오기 중 */}
        {step === 'importing' && (
          <div className="card p-8">
            <div className="text-center mb-6">
              <svg className="animate-spin h-10 w-10 mx-auto text-[var(--sage-primary)]" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <h2 className="text-lg font-semibold text-[var(--text-primary)] mt-4">
                사건 등록 중...
              </h2>
              <p className="text-sm text-[var(--text-tertiary)] mt-1">
                대법원 연동 → 사건 생성 → 데이터 동기화
              </p>
            </div>

            {progress && (
              <div className="space-y-4">
                {/* 진행률 바 */}
                <div className="relative pt-1">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-[var(--sage-primary)]">진행 상황</span>
                    <span className="text-sm font-medium text-[var(--sage-primary)]">
                      {progress.current} / {progress.total}
                    </span>
                  </div>
                  <div className="overflow-hidden h-3 rounded-full bg-[var(--sage-muted)]">
                    <div
                      style={{ width: `${(progress.current / progress.total) * 100}%` }}
                      className="h-full rounded-full bg-[var(--sage-primary)] transition-all duration-300"
                    />
                  </div>
                </div>

                {/* 현재 처리 중인 사건 */}
                {progress.currentCase && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[var(--text-tertiary)]">현재:</span>
                    <span className="text-[var(--text-secondary)] font-medium truncate max-w-[300px]">
                      {progress.currentCase}
                    </span>
                    {/* 실패한 경우에만 상태 표시 */}
                    {progress.status === 'failed' && (
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-[var(--color-danger-muted)] text-[var(--color-danger)]">
                        실패
                      </span>
                    )}
                  </div>
                )}

                {/* 진행 시간 및 예상 소요 시간 */}
                {(() => {
                  const elapsedSec = importStartTime ? Math.floor((Date.now() - importStartTime) / 1000) : 0
                  // 최소 5건 이상 처리 후 평균 계산, 그 전에는 기본값 1.5초 사용
                  const avgSecPerItem = progress.current >= 5 ? elapsedSec / progress.current : 1.5
                  const remainingSec = Math.round((progress.total - progress.current) * avgSecPerItem)
                  return (
                    <div className="flex items-center justify-between text-xs text-[var(--text-tertiary)] mt-3">
                      <span>
                        경과: {Math.floor(elapsedSec / 60)}분 {elapsedSec % 60}초
                      </span>
                      <span>
                        예상 남은 시간: {Math.floor(remainingSec / 60)}분 {remainingSec % 60}초
                      </span>
                    </div>
                  )
                })()}

                <p className="text-xs text-[var(--text-tertiary)] text-center mt-4">
                  대법원 나의사건 연동은 건당 약 1.5초가 소요됩니다
                </p>
              </div>
            )}
          </div>
        )}

        {/* Step 5: 완료 */}
        {step === 'complete' && report && (
          <div className="space-y-4">
            {/* 성공 메시지 */}
            <div className="card p-6 text-center">
              <div className="w-14 h-14 mx-auto bg-[var(--color-success-muted)] rounded-full flex items-center justify-center">
                <svg className="w-7 h-7 text-[var(--color-success)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-[var(--text-primary)] mt-3">등록 완료</h2>
              <p className="text-sm text-[var(--text-tertiary)] mt-1">
                {report.summary.success + (report.summary.partial || 0)}건 성공 / {report.summary.total}건 중
              </p>
            </div>

            {/* 결과 요약 */}
            <div className="grid grid-cols-4 gap-3">
              <div className="card p-4 text-center">
                <div className="text-2xl font-bold text-[var(--color-success)]">
                  {report.summary.success + (report.summary.partial || 0)}
                </div>
                <div className="text-xs text-[var(--text-tertiary)]">성공</div>
              </div>
              <div className="card p-4 text-center">
                <div className="text-2xl font-bold text-[var(--color-danger)]">{report.summary.failed}</div>
                <div className="text-xs text-[var(--text-tertiary)]">실패</div>
              </div>
              <div className="card p-4 text-center">
                <div className="text-2xl font-bold text-[var(--color-warning)]">{report.summary.skipped}</div>
                <div className="text-xs text-[var(--text-tertiary)]">건너뜀</div>
              </div>
              <div className="card p-4 text-center">
                <div className="text-2xl font-bold text-[var(--color-info)]">{report.summary.newClientsCreated}</div>
                <div className="text-xs text-[var(--text-tertiary)]">신규 의뢰인</div>
              </div>
            </div>

            {/* SCOURT 결과 */}
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">대법원 연동</h3>
              <div className="flex gap-6 text-sm">
                <div>
                  <span className="text-[var(--text-tertiary)]">연동 성공:</span>
                  <span className="ml-2 font-medium text-[var(--color-success)]">{report.summary.scourtLinked}건</span>
                </div>
                {report.summary.scourtFailed > 0 && (
                  <div>
                    <span className="text-[var(--text-tertiary)]">연동 안됨:</span>
                    <span className="ml-2 font-medium text-[var(--color-warning)]">{report.summary.scourtFailed}건</span>
                  </div>
                )}
              </div>

              {/* 연동 안된 사건 목록 */}
              {report.summary.scourtFailed > 0 && (
                <div className="mt-4 pt-4 border-t border-[var(--border-subtle)]">
                  <p className="text-xs text-[var(--text-tertiary)] mb-2">연동되지 않은 사건:</p>
                  <div className="max-h-32 overflow-y-auto">
                    <ul className="text-xs text-[var(--text-secondary)] space-y-1">
                      {report.results
                        .filter(r => !r.scourtLinked && (r.status === 'success' || r.status === 'partial'))
                        .slice(0, 20)
                        .map((r, idx) => (
                          <li key={idx} className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-[var(--color-warning)] rounded-full flex-shrink-0" />
                            <span>{r.created?.caseName || r.originalData?.court_case_number || `행 ${r.rowIndex + 1}`}</span>
                          </li>
                        ))}
                      {report.results.filter(r => !r.scourtLinked && (r.status === 'success' || r.status === 'partial')).length > 20 && (
                        <li className="text-[var(--text-muted)]">외 {report.results.filter(r => !r.scourtLinked && (r.status === 'success' || r.status === 'partial')).length - 20}건</li>
                      )}
                    </ul>
                  </div>
                  <p className="text-xs text-[var(--text-muted)] mt-2">
                    * 사건 상세 페이지에서 수동으로 대법원 연동할 수 있습니다.
                  </p>
                </div>
              )}
            </div>

            {/* 버튼 */}
            <div className="flex justify-between items-center pt-2">
              <button onClick={handleReset} className="text-sm text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]">
                새로 등록하기
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => downloadReport(report, 'xlsx')}
                  className="btn btn-primary"
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
