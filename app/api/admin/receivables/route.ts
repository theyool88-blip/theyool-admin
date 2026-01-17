/**
 * GET/PATCH /api/admin/receivables
 * 미수금 관리 API (테넌트 격리 적용)
 */

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { withTenant } from '@/lib/api/with-tenant'
import { canAccessAccountingWithContext } from '@/lib/auth/permissions'

export const dynamic = 'force-dynamic'

type ReceivableGrade = 'normal' | 'watch' | 'collection'

interface Memo {
  id: string
  content: string
  is_completed: boolean
  created_at: string
  completed_at: string | null
}

interface CaseReceivable {
  id: string
  case_name: string
  case_type: string
  fee_allocation: number
  total_received: number
  outstanding: number
  grade: ReceivableGrade
}

interface ClientReceivable {
  client_id: string
  client_name: string
  case_count: number
  total_fee: number
  total_received: number
  outstanding: number
  highest_grade: ReceivableGrade
  cases: CaseReceivable[]
  memos?: Memo[]
}

interface WriteOff {
  id: string
  case_id: string
  case_name: string
  client_name: string | null
  original_amount: number
  reason: string | null
  written_off_at: string
}

interface ReceivablesSummary {
  total_outstanding: number
  client_count: number
  case_count: number
  watch_count: number
  collection_count: number
  clients: ClientReceivable[]
  writeoffs?: WriteOff[]
}

// 등급 우선순위 (정렬용)
const gradeOrder: Record<ReceivableGrade, number> = {
  collection: 0,
  watch: 1,
  normal: 2,
}

/**
 * PATCH /api/admin/receivables
 * 미수금 등급 변경 또는 포기 처리
 */
export const PATCH = withTenant(async (request, { tenant }) => {
  try {
    // 회계 모듈 접근 권한 확인
    if (!canAccessAccountingWithContext(tenant)) {
      return NextResponse.json(
        { error: '회계 기능에 접근할 수 없습니다.' },
        { status: 403 }
      )
    }

    const supabase = createAdminClient()
    const body = await request.json()
    const { case_id, reason, grade } = body

    // 등급 변경 요청인 경우
    if (case_id && grade !== undefined) {
      // 테넌트 소속 사건인지 확인
      let query = supabase
        .from('legal_cases')
        .update({ receivable_grade: grade })
        .eq('id', case_id)

      // 테넌트 필터 (슈퍼어드민 제외)
      if (!tenant.isSuperAdmin && tenant.tenantId) {
        query = query.eq('tenant_id', tenant.tenantId)
      }

      const { error: updateError } = await query

      if (updateError) {
        console.error('[PATCH /api/admin/receivables] Grade update error:', updateError)
        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }

      return NextResponse.json({ success: true, message: '등급이 변경되었습니다' })
    }

    // 미수금 포기 요청인 경우
    if (!case_id) {
      return NextResponse.json({ error: 'case_id is required' }, { status: 400 })
    }

    // 테넌트 소속 사건 조회
    let fetchQuery = supabase
      .from('legal_cases')
      .select('case_name')
      .eq('id', case_id)

    if (!tenant.isSuperAdmin && tenant.tenantId) {
      fetchQuery = fetchQuery.eq('tenant_id', tenant.tenantId)
    }

    const { data: currentCase, error: fetchError } = await fetchQuery.single()

    if (fetchError || !currentCase) {
      return NextResponse.json({ error: '사건을 찾을 수 없습니다' }, { status: 404 })
    }

    // 의뢰인 정보 및 수임료 조회
    const { data: partyInfo } = await supabase
      .from('case_parties')
      .select('party_name, fee_allocation_amount, client_id')
      .eq('case_id', case_id)
      .eq('is_our_client', true)
      .limit(1)
      .maybeSingle()

    // 입금 합계 조회
    const { data: payments } = await supabase
      .from('payments')
      .select('amount')
      .eq('case_id', case_id)
      .gt('amount', 0)

    const totalReceived = payments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0
    const feeAllocation = partyInfo?.fee_allocation_amount || 0
    const outstanding = Math.max(0, feeAllocation - totalReceived)

    // 포기 이력 저장
    try {
      await supabase.from('receivable_writeoffs').insert({
        case_id,
        client_id: partyInfo?.client_id || null,
        case_name: currentCase.case_name,
        client_name: partyInfo?.party_name || null,
        original_amount: outstanding,
        reason: reason || null,
        written_off_at: new Date().toISOString(),
        tenant_id: tenant.tenantId,
      })
    } catch {
      // 테이블이 없어도 계속 진행
    }

    // 수임료 배분 금액을 입금액과 동일하게 설정하여 미수금 0 처리
    if (partyInfo) {
      await supabase
        .from('case_parties')
        .update({ fee_allocation_amount: totalReceived })
        .eq('case_id', case_id)
        .eq('is_our_client', true)
    }

    return NextResponse.json({
      success: true,
      message: `${currentCase.case_name} 미수금 포기 처리 완료`,
      written_off_amount: outstanding
    })
  } catch (error) {
    console.error('[PATCH /api/admin/receivables] Error:', error)
    return NextResponse.json({ error: '처리 실패' }, { status: 500 })
  }
})

/**
 * GET /api/admin/receivables
 * 미수금 현황 조회
 */
export const GET = withTenant(async (request, { tenant }) => {
  try {
    // 회계 모듈 접근 권한 확인
    if (!canAccessAccountingWithContext(tenant)) {
      return NextResponse.json(
        { error: '회계 기능에 접근할 수 없습니다.' },
        { status: 403 }
      )
    }

    const supabase = createAdminClient()
    const { searchParams } = new URL(request.url)

    const sortBy = searchParams.get('sort_by') || 'outstanding'
    const sortOrder = searchParams.get('sort_order') || 'desc'
    const minAmount = searchParams.get('min_amount')
    const gradeFilter = searchParams.get('grade') as ReceivableGrade | null
    const includeWriteoffs = searchParams.get('include_writeoffs') === 'true'

    // 사건 기본 정보 조회
    let casesQuery = supabase
      .from('legal_cases')
      .select('id, case_name, case_type, receivable_grade')
      .eq('status', 'active')

    if (!tenant.isSuperAdmin && tenant.tenantId) {
      casesQuery = casesQuery.eq('tenant_id', tenant.tenantId)
    }

    if (gradeFilter) {
      casesQuery = casesQuery.eq('receivable_grade', gradeFilter)
    }

    const { data: cases, error: casesError } = await casesQuery

    if (casesError) {
      console.error('[GET /api/admin/receivables] Cases error:', casesError)
      return NextResponse.json({ error: casesError.message }, { status: 500 })
    }

    if (!cases || cases.length === 0) {
      return NextResponse.json({
        total_outstanding: 0,
        client_count: 0,
        case_count: 0,
        watch_count: 0,
        collection_count: 0,
        clients: [],
      })
    }

    const caseIds = cases.map(c => c.id)

    // case_parties에서 의뢰인(is_our_client=true) + 수임료 배분 정보 조회
    let partiesQuery = supabase
      .from('case_parties')
      .select(`
        case_id,
        party_name,
        fee_allocation_amount,
        client_id
      `)
      .in('case_id', caseIds)
      .eq('is_our_client', true)

    if (!tenant.isSuperAdmin && tenant.tenantId) {
      partiesQuery = partiesQuery.eq('tenant_id', tenant.tenantId)
    }

    const { data: parties } = await partiesQuery

    // payments에서 사건별 입금 합계 조회
    let paymentsQuery = supabase
      .from('payments')
      .select('case_id, amount')
      .in('case_id', caseIds)
      .gt('amount', 0)

    if (!tenant.isSuperAdmin && tenant.tenantId) {
      paymentsQuery = paymentsQuery.eq('tenant_id', tenant.tenantId)
    }

    const { data: payments } = await paymentsQuery

    // 사건별 입금 합계 계산
    const paymentsByCase = new Map<string, number>()
    payments?.forEach(p => {
      const current = paymentsByCase.get(p.case_id) || 0
      paymentsByCase.set(p.case_id, current + (p.amount || 0))
    })

    // 사건별 의뢰인 정보 매핑
    const partyByCase = new Map<string, { party_name: string; fee_allocation_amount: number; client_id: string | null }>()
    parties?.forEach(p => {
      if (!partyByCase.has(p.case_id)) {
        partyByCase.set(p.case_id, {
          party_name: p.party_name,
          fee_allocation_amount: p.fee_allocation_amount || 0,
          client_id: p.client_id
        })
      }
    })

    // 의뢰인 ID 목록 추출
    const clientIds = [...new Set(parties?.map(p => p.client_id).filter(Boolean) || [])] as string[]

    // 의뢰인별 메모 조회
    const clientMemosMap = new Map<string, Memo[]>()
    try {
      if (clientIds.length > 0) {
        let memosQuery = supabase
          .from('receivable_memos')
          .select('*')
          .in('client_id', clientIds)
          .order('created_at', { ascending: true })

        if (!tenant.isSuperAdmin && tenant.tenantId) {
          memosQuery = memosQuery.eq('tenant_id', tenant.tenantId)
        }

        const { data: memos } = await memosQuery

        memos?.forEach(memo => {
          if (!memo.client_id) return
          const existing = clientMemosMap.get(memo.client_id) || []
          existing.push({
            id: memo.id,
            content: memo.content,
            is_completed: memo.is_completed,
            created_at: memo.created_at,
            completed_at: memo.completed_at,
          })
          clientMemosMap.set(memo.client_id, existing)
        })
      }
    } catch {
      // 테이블이 없으면 무시
    }

    // 의뢰인별로 그룹화
    const clientMap = new Map<string, ClientReceivable>()
    let watchCount = 0
    let collectionCount = 0
    let totalOutstanding = 0

    cases.forEach((c) => {
      const partyInfo = partyByCase.get(c.id)
      if (!partyInfo) return // 의뢰인 정보가 없는 사건 제외

      const clientId = partyInfo.client_id || c.id // client_id 없으면 case_id를 대용
      const clientName = partyInfo.party_name || '미지정'

      const feeAllocation = partyInfo.fee_allocation_amount || 0
      const received = paymentsByCase.get(c.id) || 0
      const outstanding = Math.max(0, feeAllocation - received)
      const grade: ReceivableGrade = c.receivable_grade || 'normal'

      if (outstanding > 0) {
        if (grade === 'watch') watchCount++
        if (grade === 'collection') collectionCount++
        totalOutstanding += outstanding
      }

      const caseData: CaseReceivable = {
        id: c.id,
        case_name: c.case_name,
        case_type: c.case_type,
        fee_allocation: feeAllocation,
        total_received: received,
        outstanding: outstanding,
        grade: grade,
      }

      if (clientMap.has(clientId)) {
        const existing = clientMap.get(clientId)!
        existing.case_count++
        existing.total_fee += feeAllocation
        existing.total_received += received
        existing.outstanding += outstanding
        existing.cases.push(caseData)
        if (gradeOrder[grade] < gradeOrder[existing.highest_grade]) {
          existing.highest_grade = grade
        }
      } else {
        clientMap.set(clientId, {
          client_id: clientId,
          client_name: clientName,
          case_count: 1,
          total_fee: feeAllocation,
          total_received: received,
          outstanding: outstanding,
          highest_grade: grade,
          cases: [caseData],
          memos: clientMemosMap.get(clientId) || [],
        })
      }
    })

    // 미수금이 있는 의뢰인만 필터링
    let clients = Array.from(clientMap.values()).filter(c => c.outstanding > 0)

    // 최소 금액 필터
    if (minAmount) {
      const min = parseInt(minAmount, 10)
      clients = clients.filter(c => c.outstanding >= min)
    }

    // 각 의뢰인의 사건들을 등급순으로 정렬
    clients.forEach(client => {
      client.cases.sort((a, b) => {
        const gradeCompare = gradeOrder[a.grade] - gradeOrder[b.grade]
        if (gradeCompare !== 0) return gradeCompare
        return b.outstanding - a.outstanding
      })
    })

    // 정렬
    clients.sort((a, b) => {
      let aVal: number | string = 0
      let bVal: number | string = 0

      if (sortBy === 'outstanding') {
        aVal = a.outstanding
        bVal = b.outstanding
      } else if (sortBy === 'name') {
        aVal = a.client_name
        bVal = b.client_name
      } else if (sortBy === 'case_count') {
        aVal = a.case_count
        bVal = b.case_count
      } else if (sortBy === 'grade') {
        const aMinGrade = Math.min(...a.cases.map(c => gradeOrder[c.grade]))
        const bMinGrade = Math.min(...b.cases.map(c => gradeOrder[c.grade]))
        aVal = aMinGrade
        bVal = bMinGrade
        return aVal - bVal
      }

      if (sortOrder === 'desc') {
        return aVal > bVal ? -1 : aVal < bVal ? 1 : 0
      }
      return aVal < bVal ? -1 : aVal > bVal ? 1 : 0
    })

    const summary: ReceivablesSummary = {
      total_outstanding: totalOutstanding,
      client_count: clients.length,
      case_count: clients.reduce((sum, c) => sum + c.case_count, 0),
      watch_count: watchCount,
      collection_count: collectionCount,
      clients,
    }

    // 포기 이력 조회
    if (includeWriteoffs) {
      try {
        let writeoffsQuery = supabase
          .from('receivable_writeoffs')
          .select('*')
          .order('written_off_at', { ascending: false })

        if (!tenant.isSuperAdmin && tenant.tenantId) {
          writeoffsQuery = writeoffsQuery.eq('tenant_id', tenant.tenantId)
        }

        const { data: writeoffs } = await writeoffsQuery

        summary.writeoffs = writeoffs?.map(w => ({
          id: w.id,
          case_id: w.case_id,
          case_name: w.case_name,
          client_name: w.client_name,
          original_amount: w.original_amount,
          reason: w.reason,
          written_off_at: w.written_off_at,
        })) || []
      } catch {
        summary.writeoffs = []
      }
    }

    return NextResponse.json(summary)
  } catch (error) {
    console.error('[GET /api/admin/receivables] Error:', error)
    return NextResponse.json({ error: '미수금 조회 실패' }, { status: 500 })
  }
})
