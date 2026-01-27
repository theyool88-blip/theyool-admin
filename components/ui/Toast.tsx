'use client'

import { useEffect, useState } from 'react'
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface ToastMessage {
  id: string
  type: ToastType
  message: string
  duration?: number
}

interface ToastProps {
  toast: ToastMessage
  onClose: (id: string) => void
}

function Toast({ toast, onClose }: ToastProps) {
  const [isExiting, setIsExiting] = useState(false)

  useEffect(() => {
    const duration = toast.duration || 3000
    const timer = setTimeout(() => {
      setIsExiting(true)
      setTimeout(() => onClose(toast.id), 300)
    }, duration)

    return () => clearTimeout(timer)
  }, [toast, onClose])

  const handleClose = () => {
    setIsExiting(true)
    setTimeout(() => onClose(toast.id), 300)
  }

  const icons = {
    success: <CheckCircle className="w-5 h-5 text-[var(--color-success)]" />,
    error: <XCircle className="w-5 h-5 text-[var(--color-danger)]" />,
    warning: <AlertCircle className="w-5 h-5 text-[var(--color-warning)]" />,
    info: <Info className="w-5 h-5 text-[var(--color-info)]" />
  }

  const colors = {
    success: 'bg-[var(--bg-secondary)] border-[var(--color-success)]',
    error: 'bg-[var(--bg-secondary)] border-[var(--color-danger)]',
    warning: 'bg-[var(--bg-secondary)] border-[var(--color-warning)]',
    info: 'bg-[var(--bg-secondary)] border-[var(--color-info)]'
  }

  return (
    <div
      className={`
        flex items-center gap-3 p-4 rounded-lg shadow-lg border-2 max-w-md
        ${colors[toast.type]}
        ${isExiting ? 'animate-slide-out-right' : 'animate-slide-in-right'}
      `}
    >
      {icons[toast.type]}
      <p className="flex-1 text-sm font-medium text-[var(--text-primary)]">{toast.message}</p>
      <button
        onClick={handleClose}
        className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

interface ToastContainerProps {
  toasts: ToastMessage[]
  onRemove: (id: string) => void
}

export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map(toast => (
        <Toast key={toast.id} toast={toast} onClose={onRemove} />
      ))}
    </div>
  )
}
