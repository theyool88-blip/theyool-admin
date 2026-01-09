import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentTenantContext } from '@/lib/auth/tenant-context'
import CaseDetail from '@/components/CaseDetail'

export default async function CaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  // "new"는 별도 페이지가 있으므로 리다이렉트
  if (id === 'new') {
    redirect('/cases/new')
  }

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

  // 테넌트 컨텍스트 조회
  const tenantContext = await getCurrentTenantContext()
  if (!tenantContext) {
    redirect('/login')
  }

  // 사건 상세 정보 가져오기 (테넌트 필터 적용)
  let caseQuery = adminClient
    .from('legal_cases')
    .select(`
      *,
      client:clients(*)
    `)
    .eq('id', id)

  // 슈퍼 어드민이 아니면 테넌트 필터 적용
  if (!tenantContext.isSuperAdmin && tenantContext.tenantId) {
    caseQuery = caseQuery.eq('tenant_id', tenantContext.tenantId)
  }

  const { data: caseData, error: caseError } = await caseQuery.single()

  if (!caseData) {
    console.error('Case not found:', id, caseError)
    redirect('/cases')
  }

  // 관련 사건 정보 가져오기 (양방향: 내가 등록한 관계 + 나를 등록한 관계)
  // 1. 내가 등록한 관계 (case_id = 현재 사건)
  const { data: outgoingRelations } = await adminClient
    .from('case_relations')
    .select(`
      id,
      case_id,
      related_case_id,
      relation_type,
      relation_type_code,
      notes,
      related_case:legal_cases!case_relations_related_case_id_fkey(
        id,
        case_name,
        contract_number,
        status,
        court_case_number,
        case_level,
        case_result
      )
    `)
    .eq('case_id', id)

  // 2. 나를 등록한 관계 (related_case_id = 현재 사건) - 역방향
  const { data: incomingRelations } = await adminClient
    .from('case_relations')
    .select(`
      id,
      case_id,
      related_case_id,
      relation_type,
      relation_type_code,
      notes,
      source_case:legal_cases!case_relations_case_id_fkey(
        id,
        case_name,
        contract_number,
        status,
        court_case_number,
        case_level,
        case_result
      )
    `)
    .eq('related_case_id', id)

  // 역방향 관계를 정방향 형식으로 변환
  const reverseRelations = (incomingRelations || []).map(rel => {
    // 관계 유형 반전
    const reverseRelationType = (type: string | null) => {
      if (type === '하심사건') return '상심사건'
      if (type === '상심사건') return '하심사건'
      if (type === '항소심') return '원심'
      if (type === '원심') return '항소심'
      if (type === '본소') return '반소'
      if (type === '반소') return '본소'
      return type // 가압류, 가처분, 본안사건 등은 그대로
    }

    return {
      id: rel.id,
      case_id: rel.related_case_id,  // 스왑
      related_case_id: rel.case_id,  // 스왑
      relation_type: reverseRelationType(rel.relation_type),
      relation_type_code: rel.relation_type_code,
      notes: rel.notes,
      related_case: rel.source_case,  // source_case를 related_case로
    }
  })

  // 중복 제거 (이미 outgoing에 있는 관계는 제외)
  const outgoingIds = new Set((outgoingRelations || []).map(r => r.related_case_id))
  const filteredReverse = reverseRelations.filter(r => !outgoingIds.has(r.related_case_id))

  // 합치기
  const allRelations = [...(outgoingRelations || []), ...filteredReverse]

  // caseData에 관련 사건 추가
  const caseDataWithRelations = {
    ...caseData,
    case_relations: allRelations
  }

  return <CaseDetail caseData={caseDataWithRelations} />
}
