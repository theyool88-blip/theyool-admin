'use client'

import { useState, useEffect } from 'react'

interface TenantOptions {
  lawyerNames: string[]
  officeLocations: string[]
  isLoading: boolean
  error: string | null
}

interface TenantMember {
  id: string
  role: string
  display_name?: string | null
  status: string
}

interface TenantSettings {
  consultations?: {
    officeLocations?: { value: string; label: string }[]
    offices?: string[]
  }
  cases?: {
    branches?: { id: string; name: string }[]
  }
}

const defaultOptions: TenantOptions = {
  lawyerNames: [],
  officeLocations: [],
  isLoading: true,
  error: null,
}

/**
 * 테넌트의 변호사 목록과 사무소 위치를 동적으로 가져오는 훅
 * - lawyerNames: tenant_members에서 lawyer/owner 역할인 멤버의 display_name
 * - officeLocations: tenant_settings에서 consultations.offices 또는 cases.branches
 */
export function useTenantOptions(): TenantOptions {
  const [options, setOptions] = useState<TenantOptions>(defaultOptions)

  useEffect(() => {
    async function fetchOptions() {
      try {
        // 병렬로 테넌트 정보와 설정 조회
        const [tenantRes, settingsRes] = await Promise.all([
          fetch('/api/admin/tenant'),
          fetch('/api/admin/tenant/settings'),
        ])

        let lawyerNames: string[] = []
        let officeLocations: string[] = []

        // 테넌트 멤버에서 변호사 목록 추출
        if (tenantRes.ok) {
          const tenantData = await tenantRes.json()
          if (tenantData.success && tenantData.data?.members) {
            const members = tenantData.data.members as TenantMember[]
            lawyerNames = members
              .filter(m =>
                (m.role === 'lawyer' || m.role === 'owner' || m.role === 'admin') &&
                m.status === 'active' &&
                m.display_name
              )
              .map(m => m.display_name as string)
              .filter(Boolean)
          }
        }

        // 테넌트 설정에서 사무소 위치 추출
        if (settingsRes.ok) {
          const settingsData = await settingsRes.json()
          if (settingsData.success && settingsData.data?.settings) {
            const settings = settingsData.data.settings as TenantSettings

            // consultations.offices 또는 consultations.officeLocations 확인
            if (settings.consultations?.offices) {
              officeLocations = settings.consultations.offices
            } else if (settings.consultations?.officeLocations) {
              officeLocations = settings.consultations.officeLocations.map(o => o.label || o.value)
            }

            // cases.branches에서도 사무소 위치 가져오기 (fallback)
            if (officeLocations.length === 0 && settings.cases?.branches) {
              officeLocations = settings.cases.branches.map(b => b.name)
            }
          }
        }

        // 더윤 하드코딩 폴백 (설정이 없는 경우 기존 값 사용)
        // TODO: 마이그레이션 후 제거
        if (lawyerNames.length === 0) {
          lawyerNames = ['임은지', '육심원']
        }
        if (officeLocations.length === 0) {
          officeLocations = ['평택', '천안']
        }

        setOptions({
          lawyerNames,
          officeLocations,
          isLoading: false,
          error: null,
        })
      } catch (error) {
        console.error('[useTenantOptions] Error:', error)

        // 에러 발생 시 더윤 기본값 사용
        setOptions({
          lawyerNames: ['임은지', '육심원'],
          officeLocations: ['평택', '천안'],
          isLoading: false,
          error: error instanceof Error ? error.message : '옵션을 불러올 수 없습니다.',
        })
      }
    }

    fetchOptions()
  }, [])

  return options
}

export type { TenantOptions }
