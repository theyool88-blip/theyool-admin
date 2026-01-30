'use client';

import React, { useState } from 'react';
import {
  File,
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  Folder,
  MoreVertical,
  FilePlus,
} from 'lucide-react';
import type { R2File, R2Folder } from '@/lib/r2/storage-service';

interface FileGridProps {
  files: R2File[];
  folders: R2Folder[];
  selectedIds: Set<string>;
  onSelect: (id: string, multi?: boolean) => void;
  onDoubleClick: (file: R2File) => void;
  onFolderOpen: (folderId: string) => void;
  onContextMenu: (e: React.MouseEvent, item: R2File | R2Folder, type: 'file' | 'folder') => void;
}

function getFileIcon(mimeType: string | null) {
  if (!mimeType) return { Icon: File, color: 'text-gray-400' };

  if (mimeType === 'application/pdf') {
    return { Icon: FileText, color: 'text-red-500' };
  }
  if (mimeType.startsWith('image/')) {
    return { Icon: ImageIcon, color: 'text-blue-500' };
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
    return { Icon: FileSpreadsheet, color: 'text-green-500' };
  }
  if (mimeType === 'application/hwp') {
    return { Icon: FileText, color: 'text-orange-500' };
  }

  return { Icon: File, color: 'text-gray-400' };
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

export default function FileGrid({
  files,
  folders,
  selectedIds,
  onSelect,
  onDoubleClick,
  onFolderOpen,
  onContextMenu,
}: FileGridProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const allItems = [
    ...folders.map((f) => ({ type: 'folder' as const, data: f, id: f.id })),
    ...files.map((f) => ({ type: 'file' as const, data: f, id: f.id })),
  ];

  const isSelected = (id: string) => selectedIds.has(id);

  const handleItemClick = (id: string, event: React.MouseEvent) => {
    const multi = event.metaKey || event.ctrlKey || event.shiftKey;
    onSelect(id, multi);
  };

  const handleItemDoubleClick = (item: (typeof allItems)[0]) => {
    if (item.type === 'folder') {
      onFolderOpen(item.id);
    } else {
      onDoubleClick(item.data as R2File);
    }
  };

  const handleCheckboxChange = (id: string, checked: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(id, true);
  };

  return (
    <div className="p-6">
      {allItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24">
          <div className="text-center space-y-4">
            <div className="w-24 h-24 mx-auto bg-gray-50 rounded-full flex items-center justify-center">
              <FilePlus className="w-12 h-12 text-gray-300" strokeWidth={1.5} />
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-1">No files or folders</h3>
              <p className="text-sm text-gray-500">
                Upload files or create a folder to get started
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4">
          {allItems.map((item) => {
            const selected = isSelected(item.id);
            const hovered = hoveredId === item.id;

            if (item.type === 'folder') {
              const folder = item.data as R2Folder;
              return (
                <div
                  key={item.id}
                  className={`
                    group relative
                    bg-white border border-gray-200 rounded-lg
                    transition-all duration-200 ease-out
                    cursor-pointer select-none
                    ${selected ? 'border-blue-500 bg-blue-50 shadow-sm' : 'hover:shadow-md hover:scale-[1.02]'}
                  `}
                  onClick={(e) => handleItemClick(item.id, e)}
                  onDoubleClick={() => handleItemDoubleClick(item)}
                  onContextMenu={(e) => onContextMenu(e, folder, 'folder')}
                  onMouseEnter={() => setHoveredId(item.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  draggable
                >
                  {/* Checkbox (visible on hover or when selected) */}
                  <div
                    className={`
                      absolute top-2 left-2 z-10
                      transition-opacity duration-200
                      ${hovered || selected ? 'opacity-100' : 'opacity-0'}
                    `}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={(e) => handleCheckboxChange(item.id, e.target.checked, e as any)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                  </div>

                  {/* Thumbnail Area */}
                  <div className="flex items-center justify-center h-[120px] bg-gradient-to-br from-gray-50 to-gray-100 rounded-t-lg">
                    <Folder className="w-16 h-16 text-gray-400" strokeWidth={1.5} />
                  </div>

                  {/* Name Area */}
                  <div className="p-3">
                    <p
                      className="text-sm text-gray-900 line-clamp-2 leading-tight"
                      title={folder.name}
                    >
                      {folder.name}
                    </p>
                  </div>

                  {/* Context Menu Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onContextMenu(e, folder, 'folder');
                    }}
                    className={`
                      absolute top-2 right-2
                      p-1.5 rounded-full
                      bg-white/90 hover:bg-white
                      border border-gray-200
                      transition-opacity duration-200
                      ${hovered ? 'opacity-100' : 'opacity-0'}
                    `}
                  >
                    <MoreVertical className="w-4 h-4 text-gray-600" />
                  </button>
                </div>
              );
            }

            // File item
            const file = item.data as R2File;
            const { Icon, color } = getFileIcon(file.mime_type);
            const isImage = file.mime_type?.startsWith('image/');

            return (
              <div
                key={item.id}
                className={`
                  group relative
                  bg-white border border-gray-200 rounded-lg
                  transition-all duration-200 ease-out
                  cursor-pointer select-none
                  ${selected ? 'border-blue-500 bg-blue-50 shadow-sm' : 'hover:shadow-md hover:scale-[1.02]'}
                `}
                onClick={(e) => handleItemClick(item.id, e)}
                onDoubleClick={() => handleItemDoubleClick(item)}
                onContextMenu={(e) => onContextMenu(e, file, 'file')}
                onMouseEnter={() => setHoveredId(item.id)}
                onMouseLeave={() => setHoveredId(null)}
                draggable
              >
                {/* Checkbox (visible on hover or when selected) */}
                <div
                  className={`
                    absolute top-2 left-2 z-10
                    transition-opacity duration-200
                    ${hovered || selected ? 'opacity-100' : 'opacity-0'}
                  `}
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={(e) => handleCheckboxChange(item.id, e.target.checked, e as any)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </div>

                {/* Thumbnail Area */}
                <div className="flex items-center justify-center h-[120px] bg-gradient-to-br from-gray-50 to-gray-100 rounded-t-lg relative overflow-hidden">
                  <Icon className={`w-12 h-12 ${color}`} strokeWidth={1.5} />

                  {/* File size badge */}
                  {file.file_size && (
                    <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/70 rounded text-xs text-white font-medium">
                      {formatFileSize(file.file_size)}
                    </div>
                  )}
                </div>

                {/* Name Area */}
                <div className="p-3">
                  <p
                    className="text-sm text-gray-900 line-clamp-2 leading-tight"
                    title={file.display_name}
                  >
                    {file.display_name}
                  </p>
                </div>

                {/* Context Menu Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onContextMenu(e, file, 'file');
                  }}
                  className={`
                    absolute top-2 right-2
                    p-1.5 rounded-full
                    bg-white/90 hover:bg-white
                    border border-gray-200
                    transition-opacity duration-200
                    ${hovered ? 'opacity-100' : 'opacity-0'}
                  `}
                >
                  <MoreVertical className="w-4 h-4 text-gray-600" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
