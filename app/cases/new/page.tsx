import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import NewCaseForm from '@/components/NewCaseForm'

export default async function NewCasePage() {
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

  // 의뢰인 목록 가져오기 (사건 등록 시 선택할 수 있도록)
  const { data: clients } = await adminClient
    .from('clients')
    .select('id, name, phone, email')
    .order('created_at', { ascending: false })

  return <NewCaseForm clients={clients || []} />
}
