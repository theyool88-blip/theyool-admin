import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  // 환경 변수를 명시적으로 가져오기 (브라우저 환경에서도 작동)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // 환경 변수가 없을 때 명확한 에러 메시지
  if (!supabaseUrl) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL 환경 변수가 설정되지 않았습니다. ' +
      '.env.local 파일을 확인하고 서버를 재시작해주세요.'
    )
  }

  if (!supabaseKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_ANON_KEY 환경 변수가 설정되지 않았습니다. ' +
      '.env.local 파일을 확인하고 서버를 재시작해주세요.'
    )
  }

  console.log('✅ Supabase Client 초기화:', {
    url: supabaseUrl,
    keyLength: supabaseKey.length
  })

  return createBrowserClient(supabaseUrl, supabaseKey)
}
