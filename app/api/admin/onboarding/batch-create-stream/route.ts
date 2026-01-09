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
import { parseCaseNumber } from '@/lib/scourt/case-number-utils'
import { buildManualPartySeeds } from '@/lib/case/party-seeds'
import { inferClientRoleFromGeneralData } from '@/lib/scourt/party-role'
import { syncPartiesFromScourtServer } from '@/lib/scourt/party-sync'

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

    // SSE 스트림 생성
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        const sendEvent = (event: string, data: unknown) => {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
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

            // 1. 사건번호 파싱
            const parsed = parseCaseNumber(row.court_case_number!)
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

            // 2. 중복 체크
            const { data: existingCase } = await adminClient
              .from('legal_cases')
              .select('id, case_name')
              .eq('tenant_id', tenant.tenantId)
              .eq('court_case_number', row.court_case_number!)
              .eq('court_name', row.court_name!)
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

            let scourtResult
            try {
              scourtResult = await apiClient.searchAndRegisterCase({
                cortCd: row.court_name!,
                csYr: parsed.year,
                csDvsCd: parsed.caseType,
                csSerial: parsed.serial,
                btprNm: partyName,
              })
            } catch (error) {
              console.error(`[SCOURT] 연동 실패 (row ${i}):`, error)
              results.push({
                rowIndex: i,
                status: 'failed',
                originalData,
                errors: [{
                  field: 'scourt',
                  errorCode: 'SCOURT_ERROR',
                  message: `대법원 연동 오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}`,
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

              await delay(options.scourtDelayMs)
              continue
            }

            // 대법원 연동 실패 → 사건 등록하지 않음
            if (!scourtResult.success || !scourtResult.encCsNo) {
              results.push({
                rowIndex: i,
                status: 'failed',
                originalData,
                errors: [{
                  field: 'scourt',
                  errorCode: 'SCOURT_NOT_FOUND',
                  message: scourtResult.error || '대법원에서 사건을 찾을 수 없습니다',
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

              await delay(options.scourtDelayMs)
              continue
            }

            const inferredRole = row.client_role
              ? null
              : inferClientRoleFromGeneralData(scourtResult.generalData, partyName)
            const resolvedClientRole = row.client_role || inferredRole || null

            // 4. 대법원 연동 성공! 이제 사건과 의뢰인 등록
            const warnings: ImportResult['warnings'] = []
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

            // 4-3. 사건 생성 (대법원 정보 포함)
            const { data: newCase, error: caseError } = await adminClient
              .from('legal_cases')
              .insert([{
                tenant_id: tenant.tenantId,
                case_name: row.case_name || row.court_case_number,
                case_type: (row as { case_type?: string }).case_type || '기타',
                court_case_number: row.court_case_number,
                court_name: row.court_name,
                client_id: clientId,
                client_role: resolvedClientRole,
                opponent_name: row.opponent_name || null,
                assigned_to: assignedTo,
                status: '진행중',
                contract_date: row.contract_date,
                retainer_fee: row.retainer_fee || null,
                success_fee_agreement: row.success_fee_agreement || null,
                earned_success_fee: row.earned_success_fee || null,
                notes: row.notes || null,
                // 대법원 연동 정보
                enc_cs_no: scourtResult.encCsNo,
                scourt_wmonid: scourtResult.wmonid,
                scourt_last_sync: new Date().toISOString(),
                scourt_sync_status: 'synced',
              }])
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
              caseNumber: row.court_case_number,
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

            // 4-4. 스냅샷 저장 (일반내용, 진행내용)
            if (scourtResult.generalData || scourtResult.progressData) {
              try {
                await saveSnapshot({
                  legalCaseId: newCase.id,
                  caseNumber: row.court_case_number!,
                  courtCode: row.court_name!,
                  basicInfo: (scourtResult.generalData || {}) as Record<string, unknown>,
                  hearings: (scourtResult.generalData?.hearings || []) as unknown[],
                  progress: (scourtResult.progressData || []) as unknown[],
                })
              } catch (snapshotError) {
                console.error('스냅샷 저장 실패:', snapshotError)
                warnings.push({
                  field: 'snapshot',
                  message: '스냅샷 저장 실패 (사건은 정상 등록됨)'
                })
              }
            }

            // 4-5. SCOURT 당사자 동기화 (NewCaseForm과 동일)
            if (scourtResult.generalData) {
              const generalData = scourtResult.generalData
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
              scourtLinked: true,
              encCsNo: scourtResult.encCsNo
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
          console.error('[Batch Create Stream] Error:', error)
          sendEvent('error', {
            message: error instanceof Error ? error.message : '일괄 생성 중 오류 발생'
          })
        } finally {
          controller.close()
        }
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
