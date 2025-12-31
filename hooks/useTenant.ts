'use client'

import { useState, useEffect } from 'react'
import type { MemberRole } from '@/types/tenant'

interface TenantInfo {
  tenantId: string | null
  tenantName: string | null
  tenantSlug: string | null
  tenantLogo: string | null
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
  memberRole: 'owner',
  memberId: null,
  isSuperAdmin: false,
  isLoading: true,
  error: null,
}

/**
 * 클라이언트에서 현재 사용자의 테넌트 정보를 가져오는 훅
 */
export function useTenant(): TenantInfo {
  const [tenantInfo, setTenantInfo] = useState<TenantInfo>(defaultTenantInfo)

  useEffect(() => {
    async function fetchTenantInfo() {
      try {
        const response = await fetch('/api/admin/tenant')

        if (!response.ok) {
          if (response.status === 401) {
            setTenantInfo({
              ...defaultTenantInfo,
              isLoading: false,
              error: '로그인이 필요합니다.',
            })
            return
          }
          throw new Error('테넌트 정보를 가져올 수 없습니다.')
        }

        const data = await response.json()

        setTenantInfo({
          tenantId: data.tenant?.id || null,
          tenantName: data.tenant?.name || null,
          tenantSlug: data.tenant?.slug || null,
          tenantLogo: data.tenant?.logo_url || null,
          memberRole: data.member?.role || 'owner',
          memberId: data.member?.id || null,
          isSuperAdmin: data.isSuperAdmin || false,
          isLoading: false,
          error: null,
        })
      } catch (error) {
        console.error('[useTenant] Error:', error)
        setTenantInfo({
          ...defaultTenantInfo,
          isLoading: false,
          error: error instanceof Error ? error.message : '알 수 없는 오류',
        })
      }
    }

    fetchTenantInfo()
  }, [])

  return tenantInfo
}

export type { TenantInfo }
