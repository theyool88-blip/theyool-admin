import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import ClientDetail from '@/components/ClientDetail'

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
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

  // 의뢰인 상세 정보 가져오기
  const { data: clientData, error: clientError } = await adminClient
    .from('clients')
    .select('*')
    .eq('id', id)
    .single()

  if (!clientData) {
    console.error('Client not found:', id, clientError)
    redirect('/clients')
  }

  // 의뢰인의 사건 목록 가져오기 (재무 정보 포함)
  const { data: cases } = await adminClient
    .from('legal_cases')
    .select('id, contract_number, case_name, status, office, contract_date, case_type, retainer_fee, calculated_success_fee, total_received')
    .eq('client_id', id)
    .order('created_at', { ascending: false })

  const clientWithCases = {
    ...clientData,
    cases: cases || []
  }

  return <ClientDetail profile={profile} clientData={clientWithCases} />
}
