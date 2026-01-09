/**
 * SCOURT 사건별 caseType/기본 XML 매핑 검증 스크립트
 *
 * 사용법:
 *   npx tsx scripts/verify-scourt-xml-case-type.ts 2023노2410 2019구합53703
 */
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

import {
  detectCaseTypeFromApiResponse,
  detectCaseTypeFromCaseNumber,
  detectCaseTypeFromTemplateId,
  extractTemplateIdFromResponse,
  resolveBasicInfoXmlPath,
} from '../lib/scourt/xml-mapping'

dotenv.config({ path: path.join(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const apiBaseUrl = process.env.SCOURT_VERIFY_BASE_URL || 'http://localhost:3000'

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing environment variables: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

type SnapshotRow = {
  legal_case_id: string
  case_number: string | null
  raw_data: Record<string, unknown> | null
  basic_info: Record<string, unknown> | null
  scraped_at: string | null
}

type ApiSnapshot = {
  id: string
  scrapedAt?: string | null
  caseType?: string | null
  basicInfo?: Record<string, unknown> | null
  rawData?: Record<string, unknown> | null
}

function pickApiData(snapshot: SnapshotRow): Record<string, unknown> {
  return snapshot.raw_data || snapshot.basic_info || {}
}

function readCaseInfo(apiData: Record<string, unknown>) {
  const caseInfo =
    (apiData as { dma_csBasCtt?: Record<string, unknown> }).dma_csBasCtt ||
    (apiData as { dma_csBsCtt?: Record<string, unknown> }).dma_csBsCtt ||
    (apiData as { dma_gnrlCtt?: Record<string, unknown> }).dma_gnrlCtt ||
    apiData
  return {
    csDvsCd: (caseInfo as { csDvsCd?: string | number }).csDvsCd,
    csDvsNm: (caseInfo as { csDvsNm?: string }).csDvsNm,
    userCsNo: (caseInfo as { userCsNo?: string }).userCsNo,
    csNo: (caseInfo as { csNo?: string | number }).csNo,
  }
}

async function findLegalCase(caseNumber: string) {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(caseNumber)

  if (isUuid) {
    const { data, error } = await supabase
      .from('legal_cases')
      .select('id, court_case_number, case_number')
      .eq('id', caseNumber)
      .limit(1)
      .single()

    if (error) {
      return { data: null, error }
    }

    return { data, error: null }
  }

  const { data, error } = await supabase
    .from('legal_cases')
    .select('id, court_case_number, case_number')
    .or(`court_case_number.eq.${caseNumber},case_number.eq.${caseNumber}`)
    .limit(1)
    .single()

  if (error) {
    const { data: fuzzyData, error: fuzzyError } = await supabase
      .from('legal_cases')
      .select('id, court_case_number, case_number')
      .or(`court_case_number.ilike.%${caseNumber}%,case_number.ilike.%${caseNumber}%`)
      .limit(1)

    if (fuzzyError || !fuzzyData || fuzzyData.length === 0) {
      return { data: null, error }
    }

    return { data: fuzzyData[0], error: null }
  }

  return { data, error: null }
}

async function findLatestSnapshot(legalCaseId: string) {
  const { data, error } = await supabase
    .from('scourt_case_snapshots')
    .select('legal_case_id, case_number, raw_data, basic_info, scraped_at')
    .eq('legal_case_id', legalCaseId)
    .order('scraped_at', { ascending: false })
    .limit(1)
    .single()

  if (error) {
    return { data: null, error }
  }

  return { data: data as SnapshotRow, error: null }
}

async function findXmlCache(xmlPath: string) {
  const { data, error } = await supabase
    .from('scourt_xml_cache')
    .select('xml_path, case_type, data_list_id, updated_at')
    .eq('xml_path', xmlPath)
    .limit(1)
    .single()

  if (error) {
    return { data: null, error }
  }

  return { data, error: null }
}

async function fetchSnapshotFromApi(caseId: string) {
  try {
    const response = await fetch(
      `${apiBaseUrl}/api/admin/scourt/snapshot?caseId=${encodeURIComponent(caseId)}`
    )
    if (!response.ok) {
      return { data: null, error: new Error(`HTTP ${response.status}`) }
    }
    const payload = await response.json()
    if (!payload?.snapshot) {
      return { data: null, error: new Error('snapshot not found') }
    }
    return { data: payload.snapshot as ApiSnapshot, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

async function fetchXmlCacheFromApi(xmlPath: string) {
  try {
    const response = await fetch(
      `${apiBaseUrl}/api/scourt/xml-cache?path=${encodeURIComponent(xmlPath)}`
    )
    if (!response.ok) {
      return { data: null, error: new Error(`HTTP ${response.status}`) }
    }
    const payload = await response.json()
    if (!payload?.xml_content) {
      return { data: null, error: new Error('xml_content empty') }
    }
    return { data: payload, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

async function verifyCase(caseNumber: string) {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(caseNumber)
  const { data: legalCase, error: caseError } = await findLegalCase(caseNumber)
  if (caseError || !legalCase) {
    if (isUuid) {
      const { data: apiSnapshot } = await fetchSnapshotFromApi(caseNumber)
      if (!apiSnapshot) {
        console.log(`\n[${caseNumber}] ❌ legal_cases에서 찾지 못했고, 로컬 API에서도 스냅샷을 못 찾았습니다.`)
        return
      }

      const apiData = apiSnapshot.rawData || apiSnapshot.basicInfo || {}
      const caseInfo = readCaseInfo(apiData)
      const caseNumberForDetection = caseInfo.userCsNo || (typeof caseInfo.csNo === 'string' ? caseInfo.csNo : '')
      const templateId = extractTemplateIdFromResponse(apiSnapshot.rawData || apiSnapshot.basicInfo || {})
      const caseTypeFromTemplate = templateId ? detectCaseTypeFromTemplateId(templateId) : null
      const caseTypeFromApi = detectCaseTypeFromApiResponse(apiData)
      const caseTypeFromNumber = caseNumberForDetection
        ? detectCaseTypeFromCaseNumber(caseNumberForDetection)
        : null
      const resolvedCaseType = caseTypeFromTemplate || caseTypeFromApi || caseTypeFromNumber
      const basicInfoPath = resolvedCaseType
        ? resolveBasicInfoXmlPath({
          caseType: resolvedCaseType,
          apiResponse: apiSnapshot.rawData || apiSnapshot.basicInfo || {},
          templateId,
        })
        : null
      const xmlCache = basicInfoPath ? await fetchXmlCacheFromApi(basicInfoPath) : { data: null, error: null }

      console.log(`\n[${caseNumber}] ✅ 로컬 API 스냅샷 기반 검증`)
      console.log(`- snapshot id: ${apiSnapshot.id}`)
      console.log(`- scrapedAt: ${apiSnapshot.scrapedAt || ''}`)
      console.log(`- csDvsCd: ${caseInfo.csDvsCd ?? ''}`)
      console.log(`- csDvsNm: ${caseInfo.csDvsNm ?? ''}`)
      console.log(`- userCsNo: ${caseInfo.userCsNo ?? ''}`)
      console.log(`- csNo: ${caseInfo.csNo ?? ''}`)
      console.log(`- templateId: ${templateId || ''}`)
      console.log(`- caseType (template): ${caseTypeFromTemplate || ''}`)
      console.log(`- caseType (api): ${caseTypeFromApi || ''}`)
      console.log(`- caseType (case number): ${caseTypeFromNumber || ''}`)
      console.log(`- caseType (resolved): ${resolvedCaseType || ''}`)
      console.log(`- basic_info XML: ${basicInfoPath || ''}`)
      console.log(`- basic_info XML cached (API): ${xmlCache.data ? 'yes' : 'no'}`)
      return
    }

    console.log(`\n[${caseNumber}] ❌ legal_cases에서 찾지 못했습니다.`)
    return
  }

  const { data: snapshot, error: snapshotError } = await findLatestSnapshot(legalCase.id)
  if (snapshotError || !snapshot) {
    console.log(`\n[${caseNumber}] ❌ 스냅샷이 없습니다.`)
    return
  }

  const apiData = pickApiData(snapshot)
  const templateId = extractTemplateIdFromResponse(snapshot.raw_data || {})
  const caseTypeFromTemplate = templateId ? detectCaseTypeFromTemplateId(templateId) : null
  const caseTypeFromApi = detectCaseTypeFromApiResponse(apiData)
  const caseTypeFromNumber = detectCaseTypeFromCaseNumber(caseNumber)
  const resolvedCaseType = caseTypeFromTemplate || caseTypeFromApi || caseTypeFromNumber
  const basicInfoPath = resolvedCaseType
    ? resolveBasicInfoXmlPath({
      caseType: resolvedCaseType,
      apiResponse: snapshot.raw_data || apiData,
      templateId,
    })
    : null
  const caseInfo = readCaseInfo(apiData)
  const xmlCache = basicInfoPath ? await findXmlCache(basicInfoPath) : { data: null, error: null }

  console.log(`\n[${caseNumber}] ✅ 최신 스냅샷 ${snapshot.scraped_at || ''}`)
  console.log(`- court_case_number: ${legalCase.court_case_number || ''}`)
  console.log(`- case_number: ${legalCase.case_number || ''}`)
  console.log(`- csDvsCd: ${caseInfo.csDvsCd ?? ''}`)
  console.log(`- csDvsNm: ${caseInfo.csDvsNm ?? ''}`)
  console.log(`- userCsNo: ${caseInfo.userCsNo ?? ''}`)
  console.log(`- csNo: ${caseInfo.csNo ?? ''}`)
  console.log(`- templateId: ${templateId || ''}`)
  console.log(`- caseType (template): ${caseTypeFromTemplate || ''}`)
  console.log(`- caseType (api): ${caseTypeFromApi || ''}`)
  console.log(`- caseType (case number): ${caseTypeFromNumber}`)
  console.log(`- caseType (resolved): ${resolvedCaseType || ''}`)
  console.log(`- basic_info XML: ${basicInfoPath || ''}`)
  console.log(`- basic_info XML cached: ${xmlCache.data ? 'yes' : 'no'}`)
  if (xmlCache.data) {
    console.log(`- cached case_type: ${xmlCache.data.case_type || ''}`)
    console.log(`- cached updated_at: ${xmlCache.data.updated_at || ''}`)
  }
}

async function main() {
  const caseNumbers = process.argv.slice(2)

  if (caseNumbers.length === 0) {
    console.log('사건번호를 인자로 전달해주세요.')
    console.log('예: npx tsx scripts/verify-scourt-xml-case-type.ts 2023노2410')
    process.exit(1)
  }

  for (const caseNumber of caseNumbers) {
    await verifyCase(caseNumber)
  }
}

main().catch((error) => {
  console.error('검증 실패:', error)
  process.exit(1)
})
