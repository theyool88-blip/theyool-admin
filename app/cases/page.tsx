import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import CasesList from '@/components/CasesList'

export default async function CasesPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // 사용자 프로필 확인
  const adminClient = createAdminClient()
  const { data: profile } = await adminClient
    .from('users_profiles')
    .select('*')
    .eq('auth_user_id', user.id)
    .single()

  if (!profile) {
    redirect('/login')
  }

  // 사건 데이터 미리 가져오기 (Service Role Key 사용)
  const { data: casesData } = await adminClient
    .from('legal_cases')
    .select(`
      *,
      client:clients(id, name)
    `)
    .order('created_at', { ascending: false })

  return <CasesList initialCases={casesData || []} />
}
