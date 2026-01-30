'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  Plus,
} from 'lucide-react'
import { R2Folder } from '@/lib/r2/storage-service'

// ============================================================================
// Types
// ============================================================================

interface TreeNode {
  id: string
  name: string
  path: string
  children?: TreeNode[]
  isExpanded?: boolean
  depth: number
}

interface FolderTreeProps {
  tenantId: string
  currentFolderId: string | null
  onFolderSelect: (folderId: string | null) => void
  onContextMenu?: (e: React.MouseEvent, folderId: string, folderName: string) => void
  caseId?: string
}

// ============================================================================
// Component
// ============================================================================

export default function FolderTree({
  tenantId,
  currentFolderId,
  onFolderSelect,
  onContextMenu,
  caseId,
}: FolderTreeProps) {
  const [folders, setFolders] = useState<R2Folder[]>([])
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['root']))
  const [dragOver, setDragOver] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // ============================================================================
  // Data Fetching
  // ============================================================================

  const fetchFolders = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({ tenant_id: tenantId })
      if (caseId) params.append('case_id', caseId)

      const response = await fetch(`/api/drive/folders?${params}`)
      if (!response.ok) throw new Error('Failed to fetch folders')

      const data = await response.json()
      setFolders(data.folders || [])
    } catch (error) {
      console.error('Failed to fetch folders:', error)
    } finally {
      setIsLoading(false)
    }
  }, [tenantId, caseId])

  useEffect(() => {
    fetchFolders()
  }, [fetchFolders])

  // ============================================================================
  // Tree Structure Building
  // ============================================================================

  const treeStructure = useMemo(() => {
    // Group folders by parent
    const foldersByParent = new Map<string | null, R2Folder[]>()
    folders.forEach((folder) => {
      const parentId = folder.parent_id
      if (!foldersByParent.has(parentId)) {
        foldersByParent.set(parentId, [])
      }
      foldersByParent.get(parentId)!.push(folder)
    })

    // Build tree recursively
    const buildTree = (parentId: string | null, depth: number): TreeNode[] => {
      const children = foldersByParent.get(parentId) || []
      return children
        .sort((a, b) => a.display_order - b.display_order)
        .map((folder) => ({
          id: folder.id,
          name: folder.name,
          path: folder.path,
          depth,
          children: buildTree(folder.id, depth + 1),
        }))
    }

    return buildTree(null, 0)
  }, [folders])

  // ============================================================================
  // Event Handlers
  // ============================================================================

  const toggleNode = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation()
    setExpandedNodes((prev) => {
      const next = new Set(prev)
      if (next.has(nodeId)) {
        next.delete(nodeId)
      } else {
        next.add(nodeId)
      }
      return next
    })
  }, [])

  const handleNodeClick = useCallback(
    (nodeId: string) => {
      onFolderSelect(nodeId)
    },
    [onFolderSelect]
  )

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, nodeId: string, nodeName: string) => {
      e.preventDefault()
      e.stopPropagation()
      if (onContextMenu) {
        onContextMenu(e, nodeId, nodeName)
      }
    },
    [onContextMenu]
  )

  const handleDragOver = useCallback((e: React.DragEvent, nodeId: string) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(nodeId)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(null)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent, targetNodeId: string) => {
      e.preventDefault()
      e.stopPropagation()
      setDragOver(null)

      const fileId = e.dataTransfer.getData('fileId')
      if (fileId) {
        // TODO: Implement file moving
        console.log('Moving file', fileId, 'to folder', targetNodeId)
      }
    },
    []
  )

  // ============================================================================
  // Render Helpers
  // ============================================================================

  const renderTreeNode = (node: TreeNode) => {
    const isExpanded = expandedNodes.has(node.id)
    const isSelected = currentFolderId === node.id
    const hasChildren = node.children && node.children.length > 0
    const isDragTarget = dragOver === node.id

    return (
      <div key={node.id} className="select-none">
        <div
          className={`
            group relative flex items-center gap-1.5 py-1.5 px-2 cursor-pointer
            rounded-md mx-1 transition-colors
            ${isSelected ? 'bg-blue-100 text-blue-900' : 'hover:bg-gray-100 text-gray-900'}
            ${isDragTarget ? 'bg-blue-50 ring-2 ring-blue-300 ring-inset' : ''}
          `}
          style={{ paddingLeft: `${8 + node.depth * 20}px` }}
          onClick={() => handleNodeClick(node.id)}
          onContextMenu={(e) => handleContextMenu(e, node.id, node.name)}
          onDragOver={(e) => handleDragOver(e, node.id)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, node.id)}
        >
          {/* Expand/Collapse Chevron */}
          {hasChildren ? (
            <button
              className="p-0.5 hover:bg-gray-200 rounded transition-colors flex-shrink-0"
              onClick={(e) => toggleNode(e, node.id)}
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-gray-600" strokeWidth={1.5} />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-600" strokeWidth={1.5} />
              )}
            </button>
          ) : (
            <div className="w-5 flex-shrink-0" />
          )}

          {/* Folder Icon */}
          <div className={`flex-shrink-0 ${isSelected ? 'text-blue-700' : 'text-gray-500'}`}>
            {isExpanded && hasChildren ? (
              <FolderOpen className="w-5 h-5" strokeWidth={1.5} />
            ) : (
              <Folder className="w-5 h-5" strokeWidth={1.5} />
            )}
          </div>

          {/* Folder Name */}
          <span
            className={`
              flex-1 text-sm truncate
              ${isSelected ? 'font-medium text-blue-900' : 'text-gray-900'}
            `}
          >
            {node.name}
          </span>
        </div>

        {/* Children */}
        {isExpanded && hasChildren && (
          <div>{node.children!.map((child) => renderTreeNode(child))}</div>
        )}
      </div>
    )
  }

  // ============================================================================
  // Render
  // ============================================================================

  if (isLoading) {
    return (
      <div className="h-full bg-white border-r border-gray-200 flex items-center justify-center">
        <div className="text-sm text-gray-500">로딩 중...</div>
      </div>
    )
  }

  return (
    <div className="h-full bg-white border-r border-gray-200 overflow-y-auto flex flex-col">
      {/* Header */}
      <div className="px-4 py-4 border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900">내 드라이브</h2>
          <button
            className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
            onClick={() => {
              // TODO: New folder creation
              console.log('Create new folder')
            }}
            title="새 폴더"
          >
            <Plus className="w-5 h-5 text-gray-700" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* Tree */}
      <div className="py-2 flex-1 overflow-y-auto">
        {treeStructure.length > 0 ? (
          treeStructure.map((node) => renderTreeNode(node))
        ) : (
          <div className="px-4 py-12 text-center">
            <Folder className="w-12 h-12 mx-auto mb-3 text-gray-300" strokeWidth={1.5} />
            <p className="text-sm text-gray-500">폴더가 없습니다</p>
          </div>
        )}
      </div>
    </div>
  )
}
