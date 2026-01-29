'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  Inbox,
  Briefcase,
  FileLock,
  Share2,
  MoreVertical,
  Plus,
  Edit2,
  Trash2,
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
  isContractFolder?: boolean
  caseId?: string | null
  depth: number
  isSpecial?: boolean
  icon?: string
}

interface FolderTreeProps {
  tenantId: string
  currentFolderId: string | null
  onFolderSelect: (folderId: string | null) => void
  caseId?: string
}

interface ContextMenuState {
  x: number
  y: number
  nodeId: string
  nodeName: string
}

// ============================================================================
// Component
// ============================================================================

export default function FolderTree({
  tenantId,
  currentFolderId,
  onFolderSelect,
  caseId,
}: FolderTreeProps) {
  const [folders, setFolders] = useState<R2Folder[]>([])
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['root']))
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
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
          isContractFolder: folder.is_contract_folder,
          caseId: folder.case_id,
          depth,
          children: buildTree(folder.id, depth + 1),
        }))
    }

    // Special root nodes
    const specialNodes: TreeNode[] = [
      {
        id: 'inbox',
        name: 'Inbox',
        path: '/inbox',
        depth: 0,
        isSpecial: true,
        icon: 'inbox',
      },
      {
        id: 'cases',
        name: 'Cases',
        path: '/cases',
        depth: 0,
        isSpecial: true,
        icon: 'briefcase',
        children: buildTree(null, 1).filter((node) => node.caseId),
      },
      {
        id: 'contracts',
        name: 'Contracts',
        path: '/contracts',
        depth: 0,
        isSpecial: true,
        icon: 'file-lock',
        children: buildTree(null, 1).filter((node) => node.isContractFolder),
      },
      {
        id: 'shared',
        name: 'Shared',
        path: '/shared',
        depth: 0,
        isSpecial: true,
        icon: 'share-2',
      },
    ]

    return specialNodes
  }, [folders])

  // ============================================================================
  // Event Handlers
  // ============================================================================

  const toggleNode = useCallback((nodeId: string) => {
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
      if (nodeId.startsWith('inbox') || nodeId.startsWith('shared')) {
        onFolderSelect(null)
      } else {
        onFolderSelect(nodeId)
      }
    },
    [onFolderSelect]
  )

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, nodeId: string, nodeName: string) => {
      e.preventDefault()
      e.stopPropagation()
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        nodeId,
        nodeName,
      })
    },
    []
  )

  const closeContextMenu = useCallback(() => {
    setContextMenu(null)
  }, [])

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

  const getNodeIcon = (node: TreeNode, isExpanded: boolean) => {
    if (node.isSpecial) {
      switch (node.icon) {
        case 'inbox':
          return <Inbox className="w-5 h-5" strokeWidth={2.5} />
        case 'briefcase':
          return <Briefcase className="w-5 h-5" strokeWidth={2.5} />
        case 'file-lock':
          return <FileLock className="w-5 h-5" strokeWidth={2.5} />
        case 'share-2':
          return <Share2 className="w-5 h-5" strokeWidth={2.5} />
        default:
          return <Folder className="w-5 h-5" strokeWidth={2.5} />
      }
    }

    if (isExpanded && node.children && node.children.length > 0) {
      return <FolderOpen className="w-5 h-5" strokeWidth={2.5} />
    }

    return <Folder className="w-5 h-5" strokeWidth={2.5} />
  }

  const renderTreeNode = (node: TreeNode, _index: number) => {
    const isExpanded = expandedNodes.has(node.id)
    const isSelected = currentFolderId === node.id
    const hasChildren = node.children && node.children.length > 0
    const isDragTarget = dragOver === node.id

    return (
      <div key={node.id} className="select-none">
        <div
          className={`
            group relative flex items-center gap-2 px-3 py-2 cursor-pointer
            transition-all duration-100
            ${isSelected ? 'bg-black text-white' : 'hover:bg-neutral-100'}
            ${isDragTarget ? 'ring-2 ring-black ring-inset' : ''}
            ${node.depth > 0 ? 'border-l-2 border-neutral-200' : ''}
          `}
          style={{ paddingLeft: `${12 + node.depth * 20}px` }}
          onClick={() => handleNodeClick(node.id)}
          onContextMenu={(e) => handleContextMenu(e, node.id, node.name)}
          onDragOver={(e) => handleDragOver(e, node.id)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, node.id)}
        >
          {/* Expand/Collapse Toggle */}
          {hasChildren && (
            <button
              className="p-0.5 hover:bg-neutral-200 rounded transition-colors"
              onClick={(e) => {
                e.stopPropagation()
                toggleNode(node.id)
              }}
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4" strokeWidth={3} />
              ) : (
                <ChevronRight className="w-4 h-4" strokeWidth={3} />
              )}
            </button>
          )}

          {/* Spacer for nodes without children */}
          {!hasChildren && <div className="w-5" />}

          {/* Icon */}
          <div className={isSelected ? 'text-white' : 'text-neutral-700'}>
            {getNodeIcon(node, isExpanded)}
          </div>

          {/* Name */}
          <span
            className={`
              flex-1 text-sm font-mono font-medium tracking-tight truncate
              ${isSelected ? 'text-white' : 'text-neutral-900'}
            `}
          >
            {node.name}
          </span>

          {/* Context Menu Button */}
          <button
            className={`
              opacity-0 group-hover:opacity-100 p-1 rounded
              transition-opacity
              ${isSelected ? 'hover:bg-neutral-800' : 'hover:bg-neutral-200'}
            `}
            onClick={(e) => {
              e.stopPropagation()
              handleContextMenu(e, node.id, node.name)
            }}
          >
            <MoreVertical className="w-4 h-4" strokeWidth={2.5} />
          </button>
        </div>

        {/* Children */}
        {isExpanded && hasChildren && (
          <div className="relative">
            {node.children!.map((child, idx) => renderTreeNode(child, idx))}
          </div>
        )}
      </div>
    )
  }

  // ============================================================================
  // Context Menu
  // ============================================================================

  useEffect(() => {
    if (contextMenu) {
      const handleClick = () => closeContextMenu()
      document.addEventListener('click', handleClick)
      return () => document.removeEventListener('click', handleClick)
    }
  }, [contextMenu, closeContextMenu])

  // ============================================================================
  // Render
  // ============================================================================

  if (isLoading) {
    return (
      <div className="h-full bg-neutral-50 border-r-4 border-black flex items-center justify-center">
        <div className="text-sm font-mono text-neutral-500 tracking-tight">
          LOADING...
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Tree Container */}
      <div className="h-full bg-neutral-50 border-r-4 border-black overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-black text-white px-4 py-4 border-b-4 border-white z-10">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-mono font-bold tracking-tighter uppercase">
              Folders
            </h2>
            <button className="p-1 hover:bg-neutral-800 rounded transition-colors">
              <Plus className="w-5 h-5" strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {/* Tree */}
        <div className="py-2">
          {treeStructure.map((node, index) => renderTreeNode(node, index))}
        </div>

        {/* Empty State */}
        {folders.length === 0 && (
          <div className="px-4 py-12 text-center">
            <Folder className="w-12 h-12 mx-auto mb-4 text-neutral-300" strokeWidth={2} />
            <p className="text-sm font-mono text-neutral-500 tracking-tight">
              No folders found
            </p>
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
          style={{
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`,
          }}
        >
          <div className="py-1 min-w-[180px]">
            <button
              className="w-full px-4 py-2 text-left text-sm font-mono hover:bg-black hover:text-white flex items-center gap-2 transition-colors"
              onClick={() => {
                console.log('Add subfolder to', contextMenu.nodeId)
                closeContextMenu()
              }}
            >
              <Plus className="w-4 h-4" strokeWidth={2.5} />
              New Folder
            </button>
            <button
              className="w-full px-4 py-2 text-left text-sm font-mono hover:bg-black hover:text-white flex items-center gap-2 transition-colors"
              onClick={() => {
                console.log('Rename', contextMenu.nodeId)
                closeContextMenu()
              }}
            >
              <Edit2 className="w-4 h-4" strokeWidth={2.5} />
              Rename
            </button>
            <div className="h-px bg-neutral-200 my-1" />
            <button
              className="w-full px-4 py-2 text-left text-sm font-mono hover:bg-red-600 hover:text-white flex items-center gap-2 transition-colors"
              onClick={() => {
                console.log('Delete', contextMenu.nodeId)
                closeContextMenu()
              }}
            >
              <Trash2 className="w-4 h-4" strokeWidth={2.5} />
              Delete
            </button>
          </div>
        </div>
      )}
    </>
  )
}
