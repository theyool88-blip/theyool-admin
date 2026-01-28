'use client';

import React from 'react';
import {
  File,
  FileText,
  Image,
  FileSpreadsheet,
  Folder,
  Download,
  Trash2,
  MoreVertical,
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
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function truncateFilename(name: string, maxLength = 30): string {
  if (name.length <= maxLength) return name;
  const ext = name.split('.').pop() || '';
  const nameWithoutExt = name.slice(0, name.length - ext.length - 1);
  const truncated = nameWithoutExt.slice(0, maxLength - ext.length - 4);
  return `${truncated}...${ext}`;
}

export default function FileGrid({
  files,
  folders,
  selectedIds,
  onSelect,
  onFolderOpen,
  onFileOpen,
  onContextMenu,
}: FileViewProps) {
  const allItems = [
    ...folders.map((f) => ({ type: 'folder' as const, data: f, id: f.id })),
    ...files.map((f) => ({ type: 'file' as const, data: f, id: f.id })),
  ];

  const isSelected = (id: string) => selectedIds.includes(id);

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

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 p-6">
      {allItems.map((item) => {
        const selected = isSelected(item.id);

        if (item.type === 'folder') {
          const folder = item.data as R2Folder;
          return (
            <div
              key={item.id}
              className={`
                group relative
                border-3 border-slate-900 bg-warning-50
                transition-all duration-200
                cursor-pointer
                ${selected ? 'ring-4 ring-sage-500 translate-y-[-4px]' : 'hover:translate-y-[-2px]'}
              `}
              onClick={(e) => handleItemClick(item.id, e)}
              onDoubleClick={() => handleItemDoubleClick(item)}
              onContextMenu={(e) => onContextMenu(e, folder)}
            >
              {/* Selection Checkbox */}
              <div className="absolute top-2 left-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={(e) => {
                    e.stopPropagation();
                    handleCheckboxChange(item.id, e.target.checked);
                  }}
                  className="w-5 h-5 border-3 border-slate-900 rounded-none accent-sage-600 cursor-pointer"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>

              {/* Icon Area */}
              <div className="flex items-center justify-center h-32 border-b-3 border-slate-900 bg-warning-100">
                <Folder className="w-16 h-16 text-warning-600" strokeWidth={2.5} />
              </div>

              {/* Name Area */}
              <div className="p-3 bg-warning-50">
                <p className="text-sm font-bold text-slate-900 line-clamp-2 leading-tight">
                  {folder.name}
                </p>
              </div>

              {/* Quick Actions */}
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onContextMenu(e, folder);
                  }}
                  className="p-1.5 bg-slate-900 text-warning-50 border-2 border-slate-900 hover:bg-slate-800 transition-colors"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        }

        // File item
        const file = item.data as R2File;
        const { Icon, color } = getFileIcon(file.mime_type);

        return (
          <div
            key={item.id}
            className={`
              group relative
              border-3 border-slate-900 bg-white
              transition-all duration-200
              cursor-pointer
              ${selected ? 'ring-4 ring-sage-500 translate-y-[-4px]' : 'hover:translate-y-[-2px]'}
            `}
            onClick={(e) => handleItemClick(item.id, e)}
            onDoubleClick={() => handleItemDoubleClick(item)}
            onContextMenu={(e) => onContextMenu(e, file)}
          >
            {/* Selection Checkbox */}
            <div className="absolute top-2 left-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
              <input
                type="checkbox"
                checked={selected}
                onChange={(e) => {
                  e.stopPropagation();
                  handleCheckboxChange(item.id, e.target.checked);
                }}
                className="w-5 h-5 border-3 border-slate-900 rounded-none accent-sage-600 cursor-pointer"
                onClick={(e) => e.stopPropagation()}
              />
            </div>

            {/* Icon Area */}
            <div className="flex flex-col items-center justify-center h-32 border-b-3 border-slate-900 bg-slate-50">
              <Icon className={`w-14 h-14 ${color} mb-2`} strokeWidth={2.5} />
              {file.file_size && (
                <span className="text-xs font-bold text-slate-600 bg-slate-900 text-white px-2 py-0.5 border-2 border-slate-900">
                  {formatFileSize(file.file_size)}
                </span>
              )}
            </div>

            {/* Name Area */}
            <div className="p-3 bg-white">
              <p
                className="text-sm font-bold text-slate-900 line-clamp-2 leading-tight"
                title={file.display_name}
              >
                {truncateFilename(file.display_name)}
              </p>
            </div>

            {/* Quick Actions */}
            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onFileOpen(file);
                }}
                className="p-1.5 bg-info-500 text-white border-2 border-slate-900 hover:bg-info-600 transition-colors"
                title="Download"
              >
                <Download className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onContextMenu(e, file);
                }}
                className="p-1.5 bg-slate-900 text-white border-2 border-slate-900 hover:bg-slate-800 transition-colors"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
            </div>
          </div>
        );
      })}

      {allItems.length === 0 && (
        <div className="col-span-full flex flex-col items-center justify-center py-16">
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
