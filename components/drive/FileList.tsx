'use client';

import React, { useEffect, useRef } from 'react';
import {
  File,
  FileText,
  Image,
  FileSpreadsheet,
  Folder,
  Download,
  Trash2,
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
  if (!mimeType) return { Icon: File, color: 'text-slate-400' };

  if (mimeType === 'application/pdf') {
    return { Icon: FileText, color: 'text-danger-500' };
  }
  if (mimeType.startsWith('image/')) {
    return { Icon: Image, color: 'text-info-500' };
  }
  if (
    mimeType === 'application/msword' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return { Icon: FileText, color: 'text-info-600' };
  }
  if (
    mimeType === 'application/vnd.ms-excel' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ) {
    return { Icon: FileSpreadsheet, color: 'text-success-500' };
  }
  if (mimeType === 'application/hwp') {
    return { Icon: FileText, color: 'text-warning-500' };
  }

  return { Icon: File, color: 'text-slate-400' };
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

  const allItems = [
    ...folders.map((f) => ({ type: 'folder' as const, data: f, id: f.id })),
    ...files.map((f) => ({ type: 'file' as const, data: f, id: f.id })),
  ];

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

  const handleItemDoubleClick = (item: (typeof allItems)[0]) => {
    if (item.type === 'folder') {
      onFolderOpen(item.id);
    } else {
      onFileOpen(item.data as R2File);
    }
  };

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
  }, [selectedIds, allItems, onSelect]);

  const SortIcon = ({ column }: { column: string }) => {
    if (sortBy !== column) return null;
    return sortOrder === 'asc' ? (
      <ChevronUp className="w-4 h-4 inline-block ml-1" />
    ) : (
      <ChevronDown className="w-4 h-4 inline-block ml-1" />
    );
  };

  return (
    <div className="overflow-x-auto border-3 border-slate-900 bg-white">
      <table ref={tableRef} className="w-full border-collapse">
        <thead>
          <tr className="bg-slate-900 text-white">
            <th className="w-12 p-3 text-left border-r-2 border-slate-700">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={handleSelectAll}
                className="w-5 h-5 border-2 border-white rounded-none accent-sage-400 cursor-pointer"
              />
            </th>
            <th className="w-12 p-3 text-left border-r-2 border-slate-700">
              <span className="text-xs font-bold tracking-wider">TYPE</span>
            </th>
            <th
              className="p-3 text-left border-r-2 border-slate-700 cursor-pointer hover:bg-slate-800 transition-colors"
              onClick={() => onSort('name')}
            >
              <span className="text-xs font-bold tracking-wider">
                NAME <SortIcon column="name" />
              </span>
            </th>
            <th
              className="p-3 text-left border-r-2 border-slate-700 cursor-pointer hover:bg-slate-800 transition-colors"
              onClick={() => onSort('type')}
            >
              <span className="text-xs font-bold tracking-wider">
                FILE TYPE <SortIcon column="type" />
              </span>
            </th>
            <th
              className="p-3 text-left border-r-2 border-slate-700 cursor-pointer hover:bg-slate-800 transition-colors"
              onClick={() => onSort('size')}
            >
              <span className="text-xs font-bold tracking-wider">
                SIZE <SortIcon column="size" />
              </span>
            </th>
            <th
              className="p-3 text-left border-r-2 border-slate-700 cursor-pointer hover:bg-slate-800 transition-colors"
              onClick={() => onSort('modified')}
            >
              <span className="text-xs font-bold tracking-wider">
                MODIFIED <SortIcon column="modified" />
              </span>
            </th>
            <th className="w-24 p-3 text-center">
              <span className="text-xs font-bold tracking-wider">ACTIONS</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {allItems.map((item, index) => {
            const selected = isSelected(item.id);

            if (item.type === 'folder') {
              const folder = item.data as R2Folder;
              return (
                <tr
                  key={item.id}
                  className={`
                    group border-b-2 border-slate-200
                    transition-all duration-150
                    cursor-pointer
                    ${selected ? 'bg-sage-100 border-sage-400' : 'hover:bg-slate-50'}
                  `}
                  onClick={(e) => handleItemClick(item.id, e)}
                  onDoubleClick={() => handleItemDoubleClick(item)}
                  onContextMenu={(e) => onContextMenu(e, folder)}
                >
                  <td className="p-3 border-r-2 border-slate-200">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleCheckboxChange(item.id, e.target.checked);
                      }}
                      className="w-5 h-5 border-2 border-slate-900 rounded-none accent-sage-600 cursor-pointer"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                  <td className="p-3 border-r-2 border-slate-200">
                    <Folder className="w-6 h-6 text-warning-600" strokeWidth={2.5} />
                  </td>
                  <td className="p-3 border-r-2 border-slate-200">
                    <span className="font-bold text-slate-900">{folder.name}</span>
                  </td>
                  <td className="p-3 border-r-2 border-slate-200">
                    <span className="text-sm font-bold text-warning-700 bg-warning-100 px-2 py-1 border-2 border-warning-600">
                      FOLDER
                    </span>
                  </td>
                  <td className="p-3 border-r-2 border-slate-200 text-slate-500 text-sm">-</td>
                  <td className="p-3 border-r-2 border-slate-200 text-slate-700 text-sm">
                    {formatDate(folder.created_at)}
                  </td>
                  <td className="p-3 text-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onContextMenu(e, folder);
                      }}
                      className="p-1.5 border-2 border-slate-900 bg-white hover:bg-slate-900 hover:text-white transition-colors"
                    >
                      <MoreVertical className="w-4 h-4" />
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
                  group border-b-2 border-slate-200
                  transition-all duration-150
                  cursor-pointer
                  ${selected ? 'bg-sage-100 border-sage-400' : 'hover:bg-slate-50'}
                `}
                onClick={(e) => handleItemClick(item.id, e)}
                onDoubleClick={() => handleItemDoubleClick(item)}
                onContextMenu={(e) => onContextMenu(e, file)}
              >
                <td className="p-3 border-r-2 border-slate-200">
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={(e) => {
                      e.stopPropagation();
                      handleCheckboxChange(item.id, e.target.checked);
                    }}
                    className="w-5 h-5 border-2 border-slate-900 rounded-none accent-sage-600 cursor-pointer"
                    onClick={(e) => e.stopPropagation()}
                  />
                </td>
                <td className="p-3 border-r-2 border-slate-200">
                  <Icon className={`w-6 h-6 ${color}`} strokeWidth={2.5} />
                </td>
                <td className="p-3 border-r-2 border-slate-200">
                  <span className="font-bold text-slate-900" title={file.display_name}>
                    {file.display_name}
                  </span>
                </td>
                <td className="p-3 border-r-2 border-slate-200">
                  <span className="text-sm font-bold text-slate-700 bg-slate-100 px-2 py-1 border-2 border-slate-300">
                    {getMimeTypeDisplay(file.mime_type)}
                  </span>
                </td>
                <td className="p-3 border-r-2 border-slate-200 text-slate-700 text-sm font-medium">
                  {formatFileSize(file.file_size)}
                </td>
                <td className="p-3 border-r-2 border-slate-200 text-slate-700 text-sm">
                  {formatDate(file.created_at)}
                </td>
                <td className="p-3 text-center">
                  <div className="flex gap-1 justify-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onFileOpen(file);
                      }}
                      className="p-1.5 border-2 border-info-500 bg-info-500 text-white hover:bg-info-600 hover:border-info-600 transition-colors"
                      title="Download"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onContextMenu(e, file);
                      }}
                      className="p-1.5 border-2 border-slate-900 bg-white hover:bg-slate-900 hover:text-white transition-colors"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {allItems.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 border-t-3 border-slate-900">
          <div className="border-4 border-dashed border-slate-300 p-12 bg-slate-50">
            <Folder className="w-16 h-16 text-slate-300 mx-auto mb-4" strokeWidth={2} />
            <p className="text-lg font-bold text-slate-400 text-center">NO FILES YET</p>
            <p className="text-sm text-slate-400 text-center mt-2">
              Upload files or create folders to get started
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
