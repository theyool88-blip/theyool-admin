'use client';

import { useState, useEffect } from 'react';
import AdminHeader from '@/components/AdminHeader';
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
      <div className="min-h-screen bg-gray-50">
        <AdminHeader title="유입 경로 관리" />
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-gray-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader title="유입 경로 관리" />

      <div className="max-w-5xl mx-auto pt-20 pb-8 px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="text-sm text-gray-500">
            총 {sources.length}개의 유입 경로
          </div>
          <button
            onClick={openAddModal}
            className="px-3 py-1.5 text-sm bg-sage-600 text-white rounded-lg hover:bg-sage-700 transition-colors"
          >
            + 새 유입 경로
          </button>
        </div>

        {/* Sources List */}
        <div className="bg-white rounded-lg border border-gray-200">
          {sources.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-sm">
              유입 경로가 없습니다. 새로 추가해주세요.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium">이름</th>
                  <th className="px-4 py-2.5 text-left font-medium">색상</th>
                  <th className="px-4 py-2.5 text-center font-medium">순서</th>
                  <th className="px-4 py-2.5 text-center font-medium">상태</th>
                  <th className="px-4 py-2.5 text-center font-medium">사용</th>
                  <th className="px-4 py-2.5 text-right font-medium">작업</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sources.map((source) => (
                  <tr key={source.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{source.name}</div>
                      {source.description && (
                        <div className="text-xs text-gray-500 mt-0.5">{source.description}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getSourceColorClass(source.color)}`}>
                        {source.color}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-500">
                      {source.display_order}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {source.is_active ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                          활성
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                          비활성
                        </span>
                      )}
                      {source.is_default && (
                        <span className="inline-flex items-center ml-1 px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                          기본
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-500">
                      {source.usage_count}건
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => openEditModal(source)}
                        className="text-sage-600 hover:text-sage-800 text-xs mr-3"
                      >
                        수정
                      </button>
                      <button
                        onClick={() => handleDelete(source.id, source.name)}
                        className="text-red-500 hover:text-red-700 text-xs"
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
          <div className="bg-white rounded-lg w-full max-w-sm">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">
                {editingSource ? '유입 경로 수정' : '새 유입 경로 추가'}
              </h3>
            </div>

            <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  이름 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-transparent"
                  placeholder="예: 인스타그램"
                  required
                />
              </div>

              {/* Color */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  색상
                </label>
                <select
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-transparent"
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
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  정렬 순서
                </label>
                <input
                  type="number"
                  value={formData.display_order}
                  onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-transparent"
                  placeholder="0"
                />
                <p className="text-xs text-gray-400 mt-1">낮은 숫자가 먼저 표시됩니다</p>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  설명
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-transparent resize-none"
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
                    className="w-4 h-4 rounded border-gray-300 text-sage-600 focus:ring-sage-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">활성화</span>
                </label>
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_default}
                    onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300 text-sage-600 focus:ring-sage-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">기본값으로 설정</span>
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
                  className="flex-1 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 text-sm bg-sage-600 text-white rounded-lg hover:bg-sage-700 transition-colors"
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
