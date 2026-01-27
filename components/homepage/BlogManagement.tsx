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
  Calendar,
  User,
  Search,
} from 'lucide-react';
import ImageUploader from './ImageUploader';
import MarkdownEditorWithUpload from './MarkdownEditorWithUpload';

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  category: string | null;
  tags: string[];
  featured_image: string | null;
  author_name: string | null;
  published: boolean;
  published_at: string | null;
  views: number;
  created_at: string;
}

const categoryOptions = ['이혼상담', '재산분할', '위자료', '양육권', '법률정보', '칼럼'];

export default function BlogManagement() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'published' | 'draft'>('all');
  const [categoryFilter, setCategoryFilter] = useState('');

  // 모달 상태
  const [showModal, setShowModal] = useState(false);
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
  const [saving, setSaving] = useState(false);

  // 폼 데이터
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    content: '',
    excerpt: '',
    category: '',
    tags: [] as string[],
    featured_image: '',
    author_name: '',
    published: false,
  });

  const loadPosts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
      });

      if (search) params.set('search', search);
      if (filter !== 'all') params.set('published', filter === 'published' ? 'true' : 'false');
      if (categoryFilter) params.set('category', categoryFilter);

      const response = await fetch(`/api/admin/homepage/blog?${params}`);
      const result = await response.json();

      if (result.success) {
        setPosts(result.data);
        setTotal(result.pagination.total);
        setTotalPages(result.pagination.totalPages);
      }
    } catch (error) {
      console.error('Posts load error:', error);
    } finally {
      setLoading(false);
    }
  }, [page, search, filter, categoryFilter]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const resetForm = () => {
    setFormData({
      title: '',
      slug: '',
      content: '',
      excerpt: '',
      category: '',
      tags: [],
      featured_image: '',
      author_name: '',
      published: false,
    });
    setEditingPost(null);
  };

  const openNewModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (post: BlogPost) => {
    setEditingPost(post);
    setFormData({
      title: post.title,
      slug: post.slug,
      content: post.content,
      excerpt: post.excerpt || '',
      category: post.category || '',
      tags: post.tags || [],
      featured_image: post.featured_image || '',
      author_name: post.author_name || '',
      published: post.published,
    });
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      alert('제목을 입력해주세요.');
      return;
    }

    setSaving(true);
    try {
      const url = editingPost
        ? `/api/admin/homepage/blog/${editingPost.id}`
        : '/api/admin/homepage/blog';
      const method = editingPost ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (result.success) {
        setShowModal(false);
        resetForm();
        loadPosts();
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

  const handleDelete = async (post: BlogPost) => {
    if (!confirm(`"${post.title}" 글을 삭제하시겠습니까?`)) return;

    try {
      const response = await fetch(`/api/admin/homepage/blog/${post.id}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        loadPosts();
      } else {
        alert(result.error || '삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  const togglePublished = async (post: BlogPost) => {
    try {
      const response = await fetch(`/api/admin/homepage/blog/${post.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ published: !post.published }),
      });

      const result = await response.json();

      if (result.success) {
        loadPosts();
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-[var(--text-tertiary)]">
            총 <span className="font-medium text-[var(--text-primary)]">{total}</span>개
          </p>
        </div>
        <button
          onClick={openNewModal}
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          새 글 작성
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
        <div className="flex gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
            className="form-input h-10 px-3 appearance-none cursor-pointer"
          >
            <option value="all">전체 상태</option>
            <option value="published">게시됨</option>
            <option value="draft">비공개</option>
          </select>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="form-input h-10 px-3 appearance-none cursor-pointer"
          >
            <option value="">전체 카테고리</option>
            {categoryOptions.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 목록 */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-[var(--sage-muted)] border-t-[var(--sage-primary)] rounded-full animate-spin" />
        </div>
      ) : posts.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-20">
          <div className="w-12 h-12 rounded-full bg-[var(--sage-muted)] flex items-center justify-center mb-4">
            <Search className="w-6 h-6 text-[var(--text-muted)]" />
          </div>
          <p className="text-[var(--text-secondary)] mb-1">블로그 글이 없습니다</p>
          <p className="text-sm text-[var(--text-muted)] mb-4">첫 번째 글을 작성해보세요</p>
          <button
            onClick={openNewModal}
            className="btn btn-primary"
          >
            새 글 작성
          </button>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="divide-y divide-[var(--border-subtle)]">
            {posts.map((post) => (
              <div
                key={post.id}
                className="p-4 hover:bg-[var(--bg-hover)] transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <h3 className="font-medium text-[var(--text-primary)] truncate">{post.title}</h3>
                      {post.category && (
                        <span className="flex-shrink-0 px-2 py-0.5 text-xs bg-[var(--sage-muted)] text-[var(--sage-primary)] rounded">
                          {post.category}
                        </span>
                      )}
                    </div>
                    {post.excerpt && (
                      <p className="text-sm text-[var(--text-tertiary)] line-clamp-1 mb-2">{post.excerpt}</p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-[var(--text-muted)]">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {formatDate(post.created_at)}
                      </span>
                      {post.author_name && (
                        <span className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5" />
                          {post.author_name}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Eye className="w-3.5 h-3.5" />
                        {post.views || 0}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => togglePublished(post)}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                        post.published
                          ? 'bg-[var(--color-success-muted)] text-[var(--color-success)] hover:opacity-80'
                          : 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)]'
                      }`}
                    >
                      {post.published ? (
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
                      onClick={() => openEditModal(post)}
                      className="p-2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] rounded-md transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(post)}
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
          <span className="px-3 py-1 text-sm text-[var(--text-secondary)] tabular-nums">
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
                {editingPost ? '블로그 수정' : '새 블로그 작성'}
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
                      placeholder="블로그 제목"
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

                  <div>
                    <label className="form-label">
                      카테고리
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="form-input w-full h-10 px-3"
                    >
                      <option value="">선택안함</option>
                      {categoryOptions.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="form-label">
                      작성자
                    </label>
                    <input
                      type="text"
                      value={formData.author_name}
                      onChange={(e) => setFormData({ ...formData, author_name: e.target.value })}
                      className="form-input w-full h-10 px-3"
                      placeholder="작성자 이름"
                    />
                  </div>

                  <div>
                    <label className="form-label">
                      요약
                    </label>
                    <textarea
                      value={formData.excerpt}
                      onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })}
                      rows={3}
                      className="form-input w-full resize-none"
                      placeholder="글 요약 (목록에 표시)"
                    />
                  </div>

                  <div>
                    <label className="form-label">
                      대표 이미지
                    </label>
                    <ImageUploader
                      value={formData.featured_image}
                      onChange={(url) => setFormData({ ...formData, featured_image: url })}
                      folder="blog"
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

                {/* 오른쪽: 마크다운 에디터 */}
                <div className="lg:col-span-2" data-color-mode="light">
                  <label className="form-label">
                    본문 <span className="text-[var(--color-danger)]">*</span>
                  </label>
                  <MarkdownEditorWithUpload
                    value={formData.content}
                    onChange={(val) => setFormData({ ...formData, content: val })}
                    height={400}
                    folder="blog"
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
                {editingPost ? '수정' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
