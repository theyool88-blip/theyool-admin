'use client'

import { useState, useCallback, useRef, DragEvent, ChangeEvent } from 'react'
import { Upload, X, Check, AlertCircle, FileIcon, Loader2 } from 'lucide-react'
import type { R2File } from '@/types/r2'

interface FileUploaderProps {
  tenantId: string
  folderId?: string
  caseId?: string
  onUploadComplete: (files: R2File[]) => void
  onUploadError?: (error: Error) => void
  maxFileSize?: number // in bytes, default 100MB
  acceptedTypes?: string[] // mime types
  multiple?: boolean
}

interface UploadingFile {
  id: string
  file: File
  progress: number
  status: 'pending' | 'uploading' | 'success' | 'error'
  error?: string
  controller?: AbortController
}

export default function FileUploader({
  tenantId,
  folderId,
  caseId,
  onUploadComplete,
  onUploadError,
  maxFileSize = 100 * 1024 * 1024, // 100MB
  acceptedTypes = [],
  multiple = true,
}: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragCounterRef = useRef(0)

  const validateFile = (file: File): string | null => {
    if (file.size > maxFileSize) {
      return `File size exceeds ${Math.round(maxFileSize / 1024 / 1024)}MB limit`
    }

    if (acceptedTypes.length > 0 && !acceptedTypes.includes(file.type)) {
      return `File type ${file.type} is not accepted`
    }

    return null
  }

  const uploadFile = async (uploadingFile: UploadingFile): Promise<R2File | null> => {
    const { file } = uploadingFile

    try {
      // Step 1: Get presigned URL
      setUploadingFiles(prev =>
        prev.map(f => (f.id === uploadingFile.id ? { ...f, status: 'uploading', progress: 0 } : f))
      )

      const presignResponse = await fetch('/api/drive/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          folderId,
          caseId,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
        }),
      })

      if (!presignResponse.ok) {
        const error = await presignResponse.json()
        throw new Error(error.error || 'Failed to get upload URL')
      }

      const { fileId, presignedUrl } = await presignResponse.json()

      // Step 2: Upload to R2 with progress tracking
      const xhr = new XMLHttpRequest()

      await new Promise<string>((resolve, reject) => {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const progress = Math.round((e.loaded / e.total) * 100)
            setUploadingFiles(prev =>
              prev.map(f => (f.id === uploadingFile.id ? { ...f, progress } : f))
            )
          }
        })

        xhr.addEventListener('load', () => {
          if (xhr.status === 200) {
            const etag = xhr.getResponseHeader('ETag')
            resolve(etag || '')
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`))
          }
        })

        xhr.addEventListener('error', () => {
          reject(new Error('Network error during upload'))
        })

        xhr.addEventListener('abort', () => {
          reject(new Error('Upload cancelled'))
        })

        xhr.open('PUT', presignedUrl)
        xhr.setRequestHeader('Content-Type', file.type)
        xhr.send(file)

        // Store controller for cancellation
        uploadingFile.controller = {
          abort: () => xhr.abort(),
        } as AbortController
      })

      const etag = xhr.getResponseHeader('ETag')

      // Step 3: Complete upload
      const completeResponse = await fetch('/api/drive/upload/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileId,
          etag: etag?.replace(/"/g, ''),
        }),
      })

      if (!completeResponse.ok) {
        const error = await completeResponse.json()
        throw new Error(error.error || 'Failed to complete upload')
      }

      const { file: uploadedFile } = await completeResponse.json()

      setUploadingFiles(prev =>
        prev.map(f => (f.id === uploadingFile.id ? { ...f, status: 'success', progress: 100 } : f))
      )

      return uploadedFile
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed'

      setUploadingFiles(prev =>
        prev.map(f =>
          f.id === uploadingFile.id ? { ...f, status: 'error', error: errorMessage } : f
        )
      )

      if (onUploadError) {
        onUploadError(error instanceof Error ? error : new Error(errorMessage))
      }

      return null
    }
  }

  const processFiles = async (files: File[]) => {
    const validFiles: UploadingFile[] = []
    const errors: string[] = []

    files.forEach((file) => {
      const error = validateFile(file)
      if (error) {
        errors.push(`${file.name}: ${error}`)
      } else {
        validFiles.push({
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          file,
          progress: 0,
          status: 'pending',
        })
      }
    })

    if (errors.length > 0) {
      alert(errors.join('\n'))
    }

    if (validFiles.length === 0) return

    setUploadingFiles(prev => [...prev, ...validFiles])

    // Upload files sequentially
    const uploadedFiles: R2File[] = []

    for (const uploadingFile of validFiles) {
      const result = await uploadFile(uploadingFile)
      if (result) {
        uploadedFiles.push(result)
      }
    }

    if (uploadedFiles.length > 0) {
      onUploadComplete(uploadedFiles)
    }

    // Remove completed files after 3 seconds
    setTimeout(() => {
      setUploadingFiles(prev =>
        prev.filter(f => !validFiles.map(vf => vf.id).includes(f.id))
      )
    }, 3000)
  }

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current++
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true)
    }
  }

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current--
    if (dragCounterRef.current === 0) {
      setIsDragging(false)
    }
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    dragCounterRef.current = 0

    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      if (!multiple && files.length > 1) {
        alert('Only one file can be uploaded at a time')
        return
      }
      processFiles(files)
    }
  }

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) {
      processFiles(files)
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  const cancelUpload = (fileId: string) => {
    const file = uploadingFiles.find(f => f.id === fileId)
    if (file?.controller) {
      file.controller.abort()
    }
    setUploadingFiles(prev => prev.filter(f => f.id !== fileId))
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
  }

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        className={`
          relative overflow-hidden cursor-pointer
          transition-all duration-300 ease-out
          ${
            isDragging
              ? 'border-2 border-sage-600 bg-sage-50 shadow-sage-lg scale-[1.02]'
              : 'border-2 border-dashed border-slate-300 bg-white hover:border-sage-500 hover:bg-sage-50/50'
          }
        `}
        style={{
          borderRadius: '2px',
          minHeight: '240px',
        }}
      >
        {/* Geometric Pattern Background */}
        <div
          className="absolute inset-0 opacity-5 pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(45deg, transparent 48%, currentColor 48%, currentColor 52%, transparent 52%),
              linear-gradient(-45deg, transparent 48%, currentColor 48%, currentColor 52%, transparent 52%)
            `,
            backgroundSize: '20px 20px',
            color: isDragging ? '#6DB5A4' : '#94A3B8',
          }}
        />

        <div className="relative z-10 flex flex-col items-center justify-center h-full p-8 text-center">
          {/* Upload Icon with Geometric Shape */}
          <div
            className={`
              relative mb-6
              transition-all duration-300
              ${isDragging ? 'scale-110' : 'scale-100'}
            `}
          >
            {/* Hexagon Background */}
            <div
              className={`
                absolute inset-0 -m-6
                transition-colors duration-300
                ${isDragging ? 'text-sage-500' : 'text-slate-200'}
              `}
              style={{
                width: '80px',
                height: '80px',
                clipPath: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)',
                backgroundColor: 'currentColor',
              }}
            />
            <Upload
              className={`
                relative z-10
                transition-colors duration-300
                ${isDragging ? 'text-white' : 'text-slate-500'}
              `}
              size={32}
              strokeWidth={1.5}
            />
          </div>

          {/* Text */}
          <div className="space-y-2">
            <p
              className={`
                text-lg font-semibold tracking-tight
                transition-colors duration-300
                ${isDragging ? 'text-sage-700' : 'text-slate-700'}
              `}
              style={{ fontFamily: 'var(--font-geist-mono)' }}
            >
              {isDragging ? 'RELEASE TO UPLOAD' : 'DROP FILES HERE'}
            </p>
            <p className="text-sm text-slate-500">
              or click to browse
            </p>
            <p className="text-xs text-slate-400 font-mono mt-4">
              MAX: {Math.round(maxFileSize / 1024 / 1024)}MB
              {acceptedTypes.length > 0 && (
                <span className="ml-2">
                  | TYPES: {acceptedTypes.map(t => t.split('/')[1]?.toUpperCase()).join(', ')}
                </span>
              )}
              {!multiple && <span className="ml-2">| SINGLE FILE ONLY</span>}
            </p>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple={multiple}
          accept={acceptedTypes.join(',')}
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* Upload Progress List */}
      {uploadingFiles.length > 0 && (
        <div className="space-y-2">
          {uploadingFiles.map((uploadingFile) => (
            <div
              key={uploadingFile.id}
              className="relative overflow-hidden bg-white border border-slate-200"
              style={{ borderRadius: '2px' }}
            >
              {/* Progress Bar Background */}
              <div
                className={`
                  absolute inset-0 transition-all duration-300
                  ${
                    uploadingFile.status === 'success'
                      ? 'bg-success-50'
                      : uploadingFile.status === 'error'
                      ? 'bg-danger-50'
                      : 'bg-sage-50'
                  }
                `}
                style={{
                  width: `${uploadingFile.progress}%`,
                }}
              />

              <div className="relative z-10 flex items-center gap-4 p-4">
                {/* File Icon */}
                <div
                  className={`
                    flex-shrink-0 w-10 h-10 flex items-center justify-center
                    ${
                      uploadingFile.status === 'success'
                        ? 'bg-success-100 text-success-600'
                        : uploadingFile.status === 'error'
                        ? 'bg-danger-100 text-danger-600'
                        : 'bg-slate-100 text-slate-600'
                    }
                  `}
                  style={{
                    clipPath: 'polygon(0 0, 100% 0, 100% 80%, 80% 100%, 0 100%)',
                  }}
                >
                  {uploadingFile.status === 'success' ? (
                    <Check size={20} strokeWidth={2} />
                  ) : uploadingFile.status === 'error' ? (
                    <AlertCircle size={20} strokeWidth={2} />
                  ) : uploadingFile.status === 'uploading' ? (
                    <Loader2 size={20} strokeWidth={2} className="animate-spin" />
                  ) : (
                    <FileIcon size={20} strokeWidth={2} />
                  )}
                </div>

                {/* File Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2 mb-1">
                    <p className="text-sm font-medium text-slate-700 truncate font-mono">
                      {uploadingFile.file.name}
                    </p>
                    <span className="text-xs text-slate-500 font-mono flex-shrink-0">
                      {formatFileSize(uploadingFile.file.size)}
                    </span>
                  </div>

                  {uploadingFile.status === 'error' ? (
                    <p className="text-xs text-danger-600 font-mono">
                      ERROR: {uploadingFile.error}
                    </p>
                  ) : uploadingFile.status === 'success' ? (
                    <p className="text-xs text-success-600 font-mono">
                      UPLOAD COMPLETE
                    </p>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1 bg-slate-200 overflow-hidden">
                        <div
                          className="h-full bg-sage-600 transition-all duration-300"
                          style={{ width: `${uploadingFile.progress}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-500 font-mono w-12 text-right">
                        {uploadingFile.progress}%
                      </span>
                    </div>
                  )}
                </div>

                {/* Cancel Button */}
                {uploadingFile.status === 'uploading' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      cancelUpload(uploadingFile.id)
                    }}
                    className="flex-shrink-0 p-1 text-slate-400 hover:text-danger-600 hover:bg-danger-50 transition-colors"
                    style={{ borderRadius: '2px' }}
                  >
                    <X size={16} strokeWidth={2} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
