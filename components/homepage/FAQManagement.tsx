'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  X,
  Check,
  ChevronRight,
  Eye,
  EyeOff,
  HelpCircle,
} from 'lucide-react';

interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: string;
  display_order: number;
  published: boolean;
  created_at: string;
}

const categoryOptions = ['일반', '이혼절차', '재산분할', '양육권', '위자료', '비용안내'];

export default function FAQManagement() {
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [grouped, setGrouped] = useState<Record<string, FAQ[]>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'published' | 'draft'>('all');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // 모달 상태
  const [showModal, setShowModal] = useState(false);
  const [editingFaq, setEditingFaq] = useState<FAQ | null>(null);
  const [saving, setSaving] = useState(false);

  // 폼 데이터
  const [formData, setFormData] = useState({
    question: '',
    answer: '',
    category: '일반',
    published: true,
  });

  const loadFaqs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (filter !== 'all') params.set('published', filter === 'published' ? 'true' : 'false');

      const response = await fetch(`/api/admin/homepage/faqs?${params}`);
      const result = await response.json();

      if (result.success) {
        setFaqs(result.data);
        setGrouped(result.grouped || {});
        // 초기에 모든 카테고리 펼치기
        if (expandedCategories.size === 0) {
          setExpandedCategories(new Set(Object.keys(result.grouped || {})));
        }
      }
    } catch (error) {
      console.error('FAQ load error:', error);
    } finally {
      setLoading(false);
    }
  }, [filter, expandedCategories.size]);

  useEffect(() => {
    loadFaqs();
  }, [loadFaqs]);

  const resetForm = () => {
    setFormData({
      question: '',
      answer: '',
      category: '일반',
      published: true,
    });
    setEditingFaq(null);
  };

  const openNewModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (faq: FAQ) => {
    setEditingFaq(faq);
    setFormData({
      question: faq.question,
      answer: faq.answer,
      category: faq.category,
      published: faq.published,
    });
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!formData.question.trim()) {
      alert('질문을 입력해주세요.');
      return;
    }
    if (!formData.answer.trim()) {
      alert('답변을 입력해주세요.');
      return;
    }

    setSaving(true);
    try {
      const url = editingFaq
        ? `/api/admin/homepage/faqs/${editingFaq.id}`
        : '/api/admin/homepage/faqs';
      const method = editingFaq ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (result.success) {
        setShowModal(false);
        resetForm();
        loadFaqs();
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

  const handleDelete = async (faq: FAQ) => {
    if (!confirm(`"${faq.question.slice(0, 30)}..." FAQ를 삭제하시겠습니까?`)) return;

    try {
      const response = await fetch(`/api/admin/homepage/faqs/${faq.id}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        loadFaqs();
      } else {
        alert(result.error || '삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  const togglePublished = async (faq: FAQ) => {
    try {
      const response = await fetch(`/api/admin/homepage/faqs/${faq.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ published: !faq.published }),
      });

      const result = await response.json();

      if (result.success) {
        loadFaqs();
      }
    } catch (error) {
      console.error('Toggle error:', error);
    }
  };

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--text-tertiary)]">
          총 <span className="font-medium text-[var(--text-primary)]">{faqs.length}</span>개
        </p>
        <div className="flex items-center gap-3">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
            className="form-input h-10 px-3 text-sm appearance-none cursor-pointer"
          >
            <option value="all">전체</option>
            <option value="published">게시됨</option>
            <option value="draft">비공개</option>
          </select>
          <button
            onClick={openNewModal}
            className="btn btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            FAQ 추가
          </button>
        </div>
      </div>

      {/* 목록 (카테고리별 그룹) */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-[var(--border-default)] border-t-[var(--sage-primary)] rounded-full animate-spin" />
        </div>
      ) : faqs.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-20">
          <div className="w-12 h-12 rounded-full bg-[var(--sage-muted)] flex items-center justify-center mb-4">
            <HelpCircle className="w-6 h-6 text-[var(--sage-primary)]" />
          </div>
          <p className="text-[var(--text-secondary)] mb-1">FAQ가 없습니다</p>
          <p className="text-caption mb-4">자주 묻는 질문을 추가해보세요</p>
          <button
            onClick={openNewModal}
            className="btn btn-primary"
          >
            FAQ 추가
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category} className="card overflow-hidden">
              {/* 카테고리 헤더 */}
              <button
                onClick={() => toggleCategory(category)}
                className="w-full flex items-center justify-between px-4 py-3 bg-[var(--sage-muted)]/50 hover:bg-[var(--sage-muted)] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`transition-transform duration-200 ${expandedCategories.has(category) ? 'rotate-90' : ''}`}>
                    <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
                  </div>
                  <span className="font-medium text-[var(--text-primary)]">{category}</span>
                  <span className="text-xs text-[var(--text-muted)] bg-[var(--bg-secondary)] px-2 py-0.5 rounded-full">{items.length}</span>
                </div>
              </button>

              {/* FAQ 목록 */}
              {expandedCategories.has(category) && (
                <div className="divide-y divide-[var(--border-subtle)]">
                  {items.map((faq) => (
                    <div key={faq.id} className="p-4 hover:bg-[var(--bg-hover)] transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-[var(--text-primary)] mb-1">{faq.question}</p>
                          <p className="text-sm text-[var(--text-tertiary)] line-clamp-2">{faq.answer}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => togglePublished(faq)}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                              faq.published
                                ? 'bg-[var(--color-success-muted)] text-[var(--color-success)] hover:bg-[var(--color-success-muted)]'
                                : 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)]'
                            }`}
                          >
                            {faq.published ? (
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
                            onClick={() => openEditModal(faq)}
                            className="p-2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] rounded-md transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(faq)}
                            className="p-2 text-[var(--text-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-muted)] rounded-md transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 모달 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--bg-secondary)] rounded-2xl shadow-2xl w-full max-w-xl">
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)]">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                {editingFaq ? 'FAQ 수정' : '새 FAQ 추가'}
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
            <div className="p-6 space-y-5">
              <div>
                <label className="form-label">
                  카테고리
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="form-input w-full"
                >
                  {categoryOptions.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label">
                  질문 <span className="text-[var(--color-danger)]">*</span>
                </label>
                <input
                  type="text"
                  value={formData.question}
                  onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                  className="form-input w-full"
                  placeholder="자주 묻는 질문"
                />
              </div>

              <div>
                <label className="form-label">
                  답변 <span className="text-[var(--color-danger)]">*</span>
                </label>
                <textarea
                  value={formData.answer}
                  onChange={(e) => setFormData({ ...formData, answer: e.target.value })}
                  rows={5}
                  className="form-input w-full resize-none"
                  placeholder="질문에 대한 답변"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.published}
                  onChange={(e) => setFormData({ ...formData, published: e.target.checked })}
                  className="w-4 h-4 rounded border-[var(--border-default)] text-[var(--sage-primary)] focus:ring-[var(--sage-primary)]"
                />
                <span className="text-sm text-[var(--text-secondary)]">게시하기</span>
              </label>
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
                className="btn btn-primary flex items-center gap-2"
              >
                {saving ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                {editingFaq ? '수정' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
