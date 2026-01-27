'use client'

import { useState, useEffect } from 'react'
import { FileText, ClipboardList, Paperclip, Scale, FolderOpen, File, Image, FileSpreadsheet, type LucideIcon } from 'lucide-react'
import type { GroupedFiles, ClientFile, ClientDocType } from '@/types/case-files'

interface CaseDocumentsProps {
  caseId: string
}

// 문서 유형별 정보
const DOCUMENT_CATEGORIES: Array<{
  key: ClientDocType
  label: string
  icon: LucideIcon
  description: string
}> = [
  { key: 'brief_client', label: '의뢰인 서류', icon: FileText, description: '준비서면, 답변서 등' },
  { key: 'brief_defendant', label: '상대방 서류', icon: ClipboardList, description: '피고측 제출 서류' },
  { key: 'evidence', label: '증거 서류', icon: Paperclip, description: '갑호증, 을호증' },
  { key: 'judgment', label: '판결문', icon: Scale, description: '판결문, 결정문' },
  { key: 'third_party', label: '참고 서류', icon: FolderOpen, description: '제3자 제출 서류' },
]

// 파일 크기 포맷팅
function formatFileSize(bytes: number | null): string {
  if (bytes === null || bytes === 0) return '-'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

// 파일 확장자로 아이콘 결정
function getFileIcon(mimeType: string): LucideIcon {
  if (mimeType === 'application/pdf') return FileText
  if (mimeType.startsWith('image/')) return Image
  if (mimeType.includes('word') || mimeType.includes('document')) return FileText
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return FileSpreadsheet
  return File
}

export default function CaseDocuments({ caseId }: CaseDocumentsProps) {
  const [files, setFiles] = useState<GroupedFiles | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<ClientFile | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [_previewType, setPreviewType] = useState<'pdf' | 'image' | 'unsupported'>('unsupported')
  const [expandedCategories, setExpandedCategories] = useState<Set<ClientDocType>>(new Set())

  // 카테고리 토글
  function toggleCategory(key: ClientDocType) {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  // 파일 목록 조회
  useEffect(() => {
    async function fetchFiles() {
      try {
        setLoading(true)
        const response = await fetch(`/api/client/cases/${caseId}/files`)

        if (!response.ok) {
          throw new Error('파일 목록을 불러오는데 실패했습니다.')
        }

        const data = await response.json()
        setFiles(data.files)
      } catch (err) {
        setError(err instanceof Error ? err.message : '오류가 발생했습니다.')
      } finally {
        setLoading(false)
      }
    }

    fetchFiles()
  }, [caseId])

  // 파일 미리보기
  async function handlePreview(file: ClientFile) {
    if (file.isLargeFile) {
      alert('고용량 파일은 미리보기를 지원하지 않습니다.')
      return
    }

    // PDF는 새 탭에서 열기 (브라우저 내장 PDF 뷰어 사용)
    if (file.mimeType === 'application/pdf') {
      window.open(`/api/client/files/${file.id}?action=view`, '_blank')
      return
    }

    // 이미지는 모달에서 보기
    if (file.mimeType.startsWith('image/')) {
      setSelectedFile(file)
      setPreviewType('image')
      setPreviewUrl(`/api/client/files/${file.id}?action=view`)
      setPreviewLoading(false)
      return
    }

    // 그 외는 다운로드
    handleDownload(file)
  }

  // 파일 다운로드
  function handleDownload(file: ClientFile) {
    if (file.isLargeFile) {
      alert('고용량 파일은 다운로드할 수 없습니다.')
      return
    }

    window.open(`/api/client/files/${file.id}?action=download`, '_blank')
  }

  // 모달 닫기
  function closePreview() {
    setSelectedFile(null)
    setPreviewUrl(null)
    setPreviewType('unsupported')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--sage-primary)]"></div>
        <span className="ml-3 text-[var(--sage-primary)]">파일 목록을 불러오는 중...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-[var(--color-danger-muted)] border border-[var(--color-danger)]/20 rounded-lg p-4 text-[var(--color-danger)]">
        {error}
      </div>
    )
  }

  if (!files) {
    return null
  }

  // 전체 파일 수 계산
  const totalFiles = Object.values(files).reduce((sum, arr) => sum + arr.length, 0)

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">소송 서류</h3>
        <span className="text-sm text-[var(--text-secondary)]">{totalFiles}개 파일</span>
      </div>

      {/* 파일이 없는 경우 */}
      {totalFiles === 0 && (
        <div className="text-center py-12 text-[var(--text-secondary)]">
          <FolderOpen className="w-12 h-12 mx-auto mb-4 text-[var(--text-muted)]" />
          <p>아직 공개된 서류가 없습니다.</p>
        </div>
      )}

      {/* 문서 카테고리별 목록 (아코디언) */}
      <div className="space-y-2">
        {DOCUMENT_CATEGORIES.map(category => {
          const categoryFiles = files[category.key] || []
          if (categoryFiles.length === 0) return null

          const isExpanded = expandedCategories.has(category.key)

          return (
            <div key={category.key} className="border border-[var(--border-default)] rounded-xl overflow-hidden">
              {/* 카테고리 헤더 (클릭 가능) */}
              <button
                onClick={() => toggleCategory(category.key)}
                className="w-full flex items-center justify-between px-4 py-3 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <category.icon className="w-5 h-5 text-[var(--text-secondary)]" />
                  <span className="font-medium text-[var(--text-primary)]">{category.label}</span>
                  <span className="text-sm text-[var(--text-tertiary)] bg-[var(--bg-secondary)] px-2 py-0.5 rounded-full">
                    {categoryFiles.length}
                  </span>
                </div>
                <svg
                  className={`w-5 h-5 text-[var(--text-tertiary)] transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* 파일 목록 (펼쳐졌을 때만 표시) */}
              {isExpanded && (
                <div className="divide-y divide-[var(--border-subtle)] bg-[var(--bg-secondary)]">
                  {categoryFiles.map(file => (
                    <div
                      key={file.id}
                      className="px-4 py-3 flex items-center justify-between hover:bg-[var(--bg-hover)] transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {(() => {
                          const FileIcon = getFileIcon(file.mimeType)
                          return <FileIcon className="w-5 h-5 flex-shrink-0 text-[var(--text-secondary)]" />
                        })()}
                        <div className="min-w-0">
                          <p className="text-[var(--text-primary)] text-sm font-medium truncate">
                            {file.fileName}
                            {file.isLargeFile && (
                              <span className="ml-2 text-xs bg-[var(--color-danger-muted)] text-[var(--color-danger)] px-1.5 py-0.5 rounded">
                                고용량
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-[var(--text-tertiary)]">
                            {formatFileSize(file.fileSize)}
                          </p>
                        </div>
                      </div>

                      {/* 액션 버튼 */}
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {!file.isLargeFile && (
                          <>
                            <button
                              onClick={() => handlePreview(file)}
                              className="btn btn-sm btn-ghost"
                            >
                              보기
                            </button>
                            <button
                              onClick={() => handleDownload(file)}
                              className="btn btn-sm btn-primary"
                            >
                              저장
                            </button>
                          </>
                        )}
                        {file.isLargeFile && (
                          <span className="text-xs text-[var(--text-muted)]">용량 초과</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* 미리보기 모달 */}
      {selectedFile && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-secondary)] rounded-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-default)]">
              <h3 className="font-semibold text-[var(--text-primary)] truncate pr-4">
                {selectedFile.fileName}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownload(selectedFile)}
                  className="btn btn-primary"
                >
                  다운로드
                </button>
                <button
                  onClick={closePreview}
                  className="p-2 hover:bg-[var(--bg-hover)] rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5 text-[var(--text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* 이미지 미리보기 콘텐츠 */}
            <div className="flex-1 overflow-auto p-4">
              {previewLoading ? (
                <div className="flex items-center justify-center h-96">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--sage-primary)]"></div>
                  <span className="ml-3 text-[var(--sage-primary)]">로딩 중...</span>
                </div>
              ) : previewUrl ? (
                <div className="flex items-center justify-center">
                  <img
                    src={previewUrl}
                    alt={selectedFile.fileName}
                    className="max-w-full max-h-[70vh] object-contain rounded-lg"
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-96 text-[var(--text-secondary)]">
                  <span className="text-6xl mb-4">📄</span>
                  <p className="mb-2">이미지를 불러올 수 없습니다.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
