'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      setError('환경 변수가 설정되지 않았습니다.')
      setLoading(false)
      return
    }

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        setError('이메일 또는 비밀번호가 올바르지 않습니다.')
        setLoading(false)
        return
      }

      if (data.user) {
        router.push('/')
        router.refresh()
      }
    } catch {
      setError('로그인 중 오류가 발생했습니다.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        {/* Login Card */}
        <div className="bg-white border border-gray-200 rounded-lg p-8">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <Image
                src="/images/logo-horizontal.png"
                alt="법무법인 더율"
                width={140}
                height={36}
                className="h-6 w-auto"
                style={{
                  filter: 'brightness(0) saturate(100%) invert(46%) sepia(13%) saturate(1243%) hue-rotate(118deg) brightness(93%) contrast(87%)'
                }}
                priority
              />
            </div>
            <p className="text-xs text-gray-500">
              관리자 시스템
            </p>
          </div>

          {/* Login Form */}
          <form className="space-y-4" onSubmit={handleLogin}>
            {error && (
              <div className="bg-red-50 border border-red-200 rounded px-3 py-2">
                <p className="text-xs text-red-600">{error}</p>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-xs font-medium text-gray-700 mb-1.5">
                이메일
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-9 px-3 text-sm border border-gray-200 rounded focus:outline-none focus:border-sage-500 focus:ring-1 focus:ring-sage-500 transition-colors"
                placeholder="admin@theyool.com"
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-medium text-gray-700 mb-1.5">
                비밀번호
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-9 px-3 text-sm border border-gray-200 rounded focus:outline-none focus:border-sage-500 focus:ring-1 focus:ring-sage-500 transition-colors"
                placeholder="비밀번호 입력"
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-9 mt-2 text-sm font-medium text-white bg-sage-600 rounded hover:bg-sage-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sage-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  로그인 중...
                </span>
              ) : (
                '로그인'
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-400">
            관리자 전용 시스템입니다
          </p>
          <p className="text-xs text-gray-400 mt-1">
            &copy; 2025 법무법인 더율
          </p>
        </div>
      </div>
    </div>
  )
}
