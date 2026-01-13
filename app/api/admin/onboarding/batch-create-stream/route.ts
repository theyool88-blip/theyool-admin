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

export async function POST(request: NextRequest) {
  const tenant = await getCurrentTenantContext()

  if (!tenant || !tenant.tenantId) {
    return new Response(JSON.stringify({ error: '인증이 필요합니다' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    })
  }

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
    const options: ImportOptions = {
      duplicateHandling: inputOptions?.duplicateHandling || 'skip',
      createNewClients: inputOptions?.createNewClients ?? true,
      linkScourt: true, // 항상 true (연동 필수)
      scourtDelayMs: inputOptions?.scourtDelayMs || 2500,
      dryRun: inputOptions?.dryRun ?? false
    }

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
            if (row.client_name) {
              const { data: existingClient } = await adminClient
                .from('clients')
                .select('id, name')
                .eq('tenant_id', tenant.tenantId)
                .eq('name', row.client_name)
                .single()

              if (existingClient) {
                clientId = existingClient.id
              } else if (options.createNewClients && row.client_phone) {
                const { data: newClient, error: clientError } = await adminClient
                  .from('clients')
                  .insert([{
                    tenant_id: tenant.tenantId,
                    name: row.client_name,
                    phone: row.client_phone,
                    email: row.client_email || null,
                    birth_date: row.client_birth_date || null,
                    address: row.client_address || null,
                    bank_account: row.client_bank_account || null,
                  }])
                  .select()
                  .single()

                if (clientError) {
                  warnings.push({
                    field: 'client_name',
                    message: `의뢰인 생성 실패: ${clientError.message}`
                  })
                } else {
                  clientId = newClient.id
                  isNewClient = true
                }
              } else if (!row.client_phone) {
                warnings.push({
                  field: 'client_phone',
                  message: '의뢰인 연락처가 없어 의뢰인을 생성하지 않았습니다'
                })
              }
            }

            // 4-2. 담당자 처리
            let assignedTo: string | null = null
            if (row.assigned_lawyer || row.assigned_staff) {
              const assignedName = row.assigned_lawyer || row.assigned_staff
              const { data: member } = await adminClient
                .from('tenant_members')
                .select('id')
                .eq('tenant_id', tenant.tenantId)
                .eq('display_name', assignedName)
                .single()

              if (member) {
                assignedTo = member.id
              } else {
                warnings.push({
                  field: 'assigned_lawyer',
                  message: `담당자 "${assignedName}"을(를) 찾을 수 없습니다`
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
            // opponent_name은 case_parties에서 관리하므로 null로 설정
            const caseData: Record<string, unknown> = {
              tenant_id: tenant.tenantId,
              case_name: row.case_name || cleanedCaseNumber,
              case_type: (row as { case_type?: string }).case_type || '기타',
              court_case_number: cleanedCaseNumber,
              court_name: normalizedCourtName,
              client_id: clientId,
              client_role: resolvedClientRole,
              client_role_status: resolvedClientRoleStatus,
              opponent_name: null,  // case_parties로 관리
              assigned_to: assignedTo,
              status: '진행중',
              contract_date: row.contract_date,
              retainer_fee: row.retainer_fee || null,
              success_fee_agreement: row.success_fee_agreement || null,
              notes: row.notes || null,
            }

            // 대법원 연동 성공 시에만 연동 정보 추가
            if (scourtLinked && scourtResult) {
              caseData.enc_cs_no = scourtResult.encCsNo
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

            if (partySeeds.length > 0) {
              const payload = partySeeds.map((seed, index) => ({
                tenant_id: tenant.tenantId,
                case_id: newCase.id,
                party_name: seed.party_name,
                party_type: seed.party_type,
                party_type_label: seed.party_type_label || null,
                party_order: index + 1,
                is_our_client: seed.is_our_client,
                client_id: seed.client_id || null,
                manual_override: true,
                scourt_synced: false,
              }))

              const { error: partyError } = await adminClient
                .from('case_parties')
                .upsert(payload, { onConflict: 'case_id,party_type,party_name' })

              if (partyError) {
                warnings.push({
                  field: 'party',
                  message: `당사자 정보 저장 실패: ${partyError.message}`
                })
              }
            }

            // 4-4. 스냅샷 저장 (대법원 연동 성공 시에만)
            if (scourtLinked && scourtResult && (scourtResult.generalData || scourtResult.progressData)) {
              try {
                type GeneralDataType = {
                  hearings?: unknown[];
                  lowerCourtCases?: Array<{
                    userCsNo: string;
                    cortNm?: string;
                    ultmtDvsNm?: string;
                    ultmtYmd?: string;
                    encCsNo?: string;
                  }>;
                  relatedCases?: Array<{
                    userCsNo: string;
                    reltCsCortNm?: string;
                    reltCsDvsNm?: string;
                    encCsNo?: string;
                  }>;
                  documents?: unknown[];
                }
                const generalData = scourtResult.generalData as GeneralDataType | undefined

                // 연관사건/심급 데이터 변환
                const lowerCourtData: LowerCourtData[] = (generalData?.lowerCourtCases || []).map(lc => ({
                  caseNo: lc.userCsNo,
                  courtName: lc.cortNm,
                  result: lc.ultmtDvsNm,
                  resultDate: lc.ultmtYmd,
                  encCsNo: lc.encCsNo || null,
                }))

                const relatedCasesData: RelatedCaseData[] = (generalData?.relatedCases || []).map(rc => ({
                  caseNo: rc.userCsNo,
                  caseName: rc.reltCsCortNm,
                  relation: rc.reltCsDvsNm,
                  encCsNo: rc.encCsNo || null,
                }))

                await saveSnapshot({
                  legalCaseId: newCase.id,
                  caseNumber: cleanedCaseNumber,
                  courtCode: normalizedCourtName,
                  basicInfo: (generalData || {}) as Record<string, unknown>,
                  hearings: ((generalData?.hearings as unknown[]) || []),
                  progress: (scourtResult.progressData || []) as unknown[],
                  documents: ((generalData?.documents as unknown[]) || []),
                  lowerCourt: lowerCourtData,
                  relatedCases: relatedCasesData,
                })

                // 4-4-1. 연관사건/심급 자동 연결
                if (lowerCourtData.length > 0 || relatedCasesData.length > 0) {
                  try {
                    await linkRelatedCases({
                      supabase: adminClient,
                      legalCaseId: newCase.id,
                      tenantId: tenant.tenantId,
                      caseNumber: cleanedCaseNumber,
                      caseType: parsed.caseType,
                      relatedCases: relatedCasesData,
                      lowerCourt: lowerCourtData,
                    })
                  } catch (linkError) {
                    console.error('연관사건 연결 실패:', linkError)
                    warnings.push({
                      field: 'related_cases',
                      message: '연관사건 자동 연결 실패 (사건은 정상 등록됨)'
                    })
                  }
                }
              } catch (snapshotError) {
                console.error('스냅샷 저장 실패:', snapshotError)
                warnings.push({
                  field: 'snapshot',
                  message: '스냅샷 저장 실패 (사건은 정상 등록됨)'
                })
              }
            }

            // 4-5. SCOURT 당사자 동기화 (대법원 연동 성공 시에만)
            if (scourtLinked && scourtResult && scourtResult.generalData) {
              type PartyType = { btprNm: string; btprDvsNm: string; adjdocRchYmd?: string; indvdCfmtnYmd?: string }
              type RepType = { agntDvsNm: string; agntNm: string; jdafrCorpNm?: string }
              const generalData = scourtResult.generalData as { parties?: PartyType[]; representatives?: RepType[] }
              if ((generalData.parties && generalData.parties.length > 0) ||
                  (generalData.representatives && generalData.representatives.length > 0)) {
                try {
                  await syncPartiesFromScourtServer(adminClient, {
                    legalCaseId: newCase.id,
                    tenantId: tenant.tenantId,
                    parties: generalData.parties || [],
                    representatives: generalData.representatives || []
                  })
                } catch (syncError) {
                  console.error('당사자 동기화 실패:', syncError)
                  warnings.push({
                    field: 'party_sync',
                    message: '당사자 동기화 실패 (사건은 정상 등록됨)'
                  })
                }
              }
            }

            // 4-6. SCOURT 기일 동기화 (대법원 연동 성공 시에만)
            if (scourtLinked && scourtResult && scourtResult.generalData) {
              type HearingType = { trmDt?: string; trmHm?: string; trmNm?: string; trmPntNm?: string; rslt?: string }
              const generalData = scourtResult.generalData as { hearings?: HearingType[] }
              if (generalData.hearings && generalData.hearings.length > 0) {
                try {
                  const hearingsForSync = generalData.hearings.map((h) => ({
                    date: h.trmDt || '',
                    time: h.trmHm || '',
                    type: h.trmNm || '',
                    location: h.trmPntNm || '',
                    result: h.rslt || '',
                  }))
                  await syncHearingsToCourtHearings(
                    newCase.id,
                    cleanedCaseNumber,
                    hearingsForSync
                  )
                } catch (syncError) {
                  console.error('기일 동기화 실패:', syncError)
                  warnings.push({
                    field: 'hearing_sync',
                    message: '기일 동기화 실패 (사건은 정상 등록됨)'
                  })
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
