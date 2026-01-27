'use client';

import { useState, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Loader2, CheckCircle2 } from 'lucide-react';
import '@uiw/react-md-editor/markdown-editor.css';
import '@uiw/react-markdown-preview/markdown.css';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MDEditor = dynamic(
  () => import('@uiw/react-md-editor').then((mod) => mod.default),
  { ssr: false }
) as any;

interface UploadResult {
  url: string;
  compressionRatio: string;
  width: number;
  height: number;
}

interface MarkdownEditorWithUploadProps {
  value: string;
  onChange: (value: string) => void;
  height?: number;
  folder?: string;
  preview?: 'edit' | 'live' | 'preview';
}

export default function MarkdownEditorWithUpload({
  value,
  onChange,
  height = 400,
  folder = 'content',
  preview = 'live',
}: MarkdownEditorWithUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const messageTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showUploadMessage = (message: string) => {
    if (messageTimeoutRef.current) {
      clearTimeout(messageTimeoutRef.current);
    }
    setUploadMessage(message);
    messageTimeoutRef.current = setTimeout(() => {
      setUploadMessage(null);
    }, 3000);
  };

  const uploadImage = async (file: File): Promise<UploadResult | null> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', folder);

    try {
      const response = await fetch('/api/admin/homepage/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      if (result.success) {
        return {
          url: result.data.url,
          compressionRatio: result.data.compressionRatio,
          width: result.data.width,
          height: result.data.height,
        };
      } else {
        alert(result.error || '이미지 업로드 실패');
        return null;
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('이미지 업로드 중 오류가 발생했습니다.');
      return null;
    }
  };

  const insertImage = (url: string, altText: string = '이미지') => {
    const imageMarkdown = `![${altText}](${url})`;
    const newValue = value ? `${value}\n\n${imageMarkdown}` : imageMarkdown;
    onChange(newValue);
  };

  const handleFiles = async (files: FileList) => {
    const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));

    if (imageFiles.length === 0) {
      alert('이미지 파일만 업로드할 수 있습니다.');
      return;
    }

    setUploading(true);

    for (const file of imageFiles) {
      const result = await uploadImage(file);
      if (result) {
        const altText = file.name.replace(/\.[^/.]+$/, ''); // 확장자 제거
        insertImage(result.url, altText);

        // 최적화 정보 메시지 표시
        if (result.compressionRatio !== '0%') {
          showUploadMessage(`이미지 최적화 완료: ${result.width}×${result.height}, ${result.compressionRatio} 압축`);
        } else {
          showUploadMessage(`이미지 업로드 완료: ${result.width}×${result.height}`);
        }
      }
    }

    setUploading(false);
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFiles(files);
    }
  }, [value, folder]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    const imageItems = Array.from(items).filter(item => item.type.startsWith('image/'));

    if (imageItems.length > 0) {
      e.preventDefault();
      const files = imageItems
        .map(item => item.getAsFile())
        .filter((file): file is File => file !== null);

      if (files.length > 0) {
        (async () => {
          setUploading(true);
          for (const file of files) {
            const result = await uploadImage(file);
            if (result) {
              insertImage(result.url, 'pasted-image');

              // 최적화 정보 메시지 표시
              if (result.compressionRatio !== '0%') {
                showUploadMessage(`이미지 최적화 완료: ${result.width}×${result.height}, ${result.compressionRatio} 압축`);
              } else {
                showUploadMessage(`이미지 업로드 완료: ${result.width}×${result.height}`);
              }
            }
          }
          setUploading(false);
        })();
      }
    }
  }, [value, folder]);

  return (
    <div
      ref={containerRef}
      className="relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onPaste={handlePaste}
    >
      {/* 드래그 오버레이 */}
      {dragOver && (
        <div className="absolute inset-0 z-10 bg-[var(--sage-muted)]/90 border-2 border-dashed border-[var(--sage-primary)] rounded-lg flex items-center justify-center">
          <div className="text-center">
            <p className="text-lg font-medium text-[var(--sage-primary)]">
              이미지를 여기에 놓으세요
            </p>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              JPG, PNG, GIF, WebP 지원
            </p>
          </div>
        </div>
      )}

      {/* 업로드 중 오버레이 */}
      {uploading && (
        <div className="absolute inset-0 z-10 bg-[var(--bg-primary)]/80 rounded-lg flex items-center justify-center">
          <div className="flex items-center gap-2 text-[var(--sage-primary)]">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>이미지 업로드 중...</span>
          </div>
        </div>
      )}

      <MDEditor
        value={value}
        onChange={(val: string | undefined) => onChange(val || '')}
        height={height}
        preview={preview}
      />

      {/* 업로드 성공 메시지 */}
      {uploadMessage && (
        <div className="mt-2 flex items-center gap-2 text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-3 py-2 rounded-md">
          <CheckCircle2 className="w-4 h-4" />
          <span>{uploadMessage}</span>
        </div>
      )}

      <p className="mt-2 text-xs text-[var(--text-muted)]">
        💡 이미지를 드래그하거나 붙여넣기(Ctrl+V)하면 자동으로 업로드됩니다. (WebP 자동 변환)
      </p>
    </div>
  );
}
