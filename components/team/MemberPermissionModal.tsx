'use client';

import { useEffect, useState } from 'react';
import {
  X,
  RefreshCw,
  AlertCircle,
  Check,
  Eye,
  Edit3,
  Trash2,
  RotateCcw,
  Crown,
  Shield,
  Scale,
  UserCircle,
} from 'lucide-react';
import { MemberRole, ROLE_DISPLAY_NAMES } from '@/types/tenant';
import {
  type PermissionModule,
  type DataScope,
  MODULE_DISPLAY_NAMES,
  DATA_SCOPE_DISPLAY_NAMES,
  ALL_MODULES,
} from '@/lib/auth/permission-types';

interface MemberData {
  id: string;
  role: MemberRole;
  display_name?: string;
  email?: string;
}

interface EffectivePermission {
  module: PermissionModule;
  canRead: boolean;
  canWrite: boolean;
  canDelete: boolean;
  dataScope: DataScope;
}

interface MemberOverride {
  module: PermissionModule;
  canRead: boolean | null;
  canWrite: boolean | null;
  canDelete: boolean | null;
  dataScope: DataScope | null;
}

interface MemberPermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: MemberData;
  currentRole: MemberRole;
}

export default function MemberPermissionModal({
  isOpen,
  onClose,
  member,
  currentRole: _currentRole,
}: MemberPermissionModalProps) {
  const [effectivePermissions, setEffectivePermissions] = useState<EffectivePermission[]>([]);
  const [overrides, setOverrides] = useState<MemberOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState('');

  const fetchMemberPermissions = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/admin/tenant/permissions/member/${member.id}`);
      const result = await response.json();

      if (!result.success) {
        setError(result.error || '권한 정보를 가져올 수 없습니다.');
        return;
      }

      setEffectivePermissions(result.data.effectivePermissions);
      setOverrides(result.data.overrides);
    } catch (err) {
      console.error('Fetch member permissions error:', err);
      setError('서버 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && member) {
      fetchMemberPermissions();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, member]);

  const handleOverrideChange = async (
    module: PermissionModule,
    field: 'canRead' | 'canWrite' | 'canDelete' | 'dataScope',
    value: boolean | DataScope | null
  ) => {
    setSaving(`${module}-${field}`);

    try {
      // 현재 오버라이드 찾기
      const currentOverride = overrides.find((o) => o.module === module);

      const response = await fetch(`/api/admin/tenant/permissions/member/${member.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module,
          canRead: field === 'canRead' ? value : currentOverride?.canRead ?? null,
          canWrite: field === 'canWrite' ? value : currentOverride?.canWrite ?? null,
          canDelete: field === 'canDelete' ? value : currentOverride?.canDelete ?? null,
          dataScope: field === 'dataScope' ? value : currentOverride?.dataScope ?? null,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        alert(result.error || '권한 수정에 실패했습니다.');
        return;
      }

      // 다시 불러오기
      fetchMemberPermissions();
    } catch (err) {
      console.error('Update permission error:', err);
      alert('서버 오류가 발생했습니다.');
    } finally {
      setSaving(null);
    }
  };

  const handleResetOverride = async (module: PermissionModule) => {
    setSaving(`${module}-reset`);

    try {
      const response = await fetch(`/api/admin/tenant/permissions/member/${member.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module,
          canRead: null,
          canWrite: null,
          canDelete: null,
          dataScope: null,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        alert(result.error || '권한 초기화에 실패했습니다.');
        return;
      }

      fetchMemberPermissions();
    } catch (err) {
      console.error('Reset permission error:', err);
      alert('서버 오류가 발생했습니다.');
    } finally {
      setSaving(null);
    }
  };

  const handleResetAll = async () => {
    if (!confirm('모든 권한 오버라이드를 초기화하시겠습니까?\n역할 기본 권한으로 돌아갑니다.')) {
      return;
    }

    setSaving('reset-all');

    try {
      const response = await fetch(`/api/admin/tenant/permissions/member/${member.id}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (!result.success) {
        alert(result.error || '권한 초기화에 실패했습니다.');
        return;
      }

      fetchMemberPermissions();
    } catch (err) {
      console.error('Reset all permissions error:', err);
      alert('서버 오류가 발생했습니다.');
    } finally {
      setSaving(null);
    }
  };

  const getRoleIcon = (role: MemberRole) => {
    switch (role) {
      case 'owner':
        return <Crown className="w-4 h-4 text-[var(--color-warning)]" />;
      case 'admin':
        return <Shield className="w-4 h-4 text-[var(--color-info)]" />;
      case 'lawyer':
        return <Scale className="w-4 h-4 text-[var(--sage-primary)]" />;
      default:
        return <UserCircle className="w-4 h-4 text-[var(--text-muted)]" />;
    }
  };

  const hasOverride = (module: PermissionModule) => {
    const override = overrides.find((o) => o.module === module);
    if (!override) return false;
    return (
      override.canRead !== null ||
      override.canWrite !== null ||
      override.canDelete !== null ||
      override.dataScope !== null
    );
  };

  const getOverrideValue = (module: PermissionModule, field: 'canRead' | 'canWrite' | 'canDelete'): boolean | 'role' => {
    const override = overrides.find((o) => o.module === module);
    if (!override || override[field] === null) return 'role';
    return override[field] as boolean;
  };

  const getDataScopeOverride = (module: PermissionModule): DataScope | 'role' => {
    const override = overrides.find((o) => o.module === module);
    if (!override || override.dataScope === null) return 'role';
    return override.dataScope;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-[var(--bg-secondary)] rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-default)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[var(--sage-muted)] flex items-center justify-center">
              {getRoleIcon(member.role)}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                {member.display_name || '이름 없음'} 권한 설정
              </h2>
              <p className="text-sm text-[var(--text-tertiary)]">
                역할: {ROLE_DISPLAY_NAMES[member.role]} | 개별 권한 오버라이드
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[var(--bg-hover)] rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-[var(--text-muted)]" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[calc(90vh-140px)]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-6 h-6 animate-spin text-[var(--sage-primary)]" />
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 text-[var(--color-danger)] p-4">
              <AlertCircle className="w-5 h-5" />
              <span className="text-sm">{error}</span>
            </div>
          ) : (
            <>
              {/* 설명 */}
              <div className="mb-4 p-3 bg-[var(--color-info-muted)] rounded-lg">
                <p className="text-xs text-[var(--color-info)]">
                  <strong>개별 권한 오버라이드:</strong> 역할 기본 권한과 다른 설정을 이 멤버에게만 적용합니다.
                  &quot;역할 기본&quot;을 선택하면 역할의 기본 권한을 따릅니다.
                </p>
              </div>

              {/* 권한 테이블 */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[var(--bg-tertiary)]">
                      <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)]">
                        모듈
                      </th>
                      <th className="px-4 py-3 text-center font-medium text-[var(--text-secondary)] w-28">
                        <div className="flex items-center justify-center gap-1">
                          <Eye className="w-4 h-4" />
                          <span>읽기</span>
                        </div>
                      </th>
                      <th className="px-4 py-3 text-center font-medium text-[var(--text-secondary)] w-28">
                        <div className="flex items-center justify-center gap-1">
                          <Edit3 className="w-4 h-4" />
                          <span>쓰기</span>
                        </div>
                      </th>
                      <th className="px-4 py-3 text-center font-medium text-[var(--text-secondary)] w-28">
                        <div className="flex items-center justify-center gap-1">
                          <Trash2 className="w-4 h-4" />
                          <span>삭제</span>
                        </div>
                      </th>
                      <th className="px-4 py-3 text-center font-medium text-[var(--text-secondary)] w-36">
                        범위
                      </th>
                      <th className="px-4 py-3 text-center font-medium text-[var(--text-secondary)] w-20">
                        초기화
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {ALL_MODULES.map((module) => {
                      const effective = effectivePermissions.find((p) => p.module === module);
                      const hasOvr = hasOverride(module);
                      const isSaving = saving?.startsWith(module);

                      return (
                        <tr
                          key={module}
                          className={`border-t border-[var(--border-subtle)] ${
                            hasOvr ? 'bg-[var(--color-warning-muted)]' : 'hover:bg-[var(--bg-primary)]'
                          }`}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-[var(--text-primary)]">
                                {MODULE_DISPLAY_NAMES[module]}
                              </span>
                              {hasOvr && (
                                <span className="text-xs px-1.5 py-0.5 bg-[var(--color-warning)] text-white rounded">
                                  오버라이드
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <TriStateToggle
                              value={getOverrideValue(module, 'canRead')}
                              effectiveValue={effective?.canRead ?? false}
                              onChange={(v) => handleOverrideChange(module, 'canRead', v)}
                              disabled={isSaving}
                            />
                          </td>
                          <td className="px-4 py-3 text-center">
                            <TriStateToggle
                              value={getOverrideValue(module, 'canWrite')}
                              effectiveValue={effective?.canWrite ?? false}
                              onChange={(v) => handleOverrideChange(module, 'canWrite', v)}
                              disabled={isSaving}
                            />
                          </td>
                          <td className="px-4 py-3 text-center">
                            <TriStateToggle
                              value={getOverrideValue(module, 'canDelete')}
                              effectiveValue={effective?.canDelete ?? false}
                              onChange={(v) => handleOverrideChange(module, 'canDelete', v)}
                              disabled={isSaving}
                            />
                          </td>
                          <td className="px-4 py-3 text-center">
                            <select
                              value={getDataScopeOverride(module)}
                              onChange={(e) => {
                                const val = e.target.value;
                                handleOverrideChange(
                                  module,
                                  'dataScope',
                                  val === 'role' ? null : (val as DataScope)
                                );
                              }}
                              disabled={isSaving}
                              className="form-input h-8 px-2 text-xs"
                            >
                              <option value="role">역할 기본 ({DATA_SCOPE_DISPLAY_NAMES[effective?.dataScope ?? 'all']})</option>
                              {Object.entries(DATA_SCOPE_DISPLAY_NAMES).map(([scope, name]) => (
                                <option key={scope} value={scope}>
                                  {name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {hasOvr && (
                              <button
                                onClick={() => handleResetOverride(module)}
                                disabled={isSaving}
                                className="p-1.5 hover:bg-[var(--bg-hover)] rounded transition-colors"
                                title="역할 기본값으로 초기화"
                              >
                                <RotateCcw className="w-4 h-4 text-[var(--text-muted)]" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-[var(--border-default)] bg-[var(--bg-primary)]">
          <button
            onClick={handleResetAll}
            disabled={loading || saving !== null || overrides.length === 0}
            className="text-sm text-[var(--color-danger)] hover:underline disabled:opacity-50 disabled:no-underline flex items-center gap-1"
          >
            <RotateCcw className="w-4 h-4" />
            모든 오버라이드 초기화
          </button>
          <button
            onClick={onClose}
            className="btn btn-primary h-9 px-4 text-sm"
          >
            완료
          </button>
        </div>
      </div>
    </div>
  );
}

// 3상태 토글 컴포넌트
interface TriStateToggleProps {
  value: boolean | 'role';
  effectiveValue: boolean;
  onChange: (value: boolean | null) => void;
  disabled?: boolean;
}

function TriStateToggle({ value, effectiveValue, onChange, disabled }: TriStateToggleProps) {
  // 현재 상태: 'role' (역할 기본), true (허용 오버라이드), false (거부 오버라이드)
  const handleClick = () => {
    if (disabled) return;

    if (value === 'role') {
      // 역할 기본 → 반대로 오버라이드
      onChange(!effectiveValue);
    } else if (value === effectiveValue) {
      // 역할과 같은 오버라이드 → 역할 기본으로
      onChange(null);
    } else {
      // 역할과 다른 오버라이드 → 역할 기본으로
      onChange(null);
    }
  };

  const isEffective = value === 'role' ? effectiveValue : value;
  const isOverride = value !== 'role';

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
        isEffective
          ? 'bg-[var(--color-success-muted)] text-[var(--color-success)]'
          : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]'
      } ${isOverride ? 'ring-2 ring-[var(--color-warning)]' : ''} ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-80 cursor-pointer'
      }`}
      title={
        value === 'role'
          ? `역할 기본: ${effectiveValue ? '허용' : '거부'}`
          : value
          ? '오버라이드: 허용'
          : '오버라이드: 거부'
      }
    >
      {isEffective ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
    </button>
  );
}
