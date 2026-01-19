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
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
            <Globe className="w-5 h-5 text-gray-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">홈페이지 연동</h2>
            <p className="text-xs text-gray-500">현재 플랜에서 사용할 수 없습니다</p>
          </div>
        </div>
        <p className="text-sm text-gray-500">
          홈페이지 연동 기능을 사용하려면 엔터프라이즈 플랜으로 업그레이드하세요.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center gap-2 text-gray-500">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span className="text-sm">로딩 중...</span>
        </div>
      </div>
    );
  }

  if (!settings) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-sage-100 flex items-center justify-center">
            <Globe className="w-5 h-5 text-sage-600" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">홈페이지 설정</h2>
            <p className="text-xs text-gray-500">홈페이지 연동 및 상담 설정</p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="h-9 px-4 text-sm font-medium text-white bg-sage-600 rounded hover:bg-sage-700 disabled:opacity-50 flex items-center gap-2"
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
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
          <p className="text-sm text-green-600">{success}</p>
        </div>
      )}

      <div className="space-y-6">
        {/* 도메인 정보 (읽기 전용) */}
        {(settings.domain || settings.subdomain) && (
          <div className="p-4 bg-gray-50 rounded-lg">
            <h3 className="text-xs font-medium text-gray-700 mb-2">연결된 도메인</h3>
            <p className="text-sm text-gray-900 font-mono">
              {settings.domain || `${settings.subdomain}.theyool.kr`}
            </p>
          </div>
        )}

        {/* 사무소 위치 */}
        <div>
          <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-gray-400" />
            사무소 위치
          </h3>

          <div className="space-y-2 mb-3">
            {settings.officeLocations.map((office) => (
              <div
                key={office.id}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
              >
                <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{office.name}</p>
                  {office.address && (
                    <p className="text-xs text-gray-500 truncate">{office.address}</p>
                  )}
                </div>
                <button
                  onClick={() => removeOfficeLocation(office.id)}
                  className="p-1.5 text-gray-400 hover:text-red-500"
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
              className="flex-1 h-9 px-3 text-sm border border-gray-200 rounded focus:outline-none focus:border-sage-500"
            />
            <input
              type="text"
              value={newOfficeAddress}
              onChange={(e) => setNewOfficeAddress(e.target.value)}
              placeholder="주소 (선택)"
              className="flex-1 h-9 px-3 text-sm border border-gray-200 rounded focus:outline-none focus:border-sage-500"
            />
            <button
              onClick={addOfficeLocation}
              disabled={!newOfficeName.trim()}
              className="h-9 px-3 text-sm font-medium text-sage-600 bg-sage-50 rounded hover:bg-sage-100 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 상담 카테고리 */}
        <div>
          <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-gray-400" />
            상담 카테고리
          </h3>

          <div className="flex flex-wrap gap-2 mb-3">
            {settings.consultationCategories.map((category) => (
              <span
                key={category}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-sm text-gray-700 rounded-full"
              >
                {category}
                <button
                  onClick={() => removeCategory(category)}
                  className="ml-1 text-gray-400 hover:text-red-500"
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
              className="flex-1 h-9 px-3 text-sm border border-gray-200 rounded focus:outline-none focus:border-sage-500"
            />
            <button
              onClick={addCategory}
              disabled={!newCategory.trim()}
              className="h-9 px-3 text-sm font-medium text-sage-600 bg-sage-50 rounded hover:bg-sage-100 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 상담 유형 설정 */}
        <div>
          <h3 className="text-sm font-medium text-gray-900 mb-3">상담 유형 허용</h3>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer">
              <input
                type="checkbox"
                checked={settings.allowVisitConsultation}
                onChange={(e) =>
                  setSettings({ ...settings, allowVisitConsultation: e.target.checked })
                }
                className="w-4 h-4 text-sage-600 rounded focus:ring-sage-500"
              />
              <Building2 className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-700">방문 상담</span>
            </label>

            <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer">
              <input
                type="checkbox"
                checked={settings.allowVideoConsultation}
                onChange={(e) =>
                  setSettings({ ...settings, allowVideoConsultation: e.target.checked })
                }
                className="w-4 h-4 text-sage-600 rounded focus:ring-sage-500"
              />
              <Video className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-700">화상 상담</span>
            </label>

            <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer">
              <input
                type="checkbox"
                checked={settings.allowPhoneConsultation}
                onChange={(e) =>
                  setSettings({ ...settings, allowPhoneConsultation: e.target.checked })
                }
                className="w-4 h-4 text-sage-600 rounded focus:ring-sage-500"
              />
              <Phone className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-700">전화 상담</span>
            </label>

            <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer">
              <input
                type="checkbox"
                checked={settings.allowCallbackRequest}
                onChange={(e) =>
                  setSettings({ ...settings, allowCallbackRequest: e.target.checked })
                }
                className="w-4 h-4 text-sage-600 rounded focus:ring-sage-500"
              />
              <MessageSquare className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-700">콜백 요청</span>
            </label>
          </div>
        </div>

        {/* 기본 설정 */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4 text-gray-400" />
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
              className="w-full h-10 px-3 text-sm border border-gray-200 rounded focus:outline-none focus:border-sage-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              <span className="flex items-center gap-1">
                <DollarSign className="w-4 h-4 text-gray-400" />
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
              className="w-full h-10 px-3 text-sm border border-gray-200 rounded focus:outline-none focus:border-sage-500"
            />
          </div>
        </div>

        <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer">
          <input
            type="checkbox"
            checked={settings.freeConsultationEnabled}
            onChange={(e) =>
              setSettings({ ...settings, freeConsultationEnabled: e.target.checked })
            }
            className="w-4 h-4 text-sage-600 rounded focus:ring-sage-500"
          />
          <span className="text-sm text-gray-700">무료 상담 허용</span>
        </label>
      </div>
    </div>
  );
}
