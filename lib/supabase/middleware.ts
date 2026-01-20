import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // 보호해야 할 경로 목록 (인증 필요)
  const protectedPaths = ['/admin', '/cases', '/clients', '/schedules', '/consultations', '/payments', '/receivables', '/expenses', '/settings']
  const isProtectedRoute = protectedPaths.some(path => pathname.startsWith(path))
  const isAdminLoginRoute = pathname === '/admin/login' || pathname === '/login'

  // 슈퍼 어드민 대리 접속 쿠키 확인
  const impersonationToken = request.cookies.get('sa_impersonate')?.value
  let isValidImpersonation = false

  // 디버깅: 모든 쿠키 로그
  console.log('[Proxy Debug] Path:', pathname, 'isProtectedRoute:', isProtectedRoute)
  console.log('[Proxy Debug] All cookies:', request.cookies.getAll().map(c => c.name))
  console.log('[Proxy Debug] sa_impersonate token exists:', !!impersonationToken)

  if (impersonationToken) {
    try {
      const decoded = JSON.parse(Buffer.from(impersonationToken, 'base64').toString())
      const expiresAt = new Date(decoded.expiresAt)
      console.log('[Proxy Debug] Token decoded:', { tenantId: decoded.tenantId, expiresAt: decoded.expiresAt })
      if (expiresAt > new Date() && decoded.tenantId) {
        isValidImpersonation = true
        console.log('[Proxy Debug] Valid impersonation!')
      }
    } catch (e) {
      console.log('[Proxy Debug] Token decode error:', e)
    }
  }

  // 로그인하지 않은 경우 AND 대리 접속 중이 아닌 경우 보호된 페이지 접근 시 로그인 페이지로 리다이렉트
  console.log('[Proxy Debug] Check:', { user: !!user, isValidImpersonation, isProtectedRoute, isAdminLoginRoute })
  if (!user && !isValidImpersonation && isProtectedRoute && !isAdminLoginRoute) {
    console.log('[Proxy Debug] Redirecting to login!')
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // 로그인한 경우 로그인 페이지 접근 시 대시보드로 리다이렉트
  if (user && isAdminLoginRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/admin'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
