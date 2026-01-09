'use client'

import { useState, useRef, useCallback } from 'react'

interface FileUploaderProps {
  onFileSelected: (file: File) => void
  accept?: string
  disabled?: boolean
}

export default function FileUploader({
  onFileSelected,
  accept = '.csv,.xlsx,.xls',
  disabled = false
}: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    if (!disabled) {
      setIsDragging(true)
    }
  }, [disabled])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    if (disabled) return

    const files = e.dataTransfer.files
    if (files.length > 0) {
      const file = files[0]
      const ext = file.name.split('.').pop()?.toLowerCase()
      if (['csv', 'xlsx', 'xls'].includes(ext || '')) {
        onFileSelected(file)
      } else {
        alert('CSV 또는 Excel 파일만 업로드 가능합니다.')
      }
    }
  }, [disabled, onFileSelected])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      onFileSelected(file)
    }
    // 같은 파일 다시 선택 가능하도록 초기화
    e.target.value = ''
  }, [onFileSelected])

  const handleClick = useCallback(() => {
    if (!disabled) {
      fileInputRef.current?.click()
    }
  }, [disabled])

  return (
    <div className="space-y-4">
      {/* 파일 업로드 영역 */}
      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
          transition-colors duration-200
          ${isDragging ? 'border-sage-500 bg-sage-50' : 'border-gray-300 hover:border-sage-400'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          onChange={handleFileChange}
          className="hidden"
          disabled={disabled}
        />

        <svg
          className={`mx-auto h-12 w-12 ${isDragging ? 'text-sage-500' : 'text-gray-400'}`}
          stroke="currentColor"
          fill="none"
          viewBox="0 0 48 48"
          aria-hidden="true"
        >
          <path
            d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        <div className="mt-4">
          <p className="text-sm text-gray-600">
            <span className="font-medium text-sage-600 hover:text-sage-500">
              파일을 선택
            </span>
            하거나 여기에 드래그하세요
          </p>
          <p className="text-xs text-gray-500 mt-1">
            CSV, Excel (.xlsx, .xls) 파일 지원
          </p>
        </div>
      </div>

      {/* 지원 형식 안내 */}
      <div className="text-xs text-gray-500 space-y-1">
        <p>* <strong>표준파일</strong>: 사건번호, 법원명, 의뢰인명 컬럼 필수</p>
        <p>* <strong>기타 형식</strong>: AI가 컬럼을 분석하여 자동 매핑</p>
      </div>
    </div>
  )
}
