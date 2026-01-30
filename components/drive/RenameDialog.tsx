'use client'

import { useState, useEffect, useRef, KeyboardEvent } from 'react'
import { X } from 'lucide-react'

interface RenameDialogProps {
  isOpen: boolean
  type: 'file' | 'folder'
  currentName: string
  onClose: () => void
  onRename: (newName: string) => void
  isLoading?: boolean
}

export default function RenameDialog({
  isOpen,
  type,
  currentName,
  onClose,
  onRename,
  isLoading = false,
}: RenameDialogProps) {
  const [name, setName] = useState(currentName)
  const [error, setError] = useState<string>('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setName(currentName)
      setError('')
      // Focus and select text after mount
      setTimeout(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      }, 50)
    }
  }, [isOpen, currentName])

  // Close on ESC key
  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isLoading) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isLoading, onClose])

  const validateName = (value: string): string | null => {
    if (!value.trim()) {
      return '이름을 입력해주세요'
    }

    // Check for invalid characters
    const invalidChars = /[<>:"/\\|?*\x00-\x1F]/
    if (invalidChars.test(value)) {
      return '이름에 사용할 수 없는 문자가 포함되어 있습니다'
    }

    // Check length
    if (value.length > 255) {
      return '이름이 너무 깁니다 (최대 255자)'
    }

    return null
  }

  const handleSubmit = () => {
    const trimmedName = name.trim()

    // Validate
    const validationError = validateName(trimmedName)
    if (validationError) {
      setError(validationError)
      return
    }

    // Check if name changed
    if (trimmedName === currentName) {
      onClose()
      return
    }

    // Submit
    onRename(trimmedName)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isLoading) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !isLoading) {
      onClose()
    }
  }

  const isNameChanged = name.trim() !== currentName
  const isSubmitDisabled = !name.trim() || !isNameChanged || isLoading

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 mx-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-normal text-gray-900">
            {type === 'folder' ? '폴더 이름 변경' : '파일 이름 변경'}
          </h3>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="닫기"
          >
            <X className="w-5 h-5" strokeWidth={1.5} />
          </button>
        </div>

        {/* Input */}
        <div className="mb-6">
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              setError('')
            }}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            placeholder={type === 'folder' ? '폴더 이름' : '파일 이름'}
            className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:cursor-not-allowed transition-all"
            aria-invalid={!!error}
            aria-describedby={error ? 'name-error' : undefined}
          />
          {error && (
            <p id="name-error" className="mt-2 text-xs text-red-600">
              {error}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitDisabled}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? '변경 중...' : '변경'}
          </button>
        </div>
      </div>
    </div>
  )
}
