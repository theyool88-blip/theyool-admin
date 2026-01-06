/**
 * 케이스노트 CSV 파서
 *
 * 케이스노트 소송리스트 내보내기 형식:
 * 중요,사건명/사건번호,의뢰인/상대방
 * ,이혼 등 청구 / 평택가정2024드단25547,엄현식[피고] / 심민선
 */

import { COURT_ABBREV_MAP, getCourtCodeByName } from './court-codes';

export interface ParsedCaseFromCSV {
  caseName: string;        // "이혼 등 청구"
  courtName: string;       // "평택가정" (축약형)
  courtFullName: string;   // "수원가정법원 평택지원" (정식명)
  caseYear: string;        // "2024"
  caseType: string;        // "드단"
  caseSerial: string;      // "25547"
  caseNumber: string;      // "2024드단25547"
  clientName: string;      // "엄현식"
  clientRole: 'plaintiff' | 'defendant' | 'applicant' | 'respondent' | 'creditor' | 'debtor' | null;
  clientRoleKorean: string; // "피고"
  opponentName: string;    // "심민선"
  isImportant: boolean;    // 중요 표시 여부
  parseError?: string;     // 파싱 에러 시 메시지
}

// 역할 매핑
const ROLE_MAP: Record<string, ParsedCaseFromCSV['clientRole']> = {
  '원고': 'plaintiff',
  '피고': 'defendant',
  '신청인': 'applicant',
  '피신청인': 'respondent',
  '청구인': 'applicant',
  '상대방': 'respondent',
  '채권자': 'creditor',
  '채무자': 'debtor',
  '항고인': 'applicant',
  '피항고인': 'respondent',
  '항소인': 'applicant',
  '피항소인': 'respondent',
  '상고인': 'applicant',
  '피상고인': 'respondent',
  '피고인': 'defendant',  // 형사 피고인
};

/**
 * 사건번호에서 법원명, 연도, 유형, 일련번호 추출
 * 예: "평택가정2024드단25547" → { court: "평택가정", year: "2024", type: "드단", serial: "25547" }
 */
function parseCaseNumber(caseNumberStr: string): {
  courtName: string;
  caseYear: string;
  caseType: string;
  caseSerial: string;
} | null {
  // 패턴: [법원명][연도4자리][사건유형][일련번호]
  // 법원명: 한글 (평택가정, 수원고법, 서울회생법원 등)
  // 연도: 4자리 숫자
  // 사건유형: 한글 (드단, 가단, 카기 등)
  // 일련번호: 숫자

  const match = caseNumberStr.match(/^([가-힣]+)(\d{4})([가-힣]+)(\d+)$/);
  if (!match) {
    return null;
  }

  return {
    courtName: match[1],
    caseYear: match[2],
    caseType: match[3],
    caseSerial: match[4],
  };
}

/**
 * 의뢰인/상대방 필드 파싱
 * 예: "엄현식[피고] / 심민선" → { clientName: "엄현식", clientRole: "피고", opponentName: "심민선" }
 * 예: "김현성[피고인] /" → { clientName: "김현성", clientRole: "피고인", opponentName: "" }
 */
function parseParties(partiesStr: string): {
  clientName: string;
  clientRoleKorean: string;
  clientRole: ParsedCaseFromCSV['clientRole'];
  opponentName: string;
} {
  // 끝에 " /" 또는 "/" 제거 (형사사건 등 상대방 없는 경우)
  let cleanedStr = partiesStr.replace(/\s*\/\s*$/, '').trim();

  const parts = cleanedStr.split(' / ');
  const clientPart = parts[0]?.trim() || '';
  const opponentPart = parts[1]?.trim() || '';

  // 의뢰인 파싱: "엄현식[피고]" → name: "엄현식", role: "피고"
  const clientMatch = clientPart.match(/^(.+?)\[(.+?)\]$/);
  let clientName = clientPart;
  let clientRoleKorean = '';
  let clientRole: ParsedCaseFromCSV['clientRole'] = null;

  if (clientMatch) {
    clientName = clientMatch[1].trim();
    clientRoleKorean = clientMatch[2].trim();
    clientRole = ROLE_MAP[clientRoleKorean] || null;
  }

  return {
    clientName,
    clientRoleKorean,
    clientRole,
    opponentName: opponentPart,
  };
}

/**
 * 케이스노트 CSV 한 줄 파싱
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());

  return result;
}

/**
 * 법원 축약명을 정식명으로 변환
 */
function getFullCourtName(abbrev: string): string {
  // 축약명 매핑에서 먼저 찾기
  if (COURT_ABBREV_MAP[abbrev]) {
    return COURT_ABBREV_MAP[abbrev];
  }

  // 코드 매핑에서 찾기 (이미 정식명일 수 있음)
  const code = getCourtCodeByName(abbrev);
  if (code) {
    // 이미 정식명이면 그대로 반환
    return abbrev;
  }

  // 찾지 못하면 원본 반환
  return abbrev;
}

/**
 * 케이스노트 CSV 파싱
 * @param csvContent CSV 파일 내용
 * @returns 파싱된 사건 목록
 */
export function parseCasenoteCSV(csvContent: string): ParsedCaseFromCSV[] {
  const lines = csvContent.split('\n');
  const results: ParsedCaseFromCSV[] = [];

  // 헤더 스킵 (첫 2줄)
  // 소송리스트,,
  // 임은지(출력시간 : 2026.01.05 09:58),,
  // 중요,사건명/사건번호,의뢰인/상대방
  let headerSkipped = 0;

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    // 헤더 감지 및 스킵
    if (headerSkipped < 3) {
      if (trimmedLine.includes('소송리스트') ||
          trimmedLine.includes('출력시간') ||
          trimmedLine.includes('사건명/사건번호')) {
        headerSkipped++;
        continue;
      }
    }

    const columns = parseCSVLine(trimmedLine);
    if (columns.length < 3) continue;

    const [importantCol, caseInfoCol, partiesCol] = columns;

    // 사건명/사건번호 파싱: "이혼 등 청구 / 평택가정2024드단25547"
    const caseInfoParts = caseInfoCol.split(' / ');
    if (caseInfoParts.length < 2) {
      results.push({
        caseName: caseInfoCol,
        courtName: '',
        courtFullName: '',
        caseYear: '',
        caseType: '',
        caseSerial: '',
        caseNumber: '',
        clientName: '',
        clientRole: null,
        clientRoleKorean: '',
        opponentName: '',
        isImportant: !!importantCol,
        parseError: '사건정보 파싱 실패: 형식이 맞지 않음',
      });
      continue;
    }

    const caseName = caseInfoParts[0].trim();
    const caseNumberFull = caseInfoParts[1].trim();

    const caseNumberParsed = parseCaseNumber(caseNumberFull);
    if (!caseNumberParsed) {
      results.push({
        caseName,
        courtName: '',
        courtFullName: '',
        caseYear: '',
        caseType: '',
        caseSerial: '',
        caseNumber: caseNumberFull,
        clientName: '',
        clientRole: null,
        clientRoleKorean: '',
        opponentName: '',
        isImportant: !!importantCol,
        parseError: `사건번호 파싱 실패: ${caseNumberFull}`,
      });
      continue;
    }

    const parties = parseParties(partiesCol);
    const courtFullName = getFullCourtName(caseNumberParsed.courtName);

    results.push({
      caseName,
      courtName: caseNumberParsed.courtName,
      courtFullName,
      caseYear: caseNumberParsed.caseYear,
      caseType: caseNumberParsed.caseType,
      caseSerial: caseNumberParsed.caseSerial,
      caseNumber: `${caseNumberParsed.caseYear}${caseNumberParsed.caseType}${caseNumberParsed.caseSerial}`,
      clientName: parties.clientName,
      clientRole: parties.clientRole,
      clientRoleKorean: parties.clientRoleKorean,
      opponentName: parties.opponentName,
      isImportant: !!importantCol,
    });
  }

  return results;
}

/**
 * 파싱 결과 요약
 */
export function getParseResultSummary(results: ParsedCaseFromCSV[]): {
  total: number;
  success: number;
  failed: number;
  byCourtType: Record<string, number>;
  byCaseType: Record<string, number>;
} {
  const success = results.filter(r => !r.parseError);
  const failed = results.filter(r => !!r.parseError);

  const byCourtType: Record<string, number> = {};
  const byCaseType: Record<string, number> = {};

  for (const r of success) {
    byCourtType[r.courtName] = (byCourtType[r.courtName] || 0) + 1;
    byCaseType[r.caseType] = (byCaseType[r.caseType] || 0) + 1;
  }

  return {
    total: results.length,
    success: success.length,
    failed: failed.length,
    byCourtType,
    byCaseType,
  };
}
