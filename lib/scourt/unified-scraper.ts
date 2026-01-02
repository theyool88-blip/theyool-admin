/**
 * 대법원 사건 통합 스크래퍼
 *
 * DOM에서 데이터 추출 → 스냅샷 저장 → 변경 감지 → 업데이트 기록
 */

import { Page } from 'puppeteer';
import { createClient } from '@supabase/supabase-js';
import {
  CaseChangeDetector,
  CaseSnapshot,
  CaseUpdate,
  HearingInfo,
  ProgressItem,
  DocumentItem,
  LowerCourtInfo,
  RelatedCaseInfo,
} from './change-detector';
import { syncHearingsToCourtHearings } from './hearing-sync';
import { notifyOnCaseUpdates } from './update-notifier';
import { autoRegisterDeadlines } from './deadline-auto-register';

// ============================================================
// 타입 정의
// ============================================================

export interface ScrapedCaseData {
  caseNumber: string;
  caseName: string;
  court: string;
  caseType: 'family' | 'criminal' | 'civil' | 'unknown';

  // 기본정보 (전체)
  basicInfo: Record<string, string>;

  // 기일 목록
  hearings: HearingInfo[];

  // 진행내용
  progress: ProgressItem[];

  // 제출서류
  documents: DocumentItem[];

  // 심급내용 (모든 사건)
  lowerCourt: LowerCourtInfo[];

  // 연계사건
  relatedCases: RelatedCaseInfo[];
}

export interface SyncResult {
  success: boolean;
  caseData?: ScrapedCaseData;
  snapshot?: {
    id: string;
    hash: string;
  };
  updates: CaseUpdate[];
  isFirstSync: boolean;
  error?: string;
}

// ============================================================
// DOM 선택자
// ============================================================

const DETAIL_SELECTORS = {
  // 가사 사건 (family)
  family: {
    basicInfoTable: '.w2group[id*="grp_gnrl"] table, .w2group[id*="gnrl"] table',
    hearingTable: '.w2group[id*="grp_grdt"] table tbody tr',
    progressTable: '.w2group[id*="grp_prog"] table tbody tr',
  },
  // 형사 사건 (criminal)
  criminal: {
    basicInfoTable: '.w2group[id*="grp_gnrl"] table',
    hearingTable: '.w2group[id*="grp_grdt"] table tbody tr',
    progressTable: '.w2group[id*="grp_prog"] table tbody tr',
    lowerCourtTable: '.w2group[id*="grp_ssgp"] table tbody tr',
  },
  // 민사 사건 (civil)
  civil: {
    basicInfoTable: '.w2group[id*="grp_gnrl"] table',
    hearingTable: '.w2group[id*="grp_grdt"] table tbody tr',
    progressTable: '.w2group[id*="grp_prog"] table tbody tr',
  },
};

// ============================================================
// 통합 스크래퍼 클래스
// ============================================================

export class UnifiedScraper {
  private supabase;

  constructor() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
  }

  /**
   * 사건 상세 페이지에서 전체 데이터 추출
   */
  async scrapeDetailPage(page: Page): Promise<ScrapedCaseData> {
    // 페이지 로드 대기
    await page.waitForSelector('.w2group', { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 1000));

    // 사건 유형 감지
    const caseType = await this.detectCaseType(page);

    // 기본 정보 추출
    const basicInfo = await this.extractBasicInfo(page);

    // 기일 정보 추출
    const hearings = await this.extractHearings(page);

    // 진행내용 추출
    const progress = await this.extractProgress(page);

    // 제출서류 추출
    const documents = await this.extractDocuments(page);

    // 심급내용 추출 (모든 사건)
    const lowerCourt = await this.extractLowerCourt(page);

    // 연계사건 추출
    const relatedCases = await this.extractRelatedCases(page);

    // 사건번호, 사건명 추출
    const caseNumber = basicInfo['사건번호'] || '';
    const caseName = basicInfo['사건명'] || '';
    const court = basicInfo['법원'] || basicInfo['재판부']?.split(' ')[0] || '';

    return {
      caseNumber,
      caseName,
      court,
      caseType,
      basicInfo,
      hearings,
      progress,
      documents,
      lowerCourt,
      relatedCases,
    };
  }

  /**
   * 사건 유형 감지
   */
  private async detectCaseType(
    page: Page
  ): Promise<'family' | 'criminal' | 'civil' | 'unknown'> {
    const pageContent = await page.content();

    // 가사 사건 (드, 느, 므 등)
    if (
      pageContent.includes('원고') &&
      pageContent.includes('피고') &&
      (pageContent.includes('이혼') || pageContent.includes('양육'))
    ) {
      return 'family';
    }

    // 형사 사건 (고, 노 등)
    if (pageContent.includes('피고인') || pageContent.includes('형제번호')) {
      return 'criminal';
    }

    // 민사 사건 (가단, 가합 등)
    if (pageContent.includes('신청인') || pageContent.includes('가압류')) {
      return 'civil';
    }

    return 'unknown';
  }

  /**
   * 기본 정보 추출
   */
  private async extractBasicInfo(page: Page): Promise<Record<string, string>> {
    return page.evaluate(() => {
      const info: Record<string, string> = {};

      // 모든 테이블에서 th-td 쌍 추출
      const tables = document.querySelectorAll('.w2group table');
      tables.forEach((table) => {
        const rows = table.querySelectorAll('tr');
        rows.forEach((row) => {
          const headers = row.querySelectorAll('th');
          const cells = row.querySelectorAll('td');

          headers.forEach((th, idx) => {
            const key = th.textContent?.trim() || '';
            const value = cells[idx]?.textContent?.trim() || '';
            if (key && value) {
              info[key] = value;
            }
          });
        });
      });

      return info;
    });
  }

  /**
   * 기일 정보 추출
   */
  private async extractHearings(page: Page): Promise<HearingInfo[]> {
    return page.evaluate(() => {
      const hearings: HearingInfo[] = [];

      // 기일 테이블 찾기 (여러 선택자 시도)
      const hearingSection = document.querySelector(
        '.w2group[id*="grdt"], .w2group[id*="기일"]'
      );
      if (!hearingSection) return hearings;

      const rows = hearingSection.querySelectorAll('table tbody tr');
      rows.forEach((row) => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 3) {
          const dateText = cells[0]?.textContent?.trim() || '';
          const timeText = cells[1]?.textContent?.trim() || '';
          const typeText = cells[2]?.textContent?.trim() || '';
          const locationText = cells[3]?.textContent?.trim() || '';
          const resultText = cells[4]?.textContent?.trim() || '';

          if (dateText && dateText.match(/\d{4}\.\d{2}\.\d{2}/)) {
            hearings.push({
              date: dateText,
              time: timeText,
              type: typeText,
              location: locationText,
              result: resultText || undefined,
            });
          }
        }
      });

      return hearings;
    });
  }

  /**
   * 진행내용 추출
   */
  private async extractProgress(page: Page): Promise<ProgressItem[]> {
    return page.evaluate(() => {
      const progress: ProgressItem[] = [];

      // 진행내용 테이블 찾기
      const progressSection = document.querySelector(
        '.w2group[id*="prog"], .w2group[id*="진행"]'
      );
      if (!progressSection) return progress;

      const rows = progressSection.querySelectorAll('table tbody tr');
      rows.forEach((row) => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 2) {
          const dateText = cells[0]?.textContent?.trim() || '';
          const contentText = cells[1]?.textContent?.trim() || '';
          const resultText = cells[2]?.textContent?.trim() || '';

          if (dateText && dateText.match(/\d{4}\.\d{2}\.\d{2}/)) {
            progress.push({
              date: dateText,
              content: contentText,
              result: resultText || undefined,
            });
          }
        }
      });

      return progress;
    });
  }

  /**
   * 제출서류 추출
   */
  private async extractDocuments(page: Page): Promise<DocumentItem[]> {
    return page.evaluate(() => {
      const documents: DocumentItem[] = [];

      // 서류 테이블 찾기
      const docSection = document.querySelector(
        '.w2group[id*="dcmt"], .w2group[id*="서류"]'
      );
      if (!docSection) return documents;

      const rows = docSection.querySelectorAll('table tbody tr');
      rows.forEach((row) => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 2) {
          const dateText = cells[0]?.textContent?.trim() || '';
          const contentText = cells[1]?.textContent?.trim() || '';

          if (dateText && dateText.match(/\d{4}\.\d{2}\.\d{2}/)) {
            documents.push({
              date: dateText,
              content: contentText,
            });
          }
        }
      });

      return documents;
    });
  }

  /**
   * 심급내용 추출 (모든 사건 유형)
   */
  private async extractLowerCourt(page: Page): Promise<LowerCourtInfo[]> {
    return page.evaluate(() => {
      const lowerCourt: LowerCourtInfo[] = [];

      // 심급 테이블 찾기 (다양한 선택자 시도)
      const section = document.querySelector(
        '.w2group[id*="ssgp"], .w2group[id*="심급"], .w2group[id*="grp_ssgp"]'
      );
      if (!section) return lowerCourt;

      const rows = section.querySelectorAll('table tbody tr');
      rows.forEach((row) => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 2) {
          const court = cells[0]?.textContent?.trim() || '';
          const caseNo = cells[1]?.textContent?.trim() || '';

          if (court && caseNo) {
            lowerCourt.push({ court, caseNo });
          }
        }
      });

      return lowerCourt;
    });
  }

  /**
   * 연계사건 추출
   */
  private async extractRelatedCases(page: Page): Promise<RelatedCaseInfo[]> {
    return page.evaluate(() => {
      const relatedCases: { caseNo: string; caseName?: string; relation?: string }[] = [];

      // 연계사건 테이블 찾기 (다양한 선택자 시도)
      const section = document.querySelector(
        '.w2group[id*="rltn"], .w2group[id*="연계"], .w2group[id*="grp_rltn"], .w2group[id*="관련"]'
      );
      if (!section) return relatedCases;

      const rows = section.querySelectorAll('table tbody tr');
      rows.forEach((row) => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 1) {
          // 사건번호는 보통 첫 번째 셀 또는 링크 안에 있음
          const linkEl = row.querySelector('a');
          const caseNo = linkEl?.textContent?.trim() || cells[0]?.textContent?.trim() || '';

          // 사건명이나 관계 정보가 있으면 추출
          const caseName = cells.length >= 2 ? cells[1]?.textContent?.trim() : undefined;
          const relation = cells.length >= 3 ? cells[2]?.textContent?.trim() : undefined;

          if (caseNo && caseNo.match(/\d{4}/)) {  // 연도가 포함된 사건번호인지 확인
            relatedCases.push({ caseNo, caseName, relation });
          }
        }
      });

      return relatedCases;
    });
  }

  /**
   * 스냅샷 저장 및 변경 감지
   */
  async syncCase(
    legalCaseId: string,
    profileId: string,
    scrapedData: ScrapedCaseData
  ): Promise<SyncResult> {
    try {
      // 1. 스냅샷 생성
      const snapshot: CaseSnapshot = {
        basicInfo: scrapedData.basicInfo,
        hearings: scrapedData.hearings,
        progress: scrapedData.progress,
        documents: scrapedData.documents,
        lowerCourt: scrapedData.lowerCourt,
        relatedCases: scrapedData.relatedCases,
      };

      // 2. 해시 생성
      const contentHash = CaseChangeDetector.generateHash(snapshot);

      // 3. 이전 스냅샷 조회
      const { data: prevSnapshot } = await this.supabase
        .from('scourt_case_snapshots')
        .select('*')
        .eq('legal_case_id', legalCaseId)
        .order('scraped_at', { ascending: false })
        .limit(1)
        .single();

      // 4. 해시 비교 - 변경 없으면 스킵
      if (prevSnapshot && prevSnapshot.content_hash === contentHash) {
        return {
          success: true,
          caseData: scrapedData,
          snapshot: { id: prevSnapshot.id, hash: contentHash },
          updates: [],
          isFirstSync: false,
        };
      }

      // 5. 새 스냅샷 저장
      const { data: newSnapshot, error: snapshotError } = await this.supabase
        .from('scourt_case_snapshots')
        .insert({
          legal_case_id: legalCaseId,
          profile_id: profileId,
          basic_info: scrapedData.basicInfo,
          hearings: scrapedData.hearings,
          progress: scrapedData.progress,
          documents: scrapedData.documents,
          lower_court: scrapedData.lowerCourt,
          related_cases: scrapedData.relatedCases,
          case_type: scrapedData.caseType,
          court_code: scrapedData.court,
          case_number: scrapedData.caseNumber,
          content_hash: contentHash,
        })
        .select()
        .single();

      if (snapshotError) {
        throw new Error(`스냅샷 저장 실패: ${snapshotError.message}`);
      }

      // 6. 변경 감지
      const oldSnapshot: CaseSnapshot | null = prevSnapshot
        ? {
            basicInfo: prevSnapshot.basic_info,
            hearings: prevSnapshot.hearings,
            progress: prevSnapshot.progress,
            documents: prevSnapshot.documents,
            lowerCourt: prevSnapshot.lower_court,
            relatedCases: prevSnapshot.related_cases,
          }
        : null;

      const updates = CaseChangeDetector.detectChanges(oldSnapshot, snapshot);

      // 7. 업데이트 저장
      if (updates.length > 0) {
        const updateRecords = updates.map((u) => ({
          legal_case_id: legalCaseId,
          snapshot_id: newSnapshot.id,
          update_type: u.updateType,
          update_summary: u.updateSummary,
          details: u.details,
          old_value: u.oldValue,
          new_value: u.newValue,
          importance: u.importance,
        }));

        await this.supabase.from('scourt_case_updates').insert(updateRecords);
      }

      // 8. legal_cases 업데이트
      const nextHearing = CaseChangeDetector.getNextHearing(scrapedData.hearings);

      // 기본정보에서 사건명, 종국결과 추출
      const basicInfo = scrapedData.basicInfo || {};
      const scourtCaseName = basicInfo['사건명'] || null;
      const caseResult = basicInfo['종국결과'] || basicInfo['종국'] || null;
      const caseResultDateStr = basicInfo['종국일'] || basicInfo['종국일자'] || null;
      const caseResultDate = caseResultDateStr
        ? this.parseKoreanDate(caseResultDateStr)
        : null;

      await this.supabase
        .from('legal_cases')
        .update({
          scourt_last_snapshot_id: newSnapshot.id,
          scourt_last_sync: new Date().toISOString(),
          scourt_next_hearing: nextHearing,
          // 대법원 기본정보 저장
          scourt_case_name: scourtCaseName,
          case_result: caseResult,
          case_result_date: caseResultDate,
        })
        .eq('id', legalCaseId);

      // 9. court_hearings 테이블에 기일 동기화
      if (scrapedData.hearings.length > 0) {
        const hearingSyncResult = await syncHearingsToCourtHearings(
          legalCaseId,
          scrapedData.caseNumber,
          scrapedData.hearings
        );
        console.log(
          `[SCOURT] court_hearings 동기화: 생성 ${hearingSyncResult.created}, 업데이트 ${hearingSyncResult.updated}, 스킵 ${hearingSyncResult.skipped}`
        );
      }

      // 10. 중요 업데이트 시 알림 발송
      if (updates.length > 0) {
        const highImportanceUpdates = updates.filter((u) => u.importance === 'high');
        if (highImportanceUpdates.length > 0) {
          try {
            const notifyResult = await notifyOnCaseUpdates(legalCaseId, highImportanceUpdates);
            console.log(
              `[SCOURT] 알림 발송: ${notifyResult.notificationsSent}건 (에러: ${notifyResult.errors.length}건)`
            );
          } catch (notifyError) {
            console.error('[SCOURT] 알림 발송 실패:', notifyError);
            // 알림 실패는 전체 동기화 결과에 영향 없음
          }
        }
      }

      // 11. 자동 기한 등록 (판결/결정 시 상소기간 등)
      if (updates.length > 0) {
        const deadlineUpdates = updates.filter(
          (u) => u.updateType === 'result_announced' || u.updateType === 'hearing_result'
        );
        if (deadlineUpdates.length > 0) {
          try {
            const deadlineResult = await autoRegisterDeadlines(
              scrapedData.caseNumber,
              deadlineUpdates,
              newSnapshot.id
            );
            console.log(
              `[SCOURT] 자동 기한 등록: ${deadlineResult.registered}건 등록, ${deadlineResult.skipped}건 스킵 (에러: ${deadlineResult.errors.length}건)`
            );
          } catch (deadlineError) {
            console.error('[SCOURT] 자동 기한 등록 실패:', deadlineError);
            // 기한 등록 실패는 전체 동기화 결과에 영향 없음
          }
        }
      }

      // 12. 연계사건/심급사건 자동 연결
      await this.autoLinkRelatedCases(
        legalCaseId,
        scrapedData.relatedCases,
        scrapedData.lowerCourt
      );

      return {
        success: true,
        caseData: scrapedData,
        snapshot: { id: newSnapshot.id, hash: contentHash },
        updates,
        isFirstSync: !prevSnapshot,
      };
    } catch (error) {
      return {
        success: false,
        updates: [],
        isFirstSync: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 연계사건/심급사건 자동 연결
   * 대법원에서 가져온 연계사건/심급정보가 우리 DB에 있으면 case_relations에 등록
   */
  private async autoLinkRelatedCases(
    legalCaseId: string,
    relatedCases: RelatedCaseInfo[],
    lowerCourt: LowerCourtInfo[]
  ): Promise<{ linked: number; skipped: number }> {
    let linked = 0;
    let skipped = 0;

    try {
      // 1. 연계사건 + 심급사건 번호 수집
      const caseNumbersToMatch: { caseNo: string; relationType: string }[] = [];

      // 연계사건
      for (const rc of relatedCases) {
        if (rc.caseNo) {
          caseNumbersToMatch.push({
            caseNo: rc.caseNo,
            relationType: rc.relation || '연계사건',
          });
        }
      }

      // 심급사건 (lowerCourt)
      for (const lc of lowerCourt) {
        if (lc.caseNo) {
          caseNumbersToMatch.push({
            caseNo: lc.caseNo,
            relationType: '하급심',
          });
        }
      }

      if (caseNumbersToMatch.length === 0) {
        return { linked: 0, skipped: 0 };
      }

      // 2. 우리 DB에서 일치하는 사건 검색
      const caseNumbers = caseNumbersToMatch.map((c) => c.caseNo);
      const { data: matchingCases } = await this.supabase
        .from('legal_cases')
        .select('id, court_case_number')
        .in('court_case_number', caseNumbers)
        .neq('id', legalCaseId); // 자기 자신 제외

      if (!matchingCases || matchingCases.length === 0) {
        return { linked: 0, skipped: caseNumbersToMatch.length };
      }

      // 3. 기존 관계 조회 (중복 방지)
      const { data: existingRelations } = await this.supabase
        .from('case_relations')
        .select('related_case_id')
        .eq('case_id', legalCaseId);

      const existingRelatedIds = new Set(
        existingRelations?.map((r) => r.related_case_id) || []
      );

      // 4. 새 관계 생성
      const newRelations: {
        case_id: string;
        related_case_id: string;
        relation_type: string;
        notes: string;
      }[] = [];

      for (const match of matchingCases) {
        if (existingRelatedIds.has(match.id)) {
          skipped++;
          continue;
        }

        // 관계 유형 찾기
        const relationInfo = caseNumbersToMatch.find(
          (c) => c.caseNo === match.court_case_number
        );

        newRelations.push({
          case_id: legalCaseId,
          related_case_id: match.id,
          relation_type: relationInfo?.relationType || '연계사건',
          notes: `대법원 나의사건검색에서 자동 연결됨 (${match.court_case_number})`,
        });
      }

      if (newRelations.length > 0) {
        const { error } = await this.supabase
          .from('case_relations')
          .upsert(newRelations, {
            onConflict: 'case_id,related_case_id',
            ignoreDuplicates: true,
          });

        if (error) {
          console.error('[SCOURT] 관계 저장 실패:', error);
        } else {
          linked = newRelations.length;
          console.log(
            `[SCOURT] 연계사건 자동 연결: ${linked}건 연결됨`
          );
        }
      }

      skipped += caseNumbersToMatch.length - matchingCases.length;
    } catch (error) {
      console.error('[SCOURT] 연계사건 자동 연결 실패:', error);
    }

    return { linked, skipped };
  }

  /**
   * 사건별 업데이트 조회
   */
  async getCaseUpdates(
    legalCaseId: string,
    options?: {
      limit?: number;
      unreadOnly?: boolean;
      importanceFilter?: ('high' | 'normal' | 'low')[];
    }
  ) {
    let query = this.supabase
      .from('scourt_case_updates')
      .select('*')
      .eq('legal_case_id', legalCaseId)
      .order('detected_at', { ascending: false });

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.unreadOnly) {
      query = query.eq('is_read_by_client', false);
    }

    if (options?.importanceFilter && options.importanceFilter.length > 0) {
      query = query.in('importance', options.importanceFilter);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`업데이트 조회 실패: ${error.message}`);
    }

    return data || [];
  }

  /**
   * 업데이트 읽음 처리
   */
  async markUpdatesAsRead(
    updateIds: string[],
    readBy: 'admin' | 'client'
  ): Promise<void> {
    const column = readBy === 'admin' ? 'is_read_by_admin' : 'is_read_by_client';
    const timestampColumn = readBy === 'admin' ? 'read_at_admin' : 'read_at_client';

    await this.supabase
      .from('scourt_case_updates')
      .update({
        [column]: true,
        [timestampColumn]: new Date().toISOString(),
      })
      .in('id', updateIds);
  }

  /**
   * 최신 업데이트가 있는 사건 목록 조회
   */
  async getCasesWithRecentUpdates(options?: {
    clientId?: string;
    limit?: number;
    daysBack?: number;
  }) {
    const daysBack = options?.daysBack || 30;
    const since = new Date();
    since.setDate(since.getDate() - daysBack);

    let query = this.supabase
      .from('scourt_case_update_summary')
      .select('*')
      .gte('last_update_at', since.toISOString())
      .order('last_update_at', { ascending: false });

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      // 뷰가 없을 수 있으므로 에러 무시하고 빈 배열 반환
      console.warn('업데이트 요약 조회 실패:', error.message);
      return [];
    }

    return data || [];
  }

  /**
   * 한국어 날짜 문자열을 ISO 날짜로 변환
   * 예: "2024.12.31", "2024-12-31", "2024년 12월 31일"
   */
  private parseKoreanDate(dateStr: string): string | null {
    if (!dateStr) return null;

    // "2024.12.31" 또는 "2024-12-31" 형식
    const match1 = dateStr.match(/(\d{4})[.\-](\d{1,2})[.\-](\d{1,2})/);
    if (match1) {
      const [, year, month, day] = match1;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    // "2024년 12월 31일" 형식
    const match2 = dateStr.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
    if (match2) {
      const [, year, month, day] = match2;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    return null;
  }
}

// ============================================================
// 싱글톤 인스턴스
// ============================================================

let unifiedScraperInstance: UnifiedScraper | null = null;

export function getUnifiedScraper(): UnifiedScraper {
  if (!unifiedScraperInstance) {
    unifiedScraperInstance = new UnifiedScraper();
  }
  return unifiedScraperInstance;
}
