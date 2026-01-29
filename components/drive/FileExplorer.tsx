'use client'

import { useState, useMemo } from 'react'
import {
  Search,
  Upload,
  LayoutGrid,
  LayoutList,
  Home,
  ChevronRight,
  Folder,
  File,
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  Music,
  Video,
  Archive,
  X,
  SortAsc,
  SortDesc,
  RefreshCw,
} from 'lucide-react'
import type { R2File as R2FileType, R2Folder as R2FolderType } from '@/types/r2'
import { useDriveFolder, useStorageUsage, invalidateDriveCache, invalidateStorageCache } from '@/hooks/useDrive'
import FileUploader from '@/components/drive/FileUploader'

// Use canonical types with local extensions
type R2File = R2FileType
type R2Folder = R2FolderType & {
  _count?: { files: number; subfolders: number }  // Optional extension for UI
}

interface FileExplorerProps {
  tenantId: string
  caseId?: string
  onFileSelect?: (file: R2File) => void
  embedded?: boolean
}

type ViewMode = 'grid' | 'list'
type SortBy = 'name' | 'date' | 'size'
type SortOrder = 'asc' | 'desc'

export default function FileExplorer({
  tenantId,
  caseId,
  onFileSelect,
  embedded = false,
}: FileExplorerProps) {
  // State
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<string[]>([])
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<SortBy>('name')
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc')
  const [showUploader, setShowUploader] = useState(false)
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')

  // Real SWR hooks for drive data
  const {
    folders,
    files,
    currentFolder: _currentFolder,
    breadcrumbs,
    isLoading: driveLoading,
    mutate: refreshDrive
  } = useDriveFolder(tenantId, currentFolderId, caseId)
  const { storage: _storage } = useStorageUsage()

  // Filtered and sorted files
  const processedFiles = useMemo(() => {
    if (!files) return []

    let filtered = [...files]

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(f => f.display_name.toLowerCase().includes(query))
    }

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0

      switch (sortBy) {
        case 'name':
          comparison = a.display_name.localeCompare(b.display_name)
          break
        case 'date':
          comparison = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
          break
        case 'size':
          comparison = (a.file_size || 0) - (b.file_size || 0)
          break
      }

      return sortOrder === 'asc' ? comparison : -comparison
    })

    return filtered
  }, [files, searchQuery, sortBy, sortOrder])

  // Handlers
  const handleFolderClick = (folderId: string) => {
    setCurrentFolderId(folderId)
    setSelectedFiles([])
  }

  const handleFileClick = (file: R2File) => {
    if (onFileSelect) {
      onFileSelect(file)
    } else {
      // Toggle selection
      setSelectedFiles(prev =>
        prev.includes(file.id)
          ? prev.filter(id => id !== file.id)
          : [...prev, file.id]
      )
    }
  }

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return

    try {
      const response = await fetch('/api/drive/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newFolderName,
          parentId: currentFolderId,
          tenantId,
          caseId,
        }),
      })

      if (!response.ok) throw new Error('Failed to create folder')

      setNewFolderName('')
      setShowNewFolder(false)
      // Refresh folder list
      invalidateDriveCache(tenantId, currentFolderId, caseId)
    } catch (error) {
      console.error('Failed to create folder:', error)
    }
  }

  const toggleSort = (field: SortBy) => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('asc')
    }
  }

  const isLoading = driveLoading

  return (
    <div className={`flex h-full ${embedded ? '' : 'page-container'}`}>
      {/* Left Sidebar - Folder Tree */}
      {!embedded && (
        <div className="w-64 border-r border-[var(--border-default)] bg-[var(--bg-secondary)] flex flex-col">
          <div className="p-4 border-b border-[var(--border-default)]">
            <h2 className="text-body font-semibold text-[var(--text-primary)]">폴더</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            <FolderTree
              folders={folders || []}
              currentFolderId={currentFolderId}
              onFolderClick={handleFolderClick}
            />
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col bg-[var(--bg-primary)]">
        {/* Toolbar */}
        <div className="bg-[var(--bg-secondary)] border-b border-[var(--border-default)] p-4 space-y-4">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-caption">
            <button
              onClick={() => setCurrentFolderId(null)}
              className="flex items-center gap-1 text-[var(--text-secondary)] hover:text-[var(--sage-primary)] transition-colors"
            >
              <Home className="w-4 h-4" />
              <span>홈</span>
            </button>
            {breadcrumbs?.map((crumb: R2Folder) => (
              <div key={crumb.id} className="flex items-center gap-2">
                <ChevronRight className="w-3 h-3 text-[var(--text-muted)]" />
                <button
                  onClick={() => setCurrentFolderId(crumb.id)}
                  className="text-[var(--text-secondary)] hover:text-[var(--sage-primary)] transition-colors"
                >
                  {crumb.name}
                </button>
              </div>
            ))}
          </div>

          {/* Actions Bar */}
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
              <input
                type="text"
                placeholder="파일 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="form-input pl-9 w-full"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Sort */}
            <div className="flex items-center gap-1 bg-[var(--bg-tertiary)] rounded-lg p-1">
              <button
                onClick={() => toggleSort('name')}
                className={`px-3 py-1.5 rounded text-caption transition-colors ${
                  sortBy === 'name'
                    ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                이름
              </button>
              <button
                onClick={() => toggleSort('date')}
                className={`px-3 py-1.5 rounded text-caption transition-colors ${
                  sortBy === 'date'
                    ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                날짜
              </button>
              <button
                onClick={() => toggleSort('size')}
                className={`px-3 py-1.5 rounded text-caption transition-colors ${
                  sortBy === 'size'
                    ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                크기
              </button>
              <button
                onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                className="p-1.5 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
              >
                {sortOrder === 'asc' ? (
                  <SortAsc className="w-4 h-4" />
                ) : (
                  <SortDesc className="w-4 h-4" />
                )}
              </button>
            </div>

            {/* View Toggle */}
            <div className="flex items-center gap-1 bg-[var(--bg-tertiary)] rounded-lg p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded transition-colors ${
                  viewMode === 'list'
                    ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}
              >
                <LayoutList className="w-4 h-4" />
              </button>
            </div>

            {/* Actions */}
            <button
              onClick={() => refreshDrive()}
              className="p-2 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
              title="새로고침"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            <button
              onClick={() => setShowNewFolder(true)}
              className="btn btn-ghost btn-sm"
            >
              <Folder className="w-4 h-4" />
              새 폴더
            </button>

            <button
              onClick={() => setShowUploader(true)}
              className="btn btn-primary btn-sm"
            >
              <Upload className="w-4 h-4" />
              업로드
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <RefreshCw className="w-6 h-6 animate-spin text-[var(--sage-primary)]" />
            </div>
          ) : (
            <>
              {/* Folders Section */}
              {folders && folders.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-caption font-semibold text-[var(--text-secondary)] mb-3 uppercase tracking-wide">
                    폴더
                  </h3>
                  <div className={viewMode === 'grid' ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4' : 'space-y-2'}>
                    {folders.map((folder: R2Folder) => (
                      <FolderItem
                        key={folder.id}
                        folder={folder}
                        viewMode={viewMode}
                        onClick={() => handleFolderClick(folder.id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Files Section */}
              {processedFiles.length > 0 ? (
                <div>
                  <h3 className="text-caption font-semibold text-[var(--text-secondary)] mb-3 uppercase tracking-wide">
                    파일 {searchQuery && `(${processedFiles.length})`}
                  </h3>
                  <div className={viewMode === 'grid' ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4' : 'space-y-2'}>
                    {processedFiles.map((file) => (
                      <FileItem
                        key={file.id}
                        file={file}
                        viewMode={viewMode}
                        selected={selectedFiles.includes(file.id)}
                        onClick={() => handleFileClick(file)}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <EmptyState
                  hasSearch={!!searchQuery}
                  onClearSearch={() => setSearchQuery('')}
                  onUpload={() => setShowUploader(true)}
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* New Folder Modal */}
      {showNewFolder && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-[var(--bg-secondary)] rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-body font-semibold mb-4">새 폴더 만들기</h3>
            <input
              type="text"
              placeholder="폴더 이름"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
              className="form-input w-full mb-4"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowNewFolder(false)
                  setNewFolderName('')
                }}
                className="btn btn-ghost"
              >
                취소
              </button>
              <button
                onClick={handleCreateFolder}
                disabled={!newFolderName.trim()}
                className="btn btn-primary"
              >
                만들기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUploader && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-[var(--bg-secondary)] rounded-lg shadow-xl w-full max-w-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-body font-semibold">파일 업로드</h3>
              <button
                onClick={() => setShowUploader(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <FileUploader
              tenantId={tenantId}
              folderId={currentFolderId ?? undefined}
              caseId={caseId}
              onUploadComplete={(files) => {
                // Refresh the file list
                refreshDrive()
                invalidateStorageCache()
                // Close modal if all uploads completed
                if (files.length > 0) {
                  setShowUploader(false)
                }
              }}
              onUploadError={(error) => {
                console.error('Upload error:', error)
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// Folder Tree Component
function FolderTree({
  folders,
  currentFolderId,
  onFolderClick,
}: {
  folders: R2Folder[]
  currentFolderId: string | null
  onFolderClick: (id: string) => void
}) {
  return (
    <div className="space-y-1">
      {folders.map((folder) => (
        <button
          key={folder.id}
          onClick={() => onFolderClick(folder.id)}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-caption transition-colors ${
            currentFolderId === folder.id
              ? 'bg-[var(--sage-muted)] text-[var(--sage-primary)] font-medium'
              : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Folder className="w-4 h-4 flex-shrink-0" />
          <span className="truncate flex-1 text-left">{folder.name}</span>
          {folder._count && (
            <span className="text-xs text-[var(--text-muted)]">
              {folder._count.files + folder._count.subfolders}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

// Folder Item Component
function FolderItem({
  folder,
  viewMode,
  onClick,
}: {
  folder: R2Folder
  viewMode: ViewMode
  onClick: () => void
}) {
  if (viewMode === 'grid') {
    return (
      <button
        onClick={onClick}
        className="flex flex-col items-center gap-2 p-4 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] hover:border-[var(--sage-primary)] hover:shadow-md transition-all group"
      >
        <Folder className="w-12 h-12 text-[var(--sage-primary)] group-hover:scale-110 transition-transform" />
        <span className="text-caption text-[var(--text-primary)] text-center truncate w-full">
          {folder.name}
        </span>
        {folder._count && (
          <span className="text-xs text-[var(--text-muted)]">
            {folder._count.files + folder._count.subfolders} 항목
          </span>
        )}
      </button>
    )
  }

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 p-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] hover:border-[var(--sage-primary)] transition-all"
    >
      <Folder className="w-5 h-5 text-[var(--sage-primary)] flex-shrink-0" />
      <span className="text-body flex-1 text-left truncate">{folder.name}</span>
      {folder._count && (
        <span className="text-caption text-[var(--text-muted)]">
          {folder._count.files + folder._count.subfolders} 항목
        </span>
      )}
    </button>
  )
}

// File Item Component
function FileItem({
  file,
  viewMode,
  selected,
  onClick,
}: {
  file: R2File
  viewMode: ViewMode
  selected: boolean
  onClick: () => void
}) {
  const icon = getFileIcon(file.mime_type || '')

  if (viewMode === 'grid') {
    return (
      <button
        onClick={onClick}
        className={`flex flex-col items-center gap-2 p-4 rounded-lg border transition-all group ${
          selected
            ? 'border-[var(--sage-primary)] bg-[var(--sage-muted)]'
            : 'border-[var(--border-default)] bg-[var(--bg-secondary)] hover:border-[var(--sage-primary)] hover:shadow-md'
        }`}
      >
        {icon}
        <span className="text-caption text-[var(--text-primary)] text-center truncate w-full">
          {file.display_name}
        </span>
        <span className="text-xs text-[var(--text-muted)]">
          {formatFileSize(file.file_size || 0)}
        </span>
      </button>
    )
  }

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
        selected
          ? 'border-[var(--sage-primary)] bg-[var(--sage-muted)]'
          : 'border-[var(--border-default)] bg-[var(--bg-secondary)] hover:border-[var(--sage-primary)]'
      }`}
    >
      {icon}
      <span className="text-body flex-1 text-left truncate">{file.display_name}</span>
      <span className="text-caption text-[var(--text-muted)]">
        {formatFileSize(file.file_size || 0)}
      </span>
      <span className="text-caption text-[var(--text-muted)]">
        {formatDate(file.updated_at)}
      </span>
    </button>
  )
}

// Empty State
function EmptyState({
  hasSearch,
  onClearSearch,
  onUpload,
}: {
  hasSearch: boolean
  onClearSearch: () => void
  onUpload: () => void
}) {
  if (hasSearch) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <Search className="w-12 h-12 text-[var(--text-muted)] mb-4" />
        <h3 className="text-body font-semibold text-[var(--text-primary)] mb-2">
          검색 결과 없음
        </h3>
        <p className="text-caption text-[var(--text-secondary)] mb-4">
          검색어를 변경하거나 필터를 조정해보세요
        </p>
        <button onClick={onClearSearch} className="btn btn-ghost btn-sm">
          검색 초기화
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center h-64 text-center">
      <Folder className="w-12 h-12 text-[var(--text-muted)] mb-4" />
      <h3 className="text-body font-semibold text-[var(--text-primary)] mb-2">
        파일이 없습니다
      </h3>
      <p className="text-caption text-[var(--text-secondary)] mb-4">
        파일을 업로드하여 시작하세요
      </p>
      <button onClick={onUpload} className="btn btn-primary btn-sm">
        <Upload className="w-4 h-4" />
        파일 업로드
      </button>
    </div>
  )
}

// Utility Functions
function getFileIcon(contentType: string) {
  const iconClass = "w-12 h-12 group-hover:scale-110 transition-transform"

  if (contentType.startsWith('image/')) {
    return <ImageIcon className={`${iconClass} text-purple-500`} />
  }
  if (contentType.startsWith('video/')) {
    return <Video className={`${iconClass} text-red-500`} />
  }
  if (contentType.startsWith('audio/')) {
    return <Music className={`${iconClass} text-pink-500`} />
  }
  if (contentType.includes('pdf')) {
    return <FileText className={`${iconClass} text-red-600`} />
  }
  if (contentType.includes('sheet') || contentType.includes('excel')) {
    return <FileSpreadsheet className={`${iconClass} text-green-600`} />
  }
  if (contentType.includes('zip') || contentType.includes('compressed')) {
    return <Archive className={`${iconClass} text-amber-600`} />
  }

  return <File className={`${iconClass} text-[var(--text-muted)]`} />
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return '오늘'
  if (diffDays === 1) return '어제'
  if (diffDays < 7) return `${diffDays}일 전`

  const year = String(date.getFullYear()).slice(2)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}.${month}.${day}`
}

