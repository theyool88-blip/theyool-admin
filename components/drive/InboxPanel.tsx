'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  FileText,
  CheckCircle2,
  XCircle,
  ChevronDown,
  Loader2,
  Sparkles,
  FolderOpen,
  AlertCircle,
  RefreshCw,
  Inbox as InboxIcon,
} from 'lucide-react'
import type { R2File } from '@/types/r2'
import EmptyState from '@/components/ui/EmptyState'

// ============================================================================
// Types
// ============================================================================

interface InboxPanelProps {
  tenantId: string
  caseId?: string
  onFileClassified?: (file: R2File) => void
}

interface ClassificationSuggestion {
  fileId: string
  targetFolderId: string
  targetFolderPath: string
  confidence: 'high' | 'medium' | 'low'
  reason: string
}

interface InboxFile extends R2File {
  suggestion?: ClassificationSuggestion
  isClassifying?: boolean
}

type ConfidenceLevel = 'high' | 'medium' | 'low'

// ============================================================================
// Component
// ============================================================================

export default function InboxPanel({ tenantId, caseId, onFileClassified }: InboxPanelProps) {
  const [files, setFiles] = useState<InboxFile[]>([])
  const [folders, setFolders] = useState<{ id: string; name: string; path: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [classifyingAll, setClassifyingAll] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ============================================================================
  // Data Fetching
  // ============================================================================

  const fetchClassification = useCallback(async (fileId: string) => {
    try {
      setFiles(prev =>
        prev.map(f =>
          f.id === fileId ? { ...f, isClassifying: true } : f
        )
      )

      const response = await fetch('/api/inbox/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId, tenantId, caseId }),
      })

      if (!response.ok) throw new Error('Classification failed')

      const suggestion: ClassificationSuggestion = await response.json()

      setFiles(prev =>
        prev.map(f =>
          f.id === fileId
            ? { ...f, suggestion, isClassifying: false }
            : f
        )
      )
    } catch (_err) {
      setFiles(prev =>
        prev.map(f =>
          f.id === fileId ? { ...f, isClassifying: false } : f
        )
      )
    }
  }, [tenantId, caseId])

  const fetchInboxFiles = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams({ tenantId })
      if (caseId) params.append('caseId', caseId)

      const response = await fetch(`/api/inbox?${params}`)
      if (!response.ok) throw new Error('Failed to fetch inbox files')

      const data = await response.json()
      setFiles(data.files || [])
      setFolders(data.folders || [])

      // Auto-fetch classifications for unclassified files
      data.files?.forEach((file: InboxFile) => {
        if (!file.suggestion && !file.folder_id) {
          fetchClassification(file.id)
        }
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [tenantId, caseId, fetchClassification])

  useEffect(() => {
    fetchInboxFiles()
  }, [fetchInboxFiles])

  // ============================================================================
  // Actions
  // ============================================================================

  const handleApplyClassification = async (file: InboxFile) => {
    if (!file.suggestion) return

    try {
      const response = await fetch('/api/inbox/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileId: file.id,
          targetFolderId: file.suggestion.targetFolderId,
          tenantId,
        }),
      })

      if (!response.ok) throw new Error('Failed to move file')

      const result = await response.json()
      if (!result.success) throw new Error(result.error || 'Move failed')

      // Remove from inbox list
      setFiles(prev => prev.filter(f => f.id !== file.id))

      // Notify parent - use the original file data since we already have it
      onFileClassified?.(file as R2File)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to classify file')
    }
  }

  const handleManualClassification = async (file: InboxFile, targetFolderId: string) => {
    try {
      const response = await fetch('/api/inbox/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileId: file.id,
          targetFolderId,
          tenantId,
        }),
      })

      if (!response.ok) throw new Error('Failed to move file')

      const result = await response.json()
      if (!result.success) throw new Error(result.error || 'Move failed')

      setFiles(prev => prev.filter(f => f.id !== file.id))
      onFileClassified?.(file as R2File)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to classify file')
    }
  }

  const handleSkip = (fileId: string) => {
    // Just remove suggestion, keep file in inbox
    setFiles(prev =>
      prev.map(f =>
        f.id === fileId ? { ...f, suggestion: undefined } : f
      )
    )
  }

  const handleClassifyAll = async () => {
    const unclassifiedFiles = files.filter(f => f.suggestion && f.suggestion.confidence === 'high')

    if (unclassifiedFiles.length === 0) {
      alert('No high-confidence suggestions to apply')
      return
    }

    if (!confirm(`Apply ${unclassifiedFiles.length} high-confidence classifications?`)) {
      return
    }

    setClassifyingAll(true)

    try {
      await Promise.all(
        unclassifiedFiles.map(file => handleApplyClassification(file))
      )
    } finally {
      setClassifyingAll(false)
    }
  }

  // ============================================================================
  // Render Helpers
  // ============================================================================

  const getConfidenceBadge = (confidence: ConfidenceLevel) => {
    const styles = {
      high: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      medium: 'bg-amber-100 text-amber-800 border-amber-300',
      low: 'bg-slate-100 text-slate-600 border-slate-300',
    }

    const labels = {
      high: '확신',
      medium: '보통',
      low: '낮음',
    }

    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border ${styles[confidence]}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${confidence === 'high' ? 'bg-emerald-600' : confidence === 'medium' ? 'bg-amber-600' : 'bg-slate-400'}`} />
        {labels[confidence]}
      </span>
    )
  }

  const getConfidencePercentage = (confidence: ConfidenceLevel): string => {
    const percentages = { high: '95%', medium: '70%', low: '45%' }
    return percentages[confidence]
  }

  // ============================================================================
  // Render
  // ============================================================================

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
        <p className="text-sm text-slate-600">{error}</p>
        <button
          onClick={fetchInboxFiles}
          className="mt-4 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
        >
          <RefreshCw className="w-4 h-4 inline mr-2" />
          다시 시도
        </button>
      </div>
    )
  }

  if (files.length === 0) {
    return (
      <EmptyState
        icon={InboxIcon}
        title="받은편지함이 비어있습니다"
        description="모든 파일이 분류되었습니다."
        compact
      />
    )
  }

  const highConfidenceCount = files.filter(f => f.suggestion?.confidence === 'high').length

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white rounded-lg border border-indigo-200 shadow-sm">
            <InboxIcon className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              받은편지함
              <span className="ml-2 text-indigo-600">({files.length}개)</span>
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              미분류 파일을 자동으로 분류합니다
            </p>
          </div>
        </div>

        <button
          onClick={handleClassifyAll}
          disabled={classifyingAll || highConfidenceCount === 0}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
        >
          {classifyingAll ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              처리중...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              자동 분류 ({highConfidenceCount}개)
            </>
          )}
        </button>
      </div>

      {/* File List */}
      <div className="space-y-3">
        {files.map(file => (
          <FileCard
            key={file.id}
            file={file}
            folders={folders}
            onApply={() => handleApplyClassification(file)}
            onManualClassify={(folderId) => handleManualClassification(file, folderId)}
            onSkip={() => handleSkip(file.id)}
            getConfidenceBadge={getConfidenceBadge}
            getConfidencePercentage={getConfidencePercentage}
          />
        ))}
      </div>
    </div>
  )
}

// ============================================================================
// FileCard Component
// ============================================================================

interface FileCardProps {
  file: InboxFile
  folders: { id: string; name: string; path: string }[]
  onApply: () => void
  onManualClassify: (folderId: string) => void
  onSkip: () => void
  getConfidenceBadge: (confidence: ConfidenceLevel) => React.ReactNode
  getConfidencePercentage: (confidence: ConfidenceLevel) => string
}

function FileCard({
  file,
  folders,
  onApply,
  onManualClassify,
  onSkip,
  getConfidenceBadge,
  getConfidencePercentage,
}: FileCardProps) {
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedFolderId, setSelectedFolderId] = useState<string>('')

  const handleFolderChange = (folderId: string) => {
    setSelectedFolderId(folderId)
    setShowDropdown(false)
  }

  const handleManualApply = () => {
    if (selectedFolderId) {
      onManualClassify(selectedFolderId)
    }
  }

  return (
    <div className="group bg-white border border-slate-200 rounded-xl hover:border-indigo-300 hover:shadow-lg transition-all duration-200 overflow-hidden">
      {/* File Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 p-2 bg-white rounded-lg border border-slate-200 shadow-sm">
            <FileText className="w-5 h-5 text-slate-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-slate-900 truncate">
              {file.original_name}
            </h4>
            <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
              <span>{((file.file_size || 0) / 1024).toFixed(1)} KB</span>
              <span>•</span>
              <span>{new Date(file.created_at).toLocaleDateString('ko-KR')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Suggestion Section */}
      <div className="px-4 py-3">
        {file.isClassifying ? (
          <div className="flex items-center gap-3 py-4 text-sm text-slate-600">
            <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
            <span className="font-medium">AI 분석중...</span>
          </div>
        ) : file.suggestion ? (
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-indigo-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-slate-600">추천 폴더</span>
                  {getConfidenceBadge(file.suggestion.confidence)}
                  <span className="text-xs text-slate-500">
                    ({getConfidencePercentage(file.suggestion.confidence)} 확률)
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <FolderOpen className="w-4 h-4 text-indigo-600" />
                  <span className="font-medium text-slate-900">
                    {file.suggestion.targetFolderPath}
                  </span>
                </div>
                {file.suggestion.reason && (
                  <p className="mt-2 text-xs text-slate-600 leading-relaxed pl-6">
                    {file.suggestion.reason}
                  </p>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={onApply}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <CheckCircle2 className="w-4 h-4" />
                적용
              </button>

              <div className="relative">
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <FolderOpen className="w-4 h-4" />
                  폴더 변경
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>

                {showDropdown && (
                  <div className="absolute top-full left-0 mt-1 w-64 max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg z-10">
                    {folders.map(folder => (
                      <button
                        key={folder.id}
                        onClick={() => handleFolderChange(folder.id)}
                        className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-indigo-50 transition-colors"
                      >
                        {folder.path}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {selectedFolderId && (
                <button
                  onClick={handleManualApply}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  확인
                </button>
              )}

              <button
                onClick={onSkip}
                className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
              >
                <XCircle className="w-4 h-4" />
                건너뛰기
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between py-3">
            <span className="text-sm text-slate-500">분류 제안 없음</span>
            <div className="relative">
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <FolderOpen className="w-4 h-4" />
                수동 분류
                <ChevronDown className="w-3.5 h-3.5" />
              </button>

              {showDropdown && (
                <div className="absolute top-full right-0 mt-1 w-64 max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg z-10">
                  {folders.map(folder => (
                    <button
                      key={folder.id}
                      onClick={() => handleFolderChange(folder.id)}
                      className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-indigo-50 transition-colors"
                    >
                      {folder.path}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedFolderId && (
              <button
                onClick={handleManualApply}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors"
              >
                <CheckCircle2 className="w-4 h-4" />
                확인
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
