/**
 * 사건 일괄 생성 로직
 * 표준 형식의 데이터를 받아 legal_cases 테이블에 등록
 */

import { createAdminClient } from '@/lib/supabase/admin'
import type {
  StandardCaseRow,
  ImportOptions,
  ImportResult,
  ImportError,
  ImportWarning,
  PreviewData,
} from '@/types/onboarding'
import { validateRow, applyDefaults } from './csv-schema'
import { getCourtFullName } from '@/lib/scourt/court-codes'
import { parseCaseNumber, stripCourtPrefix } from '@/lib/scourt/case-number-utils'
import { determineClientRoleStatus } from '@/lib/case/client-role-utils'
import { buildManualPartySeeds } from '@/lib/case/party-seeds'

// 테넌트 컨텍스트
interface TenantContext {
  tenantId: string
  isSuperAdmin?: boolean
}

/**
 * 데이터 미리보기 생성
 */
export async function generatePreview(
  rows: Partial<StandardCaseRow>[],
  tenant: TenantContext
): Promise<PreviewData> {
  const adminClient = createAdminClient()
  const previewRows: PreviewData['rows'] = []

  let validCount = 0
  let errorCount = 0
  let warningCount = 0
  let duplicateCount = 0

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const validation = validateRow(row, i)
    // 법원명 접두사 제거 (예: "평택지원2023타경864" → "2023타경864")
    const cleanedCaseNumber = row.court_case_number
      ? stripCourtPrefix(row.court_case_number)
      : null
    const parsedCourtNumber = cleanedCaseNumber
      ? parseCaseNumber(cleanedCaseNumber)
      : null
    const normalizedCourtName = row.court_name
      ? getCourtFullName(
          row.court_name,
          parsedCourtNumber?.valid ? parsedCourtNumber.caseType : undefined
        )
      : row.court_name

    // 기존 사건 확인 (정제된 사건번호로 검색)
    let existingCase: { id: string; caseName: string } | undefined
    if (cleanedCaseNumber && normalizedCourtName) {
      const { data: existing } = await adminClient
        .from('legal_cases')
        .select('id, case_name')
        .eq('tenant_id', tenant.tenantId)
        .eq('court_case_number', cleanedCaseNumber)
        .eq('court_name', normalizedCourtName)
        .single()

      if (existing) {
        existingCase = { id: existing.id, caseName: existing.case_name }
        duplicateCount++
      }
    }

    // 기존 의뢰인 확인
    let existingClient: { id: string; name: string } | undefined
    if (row.client_name) {
      const { data: client } = await adminClient
        .from('clients')
        .select('id, name')
        .eq('tenant_id', tenant.tenantId)
        .eq('name', row.client_name)
        .single()

      if (client) {
        existingClient = { id: client.id, name: client.name }
      }
    }

    // 통계 업데이트
    if (validation.isValid) {
      validCount++
    } else {
      errorCount++
    }
    if (validation.warnings.length > 0) {
      warningCount++
    }

    previewRows.push({
      ...(applyDefaults(row) as StandardCaseRow),
      _rowIndex: i,
      _validation: validation,
      _existingCase: existingCase,
      _existingClient: existingClient
    })
  }

  return {
    rows: previewRows,
    summary: {
      total: rows.length,
      valid: validCount,
      hasErrors: errorCount,
      hasWarnings: warningCount,
      duplicates: duplicateCount
    }
  }
}

/**
 * 사건 일괄 생성
 */
export async function createCasesBatch(
  rows: Partial<StandardCaseRow>[],
  options: ImportOptions,
  tenant: TenantContext,
  onProgress?: (current: number, total: number, result: ImportResult) => void
): Promise<ImportResult[]> {
  const adminClient = createAdminClient()
  const results: ImportResult[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const result = await createSingleCase(row, i, options, tenant, adminClient)
    results.push(result)

    if (onProgress) {
      onProgress(i + 1, rows.length, result)
    }

    // SCOURT 연동 시 딜레이 추가
    if (options.linkScourt && result.status === 'success') {
      await delay(options.scourtDelayMs || 100)
    }
  }

  return results
}

/**
 * 단일 사건 생성
 */
async function createSingleCase(
  row: Partial<StandardCaseRow>,
  rowIndex: number,
  options: ImportOptions,
  tenant: TenantContext,
  adminClient: ReturnType<typeof createAdminClient>
): Promise<ImportResult> {
  const errors: ImportError[] = []
  const warnings: ImportWarning[] = []
  const originalData = { ...row } as Record<string, string>
  // 법원명 접두사 제거 (예: "평택지원2023타경864" → "2023타경864")
  const cleanedCaseNumber = row.court_case_number
    ? stripCourtPrefix(row.court_case_number)
    : null
  const parsedCourtNumber = cleanedCaseNumber
    ? parseCaseNumber(cleanedCaseNumber)
    : null
  const normalizedCourtName = row.court_name
    ? getCourtFullName(
        row.court_name,
        parsedCourtNumber?.valid ? parsedCourtNumber.caseType : undefined
      )
    : row.court_name

  // 1. 유효성 검사
  const validation = validateRow(row, rowIndex)
  if (!validation.isValid) {
    return {
      rowIndex,
      status: 'failed',
      originalData,
      errors: validation.errors,
      warnings: validation.warnings
    }
  }
  warnings.push(...validation.warnings)

  // Dry run 모드면 여기서 반환
  if (options.dryRun) {
    return {
      rowIndex,
      status: 'success',
      originalData,
      errors: [],
      warnings,
      created: {
        caseName: row.case_name || row.court_case_number
      }
    }
  }

  try {
    // 2. 중복 사건 확인 (정제된 사건번호로 검색)
    const { data: existingCase } = await adminClient
      .from('legal_cases')
      .select('id, case_name')
      .eq('tenant_id', tenant.tenantId)
      .eq('court_case_number', cleanedCaseNumber!)
      .eq('court_name', normalizedCourtName!)
      .single()

    if (existingCase) {
      // 중복 처리 옵션에 따라 분기
      switch (options.duplicateHandling) {
        case 'skip':
          return {
            rowIndex,
            status: 'skipped',
            originalData,
            errors: [],
            warnings: [{
              field: 'court_case_number',
              message: '이미 등록된 사건입니다',
              suggestion: `기존 사건: ${existingCase.case_name} (${existingCase.id})`
            }],
            created: {
              caseId: existingCase.id,
              caseName: existingCase.case_name
            }
          }

        case 'update':
          // 기존 사건 업데이트
          await updateExistingCase(
            existingCase.id,
            row,
            tenant,
            adminClient
          )
          return {
            rowIndex,
            status: 'updated',
            originalData,
            errors: [],
            warnings: [{
              field: 'court_case_number',
              message: '기존 사건이 업데이트되었습니다'
            }],
            created: {
              caseId: existingCase.id,
              caseName: existingCase.case_name
            }
          }

        case 'error':
        default:
          return {
            rowIndex,
            status: 'failed',
            originalData,
            errors: [{
              field: 'court_case_number',
              errorCode: 'DUPLICATE_CASE',
              message: '이미 등록된 사건입니다',
              originalValue: row.court_case_number
            }],
            warnings: []
          }
      }
    }

    // 3. 의뢰인 처리
    let clientId: string | null = null
    let isNewClient = false

    // 기존 의뢰인 검색
    const { data: existingClient } = await adminClient
      .from('clients')
      .select('id, name')
      .eq('tenant_id', tenant.tenantId)
      .eq('name', row.client_name!)
      .single()

    if (existingClient) {
      clientId = existingClient.id
    } else if (options.createNewClients && row.client_phone) {
      // 신규 의뢰인 생성
      const { data: newClient, error: clientError } = await adminClient
        .from('clients')
        .insert([{
          tenant_id: tenant.tenantId,
          name: row.client_name!,
          phone: row.client_phone,
          email: row.client_email || null
        }])
        .select()
        .single()

      if (clientError) {
        errors.push({
          field: 'client_name',
          errorCode: 'CLIENT_CREATE_FAILED',
          message: `의뢰인 생성 실패: ${clientError.message}`
        })
      } else {
        clientId = newClient.id
        isNewClient = true
      }
    } else if (!row.client_phone) {
      warnings.push({
        field: 'client_phone',
        message: '의뢰인 연락처가 없어 의뢰인을 생성하지 않았습니다',
        suggestion: '의뢰인 연락처를 입력하면 신규 의뢰인이 자동 생성됩니다'
      })
    }

    // 4. 담당자 처리 (복수 담당자 지원)
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

    if (row.assigned_staff) {
      const { data: staffMember } = await adminClient
        .from('tenant_members')
        .select('id')
        .eq('tenant_id', tenant.tenantId)
        .eq('display_name', row.assigned_staff)
        .single()

      if (staffMember) {
        assigneeIds.push({ memberId: staffMember.id, isPrimary: false })
      } else {
        warnings.push({
          field: 'assigned_staff',
          message: `담당직원 "${row.assigned_staff}"을(를) 찾을 수 없습니다`
        })
      }
    }

    // 5. 기본값 적용
    const caseData = applyDefaults(row)
    const resolvedCourtName = normalizedCourtName || caseData.court_name

    // 6. 사건 생성 (client_role_status 결정)
    const resolvedClientRoleStatus = determineClientRoleStatus({
      explicitClientRole: caseData.client_role,
      clientName: row.client_name,
      opponentName: caseData.opponent_name
    })

    const { data: newCase, error: caseError } = await adminClient
      .from('legal_cases')
      .insert([{
        tenant_id: tenant.tenantId,
        case_name: caseData.case_name,
        case_type: caseData.case_type,
        court_case_number: cleanedCaseNumber,  // 정제된 사건번호 사용
        court_name: resolvedCourtName,
        primary_client_id: clientId,
        primary_client_name: row.client_name || null,
        assigned_to: assignedTo,
        status: '진행중',
        contract_date: caseData.contract_date,
        notes: caseData.notes || null
      }])
      .select()
      .single()

    if (caseError) {
      return {
        rowIndex,
        status: 'failed',
        originalData,
        errors: [{
          field: 'case_name',
          errorCode: 'CASE_CREATE_FAILED',
          message: `사건 생성 실패: ${caseError.message}`
        }],
        warnings
      }
    }

    // 7. case_parties 생성 (스트림 임포트와 일관성 유지)
    const partySeeds = buildManualPartySeeds({
      clientName: row.client_name,
      opponentName: caseData.opponent_name,
      clientRole: caseData.client_role || 'plaintiff',
      caseNumber: cleanedCaseNumber,
      clientId,
    })

    if (partySeeds.length > 0) {
      // case_parties 생성 (client_id, is_our_client, manual_override 컬럼 없음)
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

      const { data: insertedParties, error: partyError } = await adminClient
        .from('case_parties')
        .upsert(payload, { onConflict: 'case_id,party_type,party_name' })
        .select('id, party_name')

      if (partyError) {
        warnings.push({
          field: 'party',
          message: `당사자 정보 저장 실패: ${partyError.message}`
        })
      }

      // case_clients 생성 (의뢰인 연결)
      if (clientId && !partyError) {
        const clientParty = insertedParties?.find(p => p.party_name === row.client_name)
        const { error: clientError } = await adminClient
          .from('case_clients')
          .upsert({
            tenant_id: tenant.tenantId,
            case_id: newCase.id,
            client_id: clientId,
            linked_party_id: clientParty?.id || null,
            is_primary_client: true,
            retainer_fee: caseData.retainer_fee ? Number(caseData.retainer_fee) : null,
          }, { onConflict: 'case_id,client_id' })

        if (clientError) {
          warnings.push({
            field: 'case_clients',
            message: `의뢰인 연결 실패: ${clientError.message}`
          })
        }
      }
    }

    // 8. case_assignees 생성 (담당자 연결)
    if (assigneeIds.length > 0) {
      const assigneePayload = assigneeIds.map(a => ({
        tenant_id: tenant.tenantId,
        case_id: newCase.id,
        member_id: a.memberId,
        assignee_role: 'lawyer' as const,
        is_primary: a.isPrimary,
      }))

      const { error: assigneeError } = await adminClient
        .from('case_assignees')
        .upsert(assigneePayload, { onConflict: 'case_id,member_id' })

      if (assigneeError) {
        warnings.push({
          field: 'case_assignees',
          message: `담당자 연결 실패: ${assigneeError.message}`
        })
      }
    }

    // 9. SCOURT 연동은 API 라우트에서 처리 (Node.js 전용 모듈 사용)
    const scourtLinked = false
    const encCsNo: string | undefined = undefined

    // 성공 결과 반환
    const hasWarnings = warnings.length > 0
    return {
      rowIndex,
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
      encCsNo
    }

  } catch (error) {
    return {
      rowIndex,
      status: 'failed',
      originalData,
      errors: [{
        field: 'unknown',
        errorCode: 'UNEXPECTED_ERROR',
        message: error instanceof Error ? error.message : '알 수 없는 오류'
      }],
      warnings
    }
  }
}

/**
 * 기존 사건 업데이트 (빈 필드만)
 */
async function updateExistingCase(
  caseId: string,
  row: Partial<StandardCaseRow>,
  tenant: TenantContext,
  adminClient: ReturnType<typeof createAdminClient>
): Promise<void> {
  // 기존 사건 조회
  const { data: existingCase } = await adminClient
    .from('legal_cases')
    .select('*')
    .eq('id', caseId)
    .single()

  if (!existingCase) return

  // 업데이트할 필드 결정 (빈 필드만)
  // case_type은 자동 분류되므로 업데이트 대상에서 제외
  // 참고: opponent_name, retainer_fee, success_fee_agreement, earned_success_fee는
  //       legal_cases 테이블에서 제거됨 (case_clients, case_parties 테이블로 이동)
  const updates: Record<string, unknown> = {}

  if (!existingCase.notes && row.notes) {
    updates.notes = row.notes
  }
  if (!existingCase.primary_client_name && row.client_name) {
    updates.primary_client_name = row.client_name
  }

  if (Object.keys(updates).length > 0) {
    await adminClient
      .from('legal_cases')
      .update(updates)
      .eq('id', caseId)
  }
}

/**
 * 딜레이 유틸리티
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * 결과 요약 생성
 */
export function summarizeResults(results: ImportResult[]): {
  total: number
  success: number
  failed: number
  partial: number
  skipped: number
  updated: number
  newClientsCreated: number
  existingClientsMatched: number
} {
  let success = 0
  let failed = 0
  let partial = 0
  let skipped = 0
  let updated = 0
  let newClientsCreated = 0
  let existingClientsMatched = 0

  for (const result of results) {
    switch (result.status) {
      case 'success':
        success++
        break
      case 'failed':
        failed++
        break
      case 'partial':
        partial++
        break
      case 'skipped':
        skipped++
        break
      case 'updated':
        updated++
        break
    }

    if (result.created?.clientId) {
      if (result.created.isNewClient) {
        newClientsCreated++
      } else {
        existingClientsMatched++
      }
    }
  }

  return {
    total: results.length,
    success,
    failed,
    partial,
    skipped,
    updated,
    newClientsCreated,
    existingClientsMatched
  }
}
