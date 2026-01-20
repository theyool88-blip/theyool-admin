'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Users, Shield, Link2 } from 'lucide-react';
import { MemberRole } from '@/types/tenant';
import MemberList from '@/components/team/MemberList';
import PermissionMatrix from '@/components/team/PermissionMatrix';
import AssignmentList from '@/components/team/AssignmentList';

type TabType = 'members' | 'permissions' | 'assignments';

interface TabItem {
  id: TabType;
  label: string;
  icon: typeof Users;
  description: string;
}

interface CurrentMember {
  id: string;
  role: MemberRole;
}

interface TenantInfo {
  type: string;
}

export default function TeamSettingsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('members');
  const [currentMember, setCurrentMember] = useState<CurrentMember | null>(null);
  const [tenantInfo, setTenantInfo] = useState<TenantInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const tabs: TabItem[] = [
    {
      id: 'members',
      label: '멤버',
      icon: Users,
      description: '팀원 초대, 정보 수정, 정지/해제',
    },
    {
      id: 'permissions',
      label: '권한 설정',
      icon: Shield,
      description: '역할별 기본 권한 및 개별 권한 오버라이드',
    },
    {
      id: 'assignments',
      label: '배정',
      icon: Link2,
      description: '직원-변호사 담당 매핑',
    },
  ];

  useEffect(() => {
    const fetchInfo = async () => {
      try {
        const response = await fetch('/api/admin/tenant');
        const result = await response.json();

        if (result.success) {
          setCurrentMember(result.data.currentMember);
          setTenantInfo({ type: result.data.tenant.type });
        }
      } catch (error) {
        console.error('Failed to fetch tenant info:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchInfo();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--sage-primary)]" />
      </div>
    );
  }

  const canEdit = currentMember && ['owner', 'admin'].includes(currentMember.role);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Header */}
      <header className="bg-[var(--bg-secondary)] border-b border-[var(--border-default)]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16">
            <div className="flex items-center gap-3">
              <Link
                href="/admin/settings"
                className="p-2 hover:bg-[var(--bg-hover)] rounded -ml-2"
              >
                <ArrowLeft className="w-4 h-4 text-[var(--text-tertiary)]" />
              </Link>
              <h1 className="text-lg font-bold text-[var(--text-primary)]">팀원 관리</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 상위 탭 네비게이션 (설정 페이지로 연결) */}
        <div className="flex items-center gap-3 mb-5 text-sm">
          <div className="flex bg-[var(--bg-tertiary)] rounded-lg p-0.5">
            <Link
              href="/admin/settings"
              className="px-3 py-1.5 rounded-md transition-colors text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
            >
              상담 시간
            </Link>
            <Link
              href="/admin/settings/sources"
              className="px-3 py-1.5 rounded-md transition-colors text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
            >
              유입 경로
            </Link>
            <span className="px-3 py-1.5 rounded-md bg-[var(--bg-secondary)] shadow-sm font-medium text-[var(--text-primary)]">
              팀원 관리
            </span>
            <Link
              href="/admin/settings/alerts"
              className="px-3 py-1.5 rounded-md transition-colors text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
            >
              알림
            </Link>
            <Link
              href="/admin/settings/integrations"
              className="px-3 py-1.5 rounded-md transition-colors text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
            >
              연동
            </Link>
            <Link
              href="/admin/settings/tenant"
              className="px-3 py-1.5 rounded-md transition-colors text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
            >
              사무소
            </Link>
          </div>
        </div>

        {/* 서브 탭 네비게이션 */}
        <div className="flex items-center gap-1 mb-6 border-b border-[var(--border-default)]">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  isActive
                    ? 'text-[var(--sage-primary)] border-[var(--sage-primary)]'
                    : 'text-[var(--text-tertiary)] border-transparent hover:text-[var(--text-secondary)] hover:border-[var(--border-default)]'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* 탭 설명 */}
        <div className="mb-6">
          <p className="text-sm text-[var(--text-tertiary)]">
            {tabs.find((t) => t.id === activeTab)?.description}
          </p>
        </div>

        {/* 탭 컨텐츠 */}
        {activeTab === 'members' && currentMember && tenantInfo && (
          <MemberList
            currentMemberId={currentMember.id}
            currentRole={currentMember.role}
            tenantType={tenantInfo.type}
          />
        )}

        {activeTab === 'permissions' && canEdit && (
          <PermissionMatrix currentRole={currentMember?.role || 'admin'} />
        )}

        {activeTab === 'assignments' && canEdit && <AssignmentList />}

        {!canEdit && activeTab !== 'members' && (
          <div className="card p-12 text-center">
            <Shield className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-4" />
            <p className="text-sm text-[var(--text-tertiary)]">
              이 설정을 변경하려면 관리자 권한이 필요합니다.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
