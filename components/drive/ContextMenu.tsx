'use client';

import React, { useEffect, useRef } from 'react';
import {
  Eye,
  Download,
  Edit,
  FolderInput,
  Trash2,
  FolderOpen,
  FolderPlus,
  Upload,
} from 'lucide-react';

interface ContextMenuProps {
  x: number;
  y: number;
  type: 'file' | 'folder' | 'empty';
  itemId?: string;
  itemName?: string;
  onClose: () => void;
  onAction: (action: string, itemId?: string) => void;
}

interface MenuItem {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  action: string;
  variant?: 'default' | 'danger';
  separator?: boolean;
}

const fileMenuItems: MenuItem[] = [
  { label: '미리보기', icon: Eye, action: 'preview' },
  { label: '다운로드', icon: Download, action: 'download' },
  { label: '이름 변경', icon: Edit, action: 'rename' },
  { label: '이동', icon: FolderInput, action: 'move' },
  { label: '', icon: Trash2, action: '', separator: true },
  { label: '삭제', icon: Trash2, action: 'delete', variant: 'danger' },
];

const folderMenuItems: MenuItem[] = [
  { label: '열기', icon: FolderOpen, action: 'open' },
  { label: '새 폴더', icon: FolderPlus, action: 'newFolder' },
  { label: '이름 변경', icon: Edit, action: 'rename' },
  { label: '', icon: Trash2, action: '', separator: true },
  { label: '삭제', icon: Trash2, action: 'delete', variant: 'danger' },
];

const emptyMenuItems: MenuItem[] = [
  { label: '새 폴더', icon: FolderPlus, action: 'newFolder' },
  { label: '파일 업로드', icon: Upload, action: 'upload' },
];

export default function ContextMenu({
  x,
  y,
  type,
  itemId,
  itemName,
  onClose,
  onAction,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Determine which menu items to show
  const menuItems =
    type === 'file' ? fileMenuItems : type === 'folder' ? folderMenuItems : emptyMenuItems;

  // Handle clicks outside the menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Handle ESC key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Adjust position to keep menu within viewport
  useEffect(() => {
    if (!menuRef.current) return;

    const menu = menuRef.current;
    const rect = menu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let adjustedX = x;
    let adjustedY = y;

    // Adjust horizontal position
    if (x + rect.width > viewportWidth) {
      adjustedX = viewportWidth - rect.width - 10;
    }

    // Adjust vertical position
    if (y + rect.height > viewportHeight) {
      adjustedY = viewportHeight - rect.height - 10;
    }

    menu.style.left = `${adjustedX}px`;
    menu.style.top = `${adjustedY}px`;
  }, [x, y]);

  const handleMenuItemClick = (action: string) => {
    onAction(action, itemId);
    onClose();
  };

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[200px] bg-white border border-gray-200 rounded-lg shadow-lg py-1"
      style={{ left: x, top: y }}
    >
      {menuItems.map((item, index) => {
        if (item.separator) {
          return <div key={`separator-${index}`} className="my-1 border-t border-gray-200" />;
        }

        const Icon = item.icon;
        const isDanger = item.variant === 'danger';

        return (
          <button
            key={item.action}
            onClick={() => handleMenuItemClick(item.action)}
            className={`
              w-full flex items-center gap-3 px-4 py-2.5
              text-sm font-medium
              transition-colors duration-150
              ${
                isDanger
                  ? 'text-red-600 hover:bg-red-50'
                  : 'text-gray-700 hover:bg-gray-100'
              }
            `}
          >
            <Icon className={`w-4 h-4 ${isDanger ? 'text-red-600' : 'text-gray-500'}`} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
