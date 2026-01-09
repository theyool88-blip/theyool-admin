/**
 * POST /api/admin/onboarding/batch-create
 * 사건 일괄 생성 API
 */

import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/lib/api/with-tenant'
import type { StandardCaseRow, ImportOptions, ImportResult } from '@/types/onboarding'
import { createCasesBatch } from '@/lib/onboarding/batch-case-creator'
import { generateImportReport } from '@/lib/onboarding/import-report-generator'
import { convertToStandardRow } from '@/lib/onboarding/csv-schema'
import { createAdminClient } from '@/lib/supabase/admin'
import { getScourtApiClient } from '@/lib/scourt/api-client'
import { saveEncCsNoToCase } from '@/lib/scourt/case-storage'
import { parseCaseNumber } from '@/lib/scourt/case-number-utils'
import { buildManualPartySeeds } from '@/lib/case/party-seeds'
import { inferClientRoleFromGeneralData } from '@/lib/scourt/party-role'

// 딜레이 유틸리티
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function upsertManualParties({
  adminClient,
  tenantId,
  caseId,
  row,
  clientId,
  clientRole,
}: {
  adminClient: ReturnType<typeof createAdminClient>
  tenantId: string
  caseId: string
  row: Partial<StandardCaseRow>
  clientId?: string
  clientRole?: StandardCaseRow['client_role'] | null
}): Promise<string | null> {
  const seeds = buildManualPartySeeds({
    clientName: row.client_name,
    opponentName: row.opponent_name,
    clientRole: clientRole || null,
    caseNumber: row.court_case_number,
    clientId: clientId || null,
  })

  if (seeds.length === 0) return null

  const payload = seeds.map((seed, index) => ({
    tenant_id: tenantId,
    case_id: caseId,
    party_name: seed.party_name,
    party_type: seed.party_type,
    party_type_label: seed.party_type_label || null,
    party_order: index + 1,
    is_our_client: seed.is_our_client,
    client_id: seed.client_id || null,
    manual_override: true,
    scourt_synced: false,
  }))

  const { error } = await adminClient
    .from('case_parties')
    .upsert(payload, { onConflict: 'case_id,party_type,party_name' })

  return error?.message || null
}

export const POST = withTenant(async (request: NextRequest, { tenant }) => {
  try {
    const body = await request.json() as {
      rows: Record<string, string>[]
      columnMapping?: Record<string, string>
      options?: Partial<ImportOptions>
    }

    const { rows, columnMapping, options: inputOptions } = body

    if (!rows || rows.length === 0) {
      return NextResponse.json(
        { error: '데이터가 필요합니다' },
        { status: 400 }
      )
    }

    // 기본 옵션
    const options: ImportOptions = {
      duplicateHandling: inputOptions?.duplicateHandling || 'skip',
      createNewClients: inputOptions?.createNewClients ?? true,
      linkScourt: inputOptions?.linkScourt ?? false,
      scourtDelayMs: inputOptions?.scourtDelayMs || 2500,
      dryRun: inputOptions?.dryRun ?? false
    }

    // 컬럼 매핑 적용하여 표준 형식으로 변환
    const mapping = columnMapping ? new Map(Object.entries(columnMapping)) : undefined
    const standardRows: Partial<StandardCaseRow>[] = rows.map(row =>
      convertToStandardRow(row, mapping as Map<string, keyof StandardCaseRow> | undefined)
    )

    // 사건 일괄 생성
    const results = await createCasesBatch(
      standardRows,
      options,
      {
        tenantId: tenant.tenantId!,
        isSuperAdmin: tenant.isSuperAdmin
      }
    )

    const adminClient = createAdminClient()
    const manualPartyCases = new Set<string>()

    // SCOURT 연동 (성공한 사건에 대해)
    if (options.linkScourt && !options.dryRun) {
      console.log('[SCOURT] 연동 시작 - 총', results.length, '건')
      const apiClient = getScourtApiClient()

      for (const result of results) {
        // success 또는 partial (경고만 있는 경우)도 연동
        if ((result.status === 'success' || result.status === 'partial' || result.status === 'updated') && result.created?.caseId) {
          console.log('[SCOURT] 연동 시도:', result.created.caseId)
          const row = standardRows[result.rowIndex]
          let inferredRole: 'plaintiff' | 'defendant' | null = null

          try {
            const parsed = parseCaseNumber(row.court_case_number!)
            if (parsed.valid) {
              const partyName = row.client_name || row.opponent_name

              if (partyName) {
                const searchResult = await apiClient.searchAndRegisterCase({
                  cortCd: row.court_name!,
                  csYr: parsed.year,
                  csDvsCd: parsed.caseType,
                  csSerial: parsed.serial,
                  btprNm: partyName,
                })

                if (searchResult.success && searchResult.encCsNo) {
                  await saveEncCsNoToCase({
                    legalCaseId: result.created.caseId,
                    encCsNo: searchResult.encCsNo,
                    wmonid: searchResult.wmonid!,
                    caseNumber: row.court_case_number!,
                    courtName: row.court_name!,
                  })
                  result.scourtLinked = true
                  result.encCsNo = searchResult.encCsNo
                }

                if (!row.client_role && searchResult.generalData) {
                  inferredRole = inferClientRoleFromGeneralData(searchResult.generalData, partyName)
                  if (inferredRole) {
                    const { error: roleError } = await adminClient
                      .from('legal_cases')
                      .update({ client_role: inferredRole })
                      .eq('id', result.created.caseId)
                    if (roleError) {
                      result.warnings.push({
                        field: 'client_role',
                        message: `의뢰인 역할 저장 실패: ${roleError.message}`
                      })
                    }
                  }
                }
              }
            }
          } catch (error) {
            console.error(`[SCOURT] 연동 실패 (row ${result.rowIndex}):`, error)
            result.warnings.push({
              field: 'scourt',
              message: `SCOURT 연동 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`,
            })
          }

          const resolvedRole = row.client_role || inferredRole || null
          const partyError = await upsertManualParties({
            adminClient,
            tenantId: tenant.tenantId!,
            caseId: result.created.caseId,
            row,
            clientId: result.created.clientId,
            clientRole: resolvedRole,
          })
          if (partyError) {
            result.warnings.push({
              field: 'party',
              message: `당사자 정보 저장 실패: ${partyError}`
            })
          }
          manualPartyCases.add(result.created.caseId)

          // API 호출 간격 유지
          await delay(options.scourtDelayMs)
        }
      }
    }

    if (!options.dryRun) {
      for (const result of results) {
        if ((result.status === 'success' || result.status === 'partial' || result.status === 'updated') && result.created?.caseId) {
          if (manualPartyCases.has(result.created.caseId)) continue
          const row = standardRows[result.rowIndex]
          const partyError = await upsertManualParties({
            adminClient,
            tenantId: tenant.tenantId!,
            caseId: result.created.caseId,
            row,
            clientId: result.created.clientId,
            clientRole: row.client_role || null,
          })
          if (partyError) {
            result.warnings.push({
              field: 'party',
              message: `당사자 정보 저장 실패: ${partyError}`
            })
          }
        }
      }
    }

    // 보고서 생성
    const report = generateImportReport(results, options)

    return NextResponse.json({
      success: true,
      data: {
        summary: report.summary,
        results: report.results,
        missingInfoSummary: report.missingInfoSummary,
        createdAt: report.createdAt
      }
    })
  } catch (error) {
    console.error('[Onboarding Batch Create] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '일괄 생성 실패' },
      { status: 500 }
    )
  }
})
