'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, X, Loader2 } from 'lucide-react'

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  onSearch: (query: string) => void
  placeholder?: string
  className?: string
  isLoading?: boolean
}

export default function SearchBar({
  value,
  onChange,
  onSearch,
  placeholder = 'Search files...',
  className = '',
  isLoading = false,
}: SearchBarProps) {
  const [localValue, setLocalValue] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  // Sync with external value
  useEffect(() => {
    setLocalValue(value)
  }, [value])

  // Debounced search (300ms)
  useEffect(() => {
    const debounce = setTimeout(() => {
      if (localValue !== value) {
        onChange(localValue)
        onSearch(localValue)
      }
    }, 300)
    return () => clearTimeout(debounce)
  }, [localValue, value, onChange, onSearch])

  const handleClear = () => {
    setLocalValue('')
    onChange('')
    onSearch('')
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      // Immediate search on Enter
      onChange(localValue)
      onSearch(localValue)
    } else if (e.key === 'Escape') {
      // Clear and blur on ESC
      handleClear()
      inputRef.current?.blur()
    }
  }

  return (
    <div className={`relative max-w-[400px] ${className}`}>
      {/* Search Icon */}
      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Search className="w-4 h-4" />
        )}
      </div>

      {/* Input */}
      <input
        ref={inputRef}
        type="text"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full h-10 pl-10 pr-10 rounded-full bg-gray-100 text-gray-900 placeholder-gray-500 transition-all focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500"
      />

      {/* Clear Button */}
      {localValue && (
        <button
          onClick={handleClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Clear search"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}
