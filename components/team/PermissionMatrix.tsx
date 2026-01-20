'use client';

import { useEffect, useState } from 'react';
import {
  Shield,
  RefreshCw,
  AlertCircle,
  Check,
  X,
  Eye,
  Edit3,
  Trash2,
  ChevronDown,
} from 'lucide-react';
import { MemberRole, ROLE_DISPLAY_NAMES } from '@/types/tenant';
import {
  type PermissionModule,
  type DataScope,
  MODULE_DISPLAY_NAMES,
  MODULE_DESCRIPTIONS,
  DATA_SCOPE_DISPLAY_NAMES,
  ALL_MODULES,
} from '@/lib/auth/permission-types';

interface PermissionData {
  canRead: boolean;
  canWrite: boolean;
  canDelete: boolean;
  dataScope: DataScope;
}

type RolePermissions = Record<MemberRole, Record<PermissionModule, PermissionData>>;

interface PermissionMatrixProps {
  currentRole: MemberRole;
}

export default function PermissionMatrix({ currentRole }: PermissionMatrixProps) {
  const [permissions, setPermissions] = useState<RolePermissions | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [expandedRole, setExpandedRole] = useState<MemberRole | null>('lawyer');

  const roles: MemberRole[] = ['owner', 'admin', 'lawyer', 'staff'];
  const editableRoles: MemberRole[] = currentRole === 'owner' ? ['admin', 'lawyer', 'staff'] : ['lawyer', 'staff'];

  useEffect(() => {
    fetchPermissions();
  }, []);

  const fetchPermissions = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/admin/tenant/permissions');
      const result = await response.json();

      if (!result.success) {
        setError(result.error || '권한 정보를 가져올 수 없습니다.');
        return;
      }

      setPermissions(result.data.rolePermissions);
    } catch (err) {
      console.error('Fetch permissions error:', err);
      setError('서버 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handlePermissionChange = async (
    role: MemberRole,
    module: PermissionModule,
    field: 'canRead' | 'canWrite' | 'canDelete' | 'dataScope',
    value: boolean | DataScope
  ) => {
    if (!permissions) return;

    // Optimistic update
    const oldPermissions = { ...permissions };
    const newPermissions = { ...permissions };
    newPermissions[role] = { ...newPermissions[role] };
    newPermissions[role][module] = { ...newPermissions[role][module], [field]: value };
    setPermissions(newPermissions);

    setSaving(`${role}-${module}-${field}`);

    try {
      const response = await fetch('/api/admin/tenant/permissions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role,
          module,
          canRead: newPermissions[role][module].canRead,
          canWrite: newPermissions[role][module].canWrite,
          canDelete: newPermissions[role][module].canDelete,
          dataScope: newPermissions[role][module].dataScope,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        // Rollback on error
        setPermissions(oldPermissions);
        alert(result.error || '권한 수정에 실패했습니다.');
      }
    } catch (err) {
      console.error('Update permission error:', err);
      setPermissions(oldPermissions);
      alert('서버 오류가 발생했습니다.');
    } finally {
      setSaving(null);
    }
  };

  const isEditable = (role: MemberRole) => editableRoles.includes(role);

  if (loading) {
    return (
      <div className="card p-6">
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="w-6 h-6 animate-spin text-[var(--sage-primary)]" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-6">
        <div className="flex items-center gap-2 text-[var(--color-danger)]">
          <AlertCircle className="w-5 h-5" />
          <span className="text-sm">{error}</span>
        </div>
        <button
          onClick={fetchPermissions}
          className="mt-4 text-sm text-[var(--sage-primary)] hover:underline"
        >
          다시 시도
        </button>
      </div>
    );
  }

  if (!permissions) return null;

  return (
    <div className="space-y-4">
      {/* 범례 */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-6 text-xs">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-[var(--text-muted)]" />
            <span className="text-[var(--text-secondary)]">읽기</span>
          </div>
          <div className="flex items-center gap-2">
            <Edit3 className="w-4 h-4 text-[var(--text-muted)]" />
            <span className="text-[var(--text-secondary)]">쓰기</span>
          </div>
          <div className="flex items-center gap-2">
            <Trash2 className="w-4 h-4 text-[var(--text-muted)]" />
            <span className="text-[var(--text-secondary)]">삭제</span>
          </div>
          <div className="border-l border-[var(--border-default)] pl-6 flex items-center gap-4">
            <span className="text-[var(--text-muted)]">데이터 범위:</span>
            {Object.entries(DATA_SCOPE_DISPLAY_NAMES).map(([scope, name]) => (
              <span key={scope} className="text-[var(--text-secondary)]">
                {name}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* 역할별 권한 카드 */}
      {roles.map((role) => {
        const isExpanded = expandedRole === role;
        const canEdit = isEditable(role);

        return (
          <div key={role} className="card overflow-hidden">
            {/* 역할 헤더 */}
            <button
              onClick={() => setExpandedRole(isExpanded ? null : role)}
              className="w-full flex items-center justify-between p-4 hover:bg-[var(--bg-hover)] transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  role === 'owner' ? 'bg-[var(--color-warning-muted)]' :
                  role === 'admin' ? 'bg-[var(--color-info-muted)]' :
                  role === 'lawyer' ? 'bg-[var(--sage-muted)]' :
                  'bg-[var(--bg-tertiary)]'
                }`}>
                  <Shield className={`w-5 h-5 ${
                    role === 'owner' ? 'text-[var(--color-warning)]' :
                    role === 'admin' ? 'text-[var(--color-info)]' :
                    role === 'lawyer' ? 'text-[var(--sage-primary)]' :
                    'text-[var(--text-muted)]'
                  }`} />
                </div>
                <div className="text-left">
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                    {ROLE_DISPLAY_NAMES[role]}
                  </h3>
                  <p className="text-xs text-[var(--text-tertiary)]">
                    {!canEdit && '수정 불가'}
                    {canEdit && '클릭하여 권한 수정'}
                  </p>
                </div>
              </div>
              <ChevronDown className={`w-5 h-5 text-[var(--text-muted)] transition-transform ${
                isExpanded ? 'rotate-180' : ''
              }`} />
            </button>

            {/* 권한 매트릭스 */}
            {isExpanded && (
              <div className="border-t border-[var(--border-default)]">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[var(--bg-tertiary)]">
                        <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)]">
                          모듈
                        </th>
                        <th className="px-4 py-3 text-center font-medium text-[var(--text-secondary)] w-20">
                          <Eye className="w-4 h-4 mx-auto" />
                        </th>
                        <th className="px-4 py-3 text-center font-medium text-[var(--text-secondary)] w-20">
                          <Edit3 className="w-4 h-4 mx-auto" />
                        </th>
                        <th className="px-4 py-3 text-center font-medium text-[var(--text-secondary)] w-20">
                          <Trash2 className="w-4 h-4 mx-auto" />
                        </th>
                        <th className="px-4 py-3 text-center font-medium text-[var(--text-secondary)] w-32">
                          범위
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {ALL_MODULES.map((module) => {
                        const perm = permissions[role][module];
                        const isSaving = saving?.startsWith(`${role}-${module}`);

                        return (
                          <tr
                            key={module}
                            className="border-t border-[var(--border-subtle)] hover:bg-[var(--bg-primary)]"
                          >
                            <td className="px-4 py-3">
                              <div>
                                <p className="font-medium text-[var(--text-primary)]">
                                  {MODULE_DISPLAY_NAMES[module]}
                                </p>
                                <p className="text-xs text-[var(--text-muted)]">
                                  {MODULE_DESCRIPTIONS[module]}
                                </p>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center">
                              {canEdit ? (
                                <button
                                  onClick={() => handlePermissionChange(role, module, 'canRead', !perm.canRead)}
                                  disabled={isSaving}
                                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                                    perm.canRead
                                      ? 'bg-[var(--color-success-muted)] text-[var(--color-success)]'
                                      : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]'
                                  } ${isSaving ? 'opacity-50' : 'hover:opacity-80'}`}
                                >
                                  {perm.canRead ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                                </button>
                              ) : (
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center mx-auto ${
                                  perm.canRead
                                    ? 'bg-[var(--color-success-muted)] text-[var(--color-success)]'
                                    : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]'
                                }`}>
                                  {perm.canRead ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {canEdit ? (
                                <button
                                  onClick={() => handlePermissionChange(role, module, 'canWrite', !perm.canWrite)}
                                  disabled={isSaving}
                                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                                    perm.canWrite
                                      ? 'bg-[var(--color-success-muted)] text-[var(--color-success)]'
                                      : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]'
                                  } ${isSaving ? 'opacity-50' : 'hover:opacity-80'}`}
                                >
                                  {perm.canWrite ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                                </button>
                              ) : (
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center mx-auto ${
                                  perm.canWrite
                                    ? 'bg-[var(--color-success-muted)] text-[var(--color-success)]'
                                    : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]'
                                }`}>
                                  {perm.canWrite ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {canEdit ? (
                                <button
                                  onClick={() => handlePermissionChange(role, module, 'canDelete', !perm.canDelete)}
                                  disabled={isSaving}
                                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                                    perm.canDelete
                                      ? 'bg-[var(--color-success-muted)] text-[var(--color-success)]'
                                      : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]'
                                  } ${isSaving ? 'opacity-50' : 'hover:opacity-80'}`}
                                >
                                  {perm.canDelete ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                                </button>
                              ) : (
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center mx-auto ${
                                  perm.canDelete
                                    ? 'bg-[var(--color-success-muted)] text-[var(--color-success)]'
                                    : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]'
                                }`}>
                                  {perm.canDelete ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {canEdit ? (
                                <select
                                  value={perm.dataScope}
                                  onChange={(e) => handlePermissionChange(role, module, 'dataScope', e.target.value as DataScope)}
                                  disabled={isSaving}
                                  className="form-input h-8 px-2 text-xs text-center"
                                >
                                  {Object.entries(DATA_SCOPE_DISPLAY_NAMES).map(([scope, name]) => (
                                    <option key={scope} value={scope}>
                                      {name}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <span className="text-xs text-[var(--text-secondary)]">
                                  {DATA_SCOPE_DISPLAY_NAMES[perm.dataScope]}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* 도움말 */}
      <div className="p-4 bg-[var(--color-info-muted)] rounded-lg">
        <p className="text-xs text-[var(--color-info)]">
          <strong>참고:</strong> Owner 권한은 모든 기능에 대한 전체 접근 권한을 가지며 수정할 수 없습니다.
          {currentRole !== 'owner' && ' Admin 역할의 권한은 Owner만 수정할 수 있습니다.'}
        </p>
      </div>
    </div>
  );
}
