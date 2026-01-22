'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { ConsultationSource } from '@/types/consultation-source';
import { SOURCE_COLORS, getSourceColorClass } from '@/types/consultation-source';

export default function ConsultationSourcesSettingsPage() {
  const [sources, setSources] = useState<ConsultationSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSource, setEditingSource] = useState<ConsultationSource | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    color: 'gray',
    display_order: 0,
    is_active: true,
    is_default: false,
    description: '',
  });

  useEffect(() => {
    fetchSources();
  }, []);

  const fetchSources = async () => {
    try {
      const response = await fetch('/api/admin/consultation-sources');
      const data = await response.json();
      if (response.ok) {
        setSources(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching sources:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const url = editingSource
        ? `/api/admin/consultation-sources/${editingSource.id}`
        : '/api/admin/consultation-sources';

      const response = await fetch(url, {
        method: editingSource ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        await fetchSources();
        setShowAddModal(false);
        setEditingSource(null);
        resetForm();
        alert(data.message || '저장되었습니다.');
      } else {
        alert(data.error || '저장에 실패했습니다.');
      }
    } catch (error) {
      console.error('Error saving source:', error);
      alert('저장에 실패했습니다.');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`'${name}' 유입 경로를 삭제하시겠습니까?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/consultation-sources/${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (response.ok) {
        await fetchSources();
        alert(data.message || '삭제되었습니다.');
      } else {
        alert(data.error || '삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('Error deleting source:', error);
      alert('삭제에 실패했습니다.');
    }
  };

  const openAddModal = () => {
    resetForm();
    setEditingSource(null);
    setShowAddModal(true);
  };

  const openEditModal = (source: ConsultationSource) => {
    setFormData({
      name: source.name,
      color: source.color,
      display_order: source.display_order,
      is_active: source.is_active,
      is_default: source.is_default,
      description: source.description || '',
    });
    setEditingSource(source);
    setShowAddModal(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      color: 'gray',
      display_order: 0,
      is_active: true,
      is_default: false,
      description: '',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)]">
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-[var(--border-default)] border-t-[var(--text-secondary)]"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <div className="max-w-5xl mx-auto pt-6 pb-8 px-4">
        {/* 탭 네비게이션 */}
        <div className="flex items-center gap-3 mb-5 text-sm overflow-x-auto">
          <div className="flex bg-[var(--bg-tertiary)] rounded-lg p-0.5">
            <Link
              href="/admin/settings/profile"
              className="px-3 py-1.5 rounded-md transition-colors text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
            >
              내 정보
            </Link>
            <span className="px-3 py-1.5 rounded-md bg-[var(--bg-secondary)] shadow-sm font-medium text-[var(--text-primary)]">
              유입 경로
            </span>
            <Link
              href="/admin/settings/team"
              className="px-3 py-1.5 rounded-md transition-colors text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
            >
              팀원 관리
            </Link>
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
            <Link
              href="/admin/onboarding/import"
              className="px-3 py-1.5 rounded-md transition-colors text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
            >
              데이터 가져오기
            </Link>
          </div>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="text-sm text-[var(--text-tertiary)]">
            총 {sources.length}개의 유입 경로
          </div>
          <button
            onClick={openAddModal}
            className="btn btn-primary"
          >
            + 새 유입 경로
          </button>
        </div>

        {/* Sources List */}
        <div className="card">
          {sources.length === 0 ? (
            <div className="py-12 text-center text-[var(--text-muted)] text-sm">
              유입 경로가 없습니다. 새로 추가해주세요.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-[var(--bg-primary)] text-[var(--text-tertiary)] text-xs">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium">이름</th>
                  <th className="px-4 py-2.5 text-left font-medium">색상</th>
                  <th className="px-4 py-2.5 text-center font-medium">순서</th>
                  <th className="px-4 py-2.5 text-center font-medium">상태</th>
                  <th className="px-4 py-2.5 text-center font-medium">사용</th>
                  <th className="px-4 py-2.5 text-right font-medium">작업</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {sources.map((source) => (
                  <tr key={source.id} className="hover:bg-[var(--bg-hover)]">
                    <td className="px-4 py-3">
                      <div className="font-medium text-[var(--text-primary)]">{source.name}</div>
                      {source.description && (
                        <div className="text-xs text-[var(--text-tertiary)] mt-0.5">{source.description}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getSourceColorClass(source.color)}`}>
                        {source.color}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-[var(--text-tertiary)]">
                      {source.display_order}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {source.is_active ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-[var(--color-success-muted)] text-[var(--color-success)]">
                          활성
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-[var(--bg-tertiary)] text-[var(--text-secondary)]">
                          비활성
                        </span>
                      )}
                      {source.is_default && (
                        <span className="inline-flex items-center ml-1 px-1.5 py-0.5 rounded text-xs font-medium bg-[var(--color-info-muted)] text-[var(--color-info)]">
                          기본
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center text-[var(--text-tertiary)]">
                      {source.usage_count}건
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => openEditModal(source)}
                        className="text-[var(--sage-primary)] hover:opacity-80 text-xs mr-3"
                      >
                        수정
                      </button>
                      <button
                        onClick={() => handleDelete(source.id, source.name)}
                        className="text-[var(--color-danger)] hover:opacity-80 text-xs"
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-sm">
            <div className="px-5 py-4 border-b border-[var(--border-subtle)]">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                {editingSource ? '유입 경로 수정' : '새 유입 경로 추가'}
              </h3>
            </div>

            <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
              {/* Name */}
              <div className="form-group">
                <label className="form-label">
                  이름 <span className="text-[var(--color-danger)]">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="form-input"
                  placeholder="예: 인스타그램"
                  required
                />
              </div>

              {/* Color */}
              <div className="form-group">
                <label className="form-label">
                  색상
                </label>
                <select
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="form-input"
                >
                  {SOURCE_COLORS.map((color) => (
                    <option key={color.value} value={color.value}>
                      {color.label}
                    </option>
                  ))}
                </select>
                <div className="mt-2">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getSourceColorClass(formData.color)}`}>
                    미리보기
                  </span>
                </div>
              </div>

              {/* Display Order */}
              <div className="form-group">
                <label className="form-label">
                  정렬 순서
                </label>
                <input
                  type="number"
                  value={formData.display_order}
                  onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
                  className="form-input"
                  placeholder="0"
                />
                <p className="text-caption mt-1">낮은 숫자가 먼저 표시됩니다</p>
              </div>

              {/* Description */}
              <div className="form-group">
                <label className="form-label">
                  설명
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="form-input resize-none"
                  rows={2}
                  placeholder="선택사항"
                />
              </div>

              {/* Checkboxes */}
              <div className="space-y-2">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4 rounded border-[var(--border-default)] text-[var(--sage-primary)] focus:ring-[var(--sage-primary)]"
                  />
                  <span className="ml-2 text-sm text-[var(--text-secondary)]">활성화</span>
                </label>
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_default}
                    onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                    className="w-4 h-4 rounded border-[var(--border-default)] text-[var(--sage-primary)] focus:ring-[var(--sage-primary)]"
                  />
                  <span className="ml-2 text-sm text-[var(--text-secondary)]">기본값으로 설정</span>
                </label>
              </div>

              {/* Buttons */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingSource(null);
                    resetForm();
                  }}
                  className="btn btn-secondary flex-1"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="btn btn-primary flex-1"
                >
                  {editingSource ? '수정' : '추가'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
