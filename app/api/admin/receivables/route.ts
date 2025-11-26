import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

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
  office: string
  retainer_fee: number
  calculated_success_fee: number
  total_received: number
  outstanding: number
  grade: ReceivableGrade
}

interface ClientReceivable {
  client_id: string
  client_name: string
  case_count: number
  total_retainer: number
  total_success_fee: number
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
  pyeongtaek_outstanding: number
  cheonan_outstanding: number
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

// 미수금 포기 (Write-off)
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createAdminClient()
    const body = await request.json()
    const { case_id, reason, grade } = body

    // 등급 변경 요청인 경우
    if (case_id && grade !== undefined) {
      const { error: updateError } = await supabase
        .from('legal_cases')
        .update({ receivable_grade: grade })
        .eq('id', case_id)

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

    const { data: currentCase, error: fetchError } = await supabase
      .from('legal_cases')
      .select('case_name, outstanding_balance, client_id, clients(name)')
      .eq('id', case_id)
      .single()

    if (fetchError || !currentCase) {
      return NextResponse.json({ error: '사건을 찾을 수 없습니다' }, { status: 404 })
    }

    const clientData = Array.isArray(currentCase.clients) ? currentCase.clients[0] : currentCase.clients

    // 포기 이력 저장
    try {
      await supabase.from('receivable_writeoffs').insert({
        case_id,
        client_id: currentCase.client_id,
        case_name: currentCase.case_name,
        client_name: clientData?.name || null,
        original_amount: currentCase.outstanding_balance || 0,
        reason: reason || null,
        written_off_at: new Date().toISOString(),
      })
    } catch {
      // 테이블이 없어도 계속 진행
    }

    // outstanding_balance를 0으로 설정
    const { error: updateError } = await supabase
      .from('legal_cases')
      .update({ outstanding_balance: 0 })
      .eq('id', case_id)

    if (updateError) {
      console.error('[PATCH /api/admin/receivables] Update error:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `${currentCase.case_name} 미수금 포기 처리 완료`,
      written_off_amount: currentCase.outstanding_balance
    })
  } catch (error) {
    console.error('[PATCH /api/admin/receivables] Error:', error)
    return NextResponse.json({ error: '처리 실패' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createAdminClient()
    const { searchParams } = new URL(request.url)

    const office = searchParams.get('office')
    const sortBy = searchParams.get('sort_by') || 'outstanding'
    const sortOrder = searchParams.get('sort_order') || 'desc'
    const minAmount = searchParams.get('min_amount')
    const gradeFilter = searchParams.get('grade') as ReceivableGrade | null
    const includeWriteoffs = searchParams.get('include_writeoffs') === 'true'

    // 모든 사건과 의뢰인 정보 조회
    let query = supabase
      .from('legal_cases')
      .select(`
        id,
        case_name,
        case_type,
        office,
        retainer_fee,
        calculated_success_fee,
        total_received,
        outstanding_balance,
        receivable_grade,
        client_id,
        clients!inner(id, name)
      `)
      .not('client_id', 'is', null)

    if (office) {
      query = query.eq('office', office)
    }

    if (gradeFilter) {
      query = query.eq('receivable_grade', gradeFilter)
    }

    const { data: cases, error } = await query

    if (error) {
      console.error('[GET /api/admin/receivables] Error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 의뢰인 ID 목록 추출
    const clientIds = [...new Set(cases?.map(c => c.client_id).filter(Boolean) || [])]

    // 의뢰인별 메모 조회
    let clientMemosMap = new Map<string, Memo[]>()
    try {
      if (clientIds.length > 0) {
        const { data: memos } = await supabase
          .from('receivable_memos')
          .select('*')
          .in('client_id', clientIds)
          .order('created_at', { ascending: true })

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

    cases?.forEach((c: any) => {
      const clientId = c.client_id
      const clientName = c.clients?.name || '미지정'

      const retainer = c.retainer_fee || 0
      const successFee = c.calculated_success_fee || 0
      const received = c.total_received || 0
      const outstanding = c.outstanding_balance > 0 ? c.outstanding_balance : 0
      const grade: ReceivableGrade = c.receivable_grade || 'normal'

      if (outstanding > 0) {
        if (grade === 'watch') watchCount++
        if (grade === 'collection') collectionCount++
      }

      const caseData: CaseReceivable = {
        id: c.id,
        case_name: c.case_name,
        case_type: c.case_type,
        office: c.office,
        retainer_fee: retainer,
        calculated_success_fee: successFee,
        total_received: received,
        outstanding: outstanding,
        grade: grade,
      }

      if (clientMap.has(clientId)) {
        const existing = clientMap.get(clientId)!
        existing.case_count++
        existing.total_retainer += retainer
        existing.total_success_fee += successFee
        existing.total_received += received
        existing.outstanding += outstanding
        existing.cases.push(caseData)
        // 가장 높은 등급 업데이트 (collection > watch > normal)
        if (gradeOrder[grade] < gradeOrder[existing.highest_grade]) {
          existing.highest_grade = grade
        }
      } else {
        clientMap.set(clientId, {
          client_id: clientId,
          client_name: clientName,
          case_count: 1,
          total_retainer: retainer,
          total_success_fee: successFee,
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
        // 먼저 등급순으로
        const gradeCompare = gradeOrder[a.grade] - gradeOrder[b.grade]
        if (gradeCompare !== 0) return gradeCompare
        // 같으면 금액순으로
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
        // 등급순: 추심 > 관리 > 정상
        const aMinGrade = Math.min(...a.cases.map(c => gradeOrder[c.grade]))
        const bMinGrade = Math.min(...b.cases.map(c => gradeOrder[c.grade]))
        aVal = aMinGrade
        bVal = bMinGrade
        // 등급순은 오름차순이 의미있음 (추심이 먼저)
        return aVal - bVal
      }

      if (sortOrder === 'desc') {
        return aVal > bVal ? -1 : aVal < bVal ? 1 : 0
      }
      return aVal < bVal ? -1 : aVal > bVal ? 1 : 0
    })

    // 사무소별 합계 계산
    let pyeongtaekOutstanding = 0
    let cheonanOutstanding = 0
    let totalOutstanding = 0

    clients.forEach(client => {
      client.cases.forEach(c => {
        if (c.outstanding > 0) {
          totalOutstanding += c.outstanding
          if (c.office === '평택') {
            pyeongtaekOutstanding += c.outstanding
          } else if (c.office === '천안') {
            cheonanOutstanding += c.outstanding
          }
        }
      })
    })

    const summary: ReceivablesSummary = {
      total_outstanding: totalOutstanding,
      pyeongtaek_outstanding: pyeongtaekOutstanding,
      cheonan_outstanding: cheonanOutstanding,
      client_count: clients.length,
      case_count: clients.reduce((sum, c) => sum + c.case_count, 0),
      watch_count: watchCount,
      collection_count: collectionCount,
      clients,
    }

    // 포기 이력 조회
    if (includeWriteoffs) {
      try {
        const { data: writeoffs } = await supabase
          .from('receivable_writeoffs')
          .select('*')
          .order('written_off_at', { ascending: false })

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
}
