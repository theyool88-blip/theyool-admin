'use client';

import { useEffect, useState } from 'react';
import {
  Globe,
  Link2,
  Save,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Check,
  X,
  Copy,
  ExternalLink,
  Palette,
} from 'lucide-react';

interface DomainData {
  domain?: string;
  subdomain?: string;
  hasHomepage: boolean;
  primaryColor?: string;
  dnsInstructions: {
    cname: string;
  };
}

interface DomainSettingsProps {
  hasHomepage: boolean;
}

export default function DomainSettings({ hasHomepage }: DomainSettingsProps) {
  const [data, setData] = useState<DomainData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  // Suppress unused warning - validating state is set but not read in UI
  void validating;
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // 편집 상태
  const [editDomain, setEditDomain] = useState('');
  const [editSubdomain, setEditSubdomain] = useState('');
  const [editPrimaryColor, setEditPrimaryColor] = useState('#4a7c59');
  const [domainValid, setDomainValid] = useState<boolean | null>(null);
  const [subdomainValid, setSubdomainValid] = useState<boolean | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchDomain = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/tenant/domain');
      const result = await response.json();

      if (result.success) {
        setData(result.data);
        setEditDomain(result.data.domain || '');
        setEditSubdomain(result.data.subdomain || '');
        setEditPrimaryColor(result.data.primaryColor || '#4a7c59');
      } else {
        setError(result.error || '도메인 정보를 불러올 수 없습니다.');
      }
    } catch (err) {
      console.error('Failed to fetch domain:', err);
      setError('서버 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (hasHomepage) {
      fetchDomain();
    } else {
      setLoading(false);
    }
  }, [hasHomepage]);

  const validateDomain = async (type: 'domain' | 'subdomain') => {
    setValidating(true);
    try {
      const body = type === 'domain'
        ? { domain: editDomain }
        : { subdomain: editSubdomain };

      const response = await fetch('/api/admin/tenant/domain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (result.success) {
        if (type === 'domain') {
          setDomainValid(result.data.valid);
          if (!result.data.valid) {
            setError(result.data.error);
          }
        } else {
          setSubdomainValid(result.data.valid);
          if (!result.data.valid) {
            setError(result.data.error);
          }
        }
      }
    } catch (err) {
      console.error('Validation error:', err);
    } finally {
      setValidating(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/admin/tenant/domain', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: editDomain || null,
          subdomain: editSubdomain || null,
          primaryColor: editPrimaryColor || null,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setSuccess('도메인 설정이 저장되었습니다.');
        fetchDomain();
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(result.error || '저장에 실패했습니다.');
      }
    } catch (err) {
      console.error('Failed to save domain:', err);
      setError('서버 오류가 발생했습니다.');
    } finally {
      setSaving(false);
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

  if (!hasHomepage) {
    return null;
  }

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[var(--sage-muted)] flex items-center justify-center">
            <Globe className="w-5 h-5 text-[var(--sage-primary)]" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">도메인 설정</h2>
            <p className="text-xs text-[var(--text-tertiary)]">홈페이지 도메인 및 브랜딩</p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn btn-primary flex items-center gap-2"
        >
          {saving ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              저장 중...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              저장
            </>
          )}
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

      {loading ? (
        <div className="flex items-center gap-2 text-[var(--text-tertiary)]">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span className="text-sm">로딩 중...</span>
        </div>
      ) : (
        <div className="space-y-6">
          {/* 커스텀 도메인 */}
          <div>
            <label className="form-label">
              커스텀 도메인
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={editDomain}
                  onChange={(e) => {
                    setEditDomain(e.target.value);
                    setDomainValid(null);
                  }}
                  onBlur={() => editDomain && validateDomain('domain')}
                  placeholder="example.com"
                  className="form-input w-full pr-10"
                />
                {domainValid !== null && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2">
                    {domainValid ? (
                      <Check className="w-4 h-4 text-[var(--color-success)]" />
                    ) : (
                      <X className="w-4 h-4 text-[var(--color-danger)]" />
                    )}
                  </span>
                )}
              </div>
              {editDomain && (
                <a
                  href={`https://${editDomain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
            <p className="mt-1.5 text-caption">
              자체 도메인이 있다면 입력하세요. DNS 설정이 필요합니다.
            </p>
          </div>

          {/* 서브도메인 */}
          <div>
            <label className="form-label">
              서브도메인
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={editSubdomain}
                  onChange={(e) => {
                    setEditSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
                    setSubdomainValid(null);
                  }}
                  onBlur={() => editSubdomain && validateDomain('subdomain')}
                  placeholder="mylaw"
                  className="form-input w-full pr-10"
                />
                {subdomainValid !== null && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2">
                    {subdomainValid ? (
                      <Check className="w-4 h-4 text-[var(--color-success)]" />
                    ) : (
                      <X className="w-4 h-4 text-[var(--color-danger)]" />
                    )}
                  </span>
                )}
              </div>
              <span className="text-sm text-[var(--text-tertiary)]">.theyool.kr</span>
            </div>
            <p className="mt-1.5 text-caption">
              영문 소문자, 숫자, 하이픈만 사용 가능합니다.
            </p>
          </div>

          {/* DNS 설정 안내 */}
          {(editDomain || data?.domain) && (
            <div className="p-4 bg-[var(--bg-primary)] rounded-lg">
              <h3 className="text-xs font-medium text-[var(--text-secondary)] mb-2 flex items-center gap-1">
                <Link2 className="w-3.5 h-3.5" />
                DNS 설정 안내
              </h3>
              <p className="text-xs text-[var(--text-secondary)] mb-2">
                도메인 DNS 설정에서 다음 CNAME 레코드를 추가하세요:
              </p>
              <div className="flex items-center gap-2 p-2 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded">
                <code className="flex-1 text-xs font-mono text-[var(--text-primary)]">
                  CNAME → {data?.dnsInstructions.cname || 'cname.vercel-dns.com'}
                </code>
                <button
                  onClick={() => copyToClipboard(data?.dnsInstructions.cname || 'cname.vercel-dns.com')}
                  className="p-1 text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-[var(--color-success)]" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
              <p className="mt-2 text-caption">
                DNS 변경 후 반영까지 최대 48시간이 소요될 수 있습니다.
              </p>
            </div>
          )}

          {/* 브랜드 컬러 */}
          <div>
            <label className="form-label flex items-center gap-1">
              <Palette className="w-4 h-4 text-[var(--text-muted)]" />
              브랜드 컬러
            </label>
            <div className="flex items-center gap-3">
              <div className="relative">
                <input
                  type="color"
                  value={editPrimaryColor}
                  onChange={(e) => setEditPrimaryColor(e.target.value)}
                  className="w-12 h-10 p-1 border border-[var(--border-default)] rounded cursor-pointer"
                />
              </div>
              <input
                type="text"
                value={editPrimaryColor}
                onChange={(e) => setEditPrimaryColor(e.target.value)}
                placeholder="#4a7c59"
                className="form-input w-28 font-mono"
              />
              <div
                className="h-10 flex-1 rounded border border-[var(--border-default)]"
                style={{ backgroundColor: editPrimaryColor }}
              />
            </div>
            <p className="mt-1.5 text-caption">
              홈페이지에서 주요 버튼, 링크 등에 사용됩니다.
            </p>
          </div>

          {/* 미리보기 링크 */}
          {(editDomain || editSubdomain) && (
            <div className="pt-4 border-t border-[var(--border-subtle)]">
              <p className="text-caption mb-2">홈페이지 주소:</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 p-2 bg-[var(--bg-primary)] border border-[var(--border-default)] rounded text-sm font-mono text-[var(--text-secondary)]">
                  https://{editDomain || `${editSubdomain}.theyool.kr`}
                </code>
                <a
                  href={`https://${editDomain || `${editSubdomain}.theyool.kr`}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary flex items-center gap-1"
                >
                  <ExternalLink className="w-4 h-4" />
                  열기
                </a>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
