'use client'

import { useState } from 'react'
import HolidayManagement from './HolidayManagement'

type TabType = 'holidays' | 'system' | 'notifications'

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('holidays')

  const tabs = [
    { id: 'holidays' as TabType, label: '공휴일 관리', icon: '📅' },
    { id: 'system' as TabType, label: '시스템 설정', icon: '⚙️' },
    { id: 'notifications' as TabType, label: '알림 설정', icon: '🔔' }
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">설정</h1>
          <p className="mt-2 text-sm text-gray-600">
            시스템 설정 및 공휴일 관리
          </p>
        </div>

        {/* 탭 네비게이션 */}
        <div className="bg-white rounded-lg shadow-sm mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px" aria-label="Tabs">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors
                    ${activeTab === tab.id
                      ? 'border-red-600 text-red-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                  `}
                >
                  <span className="text-xl">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* 탭 컨텐츠 */}
          <div className="p-6">
            {activeTab === 'holidays' && <HolidayManagement />}

            {activeTab === 'system' && (
              <div className="text-center py-12 text-gray-500">
                <p className="text-lg mb-2">시스템 설정</p>
                <p className="text-sm">준비 중입니다.</p>
              </div>
            )}

            {activeTab === 'notifications' && (
              <div className="text-center py-12 text-gray-500">
                <p className="text-lg mb-2">알림 설정</p>
                <p className="text-sm">준비 중입니다.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
