/**
 * SCOURT WebSquare XML 파서
 *
 * XML 파일에서 화면 구조를 추출하여 렌더링에 사용
 * - w2:dataMap에서 필드 정의 추출
 * - 레이아웃의 txt_XXX ID를 실제 필드 ID로 자동 매핑
 */

import { getExpressionFields } from './xml-mapping';

// ============================================================================
// 타입 정의
// ============================================================================

/** 기본정보 테이블 행 */
export interface BasicInfoRow {
  id?: string;  // 행 ID (XML의 tr id 속성, 조건부 표시용)
  cells: BasicInfoCell[];
}

export interface BasicInfoCell {
  type: 'th' | 'td';
  label?: string;
  ref?: string;           // data:dma_csBasCtt.userCsNo
  displayFormat?: string; // ####.##.##
  colspan?: number;
  id?: string;           // 조건부 표시용 ID
  /** 셀에 여러 span이 있을 때 각 span의 ref/format 정보 */
  multiRefs?: Array<{ ref: string; displayFormat?: string }>;
}

/** 기본정보 테이블 레이아웃 */
export interface BasicInfoLayout {
  title: string;
  colWidths: string[];
  rows: BasicInfoRow[];
  fieldMap?: Record<string, string>;  // 필드 ID → 한글 라벨
}

/** 그리드 컬럼 정의 */
export interface GridColumn {
  id: string;
  header: string;
  displayFormat?: string;
  width?: string;
  textAlign?: string;
  /** 입력 타입 (text, expression, custom 등) */
  inputType?: string;
  /** expression 컬럼일 때 조합할 필드 목록 */
  expressionFields?: string[];
}

/** 그리드 레이아웃 */
export interface GridLayout {
  title: string;
  dataListId: string;
  columns: GridColumn[];
  noResultMessage?: string;
  /** columnInfo에서 추출한 필드 정의 (id → name 매핑) */
  fieldDefinitions?: Record<string, string>;
}

/** 파싱된 전체 레이아웃 */
export interface ParsedLayout {
  basicInfo: BasicInfoLayout;
  grids: Record<string, GridLayout>;
  subComponents: string[];  // 하위 컴포넌트 XML 파일명
  fieldDefinitions: Record<string, string>;  // 필드 ID → 한글 라벨
}

// ============================================================================
// XML 파서 구현
// ============================================================================

/**
 * XML 문자열에서 레이아웃 파싱
 */
export function parseWebSquareXml(xmlString: string): ParsedLayout {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'text/xml');

  // 파싱 에러 체크
  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    throw new Error('XML 파싱 에러: ' + parseError.textContent);
  }

  // 먼저 필드 정의 추출 (w2:dataMap → w2:key)
  const fieldDefinitions = extractFieldDefinitions(doc);

  return {
    basicInfo: parseBasicInfoTable(doc, fieldDefinitions),
    grids: parseGridViews(doc),
    subComponents: parseSubComponents(doc),
    fieldDefinitions,
  };
}

/**
 * XML에서 필드 정의 추출 (w2:dataMap의 w2:key 요소들)
 * 예: <w2:key id="ultmtDvsNm" name="종국결과명"> → { ultmtDvsNm: "종국결과명" }
 */
function extractFieldDefinitions(doc: Document): Record<string, string> {
  const fields: Record<string, string> = {};

  // w2:key 요소들에서 id와 name 추출
  const keys = doc.querySelectorAll('w2\\:key, key');
  keys.forEach(key => {
    const id = key.getAttribute('id');
    const name = key.getAttribute('name');
    if (id && name) {
      fields[id] = name;
    }
  });

  return fields;
}

const DERIVED_FIELD_IDS = new Set([
  'ultmtDvsNm',
  'csUltmtDvsNm',
  'aplPrpndCtt',
  'prsvCtt',
]);

/**
 * txt_XXX 형태의 ID에서 실제 필드 ID 찾기
 * 예: txt_csUltmtDvsNm → ultmtDvsNm (필드 정의에서 매칭)
 */
function resolveFieldIdFromSpanId(spanId: string, fieldDefinitions: Record<string, string>): string | null {
  // txt_ 접두사 제거
  const match = spanId.match(/^txt_(.+?)(\d*)$/);
  if (!match) return null;

  const baseName = match[1];
  const validFieldIds = Object.keys(fieldDefinitions);

  // 1. 정확히 일치하는 필드 찾기
  if (validFieldIds.includes(baseName)) {
    return baseName;
  }

  // 2. 흔한 접두사 (cs, crm 등) 제거 후 매칭
  const prefixes = ['cs', 'crm', 'hskp'];
  for (const prefix of prefixes) {
    if (baseName.toLowerCase().startsWith(prefix)) {
      const withoutPrefix = baseName.slice(prefix.length);
      // 첫 글자 소문자로 변환
      const fieldId = withoutPrefix.charAt(0).toLowerCase() + withoutPrefix.slice(1);
      if (validFieldIds.includes(fieldId)) {
        return fieldId;
      }
      // 그대로도 시도
      if (validFieldIds.includes(withoutPrefix)) {
        return withoutPrefix;
      }
    }
  }

  // 3. 대소문자만 다른 경우의 정확 매칭
  for (const fieldId of validFieldIds) {
    // 대소문자 무시하고 비교
    if (fieldId.toLowerCase() === baseName.toLowerCase()) {
      return fieldId;
    }
  }

  // 4. 매칭 실패 - 자동 매핑 중단
  if (DERIVED_FIELD_IDS.has(baseName)) {
    return baseName;
  }

  return null;
}

/**
 * 기본정보 테이블 파싱
 */
function parseBasicInfoTable(doc: Document, fieldDefinitions: Record<string, string>): BasicInfoLayout {
  const table = doc.querySelector('xf\\:group[tagname="table"], group[tagname="table"]');

  const layout: BasicInfoLayout = {
    title: '기본내용',
    colWidths: [],
    rows: [],
    fieldMap: fieldDefinitions,
  };

  if (!table) return layout;

  // 컬럼 너비 추출
  const colgroup = table.querySelector('xf\\:group[tagname="colgroup"], group[tagname="colgroup"]');
  if (colgroup) {
    const cols = colgroup.querySelectorAll('xf\\:group[tagname="col"], group[tagname="col"]');
    cols.forEach(col => {
      const style = col.getAttribute('style') || '';
      const widthMatch = style.match(/width:\s*(\d+%?)/);
      layout.colWidths.push(widthMatch ? widthMatch[1] : 'auto');
    });
  }

  // 행 추출
  const rows = table.querySelectorAll('xf\\:group[tagname="tr"], group[tagname="tr"]');
  rows.forEach(row => {
    const rowId = row.getAttribute('id') || undefined;
    const rowData: BasicInfoRow = { id: rowId, cells: [] };

    // th, td 셀 추출
    const cells = row.querySelectorAll('xf\\:group[tagname="th"], xf\\:group[tagname="td"], group[tagname="th"], group[tagname="td"]');
    cells.forEach(cell => {
      const tagname = cell.getAttribute('tagname') as 'th' | 'td';
      const colspan = cell.getAttribute('colspan');

      // 셀 내부의 모든 span 요소 추출
      const allSpans = cell.querySelectorAll('w2\\:span, span');
      const refSpans: Element[] = [];
      let labelSpan: Element | null = null;

      // ref 속성이 있는 span들과 라벨 span 분류
      allSpans.forEach(span => {
        const ref = span.getAttribute('ref');
        const label = span.getAttribute('label');
        if (ref && ref.startsWith('data:')) {
          refSpans.push(span);
        } else if (label && !labelSpan) {
          labelSpan = span;
        }
      });

      // 첫 번째 ref span을 기본으로 사용, 없으면 라벨 span
      const primarySpan = refSpans[0] || labelSpan || (allSpans.length > 0 ? allSpans[0] : null);

      const cellData: BasicInfoCell = {
        type: tagname,
        colspan: colspan ? parseInt(colspan) : undefined,
        id: rowId || undefined,
      };

      if (primarySpan) {
        cellData.label = primarySpan.getAttribute('label') || undefined;
        cellData.ref = primarySpan.getAttribute('ref') || undefined;
        cellData.displayFormat = primarySpan.getAttribute('displayFormat') || undefined;

        const spanId = primarySpan.getAttribute('id') || undefined;
        if (!cellData.id) {
          cellData.id = spanId;
        }

        // ref가 없거나 빈 값이고, id가 txt_XXX 형식이면 필드 정의에서 매칭
        // 예: txt_csUltmtDvsNm → ultmtDvsNm (필드 정의에서 찾음)
        if ((!cellData.ref || cellData.ref === '') && spanId) {
          const resolvedFieldId = resolveFieldIdFromSpanId(spanId, fieldDefinitions);
          if (resolvedFieldId) {
            cellData.ref = `data:dma_csBasCtt.${resolvedFieldId}`;
          }
        }

        // 여러 ref span이 있으면 multiRefs에 저장 (예: 청구금액 + 통화단위)
        if (refSpans.length > 1) {
          cellData.multiRefs = refSpans.map(span => ({
            ref: span.getAttribute('ref') || '',
            displayFormat: span.getAttribute('displayFormat') || undefined,
          }));
        }
      }

      rowData.cells.push(cellData);
    });

    if (rowData.cells.length > 0) {
      layout.rows.push(rowData);
    }
  });

  return layout;
}

/**
 * 그리드 뷰 파싱
 *
 * XML에서 추출하는 정보:
 * 1. columnInfo: 필드 ID → 한글명 (name 속성)
 * 2. gBody: 필드 ID → displayFormat, textAlign
 * 3. header: 표시 순서, width
 */
function parseGridViews(doc: Document): Record<string, GridLayout> {
  const grids: Record<string, GridLayout> = {};

  const gridViews = doc.querySelectorAll('w2\\:gridView, gridView');
  gridViews.forEach(grid => {
    const dataListAttr = grid.getAttribute('dataList');
    if (!dataListAttr) return;

    // data:dlt_btprtCttLst -> dlt_btprtCttLst
    const dataListId = dataListAttr.replace('data:', '');

    // 타이틀 추출
    let title = grid.getAttribute('captionTitle') || '';

    // 상위 형제 요소에서 타이틀 찾기
    const prevSibling = grid.previousElementSibling;
    if (prevSibling && prevSibling.getAttribute('label')) {
      title = prevSibling.getAttribute('label') || title;
    }

    const layout: GridLayout = {
      title: title.replace(' 그리드', ''),
      dataListId,
      columns: [],
      noResultMessage: grid.getAttribute('noResultMessage') || undefined,
      fieldDefinitions: {},
    };

    // 1. columnInfo에서 필드 정의 추출 (필드 ID → 한글명)
    const fieldNames: Record<string, string> = {};
    const dataList = doc.querySelector(`w2\\:dataList[id="${dataListId}"], dataList[id="${dataListId}"]`);
    if (dataList) {
      const columnInfoCols = dataList.querySelectorAll('w2\\:columnInfo w2\\:column, columnInfo column');
      columnInfoCols.forEach(col => {
        const id = col.getAttribute('id');
        const name = col.getAttribute('name');
        if (id && name) {
          fieldNames[id] = name;
          layout.fieldDefinitions![id] = name;
        }
      });
    }

    // 2. gBody에서 컬럼 정보 추출 (순서대로 배열)
    interface BodyColInfo {
      id: string;
      displayFormat?: string;
      textAlign?: string;
      inputType?: string;
      expression?: string;
    }
    const bodyColsInfo: BodyColInfo[] = [];
    const bodyRow = grid.querySelector('w2\\:gBody w2\\:row, gBody row');
    if (bodyRow) {
      const bodyCols = bodyRow.querySelectorAll('w2\\:column, column');
      bodyCols.forEach(col => {
        bodyColsInfo.push({
          id: col.getAttribute('id') || '',
          displayFormat: col.getAttribute('displayFormat') || undefined,
          textAlign: col.getAttribute('textAlign') || undefined,
          inputType: col.getAttribute('inputType') || undefined,
          expression: col.getAttribute('expression') || undefined,
        });
      });
    }

    // 3. header에서 표시 순서와 width 추출 - gBody와 위치로 매칭
    const headerRow = grid.querySelector('w2\\:header w2\\:row, header row');
    if (headerRow) {
      const headerCols = headerRow.querySelectorAll('w2\\:column, column');
      headerCols.forEach((headerCol, index) => {
        const headerValue = headerCol.getAttribute('value') || '';
        const width = headerCol.getAttribute('width') || undefined;

        // gBody 컬럼과 위치로 매칭
        const bodyInfo = bodyColsInfo[index];
        const colId = bodyInfo?.id || headerCol.getAttribute('id') || '';
        const inputType = bodyInfo?.inputType;

        // expression 컬럼: 조합할 필드들 찾기
        let expressionFields: string[] | undefined;
        if (inputType === 'expression') {
          // xml-mapping.ts의 EXPRESSION_RULES에서 조회
          const fields = getExpressionFields(dataListId);
          if (fields) {
            expressionFields = fields;
          }
        }

        // XML header의 value를 헤더로 사용 (XML 그대로)
        // columnInfo에 있는 실제 데이터 필드 또는 expression 컬럼 포함
        const fieldName = fieldNames[colId];
        if (fieldName || inputType === 'expression' || Object.keys(fieldNames).length === 0) {
          layout.columns.push({
            id: colId,
            header: headerValue,  // XML header value 그대로 사용
            displayFormat: bodyInfo?.displayFormat,
            width,
            textAlign: bodyInfo?.textAlign,
            inputType,
            expressionFields,
          });
        }
      });
    }

    // 4. header가 없으면 columnInfo 기반으로 컬럼 생성
    if (layout.columns.length === 0 && Object.keys(fieldNames).length > 0) {
      // bodyColsInfo를 id로 룩업할 수 있는 맵 생성
      const bodyInfoById: Record<string, BodyColInfo> = {};
      bodyColsInfo.forEach(info => {
        if (info.id) bodyInfoById[info.id] = info;
      });

      for (const [id, name] of Object.entries(fieldNames)) {
        const bodyInfo = bodyInfoById[id];
        layout.columns.push({
          id,
          header: name,
          displayFormat: bodyInfo?.displayFormat,
          textAlign: bodyInfo?.textAlign,
          inputType: bodyInfo?.inputType,
        });
      }
    }

    grids[dataListId] = layout;
  });

  return grids;
}

/**
 * 하위 컴포넌트 (wframe) 파싱
 */
function parseSubComponents(doc: Document): string[] {
  const wframes = doc.querySelectorAll('w2\\:wframe, wframe');
  const components: string[] = [];

  wframes.forEach(wframe => {
    const src = wframe.getAttribute('src');
    if (src) {
      components.push(src);
    }
  });

  return components;
}

/**
 * 그리드 전용 XML 파싱 (SSGO003F*.xml)
 */
export function parseGridXml(xmlString: string): GridLayout | null {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'text/xml');

  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    throw new Error('XML 파싱 에러: ' + parseError.textContent);
  }

  const grids = parseGridViews(doc);
  const gridIds = Object.keys(grids);

  if (gridIds.length === 0) return null;

  // 첫 번째 그리드 반환
  const grid = grids[gridIds[0]];

  // 타이틀 찾기 (body 내 span)
  const titleSpan = doc.querySelector('body w2\\:span.con_stit, body span.con_stit, body w2\\:span[class*="stit"]');
  if (titleSpan) {
    grid.title = titleSpan.getAttribute('label') || grid.title;
  }

  return grid;
}

/**
 * dataMap에서 필드 정의 추출
 */
export function parseDataMapFields(xmlString: string): Record<string, string> {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'text/xml');

  const fields: Record<string, string> = {};

  // w2:key 요소들에서 id와 name 추출
  const keys = doc.querySelectorAll('w2\\:key, key');
  keys.forEach(key => {
    const id = key.getAttribute('id');
    const name = key.getAttribute('name');
    if (id && name) {
      fields[id] = name;
    }
  });

  // w2:column 요소들에서도 추출
  const columns = doc.querySelectorAll('w2\\:columnInfo w2\\:column, columnInfo column');
  columns.forEach(col => {
    const id = col.getAttribute('id');
    const name = col.getAttribute('name');
    if (id && name) {
      fields[id] = name;
    }
  });

  return fields;
}

// ============================================================================
// ref 값에서 필드 ID 추출
// ============================================================================

/**
 * ref 속성에서 필드 ID 추출
 * "data:dma_csBasCtt.userCsNo" -> "userCsNo"
 */
export function extractFieldId(ref: string): string {
  if (!ref) return '';
  const parts = ref.split('.');
  return parts[parts.length - 1];
}

/**
 * ref 속성에서 데이터맵 ID 추출
 * "data:dma_csBasCtt.userCsNo" -> "dma_csBasCtt"
 */
export function extractDataMapId(ref: string): string {
  if (!ref) return '';
  const match = ref.match(/data:(\w+)\./);
  return match ? match[1] : '';
}
