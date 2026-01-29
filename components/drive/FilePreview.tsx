'use client';

import { useEffect, useState } from 'react';
import { X, Download, ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from 'lucide-react';
import { R2File } from '@/lib/r2/storage-service';

interface FilePreviewProps {
  file: R2File | null;
  isOpen: boolean;
  onClose: () => void;
  onDownload?: () => void;
  onNavigate?: (direction: 'prev' | 'next') => void;
  canNavigate?: { prev: boolean; next: boolean };
}

export default function FilePreview({
  file,
  isOpen,
  onClose,
  onDownload,
  onNavigate,
  canNavigate = { prev: false, next: false },
}: FilePreviewProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageZoom, setImageZoom] = useState(100);
  const [loading, setLoading] = useState(false);

  // Fetch preview URL when file changes
  useEffect(() => {
    if (!file || !isOpen) {
      setPreviewUrl(null);
      setImageZoom(100);
      return;
    }

    const fetchPreviewUrl = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/drive/files/${file.id}`);
        if (response.ok) {
          const data = await response.json();
          setPreviewUrl(data.downloadUrl);
        }
      } catch (error) {
        console.error('Failed to fetch preview URL:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPreviewUrl();
  }, [file, isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen || !file) return null;

  const fileType = getFileType(file.mime_type || '');
  const fileSize = formatFileSize(file.file_size || 0);
  const modifiedDate = new Date(file.updated_at).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const handleZoomIn = () => setImageZoom((prev) => Math.min(prev + 25, 200));
  const handleZoomOut = () => setImageZoom((prev) => Math.max(prev - 25, 50));

  const handleDownload = () => {
    if (previewUrl && onDownload) {
      onDownload();
    } else if (previewUrl) {
      // Fallback download
      const a = document.createElement('a');
      a.href = previewUrl;
      a.download = file.original_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/95 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="relative z-10 flex h-full w-full max-w-7xl flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 bg-black/40 px-6 py-4 backdrop-blur-md">
          <div className="flex items-center gap-4">
            {/* Navigation */}
            {canNavigate && onNavigate && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onNavigate('prev')}
                  disabled={!canNavigate.prev}
                  className="rounded-lg p-2 transition-all hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent"
                  aria-label="Previous file"
                >
                  <ChevronLeft className="h-5 w-5 text-white" />
                </button>
                <button
                  onClick={() => onNavigate('next')}
                  disabled={!canNavigate.next}
                  className="rounded-lg p-2 transition-all hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent"
                  aria-label="Next file"
                >
                  <ChevronRight className="h-5 w-5 text-white" />
                </button>
                <div className="mx-2 h-6 w-px bg-white/20" />
              </div>
            )}

            {/* File Name */}
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30">
                <span className="text-sm font-bold text-blue-300">
                  {getFileExtension(file.original_name)}
                </span>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">
                  {file.display_name}
                </h2>
                <p className="text-sm text-gray-400">{fileType}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Zoom Controls (for images) */}
            {fileType === 'Image' && (
              <>
                <button
                  onClick={handleZoomOut}
                  className="rounded-lg p-2 transition-all hover:bg-white/10"
                  aria-label="Zoom out"
                >
                  <ZoomOut className="h-5 w-5 text-white" />
                </button>
                <span className="min-w-[4rem] text-center text-sm text-gray-300">
                  {imageZoom}%
                </span>
                <button
                  onClick={handleZoomIn}
                  className="rounded-lg p-2 transition-all hover:bg-white/10"
                  aria-label="Zoom in"
                >
                  <ZoomIn className="h-5 w-5 text-white" />
                </button>
                <div className="mx-2 h-6 w-px bg-white/20" />
              </>
            )}

            {/* Download Button */}
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-all hover:bg-blue-700 active:scale-95"
            >
              <Download className="h-4 w-4" />
              Download
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="rounded-lg p-2 transition-all hover:bg-white/10"
              aria-label="Close preview"
            >
              <X className="h-5 w-5 text-white" />
            </button>
          </div>
        </div>

        {/* Preview Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Main Preview Area */}
          <div className="flex flex-1 items-center justify-center overflow-auto bg-gradient-to-br from-gray-900 via-black to-gray-900 p-8">
            {loading ? (
              <div className="flex flex-col items-center gap-4">
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/20 border-t-blue-500" />
                <p className="text-sm text-gray-400">Loading preview...</p>
              </div>
            ) : (
              <PreviewContent
                file={file}
                fileType={fileType}
                previewUrl={previewUrl}
                imageZoom={imageZoom}
              />
            )}
          </div>

          {/* Info Sidebar */}
          <div className="w-80 border-l border-white/10 bg-black/40 p-6 backdrop-blur-md">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">
              File Information
            </h3>

            <div className="space-y-4">
              <InfoItem label="Name" value={file.original_name} />
              <InfoItem label="Size" value={fileSize} />
              <InfoItem label="Type" value={file.mime_type || 'Unknown'} />
              <InfoItem label="Modified" value={modifiedDate} />
              {file.doc_type && <InfoItem label="Document Type" value={file.doc_type} />}
              {file.doc_subtype && <InfoItem label="Subtype" value={file.doc_subtype} />}
              {file.exhibit_number && (
                <InfoItem label="Exhibit Number" value={file.exhibit_number} />
              )}
              {file.uploaded_by && <InfoItem label="Uploaded By" value={file.uploaded_by} />}
            </div>

            {/* Metadata Tags */}
            <div className="mt-6 flex flex-wrap gap-2">
              {file.is_contract && (
                <span className="rounded-full bg-amber-500/20 px-3 py-1 text-xs font-medium text-amber-300 border border-amber-500/30">
                  Contract
                </span>
              )}
              {file.client_visible && (
                <span className="rounded-full bg-green-500/20 px-3 py-1 text-xs font-medium text-green-300 border border-green-500/30">
                  Client Visible
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Footer Status Bar */}
        <div className="border-t border-white/10 bg-black/40 px-6 py-3 backdrop-blur-md">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <div className="flex items-center gap-4">
              <span>ID: {file.id.slice(0, 8)}</span>
              <span className="h-1 w-1 rounded-full bg-gray-600" />
              <span>R2 Key: {file.r2_key.split('/').pop()}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              <span>Ready</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Preview Content Component
function PreviewContent({
  file,
  fileType,
  previewUrl,
  imageZoom,
}: {
  file: R2File;
  fileType: string;
  previewUrl: string | null;
  imageZoom: number;
}) {
  if (!previewUrl) {
    return (
      <div className="flex flex-col items-center gap-4 text-gray-400">
        <div className="text-6xl">📄</div>
        <p>Preview not available</p>
      </div>
    );
  }

  switch (fileType) {
    case 'PDF':
      return (
        <iframe
          src={previewUrl}
          className="h-full w-full rounded-lg border border-white/10 bg-white shadow-2xl"
          title={file.original_name}
        />
      );

    case 'Image':
      return (
        <div className="flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt={file.original_name}
            style={{ width: `${imageZoom}%`, maxWidth: 'none' }}
            className="rounded-lg border border-white/20 shadow-2xl transition-all duration-200"
          />
        </div>
      );

    case 'Text':
      return (
        <div className="h-full w-full overflow-auto rounded-lg border border-white/10 bg-gray-900 p-6">
          <pre className="text-sm text-gray-300 font-mono">
            {/* Fetch and display text content */}
            <TextFileViewer url={previewUrl} />
          </pre>
        </div>
      );

    case 'Office Document':
      return (
        <div className="flex flex-col items-center gap-6 text-center">
          <div className="rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 p-8 border border-blue-500/30">
            <div className="text-6xl">📊</div>
          </div>
          <div>
            <h3 className="text-xl font-semibold text-white mb-2">
              Office Document Preview
            </h3>
            <p className="text-gray-400 mb-6 max-w-md">
              This file type cannot be previewed in the browser. Download the file to view
              its contents.
            </p>
            <a
              href={previewUrl}
              download={file.original_name}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 font-medium text-white transition-all hover:bg-blue-700 active:scale-95"
            >
              <Download className="h-5 w-5" />
              Download File
            </a>
          </div>
        </div>
      );

    default:
      return (
        <div className="flex flex-col items-center gap-6 text-center">
          <div className="rounded-full bg-gradient-to-br from-gray-500/20 to-gray-600/20 p-8 border border-gray-500/30">
            <div className="text-6xl">📄</div>
          </div>
          <div>
            <h3 className="text-xl font-semibold text-white mb-2">No Preview Available</h3>
            <p className="text-gray-400 mb-6 max-w-md">
              This file type is not supported for preview. Download the file to view it.
            </p>
            <a
              href={previewUrl}
              download={file.original_name}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 font-medium text-white transition-all hover:bg-blue-700 active:scale-95"
            >
              <Download className="h-5 w-5" />
              Download File
            </a>
          </div>
        </div>
      );
  }
}

// Text File Viewer Component
function TextFileViewer({ url }: { url: string }) {
  const [content, setContent] = useState<string>('Loading...');

  useEffect(() => {
    fetch(url)
      .then((res) => res.text())
      .then(setContent)
      .catch(() => setContent('Failed to load file content'));
  }, [url]);

  return <>{content}</>;
}

// Info Item Component
function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
        {label}
      </dt>
      <dd className="text-sm text-white break-all">{value}</dd>
    </div>
  );
}

// Utility Functions
function getFileType(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'Image';
  if (mimeType === 'application/pdf') return 'PDF';
  if (mimeType.startsWith('text/')) return 'Text';
  if (
    mimeType.includes('word') ||
    mimeType.includes('excel') ||
    mimeType.includes('powerpoint') ||
    mimeType.includes('spreadsheet') ||
    mimeType.includes('presentation')
  ) {
    return 'Office Document';
  }
  return 'Unknown';
}

function getFileExtension(filename: string): string {
  const ext = filename.split('.').pop()?.toUpperCase();
  return ext || '?';
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}
