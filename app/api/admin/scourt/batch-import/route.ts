/**
 * SCOURT 사건 일괄 가져오기 API
 *
 * POST: CSV 데이터 받아서 순차 처리
 * - 진행 상태 반환 (처리중/완료/실패 건수)
 * - API 호출 간격 2-3초
 * - 실패 건 별도 목록 관리
 */

import { NextRequest, NextResponse } from 'next/server';
import { getScourtApiClient } from '@/lib/scourt/api-client';
import { parseCasenoteCSV, type ParsedCaseFromCSV } from '@/lib/scourt/csv-parser';
import { createClient } from '@/lib/supabase/server';
import { saveEncCsNoToCase } from '@/lib/scourt/case-storage';

interface BatchImportRequest {
  csvContent: string;  // CSV 파일 내용
  options?: {
    skipExisting?: boolean;  // 이미 등록된 사건 스킵
    delayMs?: number;        // 호출 간격 (기본 2500ms)
    dryRun?: boolean;        // 테스트 모드 (실제 API 호출 안함)
  };
}

interface BatchImportResult {
  caseNumber: string;
  courtName: string;
  clientName: string;
  status: 'success' | 'failed' | 'skipped';
  error?: string;
  encCsNo?: string;
  legalCaseId?: string;
}

interface BatchImportResponse {
  total: number;
  processed: number;
  success: number;
  failed: number;
  skipped: number;
  results: BatchImportResult[];
  parseErrors: Array<{ caseNumber: string; error: string }>;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    const body: BatchImportRequest = await request.json();
    const { csvContent, options = {} } = body;

    if (!csvContent) {
      return NextResponse.json({ error: 'CSV 내용이 필요합니다' }, { status: 400 });
    }

    const { skipExisting = true, delayMs = 2500, dryRun = false } = options;

    // CSV 파싱
    const parsedCases = parseCasenoteCSV(csvContent);
    const parseErrors: Array<{ caseNumber: string; error: string }> = [];

    for (const pc of parsedCases) {
      if (pc.parseError) {
        parseErrors.push({
          caseNumber: pc.caseNumber || '(알 수 없음)',
          error: pc.parseError,
        });
      }
    }

    // 파싱 성공한 사건만 처리
    const validCases = parsedCases.filter(pc => !pc.parseError);

    console.log(`=== SCOURT 일괄 가져오기 ===`);
    console.log(`총 ${validCases.length}건 처리 예정 (파싱 에러: ${parseErrors.length}건)`);
    console.log(`옵션: skipExisting=${skipExisting}, delayMs=${delayMs}, dryRun=${dryRun}`);

    const results: BatchImportResult[] = [];
    let successCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    const client = getScourtApiClient();

    for (let i = 0; i < validCases.length; i++) {
      const pc = validCases[i];
      const fullCaseNumber = `${pc.courtName}${pc.caseNumber}`;

      console.log(`\n[${i + 1}/${validCases.length}] ${fullCaseNumber} - ${pc.clientName}`);

      // 이미 등록된 사건 확인
      if (skipExisting) {
        const { data: existingCase } = await supabase
          .from('legal_cases')
          .select('id, enc_cs_no')
          .eq('court_case_number', pc.caseNumber)
          .maybeSingle();

        if (existingCase?.enc_cs_no) {
          console.log(`  ⏭️ 스킵: 이미 SCOURT 연동됨`);
          results.push({
            caseNumber: pc.caseNumber,
            courtName: pc.courtName,
            clientName: pc.clientName,
            status: 'skipped',
            legalCaseId: existingCase.id,
          });
          skippedCount++;
          continue;
        }
      }

      // 테스트 모드면 API 호출 스킵
      if (dryRun) {
        console.log(`  🔍 (테스트 모드) API 호출 스킵`);
        results.push({
          caseNumber: pc.caseNumber,
          courtName: pc.courtName,
          clientName: pc.clientName,
          status: 'success',
        });
        successCount++;
        continue;
      }

      try {
        // SCOURT API 호출
        const result = await client.searchAndRegisterCase({
          cortCd: pc.courtName,  // 축약명 그대로 전달 (court-codes.ts에서 매핑)
          csYr: pc.caseYear,
          csDvsCd: pc.caseType,
          csSerial: pc.caseSerial,
          btprNm: pc.clientName,
        });

        if (result.success && result.encCsNo) {
          console.log(`  ✅ 성공: encCsNo 획득`);

          // legal_cases에 저장 또는 업데이트
          let legalCaseId: string | undefined;

          // 기존 사건 확인
          const { data: existingCase } = await supabase
            .from('legal_cases')
            .select('id')
            .eq('court_case_number', pc.caseNumber)
            .maybeSingle();

          if (existingCase) {
            legalCaseId = existingCase.id;
            // encCsNo 업데이트
            await saveEncCsNoToCase({
              legalCaseId: existingCase.id,
              encCsNo: result.encCsNo,
              wmonid: result.wmonid!,
              caseNumber: pc.caseNumber,
              courtName: pc.courtFullName || pc.courtName,
            });
          }
          // 새 사건 생성은 여기서 하지 않음 (별도 플로우)

          results.push({
            caseNumber: pc.caseNumber,
            courtName: pc.courtName,
            clientName: pc.clientName,
            status: 'success',
            encCsNo: result.encCsNo.substring(0, 20) + '...',
            legalCaseId,
          });
          successCount++;
        } else {
          console.log(`  ❌ 실패: ${result.error}`);
          results.push({
            caseNumber: pc.caseNumber,
            courtName: pc.courtName,
            clientName: pc.clientName,
            status: 'failed',
            error: result.error,
          });
          failedCount++;
        }
      } catch (error) {
        console.error(`  ❌ 에러:`, error);
        results.push({
          caseNumber: pc.caseNumber,
          courtName: pc.courtName,
          clientName: pc.clientName,
          status: 'failed',
          error: String(error),
        });
        failedCount++;
      }

      // 호출 간격 대기 (마지막 건 제외)
      if (i < validCases.length - 1 && !dryRun) {
        console.log(`  대기 ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    const response: BatchImportResponse = {
      total: validCases.length,
      processed: results.length,
      success: successCount,
      failed: failedCount,
      skipped: skippedCount,
      results,
      parseErrors,
    };

    console.log(`\n=== 완료 ===`);
    console.log(`성공: ${successCount}건, 실패: ${failedCount}건, 스킵: ${skippedCount}건`);

    return NextResponse.json(response);

  } catch (error) {
    console.error('일괄 가져오기 에러:', error);
    return NextResponse.json(
      { error: '일괄 가져오기 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

// GET: 일괄 가져오기 상태 확인 (미래 구현 - SSE 등)
export async function GET() {
  return NextResponse.json({
    message: 'Batch import API. Use POST to import cases.',
    endpoints: {
      POST: {
        description: 'Import cases from CSV',
        body: {
          csvContent: 'string (required)',
          options: {
            skipExisting: 'boolean (default: true)',
            delayMs: 'number (default: 2500)',
            dryRun: 'boolean (default: false)',
          },
        },
      },
    },
  });
}
