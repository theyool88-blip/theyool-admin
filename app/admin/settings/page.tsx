'use client'

import { useState } from 'react'
import Link from 'next/link'
import AdminHeader from '@/components/AdminHeader'
import HolidayManagement from './HolidayManagement'
import ConsultationAvailability from './ConsultationAvailability'

type TabType = 'holidays' | 'consultation' | 'sources' | 'system' | 'notifications'

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('holidays')

  const tabs = [
    { id: 'holidays' as TabType, label: '공휴일 관리' },
    { id: 'consultation' as TabType, label: '상담 시간' },
    { id: 'sources' as TabType, label: '유입 경로' },
    { id: 'system' as TabType, label: '시스템' },
    { id: 'notifications' as TabType, label: '알림' }
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader title="설정" />

      <div className="max-w-5xl mx-auto pt-20 pb-8 px-4">
        {/* 탭 네비게이션 */}
        <div className="flex items-center gap-3 mb-5 text-sm">
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  activeTab === tab.id
                    ? 'bg-white shadow-sm font-medium text-gray-900'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* 탭 컨텐츠 */}
        {activeTab === 'holidays' && <HolidayManagement />}

        {activeTab === 'consultation' && <ConsultationAvailability />}

        {activeTab === 'sources' && (
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="p-6 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-sage-100 rounded-full mb-4">
                <svg className="w-6 h-6 text-sage-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-900 mb-1">상담 유입 경로 관리</p>
              <p className="text-xs text-gray-500 mb-4">
                네이버, 홈페이지 등 상담 유입 경로를 관리합니다.
              </p>
              <Link
                href="/admin/settings/sources"
                className="inline-flex items-center px-4 py-2 text-sm bg-sage-600 text-white rounded-lg hover:bg-sage-700 transition-colors"
              >
                유입 경로 관리
                <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>
        )}

        {activeTab === 'system' && (
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="p-12 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-gray-100 rounded-full mb-4">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <p className="text-sm text-gray-500">준비 중입니다.</p>
            </div>
          </div>
        )}

        {activeTab === 'notifications' && (
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="p-12 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-gray-100 rounded-full mb-4">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <p className="text-sm text-gray-500">준비 중입니다.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
