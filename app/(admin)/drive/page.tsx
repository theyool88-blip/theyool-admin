'use client'

/**
 * Luseed Drive - Full-page file explorer
 *
 * A bold, utilitarian file management interface inspired by
 * brutalist design principles with functional clarity.
 *
 * Design Philosophy:
 * - Stark black and white base with accent color for interactions
 * - Dense information display with clear hierarchy
 * - Minimal decoration, maximum function
 * - Sharp geometric shapes and borders
 */

import { useState, useEffect } from 'react'
import { AlertCircle, HardDrive, Loader2 } from 'lucide-react'
import FileExplorer from '@/components/drive/FileExplorer'

// Note: Metadata should be in layout.tsx for Server Components
// Client components cannot export metadata

interface TenantInfo {
  id: string
  name: string
}

export default function DrivePage() {
  const [tenant, setTenant] = useState<TenantInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchTenant() {
      try {
        const response = await fetch('/api/tenant/current')
        if (!response.ok) throw new Error('Failed to fetch tenant')
        const data = await response.json()
        setTenant(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    fetchTenant()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-neutral-900" />
          <p className="text-sm font-mono uppercase tracking-wider text-neutral-600">
            Loading Drive
          </p>
        </div>
      </div>
    )
  }

  if (error || !tenant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="max-w-md w-full mx-4">
          <div className="bg-white border-4 border-red-600 p-8">
            <div className="flex items-start gap-4">
              <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-1" />
              <div>
                <h1 className="text-xl font-bold uppercase tracking-tight mb-2">
                  Error Loading Drive
                </h1>
                <p className="text-sm text-neutral-700 font-mono">
                  {error || 'Failed to load tenant information'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-neutral-50">
      {/* Header - Stark and functional */}
      <header className="bg-neutral-900 text-white border-b-4 border-neutral-800">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <HardDrive className="w-6 h-6" />
              <h1 className="text-2xl font-bold uppercase tracking-tight">
                Drive
              </h1>
            </div>
            <div className="text-sm font-mono">
              <span className="text-neutral-400">Tenant:</span>{' '}
              <span className="text-white font-semibold">{tenant.name}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main content area */}
      <main className="flex-1 overflow-hidden">
        <FileExplorer tenantId={tenant.id} />
      </main>

      <style jsx global>{`
        /* Brutalist grid overlay effect on hover */
        @keyframes gridPulse {
          0%, 100% { opacity: 0.05; }
          50% { opacity: 0.15; }
        }

        .drive-container:hover::before {
          content: '';
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(0deg, transparent 24%, rgba(0, 0, 0, .05) 25%, rgba(0, 0, 0, .05) 26%, transparent 27%, transparent 74%, rgba(0, 0, 0, .05) 75%, rgba(0, 0, 0, .05) 76%, transparent 77%, transparent),
            linear-gradient(90deg, transparent 24%, rgba(0, 0, 0, .05) 25%, rgba(0, 0, 0, .05) 26%, transparent 27%, transparent 74%, rgba(0, 0, 0, .05) 75%, rgba(0, 0, 0, .05) 76%, transparent 77%, transparent);
          background-size: 50px 50px;
          pointer-events: none;
          animation: gridPulse 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}
