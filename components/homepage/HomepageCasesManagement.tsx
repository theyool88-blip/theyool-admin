'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  X,
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Trophy,
} from 'lucide-react';
import ImageUploader from './ImageUploader';
import MarkdownEditorWithUpload from './MarkdownEditorWithUpload';

interface SuccessCase {
  id: string;
  title: string;
  slug: string;
  badge: string | null;
  categories: string[];
  background: string | null;
  strategy: string | null;
  result: string | null;
  icon: string | null;
  image_url: string | null;
  published: boolean;
  views: number;
  sort_order: number | null;
  created_at: string;
}

const categoryOptions = ['이혼', '재산분할', '위자료', '양육권', '상간사건'];

export default function HomepageCasesManagement() {
  const [cases, setCases] = useState<SuccessCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'published' | 'draft'>('all');

  // 모달 상태
  const [showModal, setShowModal] = useState(false);
  const [editingCase, setEditingCase] = useState<SuccessCase | null>(null);
  const [saving, setSaving] = useState(false);

  // 폼 데이터
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    badge: '',
    categories: [] as string[],
    background: '',
    result: '',
    icon: '',
    image_url: '',
    published: false,
  });

  const loadCases = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
      });

      if (search) params.set('search', search);
      if (filter !== 'all') params.set('published', filter === 'published' ? 'true' : 'false');

      const response = await fetch(`/api/admin/homepage/cases?${params}`);
      const result = await response.json();

      if (result.success) {
        setCases(result.data);
        setTotal(result.pagination.total);
        setTotalPages(result.pagination.totalPages);
      }
    } catch (error) {
      console.error('Cases load error:', error);
    } finally {
      setLoading(false);
    }
  }, [page, search, filter]);

  useEffect(() => {
    loadCases();
  }, [loadCases]);

  const resetForm = () => {
    setFormData({
      title: '',
      slug: '',
      badge: '',
      categories: [],
      background: '',
      result: '',
      icon: '',
      image_url: '',
      published: false,
    });
    setEditingCase(null);
  };

  const openNewModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = async (caseItem: SuccessCase) => {
    try {
      const response = await fetch(`/api/admin/homepage/cases/${caseItem.id}`);
      const result = await response.json();

      if (result.success) {
        const fullCase = result.data;
        setEditingCase(fullCase);
        setFormData({
          title: fullCase.title,
          slug: fullCase.slug || '',
          badge: fullCase.badge || '',
          categories: fullCase.categories || [],
          background: fullCase.background || '',
          result: fullCase.result || '',
          icon: fullCase.icon || '',
          image_url: fullCase.image_url || '',
          published: fullCase.published,
        });
        setShowModal(true);
      }
    } catch (error) {
      console.error('Load case error:', error);
      alert('성공사례를 불러오는데 실패했습니다.');
    }
  };

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      alert('제목을 입력해주세요.');
      return;
    }

    setSaving(true);
    try {
      const url = editingCase
        ? `/api/admin/homepage/cases/${editingCase.id}`
        : '/api/admin/homepage/cases';
      const method = editingCase ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (result.success) {
        setShowModal(false);
        resetForm();
        loadCases();
      } else {
        alert(result.error || '저장에 실패했습니다.');
      }
    } catch (error) {
      console.error('Save error:', error);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (caseItem: SuccessCase) => {
    if (!confirm(`"${caseItem.title}" 성공사례를 삭제하시겠습니까?`)) return;

    try {
      const response = await fetch(`/api/admin/homepage/cases/${caseItem.id}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        loadCases();
      } else {
        alert(result.error || '삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  const togglePublished = async (caseItem: SuccessCase) => {
    try {
      const response = await fetch(`/api/admin/homepage/cases/${caseItem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ published: !caseItem.published }),
      });

      const result = await response.json();

      if (result.success) {
        loadCases();
      }
    } catch (error) {
      console.error('Toggle error:', error);
    }
  };

  const generateSlug = () => {
    if (formData.title) {
      const slug = formData.title
        .toLowerCase()
        .replace(/[^가-힣a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      setFormData({ ...formData, slug });
    }
  };

  const toggleCategory = (category: string) => {
    setFormData((prev) => ({
      ...prev,
      categories: prev.categories.includes(category)
        ? prev.categories.filter((c) => c !== category)
        : [...prev.categories, category],
    }));
  };

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <p className="text-caption text-[var(--text-tertiary)]">
          총 <span className="font-medium text-[var(--text-primary)]">{total}</span>개
        </p>
        <button
          onClick={openNewModal}
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          성공사례 추가
        </button>
      </div>

      {/* 검색 및 필터 */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="검색..."
          className="form-input flex-1 h-10 px-3"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as typeof filter)}
          className="form-input h-10 px-3 appearance-none cursor-pointer"
        >
          <option value="all">전체</option>
          <option value="published">게시됨</option>
          <option value="draft">비공개</option>
        </select>
      </div>

      {/* 목록 */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-[var(--border-default)] border-t-[var(--sage-primary)] rounded-full animate-spin" />
        </div>
      ) : cases.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-20">
          <div className="w-12 h-12 rounded-full bg-[var(--sage-muted)] flex items-center justify-center mb-4">
            <Trophy className="w-6 h-6 text-[var(--sage-primary)]" />
          </div>
          <p className="text-body text-[var(--text-secondary)] mb-1">성공사례가 없습니다</p>
          <p className="text-caption text-[var(--text-muted)] mb-4">첫 번째 사례를 추가해보세요</p>
          <button
            onClick={openNewModal}
            className="btn btn-primary"
          >
            성공사례 추가
          </button>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="divide-y divide-[var(--border-subtle)]">
            {cases.map((caseItem) => (
              <div
                key={caseItem.id}
                className="p-4 hover:bg-[var(--bg-hover)] transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      {caseItem.icon && <span className="text-base">{caseItem.icon}</span>}
                      <h3 className="font-medium text-[var(--text-primary)] truncate">{caseItem.title}</h3>
                      {caseItem.badge && (
                        <span className="flex-shrink-0 px-2 py-0.5 text-xs bg-[var(--color-warning-muted)] text-[var(--color-warning)] rounded">
                          {caseItem.badge}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      {caseItem.categories?.map((cat) => (
                        <span key={cat} className="px-2 py-0.5 text-xs bg-[var(--sage-muted)] text-[var(--sage-primary)] rounded">
                          {cat}
                        </span>
                      ))}
                    </div>
                    {caseItem.result && (
                      <p className="text-caption text-[var(--text-tertiary)] line-clamp-1">{caseItem.result}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-[var(--text-muted)] tabular-nums mr-2">
                      조회 {caseItem.views || 0}
                    </span>
                    <button
                      onClick={() => togglePublished(caseItem)}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                        caseItem.published
                          ? 'bg-[var(--color-success-muted)] text-[var(--color-success)] hover:opacity-80'
                          : 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)]'
                      }`}
                    >
                      {caseItem.published ? (
                        <>
                          <Eye className="w-3.5 h-3.5" />
                          게시
                        </>
                      ) : (
                        <>
                          <EyeOff className="w-3.5 h-3.5" />
                          비공개
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => openEditModal(caseItem)}
                      className="p-2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] rounded-md transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(caseItem)}
                      className="p-2 text-[var(--text-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-muted)] rounded-md transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="p-2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="px-3 py-1 text-caption text-[var(--text-secondary)] tabular-nums">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="p-2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 에디터 모달 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--bg-secondary)] rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)]">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                {editingCase ? '성공사례 수정' : '새 성공사례 추가'}
              </h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
                className="p-2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 모달 바디 */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 왼쪽: 기본 정보 */}
                <div className="lg:col-span-1 space-y-5">
                  <div>
                    <label className="form-label">
                      제목 <span className="text-[var(--color-danger)]">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="form-input w-full h-10 px-3"
                      placeholder="성공사례 제목"
                    />
                  </div>

                  <div>
                    <label className="form-label">
                      URL Slug
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={formData.slug}
                        onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                        className="form-input flex-1 h-10 px-3"
                        placeholder="url-slug"
                      />
                      <button
                        type="button"
                        onClick={generateSlug}
                        className="btn btn-secondary px-3 h-10"
                      >
                        생성
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="form-label">
                        Badge
                      </label>
                      <input
                        type="text"
                        value={formData.badge}
                        onChange={(e) => setFormData({ ...formData, badge: e.target.value })}
                        className="form-input w-full h-10 px-3"
                        placeholder="Case 01"
                      />
                    </div>
                    <div>
                      <label className="form-label">
                        Icon
                      </label>
                      <input
                        type="text"
                        value={formData.icon}
                        onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                        className="form-input w-full h-10 px-3"
                        placeholder="예: "
                      />
                    </div>
                  </div>

                  <div>
                    <label className="form-label mb-2">
                      카테고리
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {categoryOptions.map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => toggleCategory(cat)}
                          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                            formData.categories.includes(cat)
                              ? 'bg-[var(--sage-primary)] text-white'
                              : 'bg-[var(--sage-muted)] text-[var(--sage-primary)] hover:opacity-80'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="form-label">
                      결과 요약
                    </label>
                    <textarea
                      value={formData.result}
                      onChange={(e) => setFormData({ ...formData, result: e.target.value })}
                      rows={2}
                      className="form-input w-full resize-none"
                      placeholder="예: 재산분할 5억원 승소"
                    />
                  </div>

                  <div>
                    <label className="form-label">
                      대표 이미지
                    </label>
                    <ImageUploader
                      value={formData.image_url}
                      onChange={(url) => setFormData({ ...formData, image_url: url })}
                      folder="cases"
                    />
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.published}
                      onChange={(e) => setFormData({ ...formData, published: e.target.checked })}
                      className="w-4 h-4 rounded border-[var(--border-default)] text-[var(--sage-primary)] focus:ring-[var(--sage-primary)]"
                    />
                    <span className="text-body text-[var(--text-secondary)]">게시하기</span>
                  </label>
                </div>

                {/* 오른쪽: 마크다운 에디터 */}
                <div className="lg:col-span-2" data-color-mode="light">
                  <label className="form-label">
                    본문
                  </label>
                  <MarkdownEditorWithUpload
                    value={formData.background}
                    onChange={(val) => setFormData({ ...formData, background: val })}
                    height={400}
                    folder="cases"
                    preview="live"
                  />
                </div>
              </div>
            </div>

            {/* 모달 푸터 */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--border-subtle)]">
              <button
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
                className="btn btn-secondary"
              >
                취소
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="btn btn-primary flex items-center gap-2 disabled:opacity-50"
              >
                {saving ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                {editingCase ? '수정' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
