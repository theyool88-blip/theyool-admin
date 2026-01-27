'use client';

import { useEffect, useState } from 'react';
import {
  Globe,
  MapPin,
  Plus,
  Trash2,
  Save,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Video,
  Phone,
  Building2,
  MessageSquare,
  Clock,
  DollarSign,
} from 'lucide-react';
import { TenantHomepageSettings, OfficeLocation } from '@/types/tenant';

interface HomepageSettingsProps {
  hasHomepage: boolean;
}

export default function HomepageSettings({ hasHomepage }: HomepageSettingsProps) {
  const [settings, setSettings] = useState<TenantHomepageSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // 새 사무소 입력
  const [newOfficeName, setNewOfficeName] = useState('');
  const [newOfficeAddress, setNewOfficeAddress] = useState('');

  // 새 카테고리 입력
  const [newCategory, setNewCategory] = useState('');

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/tenant/homepage');
      const result = await response.json();

      if (result.success) {
        setSettings(result.data);
      } else {
        setError(result.error || '설정을 불러올 수 없습니다.');
      }
    } catch (err) {
      console.error('Failed to fetch homepage settings:', err);
      setError('서버 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (hasHomepage) {
      fetchSettings();
    } else {
      setLoading(false);
    }
  }, [hasHomepage]);

  const handleSave = async () => {
    if (!settings) return;

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/admin/tenant/homepage', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      const result = await response.json();

      if (result.success) {
        setSuccess('설정이 저장되었습니다.');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(result.error || '저장에 실패했습니다.');
      }
    } catch (err) {
      console.error('Failed to save homepage settings:', err);
      setError('서버 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const addOfficeLocation = () => {
    if (!newOfficeName.trim() || !settings) return;

    const newOffice: OfficeLocation = {
      id: `office-${Date.now()}`,
      name: newOfficeName.trim(),
      address: newOfficeAddress.trim(),
    };

    setSettings({
      ...settings,
      officeLocations: [...settings.officeLocations, newOffice],
    });

    setNewOfficeName('');
    setNewOfficeAddress('');
  };

  const removeOfficeLocation = (id: string) => {
    if (!settings) return;

    setSettings({
      ...settings,
      officeLocations: settings.officeLocations.filter((o) => o.id !== id),
    });
  };

  const addCategory = () => {
    if (!newCategory.trim() || !settings) return;

    if (settings.consultationCategories.includes(newCategory.trim())) {
      setError('이미 존재하는 카테고리입니다.');
      return;
    }

    setSettings({
      ...settings,
      consultationCategories: [...settings.consultationCategories, newCategory.trim()],
    });

    setNewCategory('');
  };

  const removeCategory = (category: string) => {
    if (!settings) return;

    setSettings({
      ...settings,
      consultationCategories: settings.consultationCategories.filter((c) => c !== category),
    });
  };

  if (!hasHomepage) {
    return (
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-[var(--bg-tertiary)] flex items-center justify-center">
            <Globe className="w-5 h-5 text-[var(--text-muted)]" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">홈페이지 연동</h2>
            <p className="text-caption">현재 플랜에서 사용할 수 없습니다</p>
          </div>
        </div>
        <p className="text-body">
          홈페이지 연동 기능을 사용하려면 엔터프라이즈 플랜으로 업그레이드하세요.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="card p-6">
        <div className="flex items-center gap-2 text-[var(--text-tertiary)]">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span className="text-sm">로딩 중...</span>
        </div>
      </div>
    );
  }

  if (!settings) return null;

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[var(--sage-muted)] flex items-center justify-center">
            <Globe className="w-5 h-5 text-[var(--sage-primary)]" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">홈페이지 설정</h2>
            <p className="text-caption">홈페이지 연동 및 상담 설정</p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn btn-primary h-9 px-4 text-sm flex items-center gap-2"
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

      <div className="space-y-6">
        {/* 도메인 정보 (읽기 전용) */}
        {(settings.domain || settings.subdomain) && (
          <div className="p-4 bg-[var(--bg-primary)] rounded-lg">
            <h3 className="text-xs font-medium text-[var(--text-secondary)] mb-2">연결된 도메인</h3>
            <p className="text-sm text-[var(--text-primary)] font-mono">
              {settings.domain || `${settings.subdomain}.theyool.kr`}
            </p>
          </div>
        )}

        {/* 사무소 위치 */}
        <div>
          <h3 className="text-sm font-medium text-[var(--text-primary)] mb-3 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-[var(--text-muted)]" />
            사무소 위치
          </h3>

          <div className="space-y-2 mb-3">
            {settings.officeLocations.map((office) => (
              <div
                key={office.id}
                className="flex items-center gap-3 p-3 bg-[var(--bg-primary)] rounded-lg"
              >
                <Building2 className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--text-primary)]">{office.name}</p>
                  {office.address && (
                    <p className="text-caption truncate">{office.address}</p>
                  )}
                </div>
                <button
                  onClick={() => removeOfficeLocation(office.id)}
                  className="p-1.5 text-[var(--text-muted)] hover:text-[var(--color-danger)]"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={newOfficeName}
              onChange={(e) => setNewOfficeName(e.target.value)}
              placeholder="사무소명 (예: 천안)"
              className="form-input flex-1 h-9 px-3 text-sm"
            />
            <input
              type="text"
              value={newOfficeAddress}
              onChange={(e) => setNewOfficeAddress(e.target.value)}
              placeholder="주소 (선택)"
              className="form-input flex-1 h-9 px-3 text-sm"
            />
            <button
              onClick={addOfficeLocation}
              disabled={!newOfficeName.trim()}
              className="btn btn-secondary h-9 px-3 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 상담 카테고리 */}
        <div>
          <h3 className="text-sm font-medium text-[var(--text-primary)] mb-3 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-[var(--text-muted)]" />
            상담 카테고리
          </h3>

          <div className="flex flex-wrap gap-2 mb-3">
            {settings.consultationCategories.map((category) => (
              <span
                key={category}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-[var(--bg-tertiary)] text-sm text-[var(--text-secondary)] rounded-full"
              >
                {category}
                <button
                  onClick={() => removeCategory(category)}
                  className="ml-1 text-[var(--text-muted)] hover:text-[var(--color-danger)]"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="새 카테고리 (예: 이혼, 상속)"
              onKeyPress={(e) => e.key === 'Enter' && addCategory()}
              className="form-input flex-1 h-9 px-3 text-sm"
            />
            <button
              onClick={addCategory}
              disabled={!newCategory.trim()}
              className="btn btn-secondary h-9 px-3 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 상담 유형 설정 */}
        <div>
          <h3 className="text-sm font-medium text-[var(--text-primary)] mb-3">상담 유형 허용</h3>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center gap-3 p-3 bg-[var(--bg-primary)] rounded-lg cursor-pointer">
              <input
                type="checkbox"
                checked={settings.allowVisitConsultation}
                onChange={(e) =>
                  setSettings({ ...settings, allowVisitConsultation: e.target.checked })
                }
                className="w-4 h-4 text-[var(--sage-primary)] rounded focus:ring-[var(--sage-primary)]"
              />
              <Building2 className="w-4 h-4 text-[var(--text-muted)]" />
              <span className="text-sm text-[var(--text-secondary)]">방문 상담</span>
            </label>

            <label className="flex items-center gap-3 p-3 bg-[var(--bg-primary)] rounded-lg cursor-pointer">
              <input
                type="checkbox"
                checked={settings.allowVideoConsultation}
                onChange={(e) =>
                  setSettings({ ...settings, allowVideoConsultation: e.target.checked })
                }
                className="w-4 h-4 text-[var(--sage-primary)] rounded focus:ring-[var(--sage-primary)]"
              />
              <Video className="w-4 h-4 text-[var(--text-muted)]" />
              <span className="text-sm text-[var(--text-secondary)]">화상 상담</span>
            </label>

            <label className="flex items-center gap-3 p-3 bg-[var(--bg-primary)] rounded-lg cursor-pointer">
              <input
                type="checkbox"
                checked={settings.allowPhoneConsultation}
                onChange={(e) =>
                  setSettings({ ...settings, allowPhoneConsultation: e.target.checked })
                }
                className="w-4 h-4 text-[var(--sage-primary)] rounded focus:ring-[var(--sage-primary)]"
              />
              <Phone className="w-4 h-4 text-[var(--text-muted)]" />
              <span className="text-sm text-[var(--text-secondary)]">전화 상담</span>
            </label>

            <label className="flex items-center gap-3 p-3 bg-[var(--bg-primary)] rounded-lg cursor-pointer">
              <input
                type="checkbox"
                checked={settings.allowCallbackRequest}
                onChange={(e) =>
                  setSettings({ ...settings, allowCallbackRequest: e.target.checked })
                }
                className="w-4 h-4 text-[var(--sage-primary)] rounded focus:ring-[var(--sage-primary)]"
              />
              <MessageSquare className="w-4 h-4 text-[var(--text-muted)]" />
              <span className="text-sm text-[var(--text-secondary)]">콜백 요청</span>
            </label>
          </div>
        </div>

        {/* 기본 설정 */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="form-label block mb-1.5">
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4 text-[var(--text-muted)]" />
                상담 시간 (분)
              </span>
            </label>
            <input
              type="number"
              value={settings.defaultSlotDuration}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  defaultSlotDuration: parseInt(e.target.value) || 30,
                })
              }
              min={15}
              max={120}
              step={15}
              className="form-input w-full h-10 px-3 text-sm"
            />
          </div>

          <div>
            <label className="form-label block mb-1.5">
              <span className="flex items-center gap-1">
                <DollarSign className="w-4 h-4 text-[var(--text-muted)]" />
                기본 상담료 (원)
              </span>
            </label>
            <input
              type="number"
              value={settings.defaultConsultationFee}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  defaultConsultationFee: parseInt(e.target.value) || 0,
                })
              }
              min={0}
              step={10000}
              className="form-input w-full h-10 px-3 text-sm"
            />
          </div>
        </div>

        <label className="flex items-center gap-3 p-3 bg-[var(--bg-primary)] rounded-lg cursor-pointer">
          <input
            type="checkbox"
            checked={settings.freeConsultationEnabled}
            onChange={(e) =>
              setSettings({ ...settings, freeConsultationEnabled: e.target.checked })
            }
            className="w-4 h-4 text-[var(--sage-primary)] rounded focus:ring-[var(--sage-primary)]"
          />
          <span className="text-sm text-[var(--text-secondary)]">무료 상담 허용</span>
        </label>
      </div>
    </div>
  );
}
