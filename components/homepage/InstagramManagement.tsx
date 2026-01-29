'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  X,
  Check,
  Instagram,
  Video,
  ExternalLink,
  Heart,
  MessageCircle,
  Eye,
  EyeOff,
  Images,
} from 'lucide-react';

interface InstagramPost {
  id: string;
  post_url: string | null;
  media_url: string | null;
  thumbnail_url: string | null;
  caption: string;
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
  likes_count: number;
  comments_count: number;
  published: boolean;
  display_order: number;
  created_at: string;
}

export default function InstagramManagement() {
  const [posts, setPosts] = useState<InstagramPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'published' | 'draft'>('all');
  const [mediaTypeFilter, setMediaTypeFilter] = useState('');

  // 모달 상태
  const [showModal, setShowModal] = useState(false);
  const [editingPost, setEditingPost] = useState<InstagramPost | null>(null);
  const [saving, setSaving] = useState(false);

  // 폼 데이터
  const [formData, setFormData] = useState<{
    post_url: string;
    media_url: string;
    thumbnail_url: string;
    caption: string;
    media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
    likes_count: number;
    comments_count: number;
    published: boolean;
  }>({
    post_url: '',
    media_url: '',
    thumbnail_url: '',
    caption: '',
    media_type: 'IMAGE',
    likes_count: 0,
    comments_count: 0,
    published: true,
  });

  const loadPosts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (filter !== 'all') params.set('published', filter === 'published' ? 'true' : 'false');
      if (mediaTypeFilter) params.set('media_type', mediaTypeFilter);

      const response = await fetch(`/api/admin/homepage/instagram?${params}`);
      const result = await response.json();

      if (result.success) {
        setPosts(result.data);
      }
    } catch (error) {
      console.error('Instagram posts load error:', error);
    } finally {
      setLoading(false);
    }
  }, [filter, mediaTypeFilter]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const resetForm = () => {
    setFormData({
      post_url: '',
      media_url: '',
      thumbnail_url: '',
      caption: '',
      media_type: 'IMAGE' as const,
      likes_count: 0,
      comments_count: 0,
      published: true,
    });
    setEditingPost(null);
  };

  const openNewModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (post: InstagramPost) => {
    setEditingPost(post);
    setFormData({
      post_url: post.post_url || '',
      media_url: post.media_url || '',
      thumbnail_url: post.thumbnail_url || '',
      caption: post.caption || '',
      media_type: post.media_type,
      likes_count: post.likes_count,
      comments_count: post.comments_count,
      published: post.published,
    });
    setShowModal(true);
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const url = editingPost
        ? `/api/admin/homepage/instagram/${editingPost.id}`
        : '/api/admin/homepage/instagram';
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

  const handleDelete = async (post: InstagramPost) => {
    if (!confirm('이 Instagram 포스트를 삭제하시겠습니까?')) return;

    try {
      const response = await fetch(`/api/admin/homepage/instagram/${post.id}`, {
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

  const togglePublished = async (post: InstagramPost) => {
    try {
      const response = await fetch(`/api/admin/homepage/instagram/${post.id}`, {
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

  const getMediaTypeIcon = (type: string) => {
    switch (type) {
      case 'VIDEO':
        return <Video className="w-3 h-3" />;
      case 'CAROUSEL_ALBUM':
        return <Images className="w-3 h-3" />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--text-tertiary)]">
          총 <span className="font-medium text-[var(--text-primary)]">{posts.length}</span>개
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
          <select
            value={mediaTypeFilter}
            onChange={(e) => setMediaTypeFilter(e.target.value)}
            className="form-input h-10 px-3 text-sm appearance-none cursor-pointer"
          >
            <option value="">모든 타입</option>
            <option value="IMAGE">이미지</option>
            <option value="VIDEO">비디오</option>
            <option value="CAROUSEL_ALBUM">캐러셀</option>
          </select>
          <button
            onClick={openNewModal}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            포스트 추가
          </button>
        </div>
      </div>

      {/* 그리드 목록 */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-[var(--border-default)] border-t-[var(--sage-primary)] rounded-full animate-spin" />
        </div>
      ) : posts.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-20">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center mb-4">
            <Instagram className="w-6 h-6 text-pink-500" />
          </div>
          <p className="text-[var(--text-secondary)] mb-1">Instagram 포스트가 없습니다</p>
          <p className="text-sm text-[var(--text-muted)] mb-4">첫 포스트를 추가해보세요</p>
          <button
            onClick={openNewModal}
            className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 text-sm font-medium transition-colors"
          >
            포스트 추가
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {posts.map((post) => (
            <div
              key={post.id}
              className="group relative card overflow-hidden"
            >
              {/* 썸네일 */}
              <div className="relative aspect-square bg-[var(--bg-tertiary)]">
                {post.thumbnail_url || post.media_url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={post.thumbnail_url || post.media_url || ''}
                    alt="Instagram post"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Instagram className="w-8 h-8 text-[var(--text-muted)]" />
                  </div>
                )}

                {/* 미디어 타입 배지 */}
                {post.media_type !== 'IMAGE' && (
                  <div className="absolute top-2 right-2 bg-black/60 text-white rounded px-1.5 py-0.5 flex items-center gap-1 text-xs">
                    {getMediaTypeIcon(post.media_type)}
                  </div>
                )}

                {/* 호버 오버레이 */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                  <div className="flex items-center gap-4 text-white text-sm">
                    <span className="flex items-center gap-1">
                      <Heart className="w-4 h-4" />
                      {post.likes_count}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageCircle className="w-4 h-4" />
                      {post.comments_count}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    {post.post_url && (
                      <a
                        href={post.post_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="p-1.5 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                      >
                        <ExternalLink className="w-4 h-4 text-white" />
                      </a>
                    )}
                    <button
                      onClick={() => openEditModal(post)}
                      className="p-1.5 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-4 h-4 text-white" />
                    </button>
                    <button
                      onClick={() => handleDelete(post)}
                      className="p-1.5 bg-white/20 hover:bg-[var(--color-danger)]/50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4 text-white" />
                    </button>
                  </div>
                </div>
              </div>

              {/* 하단 정보 */}
              <div className="p-2.5">
                <p className="text-xs text-[var(--text-secondary)] line-clamp-2 min-h-[2rem]">
                  {post.caption || '(캡션 없음)'}
                </p>
                <div className="flex items-center justify-between mt-2">
                  <button
                    onClick={() => togglePublished(post)}
                    className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded transition-colors ${
                      post.published
                        ? 'bg-[var(--color-success-muted)] text-[var(--color-success)] hover:opacity-80'
                        : 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)]'
                    }`}
                  >
                    {post.published ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                    {post.published ? '게시' : '비공개'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 모달 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--bg-secondary)] rounded-2xl shadow-2xl w-full max-w-lg">
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)]">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                {editingPost ? 'Instagram 포스트 수정' : '새 Instagram 포스트 추가'}
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
            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              <div>
                <label className="form-label">
                  Instagram 포스트 URL
                </label>
                <input
                  type="url"
                  value={formData.post_url}
                  onChange={(e) => setFormData({ ...formData, post_url: e.target.value })}
                  className="form-input"
                  placeholder="https://www.instagram.com/p/..."
                />
              </div>

              <div>
                <label className="form-label">
                  미디어 URL
                </label>
                <input
                  type="url"
                  value={formData.media_url}
                  onChange={(e) => setFormData({ ...formData, media_url: e.target.value })}
                  className="form-input"
                  placeholder="이미지 또는 비디오 URL"
                />
              </div>

              <div>
                <label className="form-label">
                  썸네일 URL
                </label>
                <input
                  type="url"
                  value={formData.thumbnail_url}
                  onChange={(e) => setFormData({ ...formData, thumbnail_url: e.target.value })}
                  className="form-input"
                  placeholder="썸네일 이미지 URL (비디오의 경우)"
                />
              </div>

              <div>
                <label className="form-label">
                  캡션
                </label>
                <textarea
                  value={formData.caption}
                  onChange={(e) => setFormData({ ...formData, caption: e.target.value })}
                  rows={3}
                  className="form-input resize-none"
                  placeholder="포스트 설명"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="form-label">
                    미디어 타입
                  </label>
                  <select
                    value={formData.media_type}
                    onChange={(e) => setFormData({ ...formData, media_type: e.target.value as InstagramPost['media_type'] })}
                    className="form-input"
                  >
                    <option value="IMAGE">이미지</option>
                    <option value="VIDEO">비디오</option>
                    <option value="CAROUSEL_ALBUM">캐러셀</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">
                    좋아요
                  </label>
                  <input
                    type="number"
                    value={formData.likes_count}
                    onChange={(e) => setFormData({ ...formData, likes_count: parseInt(e.target.value) || 0 })}
                    className="form-input"
                    min="0"
                  />
                </div>
                <div>
                  <label className="form-label">
                    댓글
                  </label>
                  <input
                    type="number"
                    value={formData.comments_count}
                    onChange={(e) => setFormData({ ...formData, comments_count: parseInt(e.target.value) || 0 })}
                    className="form-input"
                    min="0"
                  />
                </div>
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
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 text-sm font-medium disabled:opacity-50 transition-colors"
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
