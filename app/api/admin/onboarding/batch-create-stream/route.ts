/**
 * POST /api/admin/onboarding/batch-create-stream
 * 사건 일괄 생성 API (SSE 스트리밍)
 *
 * 흐름:
 * 1. 대법원 연동 시도 (searchAndRegisterCase)
 * 2. 연동 성공 → 의뢰인 + 사건 등록 + 스냅샷 저장
 * 3. 연동 실패 → 등록하지 않음, 결과에 실패로 표시
 */

import { NextRequest } from 'next/server'
import * as fs from 'fs'

// 디버그 로그를 파일에 저장
function debugLog(message: string, data?: unknown) {
  const logLine = `[${new Date().toISOString()}] ${message} ${data ? JSON.stringify(data) : ''}\n`
  console.log(logLine.trim())
  fs.appendFileSync('/tmp/import-debug.log', logLine)
}
import { getCurrentTenantContext } from '@/lib/auth/tenant-context'
import { createAdminClient } from '@/lib/supabase/admin'
import type { StandardCaseRow, ImportOptions, ImportResult } from '@/types/onboarding'
import { generateImportReport } from '@/lib/onboarding/import-report-generator'
import { convertToStandardRow, applyDefaults } from '@/lib/onboarding/csv-schema'
import { getScourtApiClient } from '@/lib/scourt/api-client'
import { saveSnapshot } from '@/lib/scourt/case-storage'
import { parseCaseNumber, stripCourtPrefix } from '@/lib/scourt/case-number-utils'
import { getCourtFullName } from '@/lib/scourt/court-codes'
import { linkRelatedCases, type RelatedCaseData, type LowerCourtData } from '@/lib/scourt/related-case-linker'
import { buildManualPartySeeds } from '@/lib/case/party-seeds'
import { determineClientRoleStatus } from '@/lib/case/client-role-utils'
import { syncPartiesFromScourtServer } from '@/lib/scourt/party-sync'
import { syncHearingsToCourtHearings } from '@/lib/scourt/hearing-sync'

// 딜레이 유틸리티
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// 의뢰인 유형 정규화 (한글 → 영문)
function normalizeClientType(value: string | undefined): 'individual' | 'corporation' {
  if (!value) return 'individual'
  const trimmed = value.trim().toLowerCase()

  // 이미 영문인 경우
  if (trimmed === 'individual' || trimmed === 'corporation') {
    return trimmed as 'individual' | 'corporation'
  }

  // 한글 매핑
  const corporationKeywords = ['법인', '회사', '기업', 'corporation', 'company', 'corp']
  if (corporationKeywords.some(kw => trimmed.includes(kw))) {
    return 'corporation'
  }

  return 'individual'
}

export async function POST(request: NextRequest) {
  const tenant = await getCurrentTenantContext()

  if (!tenant || !tenant.tenantId) {
    debugLog('테넌트 인증 실패', { tenant, tenantId: tenant?.tenantId })
    return new Response(JSON.stringify({ error: '인증이 필요합니다' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  debugLog('테넌트 컨텍스트', {
    tenantId: tenant.tenantId,
    tenantName: tenant.tenantName,
    isSuperAdmin: tenant.isSuperAdmin,
    isImpersonating: (tenant as any).isImpersonating
  })

  try {
    const body = await request.json() as {
      rows: Record<string, string>[]
      columnMapping?: Record<string, string>
      options?: Partial<ImportOptions>
    }

    const { rows, columnMapping, options: inputOptions } = body

    if (!rows || rows.length === 0) {
      return new Response(JSON.stringify({ error: '데이터가 필요합니다' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // 기본 옵션
    // 대법원 API 호출 자체가 1~3초 걸리므로 추가 딜레이는 최소화
    const options: ImportOptions = {
      duplicateHandling: inputOptions?.duplicateHandling || 'skip',
      createNewClients: inputOptions?.createNewClients ?? true,
      linkScourt: true, // 항상 true (연동 필수)
      scourtDelayMs: inputOptions?.scourtDelayMs || 300,
      dryRun: inputOptions?.dryRun ?? false
    }

    debugLog('Import 옵션', {
      inputOptions,
      resolvedOptions: options,
      createNewClients: options.createNewClients
    })

    // 컬럼 매핑 적용하여 표준 형식으로 변환
    const mapping = columnMapping ? new Map(Object.entries(columnMapping)) : undefined
    const standardRows: Partial<StandardCaseRow>[] = rows.map(row =>
      convertToStandardRow(row, mapping as Map<string, keyof StandardCaseRow> | undefined)
    )

    // 클라이언트 연결 끊김 감지를 위한 공유 상태
    let streamClosed = false

    // SSE 스트림 생성
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()

        const sendEvent = (event: string, data: unknown) => {
          if (streamClosed) return // 이미 닫혔으면 무시
          try {
            controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
          } catch {
            // Controller가 닫혔을 때 에러 무시
            streamClosed = true
          }
        }

        const closeController = () => {
          if (!streamClosed) {
            streamClosed = true
            try {
              controller.close()
            } catch {
              // 이미 닫혔을 수 있음
            }
          }
        }

        const adminClient = createAdminClient()
        const apiClient = getScourtApiClient()
        const results: ImportResult[] = []

        try {
          sendEvent('phase', {
            phase: 'processing',
            message: '사건 등록 중 (대법원 연동 → 사건 생성)...',
            total: standardRows.length
          })

          for (let i = 0; i < standardRows.length; i++) {
            // 클라이언트 연결 끊김 감지 시 조기 종료
            if (streamClosed) {
              console.log(`[Batch Create Stream] 클라이언트 연결 끊김 감지 - ${i}/${standardRows.length}에서 중단`)
              break
            }

            const row = applyDefaults(standardRows[i]) as StandardCaseRow
            const originalData: Record<string, string> = {}
            for (const [key, value] of Object.entries(row)) {
              originalData[key] = value != null ? String(value) : ''
            }

            // 진행 상황 - 시작
            sendEvent('progress', {
              current: i + 1,
              total: standardRows.length,
              phase: 'processing',
              status: 'processing',
              caseName: row.court_case_number || `행 ${i + 1}`
            })

            // 1. 사건번호 파싱 및 정제
            // 법원명 접두사 제거 (예: "평택지원2023타경864" → "2023타경864")
            const cleanedCaseNumber = stripCourtPrefix(row.court_case_number!)
            const parsed = parseCaseNumber(cleanedCaseNumber)
            if (!parsed.valid) {
              results.push({
                rowIndex: i,
                status: 'failed',
                originalData,
                errors: [{
                  field: 'court_case_number',
                  errorCode: 'INVALID_CASE_NUMBER',
                  message: `사건번호 파싱 실패: ${row.court_case_number}`,
                  originalValue: row.court_case_number
                }],
                warnings: []
              })

              sendEvent('progress', {
                current: i + 1,
                total: standardRows.length,
                phase: 'processing',
                status: 'failed',
                caseName: row.court_case_number || `행 ${i + 1}`
              })
              continue
            }

            // 법원명 정규화 (배치 임포트와 일관성 유지)
            const normalizedCourtName = getCourtFullName(
              row.court_name!,
              parsed.caseType
            )

            // 2. 중복 체크 (정제된 사건번호, 정규화된 법원명으로 검색)
            const { data: existingCase } = await adminClient
              .from('legal_cases')
              .select('id, case_name')
              .eq('tenant_id', tenant.tenantId)
              .eq('court_case_number', cleanedCaseNumber)
              .eq('court_name', normalizedCourtName)
              .single()

            if (existingCase) {
              if (options.duplicateHandling === 'skip') {
                results.push({
                  rowIndex: i,
                  status: 'skipped',
                  originalData,
                  errors: [],
                  warnings: [{
                    field: 'court_case_number',
                    message: '이미 등록된 사건입니다',
                    suggestion: `기존 사건: ${existingCase.case_name}`
                  }],
                  created: {
                    caseId: existingCase.id,
                    caseName: existingCase.case_name
                  }
                })

                sendEvent('progress', {
                  current: i + 1,
                  total: standardRows.length,
                  phase: 'processing',
                  status: 'skipped',
                  caseName: row.court_case_number
                })
                continue
              } else if (options.duplicateHandling === 'error') {
                results.push({
                  rowIndex: i,
                  status: 'failed',
                  originalData,
                  errors: [{
                    field: 'court_case_number',
                    errorCode: 'DUPLICATE_CASE',
                    message: '이미 등록된 사건입니다',
                    originalValue: row.court_case_number
                  }],
                  warnings: []
                })

                sendEvent('progress', {
                  current: i + 1,
                  total: standardRows.length,
                  phase: 'processing',
                  status: 'failed',
                  caseName: row.court_case_number
                })
                continue
              }
              // 'update'는 기존 사건에 추가 정보만 업데이트하므로 계속 진행
            }

            // 3. 대법원 연동 시도 (핵심!)
            const partyName = row.client_name || row.opponent_name
            if (!partyName) {
              results.push({
                rowIndex: i,
                status: 'failed',
                originalData,
                errors: [{
                  field: 'client_name',
                  errorCode: 'NO_PARTY_NAME',
                  message: '대법원 검색에 필요한 당사자명이 없습니다',
                }],
                warnings: []
              })

              sendEvent('progress', {
                current: i + 1,
                total: standardRows.length,
                phase: 'processing',
                status: 'failed',
                caseName: row.court_case_number
              })
              continue
            }

            // 3. 대법원 연동 시도 (실패해도 사건은 등록)
            let scourtResult: { success: boolean; encCsNo?: string; wmonid?: string; generalData?: unknown; progressData?: unknown; error?: string } | null = null
            let scourtLinked = false
            let scourtError: string | null = null

            try {
              scourtResult = await apiClient.searchAndRegisterCase({
                cortCd: row.court_name!,
                csYr: parsed.year,
                csDvsCd: parsed.caseType,
                csSerial: parsed.serial,
                btprNm: partyName,
              })

              if (scourtResult.success && scourtResult.encCsNo) {
                scourtLinked = true
              } else {
                scourtError = scourtResult.error || '대법원에서 사건을 찾을 수 없습니다'
              }
            } catch (error) {
              console.error(`[SCOURT] 연동 실패 (row ${i}):`, error)
              scourtError = error instanceof Error ? error.message : '대법원 연동 오류'
            }

            // 기본값 'plaintiff'로 임시 지정 (알림탭에서 사후 확인)
            const inferredRole = row.client_role ? null : 'plaintiff'
            const resolvedClientRole = row.client_role || inferredRole || 'plaintiff'

            // 4. 사건과 의뢰인 등록 (대법원 연동 여부와 관계없이 진행)
            const warnings: ImportResult['warnings'] = []

            // 대법원 연동 실패 시 경고 추가
            if (!scourtLinked && scourtError) {
              warnings.push({
                field: 'scourt',
                message: `대법원 연동 안됨: ${scourtError}`
              })
            }
            let clientId: string | null = null
            let isNewClient = false

            // 4-1. 의뢰인 처리
            debugLog('의뢰인 처리 시작', { client_name: row.client_name, createNewClients: options.createNewClients })
            if (row.client_name) {
              const { data: existingClient, error: lookupError } = await adminClient
                .from('clients')
                .select('id, name')
                .eq('tenant_id', tenant.tenantId)
                .eq('name', row.client_name)
                .maybeSingle()  // single() → maybeSingle()로 변경 (0건일 때 에러 방지)

              debugLog('기존 의뢰인 조회 결과', { existingClient, lookupError: lookupError?.code })

              if (existingClient) {
                clientId = existingClient.id
                debugLog('기존 의뢰인 매칭', { clientId })
              } else if (options.createNewClients) {
                // 전화번호 없이도 의뢰인 생성 (이름만 필수)
                debugLog('신규 의뢰인 생성 시도', { tenant_id: tenant.tenantId, name: row.client_name })
                const { data: newClient, error: clientError } = await adminClient
                  .from('clients')
                  .insert([{
                    tenant_id: tenant.tenantId,
                    name: row.client_name,
                    phone: row.client_phone || null,
                    email: row.client_email || null,
                    birth_date: row.client_birth_date || null,
                    address: row.client_address || null,
                    bank_account: row.client_bank_account || null,
                    client_type: normalizeClientType(row.client_type),
                    resident_number: row.client_resident_number || null,
                    company_name: row.client_company_name || null,
                    registration_number: row.client_registration_number || null,
                  }])
                  .select()
                  .single()

                if (clientError) {
                  debugLog('의뢰인 생성 실패', clientError)
                  warnings.push({
                    field: 'client_name',
                    message: `의뢰인 생성 실패: ${clientError.message} (code: ${clientError.code})`
                  })
                } else {
                  clientId = newClient.id
                  isNewClient = true
                  debugLog('의뢰인 생성 성공', { clientId })
                }
              } else {
                debugLog('createNewClients=false, 의뢰인 생성 스킵')
              }
            } else {
              // 의뢰인명이 비어있는 경우 경고 추가
              debugLog('client_name이 비어있음, 의뢰인 처리 스킵')
              warnings.push({
                field: 'client_name',
                message: '의뢰인명이 없어 의뢰인 정보가 등록되지 않았습니다'
              })
            }

            // 4-2. 담당자 처리 (복수 담당자 지원)
            let assignedTo: string | null = null
            const assigneeIds: { memberId: string; isPrimary: boolean }[] = []

            if (row.assigned_lawyer) {
              // 쉼표로 구분된 복수 변호사 파싱
              const lawyerNames = row.assigned_lawyer.split(',').map(n => n.trim()).filter(n => n)

              for (let idx = 0; idx < lawyerNames.length; idx++) {
                const lawyerName = lawyerNames[idx]
                const { data: member } = await adminClient
                  .from('tenant_members')
                  .select('id')
                  .eq('tenant_id', tenant.tenantId)
                  .eq('display_name', lawyerName)
                  .single()

                if (member) {
                  // 첫 번째 변호사가 primary
                  if (idx === 0) {
                    assignedTo = member.id
                  }
                  assigneeIds.push({ memberId: member.id, isPrimary: idx === 0 })
                } else {
                  warnings.push({
                    field: 'assigned_lawyer',
                    message: `담당자 "${lawyerName}"을(를) 찾을 수 없습니다`
                  })
                }
              }
            }

            // assigned_staff 처리 (단일)
            if (row.assigned_staff) {
              const { data: staffMember } = await adminClient
                .from('tenant_members')
                .select('id')
                .eq('tenant_id', tenant.tenantId)
                .eq('display_name', row.assigned_staff)
                .single()

              if (staffMember) {
                // staff는 assignedTo에 넣지 않음 (lawyer만 primary)
                assigneeIds.push({ memberId: staffMember.id, isPrimary: false })
              } else {
                warnings.push({
                  field: 'assigned_staff',
                  message: `담당직원 "${row.assigned_staff}"을(를) 찾을 수 없습니다`
                })
              }
            }

            // 4-3. 사건 생성 (대법원 연동 여부에 따라 다르게 처리)
            // client_role_status 결정
            const resolvedClientRoleStatus = determineClientRoleStatus({
              explicitClientRole: row.client_role,
              clientName: row.client_name,
              opponentName: row.opponent_name
            })

            // 정제된 사건번호, 정규화된 법원명 사용
            // 참고: client_id, client_role, client_role_status, opponent_name, retainer_fee, success_fee_agreement는
            //       legal_cases 테이블에서 제거됨 (case_clients, case_parties 테이블로 이동)
            const caseData: Record<string, unknown> = {
              tenant_id: tenant.tenantId,
              case_name: row.case_name || cleanedCaseNumber,
              case_type: (row as { case_type?: string }).case_type || '기타',
              court_case_number: cleanedCaseNumber,
              court_name: normalizedCourtName,
              primary_client_id: clientId,
              primary_client_name: row.client_name || null,
              assigned_to: assignedTo,
              status: '진행중',
              contract_date: row.contract_date,
              notes: row.notes || null,
            }

            // 대법원 연동 성공 시에만 연동 정보 추가
            if (scourtLinked && scourtResult) {
              caseData.scourt_enc_cs_no = scourtResult.encCsNo
              caseData.scourt_wmonid = scourtResult.wmonid
              caseData.scourt_last_sync = new Date().toISOString()
              caseData.scourt_sync_status = 'synced'
            }

            const { data: newCase, error: caseError } = await adminClient
              .from('legal_cases')
              .insert([caseData])
              .select()
              .single()

            if (caseError) {
              results.push({
                rowIndex: i,
                status: 'failed',
                originalData,
                errors: [{
                  field: 'case_name',
                  errorCode: 'CASE_CREATE_FAILED',
                  message: `사건 생성 실패: ${caseError.message}`
                }],
                warnings
              })

              sendEvent('progress', {
                current: i + 1,
                total: standardRows.length,
                phase: 'processing',
                status: 'failed',
                caseName: row.court_case_number
              })

              await delay(options.scourtDelayMs)
              continue
            }

            const partySeeds = buildManualPartySeeds({
              clientName: row.client_name,
              opponentName: row.opponent_name,
              clientRole: resolvedClientRole,
              caseNumber: cleanedCaseNumber,
              clientId,
            })

            // ============================================
            // 병렬 처리: 당사자, 의뢰인, 담당자 동시 생성
            // ============================================
            let insertedParties: { id: string; party_name: string }[] | null = null

            // 1. case_parties 생성 (case_clients가 linked_party_id 필요하므로 먼저)
            if (partySeeds.length > 0) {
              const payload = partySeeds.map((seed, index) => ({
                tenant_id: tenant.tenantId,
                case_id: newCase.id,
                party_name: seed.party_name,
                party_type: seed.party_type,
                party_type_label: seed.party_type_label || null,
                party_order: index + 1,
                representatives: [],
                scourt_synced: false,
              }))

              const { data, error: partyError } = await adminClient
                .from('case_parties')
                .upsert(payload, { onConflict: 'case_id,party_type,party_name' })
                .select('id, party_name')

              insertedParties = data
              if (partyError) {
                warnings.push({ field: 'party', message: `당사자 정보 저장 실패: ${partyError.message}` })
              }
            }

            // 2. case_clients + case_assignees 병렬 생성
            const parallelOps: Promise<void>[] = []

            if (clientId) {
              const clientParty = insertedParties?.find(p => p.party_name === row.client_name)
              parallelOps.push((async () => {
                const { error } = await adminClient
                  .from('case_clients')
                  .upsert({
                    tenant_id: tenant.tenantId,
                    case_id: newCase.id,
                    client_id: clientId,
                    linked_party_id: clientParty?.id || null,
                    is_primary_client: true,
                    retainer_fee: row.retainer_fee ? Number(row.retainer_fee) : null,
                  }, { onConflict: 'case_id,client_id' })
                if (error) warnings.push({ field: 'case_clients', message: `의뢰인 연결 실패: ${error.message}` })
              })())
            }

            if (assigneeIds.length > 0) {
              const assigneePayload = assigneeIds.map(a => ({
                tenant_id: tenant.tenantId,
                case_id: newCase.id,
                member_id: a.memberId,
                assignee_role: 'lawyer' as const,
                is_primary: a.isPrimary,
              }))
              parallelOps.push((async () => {
                const { error } = await adminClient.from('case_assignees').upsert(assigneePayload, { onConflict: 'case_id,member_id' })
                if (error) warnings.push({ field: 'case_assignees', message: `담당자 연결 실패: ${error.message}` })
              })())
            }

            await Promise.all(parallelOps)

            // ============================================
            // 병렬 처리: 스냅샷 저장 + 동기화 작업
            // ============================================
            if (scourtLinked && scourtResult && (scourtResult.generalData || scourtResult.progressData)) {
              type GeneralDataType = {
                hearings?: Array<{ trmDt?: string; trmHm?: string; trmNm?: string; trmPntNm?: string; rslt?: string }>;
                lowerCourtCases?: Array<{ userCsNo: string; cortNm?: string; ultmtDvsNm?: string; ultmtYmd?: string; encCsNo?: string }>;
                relatedCases?: Array<{ userCsNo: string; reltCsCortNm?: string; reltCsDvsNm?: string; encCsNo?: string }>;
                documents?: unknown[];
                parties?: Array<{ btprNm: string; btprDvsNm: string; adjdocRchYmd?: string; indvdCfmtnYmd?: string }>;
                representatives?: Array<{ agntDvsNm: string; agntNm: string; jdafrCorpNm?: string }>;
              }
              const generalData = scourtResult.generalData as GeneralDataType | undefined

              // 데이터 변환
              const lowerCourtData: LowerCourtData[] = (generalData?.lowerCourtCases || []).map(lc => ({
                caseNo: lc.userCsNo, courtName: lc.cortNm, result: lc.ultmtDvsNm, resultDate: lc.ultmtYmd, encCsNo: lc.encCsNo || null,
              }))
              const relatedCasesData: RelatedCaseData[] = (generalData?.relatedCases || []).map(rc => ({
                caseNo: rc.userCsNo, caseName: rc.reltCsCortNm, relation: rc.reltCsDvsNm, encCsNo: rc.encCsNo || null,
              }))

              // 모든 동기화 작업을 병렬로 실행 (실패해도 사건 등록에 영향 없음)
              const syncOps: Promise<{ type: string; error?: string }>[] = []

              // 1. 스냅샷 저장 + legal_cases 업데이트
              syncOps.push(
                saveSnapshot({
                  tenantId: tenant.tenantId,
                  legalCaseId: newCase.id,
                  caseNumber: cleanedCaseNumber,
                  courtCode: normalizedCourtName,
                  basicInfo: (generalData || {}) as Record<string, unknown>,
                  hearings: (generalData?.hearings || []) as unknown[],
                  progress: (scourtResult.progressData || []) as unknown[],
                  documents: (generalData?.documents || []) as unknown[],
                  lowerCourt: lowerCourtData,
                  relatedCases: relatedCasesData,
                }).then(async (snapshotId) => {
                  if (snapshotId) {
                    await adminClient.from('legal_cases').update({ scourt_last_snapshot_id: snapshotId }).eq('id', newCase.id)
                  }
                  return { type: 'snapshot' }
                }).catch(e => ({ type: 'snapshot', error: e.message }))
              )

              // 2. 연관사건 연결
              if (lowerCourtData.length > 0 || relatedCasesData.length > 0) {
                syncOps.push(
                  linkRelatedCases({
                    supabase: adminClient, legalCaseId: newCase.id, tenantId: tenant.tenantId,
                    caseNumber: cleanedCaseNumber, caseType: parsed.caseType,
                    relatedCases: relatedCasesData, lowerCourt: lowerCourtData,
                  }).then(() => ({ type: 'related_cases' })).catch(e => ({ type: 'related_cases', error: e.message }))
                )
              }

              // 3. 당사자 동기화
              if (generalData?.parties?.length || generalData?.representatives?.length) {
                syncOps.push(
                  syncPartiesFromScourtServer(adminClient, {
                    legalCaseId: newCase.id, tenantId: tenant.tenantId,
                    parties: generalData.parties || [], representatives: generalData.representatives || []
                  }).then(() => ({ type: 'party_sync' })).catch(e => ({ type: 'party_sync', error: e.message }))
                )
              }

              // 4. 기일 동기화
              if (generalData?.hearings?.length) {
                const hearingsForSync = generalData.hearings.map(h => ({
                  date: h.trmDt || '', time: h.trmHm || '', type: h.trmNm || '', location: h.trmPntNm || '', result: h.rslt || '',
                }))
                syncOps.push(
                  syncHearingsToCourtHearings(newCase.id, cleanedCaseNumber, hearingsForSync)
                    .then(() => ({ type: 'hearing_sync' })).catch(e => ({ type: 'hearing_sync', error: e.message }))
                )
              }

              // 병렬 실행 & 에러 수집
              const syncResults = await Promise.all(syncOps)
              for (const result of syncResults) {
                if (result.error) {
                  warnings.push({ field: result.type, message: `${result.type} 실패: ${result.error}` })
                }
              }
            }

            // 성공!
            const hasWarnings = warnings.length > 0
            results.push({
              rowIndex: i,
              status: hasWarnings ? 'partial' : 'success',
              originalData,
              errors: [],
              warnings,
              created: {
                caseId: newCase.id,
                caseName: newCase.case_name,
                clientId: clientId || undefined,
                clientName: row.client_name,
                isNewClient
              },
              scourtLinked,
              encCsNo: scourtLinked && scourtResult ? scourtResult.encCsNo : undefined
            })

            sendEvent('progress', {
              current: i + 1,
              total: standardRows.length,
              phase: 'processing',
              status: 'success',
              caseName: row.court_case_number
            })

            // API 호출 간격 유지
            await delay(options.scourtDelayMs)
          }

          // 최종 보고서 생성
          const report = generateImportReport(results, options)

          sendEvent('complete', {
            summary: report.summary,
            results: report.results,
            missingInfoSummary: report.missingInfoSummary,
            createdAt: report.createdAt
          })

        } catch (error) {
          // 스트림이 이미 닫힌 경우는 에러 로깅만 하고 이벤트 전송 시도하지 않음
          if (streamClosed) {
            console.log('[Batch Create Stream] Stream closed by client, ignoring error:', error)
          } else {
            console.error('[Batch Create Stream] Error:', error)
            sendEvent('error', {
              message: error instanceof Error ? error.message : '일괄 생성 중 오류 발생'
            })
          }
        } finally {
          closeController()
        }
      },
      // 클라이언트가 연결을 끊었을 때 호출됨
      cancel() {
        console.log('[Batch Create Stream] Client disconnected')
        streamClosed = true
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      }
    })

  } catch (error) {
    console.error('[Batch Create Stream] Parse Error:', error)
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : '요청 처리 실패'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
