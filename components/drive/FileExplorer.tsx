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
  MoreVertical,
  RefreshCw,
} from 'lucide-react'
import type { R2File as R2FileType, R2Folder as R2FolderType } from '@/types/r2'
import { useDriveFolder, useStorageUsage, invalidateDriveCache, invalidateStorageCache } from '@/hooks/useDrive'
import FileUploader from '@/components/drive/FileUploader'
import ContextMenu from '@/components/drive/ContextMenu'
import RenameDialog from '@/components/drive/RenameDialog'
import FilePreview from '@/components/drive/FilePreview'

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

  // Context Menu
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    type: 'file' | 'folder' | 'empty'
    itemId?: string
    itemName?: string
  } | null>(null)

  // Rename Dialog
  const [renameDialog, setRenameDialog] = useState<{
    isOpen: boolean
    type: 'file' | 'folder'
    id: string
    name: string
  } | null>(null)

  // File Preview
  const [previewFile, setPreviewFile] = useState<R2File | null>(null)

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

  const handleContextMenu = (e: React.MouseEvent, item: R2File | R2Folder, type: 'file' | 'folder') => {
    e.preventDefault()
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      type,
      itemId: item.id,
      itemName: type === 'file' ? (item as R2File).display_name : (item as R2Folder).name
    })
  }

  const handleEmptyContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, type: 'empty' })
  }

  const handleDelete = async (id: string) => {
    try {
      const isFile = files?.some(f => f.id === id)
      const endpoint = isFile ? `/api/drive/files/${id}` : `/api/drive/folders/${id}`
      const response = await fetch(endpoint, { method: 'DELETE' })
      if (!response.ok) throw new Error('Failed to delete')
      invalidateDriveCache(tenantId, currentFolderId, caseId)
    } catch (error) {
      console.error('Delete failed:', error)
    }
  }

  const handleContextAction = async (action: string, itemId?: string) => {
    setContextMenu(null)

    switch (action) {
      case 'preview':
        const file = files?.find(f => f.id === itemId)
        if (file) setPreviewFile(file)
        break
      case 'download':
        if (itemId) window.open(`/api/drive/files/${itemId}/download`, '_blank')
        break
      case 'rename':
        const item = files?.find(f => f.id === itemId) || folders?.find(f => f.id === itemId)
        if (item) {
          const isFile = 'display_name' in item
          setRenameDialog({
            isOpen: true,
            type: isFile ? 'file' : 'folder',
            id: item.id,
            name: isFile ? item.display_name : item.name
          })
        }
        break
      case 'delete':
        if (confirm('정말 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
          await handleDelete(itemId!)
        }
        break
      case 'newFolder':
        setShowNewFolder(true)
        break
      case 'upload':
        setShowUploader(true)
        break
      case 'open':
        if (itemId) handleFolderClick(itemId)
        break
    }
  }

  const handleRename = async (newName: string) => {
    if (!renameDialog) return
    try {
      const endpoint = renameDialog.type === 'file'
        ? `/api/drive/files/${renameDialog.id}`
        : `/api/drive/folders/${renameDialog.id}`
      const body = renameDialog.type === 'file'
        ? { display_name: newName }
        : { name: newName }

      const response = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      if (!response.ok) throw new Error('Failed to rename')
      setRenameDialog(null)
      invalidateDriveCache(tenantId, currentFolderId, caseId)
    } catch (error) {
      console.error('Rename failed:', error)
    }
  }

  const isLoading = driveLoading

  return (
    <div className="flex h-full bg-white">
      {/* Left Sidebar - Folder Tree */}
      {!embedded && (
        <div className="w-[280px] border-r border-gray-200 bg-gray-50 flex flex-col">
          <div className="px-6 py-5 border-b border-gray-200">
            <h2 className="text-sm font-normal text-gray-900">내 드라이브</h2>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-4">
            <FolderTree
              folders={folders || []}
              currentFolderId={currentFolderId}
              onFolderClick={handleFolderClick}
            />
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col bg-white">
        {/* Header */}
        <div className="border-b border-gray-200 bg-white">
          {/* Breadcrumb */}
          <div className="px-6 py-4 flex items-center gap-2 text-sm">
            <button
              onClick={() => setCurrentFolderId(null)}
              className="flex items-center gap-1.5 text-gray-700 hover:text-gray-900 transition-colors"
            >
              <Home className="w-4 h-4" strokeWidth={1.5} />
              <span>홈</span>
            </button>
            {breadcrumbs?.map((crumb: R2Folder) => (
              <div key={crumb.id} className="flex items-center gap-2">
                <ChevronRight className="w-4 h-4 text-gray-400" strokeWidth={1.5} />
                <button
                  onClick={() => setCurrentFolderId(crumb.id)}
                  className="text-gray-700 hover:text-gray-900 transition-colors"
                >
                  {crumb.name}
                </button>
              </div>
            ))}
          </div>

          {/* Toolbar */}
          <div className="px-6 py-3 flex items-center gap-4 border-t border-gray-200">
            {/* Search */}
            <div className="relative flex-1 max-w-xl">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" strokeWidth={1.5} />
              <input
                type="text"
                placeholder="드라이브 검색"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 text-sm bg-gray-50 border-0 rounded-full focus:bg-white focus:ring-1 focus:ring-blue-500 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" strokeWidth={1.5} />
                </button>
              )}
            </div>

            {/* View Toggle */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-lg transition-colors ${
                  viewMode === 'list'
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
                title="목록 보기"
              >
                <LayoutList className="w-5 h-5" strokeWidth={1.5} />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
                title="격자 보기"
              >
                <LayoutGrid className="w-5 h-5" strokeWidth={1.5} />
              </button>
            </div>

            {/* Actions */}
            <button
              onClick={() => refreshDrive()}
              className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
              title="새로고침"
            >
              <RefreshCw className="w-5 h-5" strokeWidth={1.5} />
            </button>

            <button
              onClick={() => setShowUploader(true)}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors flex items-center gap-2"
            >
              <Upload className="w-4 h-4" strokeWidth={1.5} />
              업로드
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto" onContextMenu={handleEmptyContextMenu}>
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <RefreshCw className="w-6 h-6 animate-spin text-blue-600" strokeWidth={1.5} />
            </div>
          ) : (
            <div className="px-6 py-6">
              {/* Folders Section */}
              {folders && folders.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-xs font-medium text-gray-500 mb-4 px-2">
                    폴더
                  </h3>
                  <div className={viewMode === 'grid' ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3' : 'space-y-1'}>
                    {folders.map((folder: R2Folder) => (
                      <FolderItem
                        key={folder.id}
                        folder={folder}
                        viewMode={viewMode}
                        onClick={() => handleFolderClick(folder.id)}
                        onContextMenu={(e) => handleContextMenu(e, folder, 'folder')}
                        onDoubleClick={() => handleFolderClick(folder.id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Files Section */}
              {processedFiles.length > 0 ? (
                <div>
                  <h3 className="text-xs font-medium text-gray-500 mb-4 px-2">
                    파일 {searchQuery && `(${processedFiles.length})`}
                  </h3>
                  <div className={viewMode === 'grid' ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3' : 'space-y-1'}>
                    {processedFiles.map((file) => (
                      <FileItem
                        key={file.id}
                        file={file}
                        viewMode={viewMode}
                        selected={selectedFiles.includes(file.id)}
                        onClick={() => handleFileClick(file)}
                        onContextMenu={(e) => handleContextMenu(e, file, 'file')}
                        onDoubleClick={() => setPreviewFile(file)}
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
            </div>
          )}
        </div>
      </div>

      {/* New Folder Modal */}
      {showNewFolder && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-base font-normal text-gray-900 mb-4">새 폴더 만들기</h3>
            <input
              type="text"
              placeholder="폴더 이름"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
              className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-6"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowNewFolder(false)
                  setNewFolderName('')
                }}
                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleCreateFolder}
                disabled={!newFolderName.trim()}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                만들기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUploader && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-normal text-gray-900">파일 업로드</h3>
              <button
                onClick={() => setShowUploader(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" strokeWidth={1.5} />
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

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          type={contextMenu.type}
          itemId={contextMenu.itemId}
          itemName={contextMenu.itemName}
          onClose={() => setContextMenu(null)}
          onAction={handleContextAction}
        />
      )}

      {/* Rename Dialog */}
      {renameDialog && (
        <RenameDialog
          isOpen={renameDialog.isOpen}
          type={renameDialog.type}
          currentName={renameDialog.name}
          onClose={() => setRenameDialog(null)}
          onRename={handleRename}
        />
      )}

      {/* File Preview */}
      {previewFile && (
        <FilePreview
          file={previewFile}
          isOpen={!!previewFile}
          onClose={() => setPreviewFile(null)}
        />
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
    <div className="space-y-0.5">
      {folders.map((folder) => (
        <button
          key={folder.id}
          onClick={() => onFolderClick(folder.id)}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
            currentFolderId === folder.id
              ? 'bg-blue-50 text-blue-600'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          <Folder className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />
          <span className="truncate flex-1 text-left font-normal">{folder.name}</span>
          {folder._count && (
            <span className="text-xs text-gray-400">
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
  onContextMenu,
  onDoubleClick,
}: {
  folder: R2Folder
  viewMode: ViewMode
  onClick: () => void
  onContextMenu?: (e: React.MouseEvent) => void
  onDoubleClick?: () => void
}) {
  if (viewMode === 'grid') {
    return (
      <button
        onClick={onClick}
        onContextMenu={onContextMenu}
        onDoubleClick={onDoubleClick}
        className="group flex flex-col items-start gap-3 p-4 rounded-xl border border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm transition-all"
      >
        <div className="w-full flex items-center justify-between">
          <Folder className="w-6 h-6 text-gray-400" strokeWidth={1.5} />
          <button className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-100 rounded transition-opacity">
            <MoreVertical className="w-4 h-4 text-gray-500" strokeWidth={1.5} />
          </button>
        </div>
        <div className="w-full">
          <p className="text-sm text-gray-900 font-normal text-left truncate">
            {folder.name}
          </p>
          {folder._count && (
            <p className="text-xs text-gray-500 mt-1">
              {folder._count.files + folder._count.subfolders} 항목
            </p>
          )}
        </div>
      </button>
    )
  }

  return (
    <button
      onClick={onClick}
      onContextMenu={onContextMenu}
      onDoubleClick={onDoubleClick}
      className="group flex items-center gap-4 px-4 py-3 rounded-lg hover:bg-gray-50 transition-colors w-full"
    >
      <Folder className="w-5 h-5 text-gray-400 flex-shrink-0" strokeWidth={1.5} />
      <span className="text-sm text-gray-900 flex-1 text-left truncate font-normal">{folder.name}</span>
      {folder._count && (
        <span className="text-xs text-gray-500">
          {folder._count.files + folder._count.subfolders} 항목
        </span>
      )}
      <button className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-100 rounded transition-opacity">
        <MoreVertical className="w-4 h-4 text-gray-500" strokeWidth={1.5} />
      </button>
    </button>
  )
}

// File Item Component
function FileItem({
  file,
  viewMode,
  selected,
  onClick,
  onContextMenu,
  onDoubleClick,
}: {
  file: R2File
  viewMode: ViewMode
  selected: boolean
  onClick: () => void
  onContextMenu?: (e: React.MouseEvent) => void
  onDoubleClick?: () => void
}) {
  const icon = getFileIcon(file.mime_type || '')

  if (viewMode === 'grid') {
    return (
      <button
        onClick={onClick}
        onContextMenu={onContextMenu}
        onDoubleClick={onDoubleClick}
        className={`group flex flex-col items-start gap-3 p-4 rounded-xl border transition-all ${
          selected
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
        }`}
      >
        <div className="w-full flex items-center justify-between">
          {icon}
          <button className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-100 rounded transition-opacity">
            <MoreVertical className="w-4 h-4 text-gray-500" strokeWidth={1.5} />
          </button>
        </div>
        <div className="w-full">
          <p className="text-sm text-gray-900 font-normal text-left truncate">
            {file.display_name}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {formatFileSize(file.file_size || 0)}
          </p>
        </div>
      </button>
    )
  }

  return (
    <button
      onClick={onClick}
      onContextMenu={onContextMenu}
      onDoubleClick={onDoubleClick}
      className={`group flex items-center gap-4 px-4 py-3 rounded-lg transition-colors w-full ${
        selected
          ? 'bg-blue-50'
          : 'hover:bg-gray-50'
      }`}
    >
      {icon}
      <span className="text-sm text-gray-900 flex-1 text-left truncate font-normal">{file.display_name}</span>
      <span className="text-xs text-gray-500 w-20 text-right">
        {formatFileSize(file.file_size || 0)}
      </span>
      <span className="text-xs text-gray-500 w-24 text-right">
        {formatDate(file.updated_at)}
      </span>
      <button className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-100 rounded transition-opacity">
        <MoreVertical className="w-4 h-4 text-gray-500" strokeWidth={1.5} />
      </button>
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
      <div className="flex flex-col items-center justify-center h-96 text-center">
        <Search className="w-16 h-16 text-gray-300 mb-6" strokeWidth={1} />
        <h3 className="text-base font-normal text-gray-900 mb-2">
          검색 결과 없음
        </h3>
        <p className="text-sm text-gray-500 mb-6">
          검색어를 변경하거나 필터를 조정해보세요
        </p>
        <button
          onClick={onClearSearch}
          className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          검색 초기화
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center h-96 text-center">
      <Folder className="w-16 h-16 text-gray-300 mb-6" strokeWidth={1} />
      <h3 className="text-base font-normal text-gray-900 mb-2">
        파일이 없습니다
      </h3>
      <p className="text-sm text-gray-500 mb-6">
        파일을 업로드하여 시작하세요
      </p>
      <button
        onClick={onUpload}
        className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors flex items-center gap-2"
      >
        <Upload className="w-4 h-4" strokeWidth={1.5} />
        파일 업로드
      </button>
    </div>
  )
}

// Utility Functions
function getFileIcon(contentType: string) {
  const iconClass = "w-6 h-6"
  const strokeWidth = 1.5

  if (contentType.startsWith('image/')) {
    return <ImageIcon className={`${iconClass} text-purple-400`} strokeWidth={strokeWidth} />
  }
  if (contentType.startsWith('video/')) {
    return <Video className={`${iconClass} text-red-400`} strokeWidth={strokeWidth} />
  }
  if (contentType.startsWith('audio/')) {
    return <Music className={`${iconClass} text-pink-400`} strokeWidth={strokeWidth} />
  }
  if (contentType.includes('pdf')) {
    return <FileText className={`${iconClass} text-red-500`} strokeWidth={strokeWidth} />
  }
  if (contentType.includes('sheet') || contentType.includes('excel')) {
    return <FileSpreadsheet className={`${iconClass} text-green-500`} strokeWidth={strokeWidth} />
  }
  if (contentType.includes('zip') || contentType.includes('compressed')) {
    return <Archive className={`${iconClass} text-amber-500`} strokeWidth={strokeWidth} />
  }

  return <File className={`${iconClass} text-gray-400`} strokeWidth={strokeWidth} />
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

