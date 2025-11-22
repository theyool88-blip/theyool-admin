import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import ClientEditForm from '@/components/ClientEditForm'

export default async function ClientEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
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

  // 의뢰인 정보 가져오기
  const { data: clientData, error: clientError } = await adminClient
    .from('clients')
    .select('*')
    .eq('id', id)
    .single()

  if (!clientData) {
    console.error('Client not found:', id, clientError)
    redirect('/clients')
  }

  return <ClientEditForm profile={profile} clientData={clientData} />
}
