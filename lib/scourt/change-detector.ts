/**
 * 대법원 사건 변경 감지 모듈
 *
 * 이전 스냅샷과 현재 데이터를 비교하여 변경 사항을 감지하고 분류
 */

import crypto from 'crypto';

// ============================================================
// 타입 정의
// ============================================================

export interface RelatedCaseInfo {
  caseNo: string;
  caseName?: string;
  relation?: string;
}

export interface CaseSnapshot {
  basicInfo: Record<string, string>;
  hearings: HearingInfo[];
  progress: ProgressItem[];
  documents: DocumentItem[];
  lowerCourt: LowerCourtInfo[];
  relatedCases?: RelatedCaseInfo[];
}

export interface HearingInfo {
  date: string;
  time: string;
  type: string;
  location: string;
  result?: string;
  [key: string]: unknown;
}

export interface ProgressItem {
  date: string;
  content: string;
  result?: string;
  [key: string]: unknown;
}

export interface DocumentItem {
  date: string;
  content: string;
}

export interface LowerCourtInfo {
  court: string;
  caseNo: string;
}

export interface CaseUpdate {
  updateType: UpdateType;
  updateSummary: string;
  details: Record<string, unknown>;
  oldValue?: unknown;
  newValue?: unknown;
  importance: 'high' | 'normal' | 'low';
}

export type UpdateType =
  | 'hearing_new'
  | 'hearing_changed'
  | 'hearing_canceled'
  | 'hearing_result'
  | 'document_filed'
  | 'document_served'
  | 'served'
  | 'result_announced'
  | 'appeal_filed'
  | 'status_changed'
  | 'party_changed'
  | 'related_case_new'      // 새 연관사건 발견
  | 'lower_court_new'       // 새 심급사건 발견
  | 'other';

// ============================================================
// 변경 감지 클래스
// ============================================================

export class CaseChangeDetector {
  /**
   * 스냅샷 해시 생성 (변경 여부 빠른 확인용)
   */
  static generateHash(snapshot: CaseSnapshot): string {
    const content = JSON.stringify({
      basicInfo: snapshot.basicInfo,
      hearings: snapshot.hearings,
      progress: snapshot.progress,
    });
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * 두 스냅샷 비교하여 변경 사항 감지
   */
  static detectChanges(
    oldSnapshot: CaseSnapshot | null,
    newSnapshot: CaseSnapshot
  ): CaseUpdate[] {
    const updates: CaseUpdate[] = [];

    if (!oldSnapshot) {
      // 첫 동기화 - 모든 내용이 새로운 것
      return this.detectInitialState(newSnapshot);
    }

    // 1. 기일 변경 감지
    updates.push(...this.detectHearingChanges(oldSnapshot.hearings, newSnapshot.hearings));

    // 2. 진행내용 변경 감지
    updates.push(...this.detectProgressChanges(oldSnapshot.progress, newSnapshot.progress));

    // 3. 기본정보 변경 감지
    updates.push(...this.detectBasicInfoChanges(oldSnapshot.basicInfo, newSnapshot.basicInfo));

    // 4. 연관사건 변경 감지
    updates.push(...this.detectRelatedCaseChanges(
      oldSnapshot.relatedCases || [],
      newSnapshot.relatedCases || []
    ));

    // 5. 심급사건(원심) 변경 감지
    updates.push(...this.detectLowerCourtChanges(
      oldSnapshot.lowerCourt || [],
      newSnapshot.lowerCourt || []
    ));

    return updates;
  }

  /**
   * 첫 동기화 시 주요 정보 추출
   */
  private static detectInitialState(snapshot: CaseSnapshot): CaseUpdate[] {
    const updates: CaseUpdate[] = [];

    // 다음 기일이 있으면 추가
    const nextHearing = this.getNextHearing(snapshot.hearings);
    if (nextHearing) {
      updates.push({
        updateType: 'hearing_new',
        updateSummary: `${nextHearing.date} ${nextHearing.time} ${nextHearing.type}`,
        details: nextHearing,
        importance: 'high',
      });
    }

    // 종국결과가 있으면 추가
    const result = snapshot.basicInfo['종국결과'];
    if (result && result.trim()) {
      updates.push({
        updateType: 'result_announced',
        updateSummary: result,
        details: { result },
        importance: 'high',
      });
    }

    return updates;
  }

  /**
   * 기일 변경 감지
   */
  private static detectHearingChanges(
    oldHearings: HearingInfo[],
    newHearings: HearingInfo[]
  ): CaseUpdate[] {
    const updates: CaseUpdate[] = [];

    // 기일 키 생성 (날짜 + 시간 + 유형)
    const getKey = (h: HearingInfo) => `${h.date}_${h.time}_${h.type}`;

    const oldMap = new Map(oldHearings.map((h) => [getKey(h), h]));
    const newMap = new Map(newHearings.map((h) => [getKey(h), h]));

    // 새로 추가된 기일
    for (const [key, hearing] of newMap) {
      if (!oldMap.has(key)) {
        updates.push({
          updateType: 'hearing_new',
          updateSummary: `${hearing.date} ${hearing.time} ${hearing.type} 지정`,
          details: hearing,
          newValue: hearing,
          importance: 'high',
        });
      }
    }

    // 삭제/취소된 기일
    for (const [key, hearing] of oldMap) {
      if (!newMap.has(key)) {
        // 미래 기일이면 취소로 간주
        if (this.isFutureDate(hearing.date)) {
          updates.push({
            updateType: 'hearing_canceled',
            updateSummary: `${hearing.date} ${hearing.type} 취소`,
            details: hearing,
            oldValue: hearing,
            importance: 'high',
          });
        }
      }
    }

    // 결과가 추가된 기일
    for (const [key, newHearing] of newMap) {
      const oldHearing = oldMap.get(key);
      if (oldHearing && !oldHearing.result && newHearing.result) {
        updates.push({
          updateType: 'hearing_result',
          updateSummary: `${newHearing.date} ${newHearing.type}: ${newHearing.result}`,
          details: newHearing,
          oldValue: oldHearing,
          newValue: newHearing,
          importance: 'high',
        });
      }
    }

    return updates;
  }

  /**
   * 진행내용 변경 감지
   */
  private static detectProgressChanges(
    oldProgress: ProgressItem[],
    newProgress: ProgressItem[]
  ): CaseUpdate[] {
    const updates: CaseUpdate[] = [];

    // 진행내용 키 (날짜 + 내용 앞 50자)
    const getKey = (p: ProgressItem) => `${p.date}_${p.content.substring(0, 50)}`;

    const oldSet = new Set(oldProgress.map(getKey));

    // 새로 추가된 진행내용
    for (const item of newProgress) {
      if (!oldSet.has(getKey(item))) {
        const update = this.classifyProgressItem(item);
        updates.push(update);
      }
    }

    return updates;
  }

  /**
   * 진행내용 항목 분류
   */
  private static classifyProgressItem(item: ProgressItem): CaseUpdate {
    const content = item.content;

    // 송달 완료 (도달)
    if (item.result && item.result.includes('도달')) {
      return {
        updateType: 'served',
        updateSummary: `${content} (${item.result})`,
        details: item,
        importance: 'normal',
      };
    }

    // 서류 송달
    if (content.includes('송달')) {
      return {
        updateType: 'document_served',
        updateSummary: content,
        details: item,
        importance: 'normal',
      };
    }

    // 서류 제출
    if (content.includes('제출') || content.includes('접수')) {
      return {
        updateType: 'document_filed',
        updateSummary: content,
        details: item,
        importance: 'normal',
      };
    }

    // 기일 관련 (판결/결정 체크보다 먼저!)
    // "선고기일 지정", "변론기일 추후지정" 등은 기일 변경으로 분류
    if (content.includes('기일')) {
      return {
        updateType: 'hearing_changed',
        updateSummary: content,
        details: item,
        importance: 'high',
      };
    }

    // 상소
    if (content.includes('항소') || content.includes('상고') || content.includes('항고')) {
      return {
        updateType: 'appeal_filed',
        updateSummary: content,
        details: item,
        importance: 'high',
      };
    }

    // 판결/결정 - 실제 판결/결정 이벤트만 분류
    // 제외: "예정", "준비", "작성" 등 미래형/진행형 표현
    const hasJudgmentKeyword = content.includes('판결') || content.includes('결정') || content.includes('선고');
    const isNotActualJudgment = content.includes('예정') || content.includes('준비') || content.includes('작성');

    if (hasJudgmentKeyword && !isNotActualJudgment) {
      return {
        updateType: 'result_announced',
        updateSummary: content,
        details: item,
        importance: 'high',
      };
    }

    // 기타
    return {
      updateType: 'other',
      updateSummary: content,
      details: item,
      importance: 'low',
    };
  }

  /**
   * 기본정보 변경 감지
   */
  private static detectBasicInfoChanges(
    oldInfo: Record<string, string>,
    newInfo: Record<string, string>
  ): CaseUpdate[] {
    const updates: CaseUpdate[] = [];

    // 종국결과 변경
    if (oldInfo['종국결과'] !== newInfo['종국결과'] && newInfo['종국결과']) {
      updates.push({
        updateType: 'result_announced',
        updateSummary: `종국결과: ${newInfo['종국결과']}`,
        details: { result: newInfo['종국결과'] },
        oldValue: oldInfo['종국결과'],
        newValue: newInfo['종국결과'],
        importance: 'high',
      });
    }

    // 재판부 변경
    if (oldInfo['재판부'] !== newInfo['재판부'] && newInfo['재판부']) {
      updates.push({
        updateType: 'status_changed',
        updateSummary: `재판부 변경: ${newInfo['재판부']}`,
        details: { court: newInfo['재판부'] },
        oldValue: oldInfo['재판부'],
        newValue: newInfo['재판부'],
        importance: 'normal',
      });
    }

    return updates;
  }

  /**
   * 다음 기일 찾기 (오늘 이후)
   */
  static getNextHearing(hearings: HearingInfo[]): HearingInfo | null {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const futureHearings = hearings
      .filter((h) => {
        const hearingDate = this.parseDate(h.date);
        return hearingDate && hearingDate >= today && !h.result;
      })
      .sort((a, b) => {
        const dateA = this.parseDate(a.date);
        const dateB = this.parseDate(b.date);
        return (dateA?.getTime() || 0) - (dateB?.getTime() || 0);
      });

    return futureHearings[0] || null;
  }

  /**
   * 날짜 파싱 (YYYY.MM.DD 형식)
   */
  private static parseDate(dateStr: string): Date | null {
    const match = dateStr.match(/(\d{4})\.(\d{2})\.(\d{2})/);
    if (!match) return null;
    return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
  }

  /**
   * 미래 날짜 확인
   */
  private static isFutureDate(dateStr: string): boolean {
    const date = this.parseDate(dateStr);
    if (!date) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date >= today;
  }

  /**
   * 연관사건 변경 감지
   */
  private static detectRelatedCaseChanges(
    oldRelated: RelatedCaseInfo[],
    newRelated: RelatedCaseInfo[]
  ): CaseUpdate[] {
    const updates: CaseUpdate[] = [];
    const oldSet = new Set(oldRelated.map((r) => r.caseNo));

    for (const relCase of newRelated) {
      if (!oldSet.has(relCase.caseNo)) {
        updates.push({
          updateType: 'related_case_new',
          updateSummary: `${relCase.relation || '관련'} 사건 발견: ${relCase.caseNo}`,
          details: {
            caseNo: relCase.caseNo,
            caseName: relCase.caseName,
            relation: relCase.relation,
          },
          importance: 'normal',
        });
      }
    }

    return updates;
  }

  /**
   * 심급사건(원심) 변경 감지
   */
  private static detectLowerCourtChanges(
    oldLower: LowerCourtInfo[],
    newLower: LowerCourtInfo[]
  ): CaseUpdate[] {
    const updates: CaseUpdate[] = [];
    const oldSet = new Set(oldLower.map((l) => l.caseNo));

    for (const lowerCase of newLower) {
      if (!oldSet.has(lowerCase.caseNo)) {
        updates.push({
          updateType: 'lower_court_new',
          updateSummary: `심급사건 발견: ${lowerCase.caseNo} (${lowerCase.court || ''})`,
          details: {
            caseNo: lowerCase.caseNo,
            court: lowerCase.court,
          },
          importance: 'normal',
        });
      }
    }

    return updates;
  }
}

// ============================================================
// 유틸리티 함수
// ============================================================

/**
 * 업데이트 유형별 한글명
 */
export const UPDATE_TYPE_NAMES: Record<UpdateType, string> = {
  hearing_new: '기일 지정',
  hearing_changed: '기일 변경',
  hearing_canceled: '기일 취소',
  hearing_result: '기일 결과',
  document_filed: '서류 제출',
  document_served: '서류 송달',
  served: '송달 도달',
  result_announced: '판결/결정',
  appeal_filed: '상소 제기',
  status_changed: '상태 변경',
  party_changed: '당사자 변경',
  related_case_new: '연관사건 발견',
  lower_court_new: '심급사건 발견',
  other: '기타',
};

/**
 * 중요도별 정렬 순서
 */
export const IMPORTANCE_ORDER: Record<string, number> = {
  high: 0,
  normal: 1,
  low: 2,
};
