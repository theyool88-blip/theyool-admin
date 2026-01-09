/**
 * SCOURT 일반내용 동적 렌더러
 *
 * 원칙: API 응답만으로 100% 렌더링, 하드코딩 매핑 없음
 *
 * API 응답 규칙:
 * - *Nm, *Ctt → 표시할 값 (한글)
 * - *Cd, *Yn, *Flag, *Org → 숨김
 * - *Ymd → 날짜 (포맷팅)
 * - *Amt → 금액 (포맷팅)
 *
 * 라벨 규칙:
 * - titRprsPtnr/titRprsRqstr → 당사자 라벨 (원고/피고, 채권자/채무자 등)
 * - *StndngNm, *DvsNm → 구분/유형 라벨
 * - 첫 번째 *Nm 컬럼 → 행의 라벨
 */

// ============================================================================
// 필드 분류 규칙 (API 응답 패턴 기반)
// ============================================================================

/** 숨길 필드 패턴 */
function isHiddenField(key: string): boolean {
  // 코드, 플래그, 원본값 등
  if (key.endsWith('Cd')) return true;
  if (key.endsWith('Yn')) return true;
  if (key.endsWith('Flag')) return true;
  if (key.endsWith('Org')) return true;
  // 내부 메타데이터
  if (['encCsNo', 'today', 'csNo'].includes(key)) return true;
  return false;
}

/** 날짜 필드 패턴 */
function isDateField(key: string): boolean {
  return key.endsWith('Ymd') || key.endsWith('Day');
}

/** 금액 필드 패턴 */
function isAmountField(key: string): boolean {
  return key.endsWith('Amt');
}

/** 시간 필드 패턴 */
function isTimeField(key: string): boolean {
  return key.endsWith('Hm') || key.endsWith('Time');
}

/** 라벨 필드 패턴 (값이 다른 필드의 라벨 역할) */
function isLabelField(key: string): boolean {
  return key.startsWith('tit') ||
         key.endsWith('StndngNm') ||
         key.endsWith('DvsNm') ||
         key.endsWith('RltnCtt');
}

// ============================================================================
// 값 포맷팅
// ============================================================================

/** 날짜 포맷팅: YYYYMMDD → YY.MM.DD */
function formatDate(value: string): string {
  if (!value || typeof value !== 'string') return '';
  if (/^\d{8}$/.test(value)) {
    return `${value.slice(2, 4)}.${value.slice(4, 6)}.${value.slice(6, 8)}`;
  }
  return value;
}

/** 시간 포맷팅: HHMM → HH:MM */
function formatTime(value: string): string {
  if (!value || typeof value !== 'string') return '';
  if (/^\d{4}$/.test(value)) {
    return `${value.slice(0, 2)}:${value.slice(2, 4)}`;
  }
  return value;
}

/** 금액 포맷팅: 천 단위 콤마 */
function formatAmount(value: number | string): string {
  if (value === null || value === undefined || value === '') return '';
  const num = typeof value === 'string' ? parseInt(value, 10) : value;
  if (isNaN(num) || num === 0) return '';
  return num.toLocaleString('ko-KR') + '원';
}

/** 값 포맷팅 (키 패턴에 따라) */
function formatValue(key: string, value: any): string {
  if (value === null || value === undefined || value === '') return '';
  if (isDateField(key)) return formatDate(String(value));
  if (isTimeField(key)) return formatTime(String(value));
  if (isAmountField(key)) return formatAmount(value);
  return String(value).trim();
}

// ============================================================================
// 기본정보 (dma_csBasCtt) 파싱
// ============================================================================

export interface BasicInfoItem {
  label: string;
  value: string;
}

/**
 * 기본정보를 라벨-값 쌍으로 파싱
 *
 * 규칙:
 * 1. titRprsPtnr/titRprsRqstr → 당사자 라벨로 사용
 * 2. rprs*Nm → 해당 라벨과 매칭
 * 3. 나머지 *Nm, *Ctt, *Amt, *Ymd → 필드명 기반 표시
 */
export function parseBasicInfo(dmaData: Record<string, any>): BasicInfoItem[] {
  if (!dmaData || typeof dmaData !== 'object') return [];

  const items: BasicInfoItem[] = [];
  const processed = new Set<string>();

  // 1. 당사자 정보 (라벨 필드와 값 필드 매칭)
  const plaintiffLabel = dmaData.titRprsPtnr || '원고';
  const defendantLabel = dmaData.titRprsRqstr || '피고';

  // 원고측 이름 찾기
  const plaintiffNameFields = ['rprsClmntNm', 'rprsPtnrNm', 'rprsAplcntNm', 'rprsGrnshNm'];
  for (const field of plaintiffNameFields) {
    if (dmaData[field]) {
      items.push({ label: plaintiffLabel, value: dmaData[field] });
      processed.add(field);
      break;
    }
  }

  // 피고측 이름 찾기
  const defendantNameFields = ['rprsAcsdNm', 'rprsRqstrNm', 'rprsRspndnNm'];
  for (const field of defendantNameFields) {
    if (dmaData[field]) {
      items.push({ label: defendantLabel, value: dmaData[field] });
      processed.add(field);
      break;
    }
  }

  // 라벨 필드들은 이미 처리됨
  processed.add('titRprsPtnr');
  processed.add('titRprsRqstr');

  // 2. 나머지 필드 처리
  for (const [key, value] of Object.entries(dmaData)) {
    if (processed.has(key)) continue;
    if (isHiddenField(key)) continue;
    if (isLabelField(key)) continue;  // 라벨 전용 필드는 스킵

    const formatted = formatValue(key, value);
    if (!formatted) continue;

    // 필드명에서 간단한 라벨 추출 (suffix 제거)
    const label = extractSimpleLabel(key);
    items.push({ label, value: formatted });
  }

  return items;
}

/**
 * 필드명에서 간단한 라벨 추출
 * cortNm → cort, csRcptYmd → csRcpt
 */
function extractSimpleLabel(key: string): string {
  // suffix 제거
  let label = key
    .replace(/Nm$/, '')
    .replace(/Ctt$/, '')
    .replace(/Ymd$/, '')
    .replace(/Amt$/, '')
    .replace(/Cnt$/, '');

  return label || key;
}

// ============================================================================
// 테이블 (dlt_*) 파싱
// ============================================================================

export interface TableData {
  key: string;
  rows: TableRow[];
}

export interface TableRow {
  label: string;      // 행의 라벨 (첫 번째 *Nm 또는 *StndngNm 값)
  values: string[];   // 나머지 표시할 값들
}

/**
 * dlt_* 테이블을 파싱
 *
 * 규칙:
 * 1. *StndngNm, *DvsNm → 행의 라벨 (구분)
 * 2. 나머지 *Nm, *Ctt → 값
 * 3. *Cd, *Yn 등은 숨김
 */
export function parseTable(tableKey: string, tableData: any[]): TableData | null {
  if (!tableData || !Array.isArray(tableData) || tableData.length === 0) {
    return null;
  }

  const rows: TableRow[] = [];

  for (const rowData of tableData) {
    // 라벨 찾기 (StndngNm > DvsNm > RltnCtt > 첫 번째 Nm)
    let label = '';
    const labelKeys = Object.keys(rowData).filter(k =>
      k.endsWith('StndngNm') || k.endsWith('DvsNm') || k.endsWith('RltnCtt')
    );
    if (labelKeys.length > 0) {
      label = rowData[labelKeys[0]] || '';
    }

    // 값들 수집 (*Nm, *Ctt 중 라벨이 아닌 것)
    const values: string[] = [];
    for (const [key, value] of Object.entries(rowData)) {
      if (isHiddenField(key)) continue;
      if (isLabelField(key)) continue;  // 라벨 필드는 스킵

      const formatted = formatValue(key, value);
      if (formatted) {
        values.push(formatted);
      }
    }

    if (label || values.length > 0) {
      rows.push({ label, values });
    }
  }

  return rows.length > 0 ? { key: tableKey, rows } : null;
}

// ============================================================================
// 전체 API 응답 파싱
// ============================================================================

export interface ParsedScourtData {
  basicInfo: BasicInfoItem[];
  tables: TableData[];
}

/**
 * SCOURT API 응답 전체 파싱
 */
export function parseScourtResponse(rawData: Record<string, any>): ParsedScourtData {
  const result: ParsedScourtData = {
    basicInfo: [],
    tables: [],
  };

  // 기본정보 파싱
  if (rawData.dma_csBasCtt) {
    result.basicInfo = parseBasicInfo(rawData.dma_csBasCtt);
  }

  // 테이블 파싱 (dlt_* 키들)
  for (const [key, value] of Object.entries(rawData)) {
    if (key.startsWith('dlt_') && Array.isArray(value)) {
      const table = parseTable(key, value);
      if (table) {
        result.tables.push(table);
      }
    }
  }

  return result;
}

/**
 * 저장된 snapshot에서 raw API 데이터 추출
 */
export function extractRawData(snapshotData: any): Record<string, any> | null {
  // 여러 가능한 경로 시도
  if (snapshotData?.basicInfo?.generalData?.raw?.data) {
    return snapshotData.basicInfo.generalData.raw.data;
  }
  if (snapshotData?.basicInfo?.detailData?.raw?.data) {
    return snapshotData.basicInfo.detailData.raw.data;
  }
  if (snapshotData?.generalData?.raw?.data) {
    return snapshotData.generalData.raw.data;
  }
  if (snapshotData?.detailData?.raw?.data) {
    return snapshotData.detailData.raw.data;
  }
  if (snapshotData?.raw?.data) {
    return snapshotData.raw.data;
  }
  // dma_csBasCtt가 직접 있으면 그것 사용
  if (snapshotData?.dma_csBasCtt) {
    return snapshotData;
  }
  return null;
}
