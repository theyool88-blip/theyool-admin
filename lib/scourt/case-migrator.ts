/**
 * SCOURT 사건 마이그레이션 모듈
 *
 * WMONID 갱신 시 기존 사건들을 새 WMONID로 재등록
 *
 * 핵심 기능:
 * - 캡챠 해결을 통한 사건 재등록
 * - 새 encCsNo 획득 및 DB 업데이트
 * - 병렬/순차 처리 지원
 */

import { createClient } from '@/lib/supabase';
import { ScourtApiClient, CaseSearchParams } from './api-client';

interface CaseToMigrate {
  id: string;
  case_number: string;
  court_code: string;
  court_name: string;
  enc_cs_no: string;
  profile_id: string;
  legal_case_id?: string | null;
  tenant_id?: string | null;
}

interface MigrationResult {
  caseNumber: string;
  success: boolean;
  newEncCsNo?: string;
  captchaAttempts?: number;
  error?: string;
}

interface BatchMigrationResult {
  totalCases: number;
  successCount: number;
  failedCount: number;
  skippedCount: number;
  results: MigrationResult[];
  durationMs: number;
}

/**
 * 사건 마이그레이터 클래스
 */
export class CaseMigrator {
  private supabase = createClient();
  private apiClient: ScourtApiClient;

  constructor() {
    this.apiClient = new ScourtApiClient();
  }

  /**
   * 사건번호 파싱 (예: "2024드단12345" → { year: "2024", type: "드단", serial: "12345" })
   */
  private parseCaseNumber(caseNumber: string): {
    year: string;
    type: string;
    serial: string;
  } | null {
    // 형식: [연도4자리][사건유형][일련번호]
    const match = caseNumber.match(/^(\d{4})([가-힣]+)(\d+)$/);
    if (!match) {
      console.log(`❌ 사건번호 파싱 실패: ${caseNumber}`);
      return null;
    }

    return {
      year: match[1],
      type: match[2],
      serial: match[3],
    };
  }

  /**
   * 단일 사건 재등록
   *
   * @param caseItem - 마이그레이션할 사건 정보
   * @param newWmonid - 새 WMONID
   * @param partyName - 당사자명 (캡챠 검색용)
   */
  async migrateCase(
    caseItem: CaseToMigrate,
    newWmonid: string,
    partyName: string
  ): Promise<MigrationResult> {
    const { case_number, court_name, court_code } = caseItem;

    console.log(`\n📦 사건 재등록 시작: ${case_number}`);
    console.log(`  법원: ${court_name} (${court_code})`);
    console.log(`  새 WMONID: ${newWmonid}`);

    try {
      // 사건번호 파싱
      const parsed = this.parseCaseNumber(case_number);
      if (!parsed) {
        return {
          caseNumber: case_number,
          success: false,
          error: '사건번호 파싱 실패',
        };
      }

      // 검색 파라미터 구성
      const searchParams: CaseSearchParams = {
        cortCd: court_name, // 법원명 또는 코드
        csYr: parsed.year,
        csDvsCd: parsed.type,
        csSerial: parsed.serial,
        btprNm: partyName,
      };

      // 새 WMONID로 세션 초기화 후 검색
      await this.apiClient.initSession(newWmonid);

      // 캡챠 해결 + 검색으로 새 encCsNo 획득
      const result = await this.apiClient.searchWithCaptcha(searchParams);

      if (!result.success || !result.encCsNo) {
        return {
          caseNumber: case_number,
          success: false,
          captchaAttempts: result.captchaAttempts,
          error: result.error || 'encCsNo 획득 실패',
        };
      }

      // DB 업데이트 - 새 encCsNo 저장
      const { error: updateError } = await this.supabase
        .from('scourt_profile_cases')
        .update({
          enc_cs_no: result.encCsNo,
          wmonid: newWmonid,
          migrated_at: new Date().toISOString(),
        })
        .eq('id', caseItem.id);

      if (updateError) {
        console.error('❌ DB 업데이트 실패:', updateError.message);
        return {
          caseNumber: case_number,
          success: false,
          newEncCsNo: result.encCsNo,
          captchaAttempts: result.captchaAttempts,
          error: `DB 업데이트 실패: ${updateError.message}`,
        };
      }

      console.log(`✅ 사건 재등록 성공: ${case_number}`);
      console.log(`  새 encCsNo: ${result.encCsNo.substring(0, 30)}...`);
      console.log(`  캡챠 시도: ${result.captchaAttempts}회`);

      return {
        caseNumber: case_number,
        success: true,
        newEncCsNo: result.encCsNo,
        captchaAttempts: result.captchaAttempts,
      };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`❌ 사건 재등록 실패: ${case_number}`, errorMsg);

      return {
        caseNumber: case_number,
        success: false,
        error: errorMsg,
      };
    }
  }

  /**
   * 특정 WMONID의 모든 사건 마이그레이션
   *
   * @param oldWmonidId - 기존 WMONID ID (DB)
   * @param newWmonid - 새 WMONID 값
   * @param partyName - 당사자명 (대표자 또는 의뢰인 이름)
   * @param delayMs - 사건 간 대기 시간 (기본 3초, 서버 부하 방지)
   */
  async migrateCasesForWmonid(
    oldWmonidId: string,
    newWmonid: string,
    partyName: string,
    delayMs: number = 3000
  ): Promise<BatchMigrationResult> {
    const startTime = Date.now();

    console.log('\n' + '='.repeat(60));
    console.log('🔄 WMONID 사건 마이그레이션 시작');
    console.log('='.repeat(60));
    console.log(`기존 WMONID ID: ${oldWmonidId}`);
    console.log(`새 WMONID: ${newWmonid}`);
    console.log(`당사자명: ${partyName}`);
    console.log('='.repeat(60));

    // 기존 WMONID에 연결된 사건들 조회
    const { data: cases, error: queryError } = await this.supabase
      .from('scourt_profile_cases')
      .select('id, case_number, court_code, court_name, enc_cs_no, profile_id, legal_case_id, tenant_id')
      .eq('user_wmonid_id', oldWmonidId);

    if (queryError) {
      console.error('❌ 사건 목록 조회 실패:', queryError.message);
      return {
        totalCases: 0,
        successCount: 0,
        failedCount: 0,
        skippedCount: 0,
        results: [],
        durationMs: Date.now() - startTime,
      };
    }

    const totalCases = cases?.length || 0;
    console.log(`\n📋 마이그레이션 대상: ${totalCases}건`);

    if (totalCases === 0) {
      return {
        totalCases: 0,
        successCount: 0,
        failedCount: 0,
        skippedCount: 0,
        results: [],
        durationMs: Date.now() - startTime,
      };
    }

    const results: MigrationResult[] = [];
    let successCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    // 순차 처리 (캡챠 서버 부하 방지)
    for (let i = 0; i < cases.length; i++) {
      const caseItem = cases[i] as CaseToMigrate;

      console.log(`\n[${i + 1}/${totalCases}] 처리 중...`);

      // 이미 마이그레이션된 사건 스킵
      if (caseItem.enc_cs_no?.includes(newWmonid)) {
        console.log(`⏭️ 이미 마이그레이션됨: ${caseItem.case_number}`);
        skippedCount++;
        results.push({
          caseNumber: caseItem.case_number,
          success: true,
          newEncCsNo: caseItem.enc_cs_no,
        });
        continue;
      }

      // 사건 재등록
      const result = await this.migrateCase(caseItem, newWmonid, partyName);
      results.push(result);

      if (result.success) {
        successCount++;
      } else {
        failedCount++;
      }

      // 서버 부하 방지를 위한 대기
      if (i < cases.length - 1) {
        console.log(`⏳ ${delayMs / 1000}초 대기...`);
        await this.wait(delayMs);
      }
    }

    const durationMs = Date.now() - startTime;

    console.log('\n' + '='.repeat(60));
    console.log('📊 마이그레이션 결과');
    console.log('='.repeat(60));
    console.log(`총 사건: ${totalCases}건`);
    console.log(`성공: ${successCount}건`);
    console.log(`실패: ${failedCount}건`);
    console.log(`스킵: ${skippedCount}건`);
    console.log(`소요 시간: ${(durationMs / 1000).toFixed(1)}초`);
    console.log('='.repeat(60));

    return {
      totalCases,
      successCount,
      failedCount,
      skippedCount,
      results,
      durationMs,
    };
  }

  /**
   * 사건별 당사자명 조회 (legal_cases + case_parties)
   */
  async getPartyNameForLegalCase(params: {
    legalCaseId?: string | null;
    caseNumber?: string | null;
    tenantId?: string | null;
  }): Promise<string | null> {
    const { legalCaseId, caseNumber, tenantId } = params;
    let resolvedCaseId = legalCaseId;

    // legalCaseId가 없으면 caseNumber로 조회
    if (!resolvedCaseId && caseNumber && tenantId) {
      const { data: caseData } = await this.supabase
        .from('legal_cases')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('court_case_number', caseNumber)
        .maybeSingle();

      if (caseData) {
        resolvedCaseId = caseData.id;
      }
    }

    if (!resolvedCaseId) {
      return null;
    }

    // 1. legal_cases에서 clients JOIN으로 의뢰인 이름 조회
    const { data: caseWithClient } = await this.supabase
      .from('legal_cases')
      .select('clients(name)')
      .eq('id', resolvedCaseId)
      .maybeSingle();

    const clientName = (caseWithClient?.clients as { name?: string } | null)?.name;
    if (clientName) {
      return clientName;
    }

    // 2. case_parties에서 당사자명 조회 (is_primary=true 우선)
    const { data: parties } = await this.supabase
      .from('case_parties')
      .select('party_name, is_our_client, is_primary')
      .eq('case_id', resolvedCaseId)
      .order('is_primary', { ascending: false })
      .order('party_order', { ascending: true });

    if (parties && parties.length > 0) {
      // 의뢰인 측 당사자 우선, 없으면 상대방
      const ourParty = parties.find(p => p.is_our_client);
      const opponentParty = parties.find(p => !p.is_our_client);
      return ourParty?.party_name || opponentParty?.party_name || null;
    }

    return null;
  }

  /**
   * 개별 사건 마이그레이션 (당사자명 자동 조회)
   */
  async migrateCaseAuto(
    caseItem: CaseToMigrate,
    newWmonid: string
  ): Promise<MigrationResult> {
    // 당사자명 조회
    const partyName = await this.getPartyNameForLegalCase({
      legalCaseId: caseItem.legal_case_id,
      caseNumber: caseItem.case_number,
      tenantId: caseItem.tenant_id,
    });

    if (!partyName) {
      return {
        caseNumber: caseItem.case_number,
        success: false,
        error: '당사자명 조회 실패 - 사건을 찾을 수 없습니다',
      };
    }

    return this.migrateCase(caseItem, newWmonid, partyName);
  }

  /**
   * 만료 임박 WMONID의 모든 사건 자동 마이그레이션
   *
   * @param maxConcurrent - 동시 처리 WMONID 수 (기본 1)
   */
  async migrateExpiringWmonids(_maxConcurrent: number = 1): Promise<{
    wmonidCount: number;
    totalMigrated: number;
    totalFailed: number;
    details: Array<{ wmonidId: string; result: BatchMigrationResult }>;
  }> {
    console.log('\n🔍 만료 임박 WMONID 검색...');

    // 만료 30일 이내 WMONID 조회
    const renewalDate = new Date();
    renewalDate.setDate(renewalDate.getDate() + 30);

    const { data: expiringWmonids, error } = await this.supabase
      .from('scourt_user_wmonid')
      .select('*')
      .eq('status', 'expiring')
      .lte('expires_at', renewalDate.toISOString());

    if (error || !expiringWmonids || expiringWmonids.length === 0) {
      console.log('✅ 마이그레이션 필요한 WMONID 없음');
      return {
        wmonidCount: 0,
        totalMigrated: 0,
        totalFailed: 0,
        details: [],
      };
    }

    console.log(`📋 마이그레이션 대상 WMONID: ${expiringWmonids.length}개`);

    const details: Array<{ wmonidId: string; result: BatchMigrationResult }> = [];
    let totalMigrated = 0;
    let totalFailed = 0;

    // 순차 처리 (WMONID별로)
    for (const wmonid of expiringWmonids) {
      // 새 WMONID 발급
      const response = await fetch('https://ssgo.scourt.go.kr/ssgo/index.on?cortId=www');
      const setCookie = response.headers.get('set-cookie');
      const newWmonidMatch = setCookie?.match(/WMONID=([^;]+)/);

      if (!newWmonidMatch) {
        console.error(`❌ 새 WMONID 획득 실패: ${wmonid.id}`);
        continue;
      }

      const newWmonidValue = newWmonidMatch[1];

      // 대표 당사자명 조회 (첫 번째 사건에서)
      const { data: firstCase } = await this.supabase
        .from('scourt_profile_cases')
        .select('case_number, legal_case_id, tenant_id')
        .eq('user_wmonid_id', wmonid.id)
        .limit(1)
        .single();

      const partyName = firstCase
        ? await this.getPartyNameForLegalCase({
            legalCaseId: firstCase.legal_case_id,
            caseNumber: firstCase.case_number,
            tenantId: firstCase.tenant_id,
          })
        : null;

      if (!partyName) {
        console.error(`❌ 당사자명 조회 실패: ${wmonid.id}`);
        continue;
      }

      // 사건 마이그레이션
      const result = await this.migrateCasesForWmonid(
        wmonid.id,
        newWmonidValue,
        partyName
      );

      details.push({ wmonidId: wmonid.id, result });
      totalMigrated += result.successCount;
      totalFailed += result.failedCount;

      // WMONID 상태 업데이트
      if (result.failedCount === 0) {
        // 모든 사건 마이그레이션 성공 → 기존 WMONID 만료 처리
        await this.supabase
          .from('scourt_user_wmonid')
          .update({ status: 'expired' })
          .eq('id', wmonid.id);

        // 새 WMONID 저장
        await this.supabase.from('scourt_user_wmonid').insert({
          user_id: wmonid.user_id,
          wmonid: newWmonidValue,
          issued_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'active',
        });
      }
    }

    return {
      wmonidCount: expiringWmonids.length,
      totalMigrated,
      totalFailed,
      details,
    };
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// 싱글톤 인스턴스
let _migratorInstance: CaseMigrator | null = null;

export function getCaseMigrator(): CaseMigrator {
  if (!_migratorInstance) {
    _migratorInstance = new CaseMigrator();
  }
  return _migratorInstance;
}
