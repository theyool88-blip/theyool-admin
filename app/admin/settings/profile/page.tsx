'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { User, Phone, Mail, Briefcase, Save, Check } from 'lucide-react'

interface Profile {
  id: string
  display_name: string | null
  title: string | null
  phone: string | null
  email: string | null
  role: string
}

export default function ProfileSettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    display_name: '',
    title: '',
    phone: '',
    email: '',
  })

  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    try {
      const response = await fetch('/api/admin/profile')
      const result = await response.json()

      if (result.success) {
        setProfile(result.data.profile)
        setFormData({
          display_name: result.data.profile.display_name || '',
          title: result.data.profile.title || '',
          phone: result.data.profile.phone || '',
          email: result.data.profile.email || '',
        })
      }
    } catch (err) {
      console.error('Failed to fetch profile:', err)
      setError('프로필을 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const result = await response.json()

      if (result.success) {
        setProfile(result.data.profile)
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      } else {
        setError(result.error || '저장에 실패했습니다.')
      }
    } catch (err) {
      console.error('Failed to save profile:', err)
      setError('저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const getRoleDisplayName = (role: string) => {
    const names: Record<string, string> = {
      owner: '소유자',
      admin: '관리자',
      lawyer: '변호사',
      staff: '직원',
    }
    return names[role] || role
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--sage-primary)]" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <div className="max-w-5xl mx-auto pt-6 pb-8 px-4">
        {/* 탭 네비게이션 */}
        <div className="flex items-center gap-3 mb-5 text-sm overflow-x-auto">
          <div className="flex bg-[var(--bg-tertiary)] rounded-lg p-0.5">
            <span className="px-3 py-1.5 rounded-md bg-[var(--bg-secondary)] shadow-sm font-medium text-[var(--text-primary)]">
              내 정보
            </span>
            <Link
              href="/admin/settings/sources"
              className="px-3 py-1.5 rounded-md transition-colors text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
            >
              유입 경로
            </Link>
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

        {/* 프로필 카드 */}
        <div className="card">
          <div className="px-5 py-4 border-b border-[var(--border-subtle)]">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-[var(--sage-muted)] flex items-center justify-center">
                <User className="w-6 h-6 text-[var(--sage-primary)]" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                  {profile?.display_name || '이름 미설정'}
                </h2>
                <p className="text-sm text-[var(--text-tertiary)]">
                  {getRoleDisplayName(profile?.role || 'staff')}
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-5 space-y-5">
            {error && (
              <div className="p-3 bg-[var(--color-danger-muted)] border border-[var(--color-danger)]/20 rounded-lg">
                <p className="text-sm text-[var(--color-danger)]">{error}</p>
              </div>
            )}

            {/* 이름 */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
                <User className="w-4 h-4 inline-block mr-1.5 text-[var(--text-tertiary)]" />
                이름
              </label>
              <input
                type="text"
                value={formData.display_name}
                onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                className="form-input w-full"
                placeholder="홍길동"
              />
            </div>

            {/* 직함 */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
                <Briefcase className="w-4 h-4 inline-block mr-1.5 text-[var(--text-tertiary)]" />
                직함
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="form-input w-full"
                placeholder="대표 변호사"
              />
            </div>

            {/* 연락처 */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
                <Phone className="w-4 h-4 inline-block mr-1.5 text-[var(--text-tertiary)]" />
                연락처
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="form-input w-full"
                placeholder="010-1234-5678"
              />
            </div>

            {/* 이메일 */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
                <Mail className="w-4 h-4 inline-block mr-1.5 text-[var(--text-tertiary)]" />
                이메일
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="form-input w-full"
                placeholder="example@email.com"
              />
            </div>

            {/* 저장 버튼 */}
            <div className="pt-3">
              <button
                type="submit"
                disabled={saving}
                className="btn btn-primary flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    저장 중...
                  </>
                ) : saved ? (
                  <>
                    <Check className="w-4 h-4" />
                    저장됨
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    저장
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
