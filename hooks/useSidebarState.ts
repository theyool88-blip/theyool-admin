'use client'

import { useState, useEffect, useCallback } from 'react'

const SIDEBAR_STORAGE_KEY = 'admin-sidebar-state'
const SIDEBAR_GROUPS_KEY = 'admin-sidebar-groups'

interface UseSidebarStateReturn {
  isCollapsed: boolean
  expandedGroups: string[]
  toggleSidebar: () => void
  toggleGroup: (groupId: string) => void
  isGroupExpanded: (groupId: string) => boolean
  setSidebarCollapsed: (collapsed: boolean) => void
}

// 전역 캐시 - 페이지 전환 시 깜빡임 방지 (hydration 후에만 사용)
let cachedCollapsed: boolean | null = null
let cachedExpandedGroups: string[] | null = null

/**
 * 사이드바 상태 관리 훅
 * - 접힘/펼침 상태를 localStorage에 저장
 * - 그룹 토글 상태 관리
 * - 전역 캐시로 페이지 전환 시 깜빡임 방지
 * - SSR/hydration 안전: 초기값은 항상 동일, 마운트 후 localStorage 반영
 */
export function useSidebarState(): UseSidebarStateReturn {
  // SSR과 클라이언트 첫 렌더에서 동일한 기본값 사용 (hydration 안전)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<string[]>(['work', 'accounting'])
  const [hasMounted, setHasMounted] = useState(false)

  // 마운트 후 localStorage에서 상태 로드 (hydration 이후)
  useEffect(() => {
    void (async () => {
      setHasMounted(true)
    })()

    // 캐시가 있으면 캐시 사용 (페이지 전환 시)
    if (cachedCollapsed !== null) {
      void (async () => {
        setIsCollapsed(cachedCollapsed)
      })()
    } else {
      // 캐시가 없으면 localStorage에서 로드
      try {
        const savedCollapsed = localStorage.getItem(SIDEBAR_STORAGE_KEY)
        if (savedCollapsed !== null) {
          const value = JSON.parse(savedCollapsed)
          cachedCollapsed = value
          void (async () => {
            setIsCollapsed(value)
          })()
        }
      } catch (error) {
        console.error('[useSidebarState] Failed to load sidebar state:', error)
      }
    }

    if (cachedExpandedGroups !== null) {
      void (async () => {
        setExpandedGroups(cachedExpandedGroups)
      })()
    } else {
      try {
        const savedGroups = localStorage.getItem(SIDEBAR_GROUPS_KEY)
        if (savedGroups !== null) {
          const value = JSON.parse(savedGroups)
          cachedExpandedGroups = value
          void (async () => {
            setExpandedGroups(value)
          })()
        }
      } catch (error) {
        console.error('[useSidebarState] Failed to load groups state:', error)
      }
    }
  }, [])

  // 사이드바 토글
  const toggleSidebar = useCallback(() => {
    setIsCollapsed(prev => {
      const newValue = !prev
      cachedCollapsed = newValue
      try {
        localStorage.setItem(SIDEBAR_STORAGE_KEY, JSON.stringify(newValue))
      } catch (error) {
        console.error('[useSidebarState] Failed to save sidebar state:', error)
      }
      return newValue
    })
  }, [])

  // 사이드바 접힘 상태 직접 설정
  const setSidebarCollapsed = useCallback((collapsed: boolean) => {
    cachedCollapsed = collapsed
    setIsCollapsed(collapsed)
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, JSON.stringify(collapsed))
    } catch (error) {
      console.error('[useSidebarState] Failed to save sidebar state:', error)
    }
  }, [])

  // 그룹 토글
  const toggleGroup = useCallback((groupId: string) => {
    setExpandedGroups(prev => {
      const newGroups = prev.includes(groupId)
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]

      cachedExpandedGroups = newGroups
      try {
        localStorage.setItem(SIDEBAR_GROUPS_KEY, JSON.stringify(newGroups))
      } catch (error) {
        console.error('[useSidebarState] Failed to save groups state:', error)
      }

      return newGroups
    })
  }, [])

  // 그룹 확장 여부 확인
  const isGroupExpanded = useCallback((groupId: string) => {
    return expandedGroups.includes(groupId)
  }, [expandedGroups])

  return {
    isCollapsed,
    expandedGroups,
    toggleSidebar,
    toggleGroup,
    isGroupExpanded,
    setSidebarCollapsed,
  }
}
