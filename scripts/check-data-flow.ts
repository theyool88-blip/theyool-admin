import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

// .env.local 로드
const envPath = path.join(process.cwd(), '.env.local')
const envContent = fs.readFileSync(envPath, 'utf8')
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=')
  if (key && valueParts.length > 0) {
    process.env[key.trim()] = valueParts.join('=').trim()
  }
})

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkDataFlow() {
  console.log('=== 데이터 흐름 검증 ===\n')

  // 1. 사건 조회 (모든 관련 데이터 포함)
  const { data: cases, error: casesError } = await supabase
    .from('legal_cases')
    .select(`
      id, case_name, court_case_number, court_name, case_level, main_case_id,
      primary_client_id, primary_client_name, status,
      client:clients(id, name),
      case_parties(id, party_name, party_type, party_type_label, is_primary),
      case_clients(client_id, linked_party_id, is_primary_client)
    `)
    .limit(3)

  if (casesError) {
    console.error('Error:', casesError.message)
    return
  }

  console.log('조회된 사건 수:', cases?.length, '\n')

  for (const c of cases || []) {
    console.log('---')
    console.log('사건명:', c.case_name)
    console.log('사건번호:', c.court_case_number || '없음')
    console.log('법원:', c.court_name || '없음')
    console.log('심급:', c.case_level || '없음')
    console.log('주사건 ID:', c.main_case_id || '없음 (이 사건이 주사건)')
    console.log('캐시-의뢰인ID:', c.primary_client_id || '없음')
    console.log('캐시-의뢰인명:', c.primary_client_name || '없음')
    console.log('레거시-client:', (c.client as any)?.name || '없음')

    const caseParties = c.case_parties as any[] || []
    const caseClients = c.case_clients as any[] || []

    console.log('\ncase_parties (' + caseParties.length + '명):')
    for (const p of caseParties) {
      console.log('  -', (p.party_type_label || p.party_type) + ':', p.party_name, '(is_primary:', p.is_primary + ')')
    }

    console.log('\ncase_clients (' + caseClients.length + '개):')
    for (const cc of caseClients) {
      console.log('  - client_id:', cc.client_id, ', linked_party_id:', cc.linked_party_id, ', is_primary_client:', cc.is_primary_client)
    }

    // 변환 로직 시뮬레이션
    const parties = caseParties
    const clients = caseClients

    const ourClientName = c.primary_client_name || (c.client as any)?.name
    const primaryClientLink = clients.find((cc: any) => cc.is_primary_client)
    const clientPartyId = primaryClientLink?.linked_party_id
    const clientParty = parties.find((p: any) => p.id === clientPartyId)
    const clientPartyType = clientParty?.party_type

    let opponent: string | null = null
    let opponentLabel: string | null = null
    if (clientPartyType) {
      const opponentType = clientPartyType === 'plaintiff' ? 'defendant' : 'plaintiff'
      const opponentParty = parties.find((p: any) =>
        p.party_type === opponentType && p.is_primary
      ) || parties.find((p: any) => p.party_type === opponentType)
      opponent = opponentParty?.party_name || null
      opponentLabel = opponentParty?.party_type_label || null
    } else {
      // Fallback: 레거시 데이터 - 의뢰인명과 다른 당사자를 상대방으로
      const opponentParty = parties.find((p: any) =>
        p.party_name !== ourClientName
      )
      opponent = opponentParty?.party_name || null
      opponentLabel = opponentParty?.party_type_label || null
    }

    console.log('\n변환 결과:')
    console.log('  의뢰인:', ourClientName, '(' + (clientParty?.party_type_label || '라벨없음') + ')')
    console.log('  상대방:', opponent, '(' + (opponentLabel || '라벨없음') + ')')
    console.log('')
  }

  // 2. 주사건-서브사건 관계 확인
  console.log('\n=== 주사건-서브사건 관계 ===\n')
  const { data: subCases } = await supabase
    .from('legal_cases')
    .select('id, case_name, case_level, main_case_id')
    .not('main_case_id', 'is', null)
    .limit(5)

  if (subCases?.length) {
    console.log('서브사건', subCases.length + '개 발견:')
    for (const sc of subCases) {
      console.log('  -', sc.case_name, '(' + sc.case_level + ') → 주사건:', sc.main_case_id)
    }
  } else {
    console.log('서브사건 없음 (모든 사건이 주사건)')
  }
}

checkDataFlow().catch(console.error)
