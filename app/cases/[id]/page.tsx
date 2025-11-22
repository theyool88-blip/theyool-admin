import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import CaseDetail from '@/components/CaseDetail'

export default async function CaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
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

  // 사건 상세 정보 가져오기
  const { data: caseData, error: caseError } = await adminClient
    .from('legal_cases')
    .select(`
      *,
      client:clients(*)
    `)
    .eq('id', id)
    .single()

  if (!caseData) {
    console.error('Case not found:', id, caseError)
    redirect('/cases')
  }

  // 관련 사건 정보 가져오기
  const { data: relatedCases } = await adminClient
    .from('case_relations')
    .select(`
      id,
      case_id,
      related_case_id,
      relation_type,
      notes,
      related_case:legal_cases!case_relations_related_case_id_fkey(
        id,
        case_name,
        contract_number,
        status
      )
    `)
    .eq('case_id', id)

  // caseData에 관련 사건 추가
  const caseDataWithRelations = {
    ...caseData,
    case_relations: relatedCases || []
  }

  return <CaseDetail profile={profile} caseData={caseDataWithRelations} />
}
