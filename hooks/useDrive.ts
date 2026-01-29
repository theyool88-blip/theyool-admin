/**
 * SWR Hooks for Drive Operations
 *
 * Uses single-fetch design pattern - one API call returns all folder data.
 * This eliminates redundant API calls and ensures consistent data.
 */

import useSWR, { mutate as globalMutate } from 'swr'
import type { R2File, R2Folder } from '@/types/r2'

const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Failed to fetch' }))
    throw new Error(error.error || 'Failed to fetch')
  }
  return res.json()
}

interface DriveFolderData {
  folders: R2Folder[]
  files: R2File[]
  currentFolder: R2Folder | null
  breadcrumbs: R2Folder[]
}

interface StorageData {
  tenant_id: string
  quota_bytes: number
  extra_quota_bytes: number
  used_bytes: number
  file_count: number
  usage_percent: number
  created_at: string
  updated_at: string
}

/**
 * Single hook that fetches all drive data for a folder
 * Returns { folders, files, currentFolder, breadcrumbs }
 *
 * API Response format from /api/drive/folders:
 * { success: true, folders: [], files: [], currentFolder: {}, breadcrumbs: [] }
 */
export function useDriveFolder(tenantId: string, parentId?: string | null, caseId?: string) {
  const params = new URLSearchParams()
  params.set('tenantId', tenantId)
  if (parentId) params.set('parentId', parentId)
  if (caseId) params.set('caseId', caseId)

  const { data, error, isLoading, mutate } = useSWR<{ success: boolean } & DriveFolderData>(
    `/api/drive/folders?${params}`,
    fetcher,
    { revalidateOnFocus: false }
  )

  return {
    folders: data?.folders || [],
    files: data?.files || [],
    currentFolder: data?.currentFolder || null,
    breadcrumbs: data?.breadcrumbs || [],
    isLoading,
    isError: !!error,
    error,
    mutate,
  }
}

/**
 * Hook for storage usage (separate endpoint)
 */
export function useStorageUsage() {
  const { data, error, isLoading, mutate } = useSWR<{ success: boolean; storage: StorageData }>(
    '/api/drive/storage',
    fetcher,
    { refreshInterval: 30000 } // Refresh every 30 seconds
  )

  return {
    storage: data?.storage || null,
    isLoading,
    isError: !!error,
    error,
    mutate,
  }
}

/**
 * Utility function to invalidate drive cache after mutations
 */
export function invalidateDriveCache(tenantId: string, parentId?: string | null, caseId?: string) {
  const params = new URLSearchParams()
  params.set('tenantId', tenantId)
  if (parentId) params.set('parentId', parentId)
  if (caseId) params.set('caseId', caseId)

  return globalMutate(`/api/drive/folders?${params}`)
}

/**
 * Invalidate storage cache after file upload/delete
 */
export function invalidateStorageCache() {
  return globalMutate('/api/drive/storage')
}
