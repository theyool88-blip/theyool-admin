'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  X,
  Check,
  Star,
  Eye,
  EyeOff,
  MessageSquare,
  Filter,
  Quote,
} from 'lucide-react';

interface Testimonial {
  id: string;
  client_name: string;
  client_initial: string;
  content: string;
  rating: number;
  verified: boolean;
  consent_given: boolean;
  published: boolean;
  featured: boolean;
  photo_url: string | null;
  use_photo: boolean;
  avatar_bg_color: string;
  avatar_text_color: string;
  display_order: number;
  created_at: string;
}

const bgColorOptions = [
  { value: 'from-slate-500 to-slate-700', label: '다크', preview: 'bg-slate-600' },
  { value: 'from-stone-400 to-stone-600', label: '스톤', preview: 'bg-stone-500' },
  { value: 'from-zinc-400 to-zinc-600', label: '진회색', preview: 'bg-zinc-500' },
  { value: 'from-sage-400 to-sage-600', label: '세이지', preview: 'bg-[#6DB5A4]' },
  { value: 'from-neutral-400 to-neutral-600', label: '중립', preview: 'bg-neutral-500' },
  { value: 'from-gray-400 to-gray-600', label: '회색', preview: 'bg-gray-500' },
];

export default function TestimonialsManagement() {
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'published' | 'draft'>('all');

  // 모달 상태
  const [showModal, setShowModal] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewTestimonial, setPreviewTestimonial] = useState<Testimonial | null>(null);
  const [editingTestimonial, setEditingTestimonial] = useState<Testimonial | null>(null);
  const [saving, setSaving] = useState(false);

  // 폼 데이터
  const [formData, setFormData] = useState({
    client_name: '',
    client_initial: '',
    content: '',
    rating: 5,
    verified: false,
    consent_given: true,
    published: false,
    featured: false,
    avatar_bg_color: 'from-blue-400 to-blue-600',
  });

  const loadTestimonials = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (filter !== 'all') params.set('published', filter === 'published' ? 'true' : 'false');

      const response = await fetch(`/api/admin/homepage/testimonials?${params}`);
      const result = await response.json();

      if (result.success) {
        setTestimonials(result.data);
      }
    } catch (error) {
      console.error('Testimonials load error:', error);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadTestimonials();
  }, [loadTestimonials]);

  const resetForm = () => {
    setFormData({
      client_name: '',
      client_initial: '',
      content: '',
      rating: 5,
      verified: false,
      consent_given: true,
      published: false,
      featured: false,
      avatar_bg_color: 'from-blue-400 to-blue-600',
    });
    setEditingTestimonial(null);
  };

  const openNewModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (testimonial: Testimonial) => {
    setEditingTestimonial(testimonial);
    setFormData({
      client_name: testimonial.client_name,
      client_initial: testimonial.client_initial,
      content: testimonial.content,
      rating: testimonial.rating,
      verified: testimonial.verified,
      consent_given: testimonial.consent_given,
      published: testimonial.published,
      featured: testimonial.featured,
      avatar_bg_color: testimonial.avatar_bg_color,
    });
    setShowModal(true);
  };

  const openPreview = (testimonial: Testimonial) => {
    setPreviewTestimonial(testimonial);
    setShowPreview(true);
  };

  const handleSubmit = async () => {
    if (!formData.client_name.trim()) {
      alert('의뢰인 이름을 입력해주세요.');
      return;
    }
    if (!formData.content.trim()) {
      alert('후기 내용을 입력해주세요.');
      return;
    }

    setSaving(true);
    try {
      const url = editingTestimonial
        ? `/api/admin/homepage/testimonials/${editingTestimonial.id}`
        : '/api/admin/homepage/testimonials';
      const method = editingTestimonial ? 'PUT' : 'POST';

      const submitData = {
        ...formData,
        client_initial: formData.client_initial || formData.client_name.charAt(0).toUpperCase(),
      };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData),
      });

      const result = await response.json();

      if (result.success) {
        setShowModal(false);
        resetForm();
        loadTestimonials();
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

  const handleDelete = async (testimonial: Testimonial) => {
    if (!confirm(`"${testimonial.client_name}" 후기를 삭제하시겠습니까?`)) return;

    try {
      const response = await fetch(`/api/admin/homepage/testimonials/${testimonial.id}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        loadTestimonials();
      } else {
        alert(result.error || '삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  const togglePublished = async (testimonial: Testimonial) => {
    try {
      const response = await fetch(`/api/admin/homepage/testimonials/${testimonial.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ published: !testimonial.published }),
      });

      const result = await response.json();

      if (result.success) {
        loadTestimonials();
      }
    } catch (error) {
      console.error('Toggle error:', error);
    }
  };

  const renderStars = (rating: number, interactive = false, onChange?: (r: number) => void) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => interactive && onChange?.(star)}
            className={interactive ? 'cursor-pointer' : 'cursor-default'}
            disabled={!interactive}
          >
            <Star
              className={`w-4 h-4 transition-colors ${
                star <= rating
                  ? 'fill-[var(--color-warning)] text-[var(--color-warning)]'
                  : interactive
                    ? 'text-[var(--border-default)] hover:text-[var(--color-warning)]'
                    : 'text-[var(--border-default)]'
              }`}
            />
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--text-tertiary)]">
          총 <span className="font-medium text-[var(--text-primary)]">{testimonials.length}</span>개
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
            후기 추가
          </button>
        </div>
      </div>

      {/* 목록 */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-[var(--border-default)] border-t-[var(--sage-primary)] rounded-full animate-spin" />
        </div>
      ) : testimonials.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-20">
          <div className="w-12 h-12 rounded-full bg-[var(--sage-muted)] flex items-center justify-center mb-4">
            <MessageSquare className="w-6 h-6 text-[var(--sage-primary)]" />
          </div>
          <p className="text-[var(--text-secondary)] mb-1">후기가 없습니다</p>
          <p className="text-caption mb-4">고객 후기를 추가해보세요</p>
          <button
            onClick={openNewModal}
            className="btn btn-primary"
          >
            후기 추가
          </button>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="divide-y divide-[var(--border-subtle)]">
            {testimonials.map((testimonial) => (
              <div
                key={testimonial.id}
                className="p-4 hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
                onClick={() => openPreview(testimonial)}
              >
                <div className="flex items-start gap-4">
                  {/* 아바타 */}
                  <div
                    className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-gradient-to-br ${testimonial.avatar_bg_color}`}
                  >
                    <span className="text-sm font-semibold text-white">
                      {testimonial.client_initial}
                    </span>
                  </div>

                  {/* 정보 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-[var(--text-primary)]">
                        {testimonial.client_name}
                      </span>
                      {renderStars(testimonial.rating)}
                      {testimonial.verified && (
                        <span className="px-1.5 py-0.5 text-xs bg-[var(--color-info-muted)] text-[var(--color-info)] rounded">검증됨</span>
                      )}
                      {testimonial.featured && (
                        <span className="px-1.5 py-0.5 text-xs bg-purple-50 text-purple-600 rounded">추천</span>
                      )}
                    </div>
                    <p className="text-sm text-[var(--text-tertiary)] line-clamp-2">
                      {testimonial.content}
                    </p>
                  </div>

                  {/* 액션 */}
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => togglePublished(testimonial)}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                        testimonial.published
                          ? 'bg-[var(--color-success-muted)] text-[var(--color-success)] hover:bg-[var(--color-success-muted)]'
                          : 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)]'
                      }`}
                    >
                      {testimonial.published ? (
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
                      onClick={() => openEditModal(testimonial)}
                      className="p-2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] rounded-md transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(testimonial)}
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

      {/* 수정/추가 모달 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--bg-secondary)] rounded-2xl shadow-2xl w-full max-w-xl">
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)]">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                {editingTestimonial ? '후기 수정' : '새 후기 추가'}
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">
                    의뢰인 이름 <span className="text-[var(--color-danger)]">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.client_name}
                    onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                    className="form-input"
                    placeholder="김OO"
                  />
                </div>
                <div>
                  <label className="form-label">
                    이니셜
                  </label>
                  <input
                    type="text"
                    value={formData.client_initial}
                    onChange={(e) => setFormData({ ...formData, client_initial: e.target.value })}
                    className="form-input"
                    placeholder="김"
                    maxLength={2}
                  />
                </div>
              </div>

              <div>
                <label className="form-label">
                  후기 내용 <span className="text-[var(--color-danger)]">*</span>
                </label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  rows={4}
                  className="form-input resize-none"
                  placeholder="의뢰인의 후기 내용"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">
                    평점
                  </label>
                  <div className="flex items-center gap-1 h-10">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setFormData({ ...formData, rating: star })}
                        className="p-0.5"
                      >
                        <Star
                          className={`w-6 h-6 transition-colors ${
                            star <= formData.rating
                              ? 'fill-[var(--color-warning)] text-[var(--color-warning)]'
                              : 'text-[var(--border-default)] hover:text-[var(--color-warning)]'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="form-label">
                    아바타 색상
                  </label>
                  <div className="flex items-center gap-2 h-10">
                    {bgColorOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setFormData({ ...formData, avatar_bg_color: option.value })}
                        className={`w-6 h-6 rounded-full ${option.preview} transition-transform ${
                          formData.avatar_bg_color === option.value
                            ? 'ring-2 ring-offset-2 ring-sage-500 scale-110'
                            : 'hover:scale-110'
                        }`}
                        title={option.label}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-x-6 gap-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.verified}
                    onChange={(e) => setFormData({ ...formData, verified: e.target.checked })}
                    className="w-4 h-4 rounded border-[var(--border-default)] text-[var(--sage-primary)] focus:ring-[var(--sage-primary)]"
                  />
                  <span className="text-sm text-[var(--text-secondary)]">검증됨</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.featured}
                    onChange={(e) => setFormData({ ...formData, featured: e.target.checked })}
                    className="w-4 h-4 rounded border-[var(--border-default)] text-[var(--sage-primary)] focus:ring-[var(--sage-primary)]"
                  />
                  <span className="text-sm text-[var(--text-secondary)]">추천</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.consent_given}
                    onChange={(e) => setFormData({ ...formData, consent_given: e.target.checked })}
                    className="w-4 h-4 rounded border-[var(--border-default)] text-[var(--sage-primary)] focus:ring-[var(--sage-primary)]"
                  />
                  <span className="text-sm text-[var(--text-secondary)]">게시 동의</span>
                </label>
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
                {editingTestimonial ? '수정' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 프리뷰 모달 */}
      {showPreview && previewTestimonial && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--bg-secondary)] rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)]">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">후기 미리보기</h2>
              <button
                onClick={() => {
                  setShowPreview(false);
                  setPreviewTestimonial(null);
                }}
                className="p-2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <div className="relative bg-[var(--sage-muted)] rounded-xl p-5">
                <Quote className="absolute top-4 left-4 w-8 h-8 text-[var(--border-default)]" />
                <div className="relative">
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center bg-gradient-to-br ${previewTestimonial.avatar_bg_color}`}
                    >
                      <span className="text-lg font-bold text-white">
                        {previewTestimonial.client_initial}
                      </span>
                    </div>
                    <div>
                      <p className="font-semibold text-[var(--text-primary)]">
                        {previewTestimonial.client_name}
                      </p>
                      {renderStars(previewTestimonial.rating)}
                    </div>
                  </div>
                  <p className="text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap">
                    {previewTestimonial.content}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--border-subtle)]">
              <button
                onClick={() => {
                  setShowPreview(false);
                  openEditModal(previewTestimonial);
                }}
                className="btn btn-secondary flex items-center gap-2"
              >
                <Edit2 className="w-4 h-4" />
                수정
              </button>
              <button
                onClick={() => {
                  setShowPreview(false);
                  setPreviewTestimonial(null);
                }}
                className="btn btn-primary"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
