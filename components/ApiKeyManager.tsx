'use client';

import { useEffect, useState } from 'react';
import {
  Key,
  Plus,
  Trash2,
  Copy,
  Check,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';

interface ApiKeyData {
  id: string;
  key_prefix: string;
  name?: string;
  scopes: string[];
  rate_limit_per_minute: number;
  allowed_origins: string[];
  is_active: boolean;
  expires_at?: string;
  last_used_at?: string;
  usage_count: number;
  created_at: string;
}

interface NewKeyResponse extends ApiKeyData {
  apiKey: string;  // 전체 API 키 (생성 시에만)
}

interface ApiKeyManagerProps {
  hasHomepage: boolean;
}

export default function ApiKeyManager({ hasHomepage }: ApiKeyManagerProps) {
  const [keys, setKeys] = useState<ApiKeyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // 새로 생성된 키 표시
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // 새 키 생성 모달
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState('홈페이지 연동용');

  const fetchKeys = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/tenant/api-keys');
      const result = await response.json();

      if (result.success) {
        setKeys(result.data || []);
      } else {
        setError(result.error || 'API 키 목록을 불러올 수 없습니다.');
      }
    } catch (err) {
      console.error('Failed to fetch API keys:', err);
      setError('서버 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (hasHomepage) {
      fetchKeys();
    } else {
      setLoading(false);
    }
  }, [hasHomepage]);

  const handleCreateKey = async () => {
    setCreating(true);
    setError('');

    try {
      const response = await fetch('/api/admin/tenant/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName }),
      });

      const result = await response.json();

      if (result.success) {
        const newKey = result.data as NewKeyResponse;
        setNewApiKey(newKey.apiKey);
        setShowCreateModal(false);
        setNewKeyName('홈페이지 연동용');
        fetchKeys();
      } else {
        setError(result.error || 'API 키 생성에 실패했습니다.');
      }
    } catch (err) {
      console.error('Failed to create API key:', err);
      setError('서버 오류가 발생했습니다.');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (keyId: string, currentActive: boolean) => {
    try {
      const response = await fetch(`/api/admin/tenant/api-keys/${keyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentActive }),
      });

      const result = await response.json();

      if (result.success) {
        fetchKeys();
      } else {
        setError(result.error || '상태 변경에 실패했습니다.');
      }
    } catch (err) {
      console.error('Failed to toggle API key:', err);
      setError('서버 오류가 발생했습니다.');
    }
  };

  const handleDeleteKey = async (keyId: string) => {
    if (!confirm('이 API 키를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/tenant/api-keys/${keyId}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        setSuccess('API 키가 삭제되었습니다.');
        setTimeout(() => setSuccess(''), 3000);
        fetchKeys();
      } else {
        setError(result.error || 'API 키 삭제에 실패했습니다.');
      }
    } catch (err) {
      console.error('Failed to delete API key:', err);
      setError('서버 오류가 발생했습니다.');
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: '2-digit',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!hasHomepage) {
    return null;
  }

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[var(--sage-muted)] flex items-center justify-center">
            <Key className="w-5 h-5 text-[var(--sage-primary)]" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">API 키 관리</h2>
            <p className="text-xs text-[var(--text-tertiary)]">홈페이지 연동용 API 키</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          새 API 키
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mb-4 p-3 bg-[var(--color-danger-muted)] border border-[var(--color-danger)] rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-[var(--color-danger)] flex-shrink-0" />
          <p className="text-sm text-[var(--color-danger)]">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-[var(--color-success-muted)] border border-[var(--color-success)] rounded-lg flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-[var(--color-success)] flex-shrink-0" />
          <p className="text-sm text-[var(--color-success)]">{success}</p>
        </div>
      )}

      {/* 새로 생성된 키 표시 */}
      {newApiKey && (
        <div className="mb-4 p-4 bg-[var(--sage-muted)] border border-[var(--sage-primary)] rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-[var(--sage-primary)]" />
            <p className="text-sm font-medium text-[var(--text-primary)]">
              API 키가 생성되었습니다
            </p>
          </div>
          <p className="text-xs text-[var(--text-secondary)] mb-3">
            이 키는 다시 확인할 수 없습니다. 안전하게 보관하세요.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 p-2 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded text-sm font-mono text-[var(--text-primary)] overflow-x-auto">
              {newApiKey}
            </code>
            <button
              onClick={() => copyToClipboard(newApiKey)}
              className="btn btn-secondary h-9 px-3 flex items-center gap-1"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  복사됨
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  복사
                </>
              )}
            </button>
          </div>
          <button
            onClick={() => setNewApiKey(null)}
            className="mt-3 text-xs text-[var(--sage-primary)] hover:underline"
          >
            닫기
          </button>
        </div>
      )}

      {/* 키 목록 */}
      {loading ? (
        <div className="flex items-center gap-2 text-[var(--text-tertiary)]">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span className="text-sm">로딩 중...</span>
        </div>
      ) : keys.length === 0 ? (
        <div className="text-center py-8">
          <Key className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-3" />
          <p className="text-sm text-[var(--text-tertiary)]">API 키가 없습니다</p>
          <p className="text-caption mt-1">
            홈페이지와 연동하려면 API 키를 생성하세요
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {keys.map((key) => (
            <div
              key={key.id}
              className={`p-4 rounded-lg border ${
                key.is_active
                  ? 'bg-[var(--bg-secondary)] border-[var(--border-default)]'
                  : 'bg-[var(--bg-primary)] border-[var(--border-subtle)]'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium text-[var(--text-primary)]">
                      {key.name || '이름 없음'}
                    </p>
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded ${
                        key.is_active
                          ? 'bg-[var(--color-success-muted)] text-[var(--color-success)]'
                          : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'
                      }`}
                    >
                      {key.is_active ? '활성' : '비활성'}
                    </span>
                  </div>
                  <p className="text-xs font-mono text-[var(--text-tertiary)] mb-2">
                    {key.key_prefix}...
                  </p>
                  <div className="flex items-center gap-4 text-xs text-[var(--text-tertiary)]">
                    <span>생성: {formatDate(key.created_at)}</span>
                    <span>마지막 사용: {formatDate(key.last_used_at)}</span>
                    <span>호출: {key.usage_count || 0}회</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => handleToggleActive(key.id, key.is_active)}
                    className={`p-2 rounded ${
                      key.is_active
                        ? 'text-[var(--color-success)] hover:bg-[var(--color-success-muted)]'
                        : 'text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)]'
                    }`}
                    title={key.is_active ? '비활성화' : '활성화'}
                  >
                    {key.is_active ? (
                      <ToggleRight className="w-5 h-5" />
                    ) : (
                      <ToggleLeft className="w-5 h-5" />
                    )}
                  </button>
                  <button
                    onClick={() => handleDeleteKey(key.id)}
                    className="p-2 text-[var(--text-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-muted)] rounded"
                    title="삭제"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 생성 모달 */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--bg-secondary)] rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
                새 API 키 생성
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="form-label">
                    키 이름
                  </label>
                  <input
                    type="text"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    placeholder="예: 홈페이지 연동용"
                    className="form-input w-full"
                  />
                </div>

                <p className="text-caption">
                  API 키는 생성 후 다시 확인할 수 없습니다.
                  생성되면 바로 안전한 곳에 저장하세요.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 px-6 py-4 bg-[var(--bg-primary)] rounded-b-lg">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewKeyName('홈페이지 연동용');
                }}
                className="btn btn-secondary"
              >
                취소
              </button>
              <button
                onClick={handleCreateKey}
                disabled={creating || !newKeyName.trim()}
                className="btn btn-primary flex items-center gap-2"
              >
                {creating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    생성 중...
                  </>
                ) : (
                  '생성'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
