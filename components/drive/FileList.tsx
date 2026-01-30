'use client';

import React, { useEffect, useRef, useMemo, useCallback } from 'react';
import {
  File,
  FileText,
  Image,
  FileSpreadsheet,
  Folder,
  MoreVertical,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import type { R2File, R2Folder } from '@/lib/r2/storage-service';

interface FileViewProps {
  files: R2File[];
  folders: R2Folder[];
  selectedIds: string[];
  onSelect: (ids: string[]) => void;
  onFolderOpen: (folderId: string) => void;
  onFileOpen: (file: R2File) => void;
  onContextMenu: (event: React.MouseEvent, item: R2File | R2Folder) => void;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  onSort: (column: string) => void;
}

function getFileIcon(mimeType: string | null) {
  if (!mimeType) return { Icon: File, color: 'text-gray-400' };

  if (mimeType === 'application/pdf') {
    return { Icon: FileText, color: 'text-red-500' };
  }
  if (mimeType.startsWith('image/')) {
    return { Icon: Image, color: 'text-blue-500' };
  }
  if (
    mimeType === 'application/msword' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return { Icon: FileText, color: 'text-blue-600' };
  }
  if (
    mimeType === 'application/vnd.ms-excel' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ) {
    return { Icon: FileSpreadsheet, color: 'text-green-600' };
  }
  if (mimeType === 'application/hwp') {
    return { Icon: FileText, color: 'text-orange-500' };
  }

  return { Icon: File, color: 'text-gray-400' };
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '-';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatDate(dateString: string | null): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function getMimeTypeDisplay(mimeType: string | null): string {
  if (!mimeType) return 'Unknown';
  if (mimeType === 'application/pdf') return 'PDF';
  if (mimeType.startsWith('image/')) return 'Image';
  if (mimeType === 'application/msword') return 'Word';
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    return 'Word';
  if (mimeType === 'application/vnd.ms-excel') return 'Excel';
  if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    return 'Excel';
  if (mimeType === 'application/hwp') return 'HWP';
  return mimeType.split('/')[1]?.toUpperCase() || 'File';
}

const SortIcon = ({ column, sortBy, sortOrder }: { column: string; sortBy: string; sortOrder: 'asc' | 'desc' }) => {
  if (sortBy !== column) return null;
  return sortOrder === 'asc' ? (
    <ChevronUp className="w-3.5 h-3.5 inline-block ml-1 text-gray-600" />
  ) : (
    <ChevronDown className="w-3.5 h-3.5 inline-block ml-1 text-gray-600" />
  );
};

export default function FileList({
  files,
  folders,
  selectedIds,
  onSelect,
  onFolderOpen,
  onFileOpen,
  onContextMenu,
  sortBy,
  sortOrder,
  onSort,
}: FileViewProps) {
  const tableRef = useRef<HTMLTableElement>(null);

  const allItems = useMemo(() => [
    ...folders.map((f) => ({ type: 'folder' as const, data: f, id: f.id })),
    ...files.map((f) => ({ type: 'file' as const, data: f, id: f.id })),
  ], [folders, files]);

  const isSelected = (id: string) => selectedIds.includes(id);
  const allSelected = allItems.length > 0 && allItems.every((item) => isSelected(item.id));

  const handleSelectAll = () => {
    if (allSelected) {
      onSelect([]);
    } else {
      onSelect(allItems.map((item) => item.id));
    }
  };

  const handleItemClick = (id: string, event: React.MouseEvent) => {
    if (event.metaKey || event.ctrlKey) {
      // Multi-select
      if (isSelected(id)) {
        onSelect(selectedIds.filter((sid) => sid !== id));
      } else {
        onSelect([...selectedIds, id]);
      }
    } else if (event.shiftKey && selectedIds.length > 0) {
      // Range select
      const allIds = allItems.map((item) => item.id);
      const lastSelectedIndex = allIds.indexOf(selectedIds[selectedIds.length - 1]);
      const currentIndex = allIds.indexOf(id);
      const start = Math.min(lastSelectedIndex, currentIndex);
      const end = Math.max(lastSelectedIndex, currentIndex);
      onSelect(allIds.slice(start, end + 1));
    } else {
      // Single select
      onSelect([id]);
    }
  };

  type ItemType = { type: 'folder'; data: R2Folder; id: string } | { type: 'file'; data: R2File; id: string };

  const handleItemDoubleClick = useCallback((item: ItemType) => {
    if (item.type === 'folder') {
      onFolderOpen(item.id);
    } else {
      onFileOpen(item.data as R2File);
    }
  }, [onFolderOpen, onFileOpen]);

  const handleCheckboxChange = (id: string, checked: boolean) => {
    if (checked) {
      onSelect([...selectedIds, id]);
    } else {
      onSelect(selectedIds.filter((sid) => sid !== id));
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!tableRef.current) return;

      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const currentIndex = selectedIds.length
          ? allItems.findIndex((item) => item.id === selectedIds[selectedIds.length - 1])
          : -1;
        const nextIndex =
          e.key === 'ArrowDown'
            ? Math.min(currentIndex + 1, allItems.length - 1)
            : Math.max(currentIndex - 1, 0);

        if (nextIndex >= 0 && nextIndex < allItems.length) {
          const nextItem = allItems[nextIndex];
          if (e.shiftKey) {
            // Range select
            const start = Math.min(currentIndex, nextIndex);
            const end = Math.max(currentIndex, nextIndex);
            onSelect(allItems.slice(start, end + 1).map((item) => item.id));
          } else {
            onSelect([nextItem.id]);
          }
        }
      } else if (e.key === 'Enter' && selectedIds.length === 1) {
        const item = allItems.find((item) => item.id === selectedIds[0]);
        if (item) {
          handleItemDoubleClick(item);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds, allItems, onSelect, handleItemDoubleClick]);

  return (
    <div className="overflow-x-auto bg-white border border-gray-200 rounded-lg">
      <table ref={tableRef} className="w-full border-collapse">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="w-12 py-3 px-4 text-left">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={handleSelectAll}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
            </th>
            <th
              className="py-3 px-4 text-left cursor-pointer hover:bg-gray-100 transition-colors select-none"
              onClick={() => onSort('name')}
            >
              <div className="flex items-center gap-1">
                <span className="text-xs font-medium text-gray-700 uppercase tracking-wide">
                  Name
                </span>
                <SortIcon column="name" sortBy={sortBy} sortOrder={sortOrder} />
              </div>
            </th>
            <th
              className="py-3 px-4 text-left cursor-pointer hover:bg-gray-100 transition-colors select-none"
              onClick={() => onSort('modified')}
            >
              <div className="flex items-center gap-1">
                <span className="text-xs font-medium text-gray-700 uppercase tracking-wide">
                  Modified
                </span>
                <SortIcon column="modified" sortBy={sortBy} sortOrder={sortOrder} />
              </div>
            </th>
            <th
              className="py-3 px-4 text-left cursor-pointer hover:bg-gray-100 transition-colors select-none"
              onClick={() => onSort('size')}
            >
              <div className="flex items-center gap-1">
                <span className="text-xs font-medium text-gray-700 uppercase tracking-wide">
                  Size
                </span>
                <SortIcon column="size" sortBy={sortBy} sortOrder={sortOrder} />
              </div>
            </th>
            <th
              className="py-3 px-4 text-left cursor-pointer hover:bg-gray-100 transition-colors select-none"
              onClick={() => onSort('type')}
            >
              <div className="flex items-center gap-1">
                <span className="text-xs font-medium text-gray-700 uppercase tracking-wide">
                  Type
                </span>
                <SortIcon column="type" sortBy={sortBy} sortOrder={sortOrder} />
              </div>
            </th>
            <th className="w-16 py-3 px-4"></th>
          </tr>
        </thead>
        <tbody>
          {allItems.map((item) => {
            const selected = isSelected(item.id);

            if (item.type === 'folder') {
              const folder = item.data as R2Folder;
              return (
                <tr
                  key={item.id}
                  className={`
                    group border-b border-gray-200
                    transition-colors
                    cursor-pointer
                    ${selected ? 'bg-blue-50' : 'hover:bg-gray-50'}
                  `}
                  onClick={(e) => handleItemClick(item.id, e)}
                  onDoubleClick={() => handleItemDoubleClick(item)}
                  onContextMenu={(e) => onContextMenu(e, folder)}
                >
                  <td className="py-3 px-4">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleCheckboxChange(item.id, e.target.checked);
                      }}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <Folder className="w-5 h-5 text-amber-500 flex-shrink-0" strokeWidth={1.5} />
                      <span className="text-sm text-gray-900 font-medium">{folder.name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600">
                    {formatDate(folder.created_at)}
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-500">-</td>
                  <td className="py-3 px-4 text-sm text-gray-600">Folder</td>
                  <td className="py-3 px-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onContextMenu(e, folder);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-gray-200 transition-all"
                      aria-label="More actions"
                    >
                      <MoreVertical className="w-4 h-4 text-gray-600" />
                    </button>
                  </td>
                </tr>
              );
            }

            // File row
            const file = item.data as R2File;
            const { Icon, color } = getFileIcon(file.mime_type);

            return (
              <tr
                key={item.id}
                className={`
                  group border-b border-gray-200
                  transition-colors
                  cursor-pointer
                  ${selected ? 'bg-blue-50' : 'hover:bg-gray-50'}
                `}
                onClick={(e) => handleItemClick(item.id, e)}
                onDoubleClick={() => handleItemDoubleClick(item)}
                onContextMenu={(e) => onContextMenu(e, file)}
              >
                <td className="py-3 px-4">
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={(e) => {
                      e.stopPropagation();
                      handleCheckboxChange(item.id, e.target.checked);
                    }}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    onClick={(e) => e.stopPropagation()}
                  />
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    <Icon className={`w-5 h-5 ${color} flex-shrink-0`} strokeWidth={1.5} />
                    <span className="text-sm text-gray-900" title={file.display_name}>
                      {file.display_name}
                    </span>
                  </div>
                </td>
                <td className="py-3 px-4 text-sm text-gray-600">
                  {formatDate(file.created_at)}
                </td>
                <td className="py-3 px-4 text-sm text-gray-600">
                  {formatFileSize(file.file_size)}
                </td>
                <td className="py-3 px-4 text-sm text-gray-600">
                  {getMimeTypeDisplay(file.mime_type)}
                </td>
                <td className="py-3 px-4">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onContextMenu(e, file);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-gray-200 transition-all"
                    aria-label="More actions"
                  >
                    <MoreVertical className="w-4 h-4 text-gray-600" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {allItems.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20">
          <Folder className="w-16 h-16 text-gray-300 mb-4" strokeWidth={1.5} />
          <p className="text-base text-gray-500 font-medium">This folder is empty</p>
          <p className="text-sm text-gray-400 mt-1">
            Upload files or create folders to get started
          </p>
        </div>
      )}
    </div>
  );
}
