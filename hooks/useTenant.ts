'use client'

import { useState, useEffect, useCallback } from 'react'
import type { MemberRole } from '@/types/tenant'

interface TenantInfo {
  tenantId: string | null
  tenantName: string | null
  tenantSlug: string | null
  tenantLogo: string | null
  hasHomepage: boolean
  memberRole: MemberRole
  memberId: string | null
  isSuperAdmin: boolean
  isLoading: boolean
  error: string | null
}

const defaultTenantInfo: TenantInfo = {
  tenantId: null,
  tenantName: null,
  tenantSlug: null,
  tenantLogo: null,
  hasHomepage: false,
  memberRole: 'owner',
  memberId: null,
  isSuperAdmin: false,
  isLoading: true,
  error: null,
}

// 전역 캐시 - 페이지 전환 시에도 데이터 유지
let cachedTenantInfo: TenantInfo | null = null
let fetchPromise: Promise<TenantInfo> | null = null

async function fetchTenantData(): Promise<TenantInfo> {
  try {
    const response = await fetch('/api/admin/tenant')

    if (!response.ok) {
      if (response.status === 401) {
        return {
          ...defaultTenantInfo,
          isLoading: false,
          error: '로그인이 필요합니다.',
        }
      }
      throw new Error('테넌트 정보를 가져올 수 없습니다.')
    }

    const result = await response.json()
    const data = result.data

    return {
      tenantId: data?.tenant?.id || null,
      tenantName: data?.tenant?.name || null,
      tenantSlug: data?.tenant?.slug || null,
      tenantLogo: data?.tenant?.logo_url || null,
      hasHomepage: data?.tenant?.has_homepage || false,
      memberRole: data?.currentMember?.role || 'owner',
      memberId: data?.currentMember?.id || null,
      isSuperAdmin: result.isSuperAdmin || false,
      isLoading: false,
      error: null,
    }
  } catch (error) {
    console.error('[useTenant] Error:', error)
    return {
      ...defaultTenantInfo,
      isLoading: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류',
    }
  }
}

/**
 * 클라이언트에서 현재 사용자의 테넌트 정보를 가져오는 훅
 * 전역 캐시를 사용하여 페이지 전환 시 깜빡임 방지
 */
export function useTenant(): TenantInfo {
  // 캐시된 데이터가 있으면 즉시 사용 (isLoading: false)
  const [tenantInfo, setTenantInfo] = useState<TenantInfo>(
    cachedTenantInfo || defaultTenantInfo
  )

  useEffect(() => {
    // 이미 캐시된 데이터가 있으면 fetch 하지 않음
    if (cachedTenantInfo) {
      void (async () => {
        setTenantInfo(cachedTenantInfo)
      })()
      return
    }

    // 이미 fetch 중이면 해당 Promise 사용
    if (!fetchPromise) {
      fetchPromise = fetchTenantData()
    }

    fetchPromise.then(data => {
      cachedTenantInfo = data
      fetchPromise = null
      setTenantInfo(data)
    })
  }, [])

  return tenantInfo
}

/**
 * 테넌트 캐시 무효화 (로그아웃 시 등에 사용)
 */
export function invalidateTenantCache() {
  cachedTenantInfo = null
  fetchPromise = null
}

/**
 * 테넌트 캐시 새로고침
 */
export async function refreshTenantCache(): Promise<TenantInfo> {
  cachedTenantInfo = null
  fetchPromise = null
  const data = await fetchTenantData()
  cachedTenantInfo = data
  return data
}

export type { TenantInfo }
