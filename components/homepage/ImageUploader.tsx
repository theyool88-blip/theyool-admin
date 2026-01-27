'use client';

import { useState, useCallback, useRef } from 'react';
import { Upload, X, Image as ImageIcon, Loader2 } from 'lucide-react';

interface UploadResult {
  url: string;
  originalSize: number;
  optimizedSize: number;
  compressionRatio: string;
  width: number;
  height: number;
}

interface ImageUploaderProps {
  value?: string;
  onChange: (url: string) => void;
  folder?: string;
  className?: string;
  showOptimizationInfo?: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function ImageUploader({
  value,
  onChange,
  folder = 'general',
  className = '',
  showOptimizationInfo = true
}: ImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [optimizationInfo, setOptimizationInfo] = useState<UploadResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadFile = async (file: File) => {
    setError(null);
    setOptimizationInfo(null);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', folder);

      const response = await fetch('/api/admin/homepage/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        onChange(result.data.url);
        setOptimizationInfo({
          url: result.data.url,
          originalSize: result.data.originalSize,
          optimizedSize: result.data.optimizedSize,
          compressionRatio: result.data.compressionRatio,
          width: result.data.width,
          height: result.data.height,
        });
      } else {
        setError(result.error || '업로드 실패');
      }
    } catch (err) {
      console.error('Upload error:', err);
      setError('업로드 중 오류가 발생했습니다.');
    } finally {
      setUploading(false);
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.type.startsWith('image/')) {
        uploadFile(file);
      } else {
        setError('이미지 파일만 업로드할 수 있습니다.');
      }
    }
  }, [folder]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      uploadFile(files[0]);
    }
  };

  const handleRemove = () => {
    onChange('');
    setError(null);
    setOptimizationInfo(null);
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className={className}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {value ? (
        // 이미지 미리보기
        <div className="space-y-2">
          <div className="relative group">
            <div className="relative aspect-video rounded-lg overflow-hidden bg-[var(--bg-tertiary)] border border-[var(--border-subtle)]">
              <img
                src={value}
                alt="업로드된 이미지"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={handleClick}
                  className="px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white text-sm rounded-md transition-colors"
                >
                  변경
                </button>
                <button
                  type="button"
                  onClick={handleRemove}
                  className="px-3 py-1.5 bg-red-500/80 hover:bg-red-500 text-white text-sm rounded-md transition-colors"
                >
                  삭제
                </button>
              </div>
            </div>
          </div>
          {/* 최적화 정보 표시 */}
          {showOptimizationInfo && optimizationInfo && (
            <div className="flex items-center gap-3 text-xs text-[var(--text-muted)] bg-[var(--bg-tertiary)] px-3 py-2 rounded-md">
              <span>{optimizationInfo.width} × {optimizationInfo.height}</span>
              <span className="text-[var(--border-default)]">•</span>
              <span>{formatFileSize(optimizationInfo.optimizedSize)}</span>
              {optimizationInfo.compressionRatio !== '0%' && (
                <>
                  <span className="text-[var(--border-default)]">•</span>
                  <span className="text-green-600 dark:text-green-400">
                    {optimizationInfo.compressionRatio} 압축
                  </span>
                </>
              )}
            </div>
          )}
        </div>
      ) : (
        // 업로드 영역
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleClick}
          className={`
            relative border-2 border-dashed rounded-lg p-6 cursor-pointer transition-all
            ${isDragging
              ? 'border-[var(--sage-primary)] bg-[var(--sage-muted)]'
              : 'border-[var(--border-default)] hover:border-[var(--sage-primary)] hover:bg-[var(--bg-hover)]'
            }
          `}
        >
          <div className="flex flex-col items-center justify-center gap-2 text-center">
            {uploading ? (
              <>
                <Loader2 className="w-8 h-8 text-[var(--sage-primary)] animate-spin" />
                <p className="text-sm text-[var(--text-secondary)]">업로드 중...</p>
              </>
            ) : (
              <>
                <div className="w-12 h-12 rounded-full bg-[var(--sage-muted)] flex items-center justify-center">
                  {isDragging ? (
                    <Upload className="w-6 h-6 text-[var(--sage-primary)]" />
                  ) : (
                    <ImageIcon className="w-6 h-6 text-[var(--sage-primary)]" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">
                    {isDragging ? '여기에 놓으세요' : '클릭하거나 드래그하여 업로드'}
                  </p>
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    JPG, PNG, GIF, WebP (최대 10MB, 자동 최적화)
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {error && (
        <p className="mt-2 text-xs text-[var(--color-danger)]">{error}</p>
      )}
    </div>
  );
}
