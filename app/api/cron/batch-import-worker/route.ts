/**
 * Batch Import Worker
 *
 * GET /api/cron/batch-import-worker?secret=xxx
 *
 * Processes queued batch import jobs from the database.
 * Called by Vercel Cron every minute.
 */

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { getBatchImportSettings } from '@/lib/batch-import/import-settings'
import {
  markJobSuccess,
  markJobFailed,
  markJobSkipped,
  updateBatchSummaryCounts,
  sendBatchCompletionNotification,
  type BatchImportJob,
  type BatchImportJobResult,
} from '@/lib/batch-import/import-queue'
import type { StandardCaseRow, ImportOptions } from '@/types/onboarding'
import { applyDefaults } from '@/lib/onboarding/csv-schema'
import { getScourtApiClient } from '@/lib/scourt/api-client'
import { saveSnapshot } from '@/lib/scourt/case-storage'
import { parseCaseNumber, stripCourtPrefix } from '@/lib/scourt/case-number-utils'
import { getCourtFullName } from '@/lib/scourt/court-codes'
import { linkRelatedCases, type RelatedCaseData, type LowerCourtData } from '@/lib/scourt/related-case-linker'
import { buildManualPartySeeds } from '@/lib/case/party-seeds'
import { syncPartiesFromScourtServer } from '@/lib/scourt/party-sync'
import { syncHearingsToCourtHearings } from '@/lib/scourt/hearing-sync'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _supabase: any = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getSupabase(): any {
  if (!_supabase) {
    _supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }
  return _supabase
}

function getCronSecret() {
  return process.env.CRON_SECRET || 'batch-import-secret'
}

// Utility functions
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function randomBetween(min: number, max: number): number {
  if (max <= min) return min
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function createRateLimiter(perMinute: number | null) {
  if (!perMinute || perMinute <= 0) {
    return { wait: async () => {} }
  }

  const windowMs = 60 * 1000
  const timestamps: number[] = []

  return {
    wait: async () => {
      while (timestamps.length >= perMinute) {
        const now = Date.now()
        const earliest = timestamps[0]
        const delta = now - earliest
        if (delta >= windowMs) {
          timestamps.shift()
          continue
        }
        await sleep(windowMs - delta + 25)
      }
      timestamps.push(Date.now())
    },
  }
}

async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  handler: (item: T) => Promise<void>
) {
  let index = 0
  const workers = Array.from({ length: Math.max(1, limit) }, async () => {
    while (index < items.length) {
      const current = items[index]
      index += 1
      await handler(current)
    }
  })
  await Promise.all(workers)
}

// Get import options from batch summary
async function getBatchOptions(batchId: string): Promise<Partial<ImportOptions>> {
  const { data } = await getSupabase()
    .from('batch_import_summaries')
    .select('options')
    .eq('batch_id', batchId)
    .single()

  return data?.options || {}
}

// Process a single job
async function processJob(
  job: BatchImportJob,
  rateLimiter: { wait: () => Promise<void> },
  settings: Awaited<ReturnType<typeof getBatchImportSettings>>
): Promise<void> {
  const jobStart = Date.now()
  const row = applyDefaults(job.payload as Partial<StandardCaseRow>) as StandardCaseRow & { case_type: string }
  const options = await getBatchOptions(job.batch_id)
  const warnings: Array<{ field: string; message: string }> = []

  try {
    // 0. Validate required fields
    if (!row.court_case_number) {
      await markJobFailed(job.id, '필수 필드 누락: 사건번호', job.attempts, settings.maxRetries)
      return
    }
    if (!row.court_name) {
      await markJobFailed(job.id, '필수 필드 누락: 법원명', job.attempts, settings.maxRetries)
      return
    }

    // 1. Parse and validate case number
    const cleanedCaseNumber = stripCourtPrefix(row.court_case_number)
    const parsed = parseCaseNumber(cleanedCaseNumber)

    if (!parsed.valid) {
      await markJobFailed(
        job.id,
        `사건번호 파싱 실패: ${row.court_case_number}`,
        job.attempts,
        settings.maxRetries
      )
      return
    }

    // Normalize court name
    const normalizedCourtName = getCourtFullName(row.court_name, parsed.caseType)

    // 2. Check for duplicates
    const { data: existingCase } = await getSupabase()
      .from('legal_cases')
      .select('id, case_name')
      .eq('tenant_id', job.tenant_id)
      .eq('court_case_number', cleanedCaseNumber)
      .eq('court_name', normalizedCourtName)
      .single()

    if (existingCase) {
      const duplicateHandling = options.duplicateHandling || 'skip'

      if (duplicateHandling === 'skip') {
        await markJobSkipped(job.id, '이미 등록된 사건입니다', {
          caseId: existingCase.id,
          caseName: existingCase.case_name,
        })
        return
      } else if (duplicateHandling === 'error') {
        await markJobFailed(job.id, '이미 등록된 사건입니다', settings.maxRetries, settings.maxRetries)
        return
      }
      // 'update' - continue processing
    }

    // 3. SCOURT API call (with rate limiting)
    const partyName = row.client_name || row.opponent_name
    if (!partyName) {
      await markJobFailed(
        job.id,
        '대법원 검색에 필요한 당사자명이 없습니다',
        job.attempts,
        settings.maxRetries
      )
      return
    }

    await rateLimiter.wait()
    await sleep(randomBetween(settings.requestJitterMs.min, settings.requestJitterMs.max))

    const apiClient = getScourtApiClient()
    let scourtResult: {
      success: boolean
      encCsNo?: string
      wmonid?: string
      generalData?: unknown
      progressData?: unknown
      error?: string
    } | null = null
    let scourtLinked = false
    let scourtError: string | null = null

    try {
      scourtResult = await apiClient.searchAndRegisterCase({
        cortCd: row.court_name,
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
      console.error(`[BatchImport] SCOURT failed (job ${job.id}):`, error)
      scourtError = error instanceof Error ? error.message : '대법원 연동 오류'
    }

    // Add warning if SCOURT link failed
    if (!scourtLinked && scourtError) {
      warnings.push({ field: 'scourt', message: `대법원 연동 안됨: ${scourtError}` })
    }

    // 4. Create client if needed
    const inferredRole = row.client_role ? null : 'plaintiff'
    const resolvedClientRole = row.client_role || inferredRole || 'plaintiff'

    let clientId: string | null = null
    let isNewClient = false

    // 디버깅 로그: 의뢰인 처리 시작
    console.log('[BatchImport] 의뢰인 처리:', {
      jobId: job.id,
      client_name: row.client_name,
      createNewClients: options.createNewClients,
    })

    if (row.client_name) {
      const { data: existingClient } = await getSupabase()
        .from('clients')
        .select('id, name')
        .eq('tenant_id', job.tenant_id)
        .eq('name', row.client_name)
        .maybeSingle()  // single() → maybeSingle()로 변경 (0건일 때 에러 방지)

      console.log('[BatchImport] 기존 의뢰인 조회:', { existingClient: existingClient?.id })

      if (existingClient) {
        clientId = existingClient.id
        console.log('[BatchImport] 기존 의뢰인 매칭:', { clientId })
      } else if (options.createNewClients !== false) {
        console.log('[BatchImport] 신규 의뢰인 생성 시도:', { name: row.client_name })
        const { data: newClient, error: clientError } = await getSupabase()
          .from('clients')
          .insert([{
            tenant_id: job.tenant_id,
            name: row.client_name,
            phone: row.client_phone || null,
            email: row.client_email || null,
            birth_date: row.client_birth_date || null,
            address: row.client_address || null,
            bank_account: row.client_bank_account || null,
          }])
          .select()
          .single()

        if (clientError) {
          console.error('[BatchImport] 의뢰인 생성 실패:', clientError)
          warnings.push({
            field: 'client_name',
            message: `의뢰인 생성 실패: ${clientError.message} (code: ${clientError.code})`
          })
        } else {
          clientId = newClient.id
          isNewClient = true
          console.log('[BatchImport] 의뢰인 생성 성공:', { clientId, isNewClient })
        }
      } else {
        console.log('[BatchImport] createNewClients=false, 의뢰인 생성 스킵')
      }
    } else {
      // 의뢰인명이 비어있는 경우 경고 추가
      console.log('[BatchImport] client_name이 비어있음, 의뢰인 처리 스킵')
      warnings.push({
        field: 'client_name',
        message: '의뢰인명이 없어 의뢰인 정보가 등록되지 않았습니다'
      })
    }

    // 5. Process assignees
    let assignedTo: string | null = null
    const assigneeIds: { memberId: string; isPrimary: boolean }[] = []

    if (row.assigned_lawyer) {
      const lawyerNames = row.assigned_lawyer.split(',').map(n => n.trim()).filter(n => n)

      for (let idx = 0; idx < lawyerNames.length; idx++) {
        const lawyerName = lawyerNames[idx]
        const { data: member } = await getSupabase()
          .from('tenant_members')
          .select('id')
          .eq('tenant_id', job.tenant_id)
          .eq('display_name', lawyerName)
          .single()

        if (member) {
          if (idx === 0) assignedTo = member.id
          assigneeIds.push({ memberId: member.id, isPrimary: idx === 0 })
        } else {
          warnings.push({ field: 'assigned_lawyer', message: `담당자 "${lawyerName}"을(를) 찾을 수 없습니다` })
        }
      }
    }

    if (row.assigned_staff) {
      const { data: staffMember } = await getSupabase()
        .from('tenant_members')
        .select('id')
        .eq('tenant_id', job.tenant_id)
        .eq('display_name', row.assigned_staff)
        .single()

      if (staffMember) {
        assigneeIds.push({ memberId: staffMember.id, isPrimary: false })
      } else {
        warnings.push({ field: 'assigned_staff', message: `담당직원 "${row.assigned_staff}"을(를) 찾을 수 없습니다` })
      }
    }

    // 6. Create case
    const caseData: Record<string, unknown> = {
      tenant_id: job.tenant_id,
      case_name: row.case_name || cleanedCaseNumber,
      case_type: row.case_type || '기타',
      court_case_number: cleanedCaseNumber,
      court_name: normalizedCourtName,
      primary_client_id: clientId,
      primary_client_name: row.client_name || null,
      assigned_to: assignedTo,
      status: '진행중',
      contract_date: row.contract_date,
      notes: row.notes || null,
    }

    // Add SCOURT info if linked
    if (scourtLinked && scourtResult) {
      caseData.scourt_enc_cs_no = scourtResult.encCsNo
      caseData.scourt_wmonid = scourtResult.wmonid
      caseData.scourt_last_sync = new Date().toISOString()
      caseData.scourt_sync_status = 'synced'
    }

    const { data: newCase, error: caseError } = await getSupabase()
      .from('legal_cases')
      .insert([caseData])
      .select()
      .single()

    if (caseError) {
      await markJobFailed(job.id, `사건 생성 실패: ${caseError.message}`, job.attempts, settings.maxRetries)
      return
    }

    // 7. Create party records
    const partySeeds = buildManualPartySeeds({
      clientName: row.client_name,
      opponentName: row.opponent_name,
      clientRole: resolvedClientRole,
      caseNumber: cleanedCaseNumber,
      clientId,
    })

    let insertedParties: { id: string; party_name: string }[] | null = null

    if (partySeeds.length > 0) {
      const payload = partySeeds.map((seed, index) => ({
        tenant_id: job.tenant_id,
        case_id: newCase.id,
        party_name: seed.party_name,
        party_type: seed.party_type,
        party_type_label: seed.party_type_label || null,
        party_order: index + 1,
        representatives: [],
        scourt_synced: false,
      }))

      const { data, error: partyError } = await getSupabase()
        .from('case_parties')
        .upsert(payload, { onConflict: 'case_id,party_type,party_name' })
        .select('id, party_name')

      insertedParties = data
      if (partyError) {
        warnings.push({ field: 'party', message: `당사자 정보 저장 실패: ${partyError.message}` })
      }
    }

    // 8. Create case_clients and case_assignees
    const parallelOps: Promise<void>[] = []

    if (clientId) {
      const clientParty = insertedParties?.find(p => p.party_name === row.client_name)
      parallelOps.push((async () => {
        const { error } = await getSupabase()
          .from('case_clients')
          .upsert({
            tenant_id: job.tenant_id,
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
        tenant_id: job.tenant_id,
        case_id: newCase.id,
        member_id: a.memberId,
        assignee_role: 'lawyer' as const,
        is_primary: a.isPrimary,
      }))
      parallelOps.push((async () => {
        const { error } = await getSupabase().from('case_assignees').upsert(assigneePayload, { onConflict: 'case_id,member_id' })
        if (error) warnings.push({ field: 'case_assignees', message: `담당자 연결 실패: ${error.message}` })
      })())
    }

    await Promise.all(parallelOps)

    // 9. SCOURT data sync (snapshot, related cases, parties, hearings)
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

      const lowerCourtData: LowerCourtData[] = (generalData?.lowerCourtCases || []).map(lc => ({
        caseNo: lc.userCsNo, courtName: lc.cortNm, result: lc.ultmtDvsNm, resultDate: lc.ultmtYmd, encCsNo: lc.encCsNo || null,
      }))
      const relatedCasesData: RelatedCaseData[] = (generalData?.relatedCases || []).map(rc => ({
        caseNo: rc.userCsNo, caseName: rc.reltCsCortNm, relation: rc.reltCsDvsNm, encCsNo: rc.encCsNo || null,
      }))

      const syncOps: Promise<{ type: string; error?: string }>[] = []

      // Snapshot
      syncOps.push(
        saveSnapshot({
          tenantId: job.tenant_id,
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
            await getSupabase().from('legal_cases').update({ scourt_last_snapshot_id: snapshotId }).eq('id', newCase.id)
          }
          return { type: 'snapshot' }
        }).catch(e => ({ type: 'snapshot', error: e.message }))
      )

      // Related cases
      if (lowerCourtData.length > 0 || relatedCasesData.length > 0) {
        syncOps.push(
          linkRelatedCases({
            supabase: getSupabase(), legalCaseId: newCase.id, tenantId: job.tenant_id,
            caseNumber: cleanedCaseNumber, caseType: parsed.caseType,
            relatedCases: relatedCasesData, lowerCourt: lowerCourtData,
          }).then(() => ({ type: 'related_cases' })).catch(e => ({ type: 'related_cases', error: e.message }))
        )
      }

      // Party sync
      if (generalData?.parties?.length || generalData?.representatives?.length) {
        syncOps.push(
          syncPartiesFromScourtServer(getSupabase(), {
            legalCaseId: newCase.id, tenantId: job.tenant_id,
            parties: generalData.parties || [], representatives: generalData.representatives || []
          }).then(() => ({ type: 'party_sync' })).catch(e => ({ type: 'party_sync', error: e.message }))
        )
      }

      // Hearing sync
      if (generalData?.hearings?.length) {
        const hearingsForSync = generalData.hearings.map(h => ({
          date: h.trmDt || '', time: h.trmHm || '', type: h.trmNm || '', location: h.trmPntNm || '', result: h.rslt || '',
        }))
        syncOps.push(
          syncHearingsToCourtHearings(newCase.id, cleanedCaseNumber, hearingsForSync)
            .then(() => ({ type: 'hearing_sync' })).catch(e => ({ type: 'hearing_sync', error: e.message }))
        )
      }

      const syncResults = await Promise.all(syncOps)
      for (const result of syncResults) {
        if (result.error) {
          warnings.push({ field: result.type, message: `${result.type} 실패: ${result.error}` })
        }
      }
    }

    // 10. Mark job as success
    const result: BatchImportJobResult = {
      caseId: newCase.id,
      caseName: newCase.case_name,
      clientId: clientId || undefined,
      clientName: row.client_name,
      isNewClient,
      scourtLinked,
      encCsNo: scourtLinked && scourtResult ? scourtResult.encCsNo : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    }

    await markJobSuccess(job.id, result)

    console.log(`[BatchImport] Job ${job.id} completed in ${Date.now() - jobStart}ms`)

  } catch (error) {
    console.error(`[BatchImport] Job ${job.id} error:`, error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    await markJobFailed(job.id, errorMessage, job.attempts, settings.maxRetries)
  }
}

// Check if a batch is complete and send notification
async function checkBatchCompletion(batchId: string): Promise<void> {
  const { data: summary } = await getSupabase()
    .from('batch_import_summaries')
    .select('*')
    .eq('batch_id', batchId)
    .single()

  if (!summary) return

  // Update counts first
  await updateBatchSummaryCounts(batchId)

  // Re-fetch updated summary
  const { data: updatedSummary } = await getSupabase()
    .from('batch_import_summaries')
    .select('*')
    .eq('batch_id', batchId)
    .single()

  if (updatedSummary?.status === 'completed' && updatedSummary.requested_by) {
    await sendBatchCompletionNotification(
      batchId,
      updatedSummary.tenant_id,
      updatedSummary.requested_by
    )
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const secret = searchParams.get('secret')

  if (secret !== getCronSecret()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startTime = Date.now()

  try {
    const settings = await getBatchImportSettings()
    const workerId = crypto.randomUUID()

    // Dequeue jobs
    const { data: jobs, error } = await getSupabase().rpc('dequeue_batch_import_jobs', {
      p_limit: settings.workerBatchSize,
      p_worker_id: workerId,
    })

    if (error) {
      throw new Error(`Job dequeue failed: ${error.message}`)
    }

    if (!jobs || jobs.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No jobs',
        processed: 0,
        durationMs: Date.now() - startTime,
      })
    }

    const rateLimiter = createRateLimiter(settings.rateLimitPerMinute)
    const processedBatches = new Set<string>()

    // Process jobs with concurrency
    await runWithConcurrency(
      jobs as BatchImportJob[],
      settings.workerConcurrency,
      async (job) => {
        await processJob(job, rateLimiter, settings)
        processedBatches.add(job.batch_id)
      }
    )

    // Check completion for all processed batches
    for (const batchId of processedBatches) {
      await checkBatchCompletion(batchId)
    }

    return NextResponse.json({
      success: true,
      processed: jobs.length,
      batches: processedBatches.size,
      durationMs: Date.now() - startTime,
    })

  } catch (error) {
    console.error('[BatchImport Worker] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Worker failed',
      },
      { status: 500 }
    )
  }
}
