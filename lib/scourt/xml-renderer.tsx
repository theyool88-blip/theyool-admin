/**
 * SCOURT XML 기반 렌더러
 *
 * 파싱된 XML 레이아웃 + API 데이터 → React 컴포넌트
 */

import React from 'react';
import {
  BasicInfoLayout,
  BasicInfoRow,
  BasicInfoCell,
  GridLayout,
  GridColumn,
  extractFieldId,
} from './xml-parser';
import { getExpressionFields, getViewFieldMapping, checkRowVisibility, normalizeDataListId } from './xml-mapping';
import { normalizeCaseNumber } from './case-number-utils';

// ============================================================================
// 값 포맷팅
// ============================================================================

/**
 * displayFormat 적용
 *
 * 포맷 패턴:
 * - "####.##.##" : 날짜 (20241004 → 2024.10.04)
 * - "##:##" : 시간 (1400 → 14:00)
 * - "#,###" : 숫자 (70000 → 70,000)
 */
export function applyFormat(value: unknown, format?: string): string {
  if (value === null || value === undefined || value === '') return '';

  const strValue = String(value);

  if (!format) return strValue;

  // 날짜 포맷: ####.##.##
  if (format === '####.##.##') {
    if (/^\d{8}$/.test(strValue)) {
      return `${strValue.slice(0, 4)}.${strValue.slice(4, 6)}.${strValue.slice(6, 8)}`;
    }
    return strValue;
  }

  // 시간 포맷: ##:##
  if (format === '##:##') {
    if (/^\d{4}$/.test(strValue)) {
      return `${strValue.slice(0, 2)}:${strValue.slice(2, 4)}`;
    }
    return strValue;
  }

  // 숫자 포맷: #,###
  if (format === '#,###') {
    const num = parseInt(strValue, 10);
    if (!isNaN(num)) {
      return num.toLocaleString('ko-KR');
    }
    return strValue;
  }

  return strValue;
}

/**
 * ref 값에서 데이터 추출
 *
 * ref="data:dma_csBasCtt.userCsNo"
 * data = { userCsNo: "2024드단531", ... }
 * → "2024드단531"
 */
export function getValueFromRef(ref: string, data: Record<string, unknown>): unknown {
  const fieldId = extractFieldId(ref);
  return data[fieldId];
}


// ============================================================================
// 기본정보 테이블 렌더러
// ============================================================================

interface BasicInfoTableProps {
  layout: BasicInfoLayout;
  data: Record<string, unknown>;
  className?: string;
}

/**
 * 기본정보 테이블 렌더링
 */
export function BasicInfoTable({ layout, data, className }: BasicInfoTableProps) {
  if (!layout || !data) return null;

  return (
    <div className={className}>
      <h3 className="text-base md:text-lg font-semibold mb-3 flex items-center gap-2">
        <span className="w-1 h-5 bg-sage-600 rounded"></span>
        {layout.title}
        {typeof data.cortNm === 'string' && data.cortNm && (
          <span className="text-xs md:text-sm font-normal text-gray-500">
            ({data.cortNm})
          </span>
        )}
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          {layout.colWidths.length > 0 && (
            <colgroup>
              {layout.colWidths.map((width, i) => (
                <col key={i} style={{ width }} />
              ))}
            </colgroup>
          )}
          <tbody>
            {layout.rows.map((row, rowIndex) => (
              <BasicInfoRowComponent
                key={rowIndex}
                row={row}
                data={data}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface BasicInfoRowProps {
  row: BasicInfoRow;
  data: Record<string, unknown>;
}

function BasicInfoRowComponent({ row, data }: BasicInfoRowProps) {
  // 조건부 표시 처리: xml-mapping.ts의 ROW_VISIBILITY_RULES 확인
  const visibility = checkRowVisibility(row.id, data);

  // visibility가 false면 행 숨김
  if (visibility === false) {
    return null;
  }

  return (
    <tr className="border-b border-gray-200">
      {row.cells.map((cell, cellIndex) => (
        <BasicInfoCellComponent
          key={cellIndex}
          cell={cell}
          data={data}
        />
      ))}
    </tr>
  );
}

interface BasicInfoCellProps {
  cell: BasicInfoCell;
  data: Record<string, unknown>;
}

function BasicInfoCellComponent({ cell, data }: BasicInfoCellProps) {
  const isHeader = cell.type === 'th';

  // 값 계산
  let displayValue = '';
  if (cell.ref) {
    // ref가 있으면 데이터에서 값 추출 후 포맷 적용
    const rawValue = getValueFromRef(cell.ref, data);
    displayValue = applyFormat(rawValue, cell.displayFormat);
    // 중요: ref가 있는 데이터 바인딩 셀에서는 label을 fallback으로 사용하지 않음
    // XML 캐시가 DOM 캡처 시점의 데이터로 오염될 수 있기 때문
    // (예: SCOURT JavaScript 실행 후 label에 실제 데이터 값이 들어간 상태로 캐시됨)
  } else if (cell.label) {
    // ref가 없는 경우에만 라벨 사용 (th 헤더 등)
    displayValue = cell.label;
  }

  const baseClasses = isHeader
    ? 'px-2 md:px-3 py-1.5 md:py-2 bg-gray-50 text-xs md:text-sm font-medium text-gray-700 text-left'
    : 'px-2 md:px-3 py-1.5 md:py-2 text-xs md:text-sm text-gray-900';

  const Tag = isHeader ? 'th' : 'td';

  return (
    <Tag
      className={baseClasses}
      colSpan={cell.colspan}
    >
      {displayValue}
    </Tag>
  );
}

// ============================================================================
// 그리드 렌더러
// ============================================================================

/**
 * expression 컬럼의 값 계산
 * 여러 필드를 조합하여 하나의 문자열로 반환
 */
function computeExpressionValue(row: Record<string, unknown>, col: GridColumn): string {
  if (!col.expressionFields || col.expressionFields.length === 0) {
    return (row[col.id] as string) || '';
  }

  const parts: string[] = [];

  for (const fieldId of col.expressionFields) {
    const value = row[fieldId];
    if (value !== null && value !== undefined && value !== '') {
      // 날짜 필드는 포맷 적용 (8자리 숫자인 경우)
      if (fieldId.endsWith('Ymd') && /^\d{8}$/.test(String(value))) {
        const formatted = `${String(value).slice(0, 4)}.${String(value).slice(4, 6)}.${String(value).slice(6, 8)}`;
        parts.push(formatted);
      } else {
        parts.push(String(value));
      }
    }
  }

  return parts.join(' ').trim();
}

interface GridTableProps {
  layout: GridLayout;
  data: Record<string, unknown>[];
  className?: string;
  caseLinkMap?: Record<string, string>;
}

/**
 * 그리드 (테이블 목록) 렌더링
 */
export function GridTable({ layout, data, className, caseLinkMap }: GridTableProps) {
  if (!layout) return null;

  const hasData = data && data.length > 0;
  const normalizedDataListId = normalizeDataListId(layout.dataListId);
  const enableCaseLinks = ['dlt_reltCsLst', 'dlt_inscrtDtsLst'].includes(normalizedDataListId)
    && caseLinkMap && Object.keys(caseLinkMap).length > 0;

  // expression 컬럼 중 모든 행에서 빈 값인 컬럼 필터링
  const visibleColumns = layout.columns.filter(col => {
    if (col.inputType !== 'expression') return true;

    // expression 컬럼: 모든 행에서 값이 있는지 확인
    const fields = col.expressionFields || getExpressionFields(layout.dataListId);
    if (!fields || !hasData) return true;

    // 하나라도 값이 있는 행이 있으면 표시
    return data.some(row => {
      const value = computeExpressionValue(row, { ...col, expressionFields: fields });
      return value && value.trim() !== '';
    });
  });

  return (
    <div className={className}>
      <h3 className="text-base md:text-lg font-semibold mb-3 flex items-center gap-2">
        <span className="w-1 h-5 bg-sage-600 rounded"></span>
        {layout.title}
      </h3>

      {!hasData ? (
        <p className="text-xs md:text-sm text-gray-500 py-4 text-center bg-gray-50 rounded">
          {layout.noResultMessage || '조회된 내용이 없습니다.'}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-full">
            <thead>
              <tr className="bg-gray-50 border-y border-gray-200">
                {visibleColumns.map((col, i) => (
                  <th
                    key={i}
                    className="px-2 md:px-3 py-1.5 md:py-2 text-xs md:text-sm font-medium text-gray-700 text-center"
                    style={{ width: col.width ? `${col.width}%` : 'auto' }}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, rowIndex) => (
                <tr key={rowIndex} className="border-b border-gray-100 hover:bg-gray-50">
                  {visibleColumns.map((col, colIndex) => {
                    // expression 컬럼: 여러 필드를 조합
                    let displayValue: string;
                    if (col.inputType === 'expression') {
                      // expressionFields가 없으면 dataListId로 EXPRESSION_RULES에서 조회
                      const fields = col.expressionFields || getExpressionFields(layout.dataListId);
                      displayValue = fields ? computeExpressionValue(row, { ...col, expressionFields: fields }) : '';
                    } else {
                      let rawValue = row[col.id];

                      // View 필드 매핑 확인 (xxxView → xxx 원본 필드)
                      // API에 xxxView가 없고 원본 필드가 있으면 원본 필드 사용
                      if (rawValue === undefined || rawValue === null || rawValue === '') {
                        const viewMapping = getViewFieldMapping(col.id);
                        if (viewMapping && row[viewMapping.sourceField]) {
                          rawValue = row[viewMapping.sourceField];
                          // View 필드 매핑에 정의된 포맷 우선 적용
                          displayValue = applyFormat(rawValue, viewMapping.format || col.displayFormat);
                        } else {
                          displayValue = '';
                        }
                      } else {
                        displayValue = applyFormat(rawValue, col.displayFormat);
                      }
                    }

                    const caseLink = enableCaseLinks
                      ? getCaseLink(displayValue, caseLinkMap)
                      : null;

                    return (
                      <td
                        key={colIndex}
                        className="px-2 md:px-3 py-1.5 md:py-2 text-xs md:text-sm text-gray-900"
                        style={{ textAlign: (col.textAlign as React.CSSProperties['textAlign']) || 'center' }}
                      >
                        {caseLink ? (
                          <a href={caseLink} className="text-sage-700 hover:underline">
                            {displayValue}
                          </a>
                        ) : (
                          displayValue
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const CASE_NUMBER_PATTERN = /\d{4}\s*[가-힣]+\s*\d+/;
const NORMALIZED_CASE_NUMBER_PATTERN = /^\d{4}[가-힣]+\d+$/;

function getCaseLink(value: string, caseLinkMap?: Record<string, string>): string | null {
  if (!caseLinkMap || !value) return null;

  const rawValue = String(value);
  const match = rawValue.match(CASE_NUMBER_PATTERN);
  let normalized = '';

  if (match) {
    normalized = normalizeCaseNumber(match[0]);
  } else {
    const candidate = normalizeCaseNumber(rawValue);
    if (NORMALIZED_CASE_NUMBER_PATTERN.test(candidate)) {
      normalized = candidate;
    }
  }

  if (!normalized) return null;
  const caseId = caseLinkMap[normalized] || caseLinkMap[match?.[0] ?? ''] || caseLinkMap[rawValue];
  return caseId ? `/cases/${caseId}` : null;
}

// ============================================================================
// 전체 일반내용 렌더러
// ============================================================================

interface ScourtGeneralInfoRendererProps {
  basicInfoLayout: BasicInfoLayout;
  gridLayouts: Record<string, GridLayout>;
  apiData: {
    dma_csBasCtt: Record<string, unknown>;
    dlt_btprtCttLst?: Record<string, unknown>[];
    dlt_agntCttLst?: Record<string, unknown>[];
    dlt_rcntDxdyLst?: Record<string, unknown>[];
    dlt_rcntSbmsnDocmtLst?: Record<string, unknown>[];
    dlt_reltCsLst?: Record<string, unknown>[];
    dlt_inscrtDtsLst?: Record<string, unknown>[];
    [key: string]: unknown;
  };
}

/**
 * 전체 일반내용 렌더링
 */
export function ScourtGeneralInfoRenderer({
  basicInfoLayout,
  gridLayouts,
  apiData,
}: ScourtGeneralInfoRendererProps) {
  // API 데이터 전처리 (당사자명 등)
  const processedBasicInfo = preprocessBasicInfo(apiData.dma_csBasCtt);

  return (
    <div className="space-y-6">
      {/* 기본내용 */}
      <BasicInfoTable
        layout={basicInfoLayout}
        data={processedBasicInfo}
        className="bg-white rounded-lg border border-gray-200 p-4"
      />

      {/* 당사자내용 */}
      {gridLayouts.dlt_btprtCttLst && (
        <GridTable
          layout={gridLayouts.dlt_btprtCttLst}
          data={apiData.dlt_btprtCttLst || []}
          className="bg-white rounded-lg border border-gray-200 p-4"
        />
      )}

      {/* 대리인내용 */}
      {gridLayouts.dlt_agntCttLst && (apiData.dlt_agntCttLst?.length ?? 0) > 0 && (
        <GridTable
          layout={gridLayouts.dlt_agntCttLst}
          data={apiData.dlt_agntCttLst || []}
          className="bg-white rounded-lg border border-gray-200 p-4"
        />
      )}

      {/* 최근기일내용 */}
      {gridLayouts.dlt_rcntDxdyLst && (
        <GridTable
          layout={gridLayouts.dlt_rcntDxdyLst}
          data={apiData.dlt_rcntDxdyLst || []}
          className="bg-white rounded-lg border border-gray-200 p-4"
        />
      )}

      {/* 제출서류 */}
      {gridLayouts.dlt_rcntSbmsnDocmtLst && (apiData.dlt_rcntSbmsnDocmtLst?.length ?? 0) > 0 && (
        <GridTable
          layout={gridLayouts.dlt_rcntSbmsnDocmtLst}
          data={apiData.dlt_rcntSbmsnDocmtLst || []}
          className="bg-white rounded-lg border border-gray-200 p-4"
        />
      )}

      {/* 관련사건 */}
      {gridLayouts.dlt_reltCsLst && (apiData.dlt_reltCsLst?.length ?? 0) > 0 && (
        <GridTable
          layout={gridLayouts.dlt_reltCsLst}
          data={apiData.dlt_reltCsLst || []}
          className="bg-white rounded-lg border border-gray-200 p-4"
        />
      )}

      {/* 심급내용 */}
      {gridLayouts.dlt_inscrtDtsLst && (apiData.dlt_inscrtDtsLst?.length ?? 0) > 0 && (
        <GridTable
          layout={gridLayouts.dlt_inscrtDtsLst}
          data={apiData.dlt_inscrtDtsLst || []}
          className="bg-white rounded-lg border border-gray-200 p-4"
        />
      )}
    </div>
  );
}

// ============================================================================
// 데이터 전처리
// ============================================================================

const APL_PRPND_CODE_LABELS: Record<string, string> = {
  '01': '검사상소',
  '02': '피고인상소',
  '03': '변호인상소',
  '04': '대리인상소',
  '05': '보조인상소',
  '06': '증인상소',
  '07': '감정인상소',
  '08': '통역인상소',
  '09': '번역인상소',
  '10': '청구인상소',
  '11': '피의자상소',
  '12': '배상신청인상소',
  '13': '직권상소',
  '14': '쌍방상소',
  '99': '기타상소',
};

const CRIMINAL_SECOND_INSTANCE_CODES = new Set(['079', '115', '080', '118']);

function formatYmd(value?: string): string {
  if (!value) return '';
  if (/^\d{8}$/.test(value)) {
    return `${value.slice(0, 4)}.${value.slice(4, 6)}.${value.slice(6, 8)}`;
  }
  return value;
}

/**
 * 기본정보 데이터 전처리
 *
 * SCOURT의 JavaScript 로직을 재현:
 * - 당사자명 + 수 조합 (외 N명)
 * - 재판부 + 전화번호 조합
 * - 종국결과 날짜+내용 조합
 * - 보존/폐기 텍스트 변환
 *
 * XML의 txt_XXX ID는 아래 필드들로 매핑됨:
 * - txt_rprsClmntNm → rprsClmntNm
 * - txt_rprsAcsdNm → rprsAcsdNm
 * - txt_jdbnNm1, txt_jdbnNm2 → jdbnNm
 * - txt_csUltmtDvsNm → ultmtDvsNm (종국결과)
 * - txt_prsvCtt → prsvCtt
 */
export function preprocessBasicInfo(data: Record<string, unknown>): Record<string, unknown> {
  if (!data) return {};

  const processed = { ...data };

  // 원고명 (외 N명) - txt_rprsClmntNm이 참조
  if (data.rprsClmntNm) {
    const cnt = parseInt(String(data.clmntCnt || '1'), 10);
    const display = cnt > 1
      ? `${data.rprsClmntNm} 외 ${cnt - 1}명`
      : String(data.rprsClmntNm);
    processed.rprsClmntNm = display;  // 원래 필드 덮어쓰기
    processed.rprsClmntNmDisplay = display;
  }

  // 피고명 (외 N명) - txt_rprsAcsdNm이 참조
  if (data.rprsAcsdNm) {
    const cnt = parseInt(String(data.acsdCnt || '1'), 10);
    const display = cnt > 1
      ? `${data.rprsAcsdNm} 외 ${cnt - 1}명`
      : String(data.rprsAcsdNm);
    processed.rprsAcsdNm = display;  // 원래 필드 덮어쓰기
    processed.rprsAcsdNmDisplay = display;
  }

  // 재판부 + 전화번호 - txt_jdbnNm1, txt_jdbnNm2가 참조
  let jdbnText = String(data.jdbnNm || '');
  if (data.csUltmtYmd && data.ultmtJdbnNm) {
    jdbnText = String(data.ultmtJdbnNm);
  }
  // cfupMarkNm(주심)이 있고, jdbnNm에 아직 포함되지 않은 경우에만 추가
  if (data.cfupMarkNm && !jdbnText.includes(`(${data.cfupMarkNm})`)) {
    jdbnText += `(${data.cfupMarkNm})`;
  }
  const jdbnPhone = data.jdbnTphnGdncCtt || data.jdbnTelno;
  if (data.csPrsrvYn !== 'Y' && jdbnPhone) {
    jdbnText += ` (전화:${jdbnPhone})`;
  }
  processed.jdbnNm = jdbnText;  // 원래 필드 덮어쓰기
  processed.jdbnNmDisplay = jdbnText;

  // 종국결과 - txt_csUltmtDvsNm이 ultmtDvsNm을 참조
  // API 응답의 필드명 변형들 모두 지원:
  // - ultmtDvsNm (XML 표준)
  // - csUltmtDvsNm (일부 API 응답)
  // - csUltmtDtlCtt (종국상세내용)
  const ultmtResultNm = data.ultmtDvsNm || data.csUltmtDvsNm || data.csUltmtDtlCtt || '';

  if (data.csUltmtYmd || ultmtResultNm) {
    let ultmtDisplay = '';

    // 날짜 포맷팅
    if (data.csUltmtYmd) {
      const ymd = String(data.csUltmtYmd);
      ultmtDisplay = /^\d{8}$/.test(ymd)
        ? `${ymd.slice(0, 4)}.${ymd.slice(4, 6)}.${ymd.slice(6, 8)}`
        : ymd;
    }

    // 종국결과명 추가
    if (ultmtResultNm) {
      ultmtDisplay += ultmtDisplay ? ` ${ultmtResultNm}` : ultmtResultNm;
    }

    processed.ultmtDvsNm = ultmtDisplay;  // txt_csUltmtDvsNm → ultmtDvsNm
    processed.csUltmtDvsNm = ultmtDisplay;  // 직접 참조도 지원
    processed.csUltmtDisplay = ultmtDisplay;
  }

  // 형사 종국결과 - SSGO10GF01 JS 로직 재현
  if (!processed.ultmtDvsNm && (data.crmcsUltmtDvsNm || data.btprtUltmtYmd)) {
    const btprtUltmtYmd = String(data.btprtUltmtYmd || '');
    let showResult = false;
    if (btprtUltmtYmd && /^\d{8}$/.test(btprtUltmtYmd)) {
      const now = new Date();
      const today = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
      showResult = parseInt(btprtUltmtYmd, 10) <= parseInt(today, 10);
    }
    processed.ultmtDvsNm = showResult ? String(data.crmcsUltmtDvsNm || '') : '';
  }

  // 형사 상소제기내용 - SSGO10GF01 JS 로직 재현
  if (!processed.aplPrpndCtt) {
    const csDvsCd = typeof data.csDvsCd === 'number' ? String(data.csDvsCd) : String(data.csDvsCd || '');
    const isSecondInstance = CRIMINAL_SECOND_INSTANCE_CODES.has(csDvsCd);
    let aplPrpndCtt = '';
    let code = '';

    if (!isSecondInstance && data.apelCrmcsLwstRltnrDvsCd) {
      const dateText = formatYmd(data.acsApelPrpndYmd as string | undefined);
      aplPrpndCtt = dateText ? `${dateText} ` : '';
      code = String(data.apelCrmcsLwstRltnrDvsCd);
    } else if (isSecondInstance && data.applCrmcsLwstRltnrDvsCd) {
      const dateText = formatYmd(data.acsApplPrpndYmd as string | undefined);
      aplPrpndCtt = dateText ? `${dateText} ` : '';
      code = String(data.applCrmcsLwstRltnrDvsCd);
    }

    if (code) {
      aplPrpndCtt += APL_PRPND_CODE_LABELS[code] || '';
    }

    if (data.aplPrpndRsltYmd && data.aplPrpndRsltCd) {
      const dateText = formatYmd(data.aplPrpndRsltYmd as string | undefined);
      const resultText = String(data.aplPrpndRsltNm || '');
      const suffix = `${dateText ? `${dateText} ` : ''}${resultText}`.trim();
      if (suffix) {
        aplPrpndCtt += aplPrpndCtt ? ` / ${suffix}` : suffix;
      }
    }

    processed.aplPrpndCtt = aplPrpndCtt;
  }

  // 보존/폐기 텍스트 - txt_prsvCtt가 참조
  if (data.prsvCtt === '보존') {
    processed.prsvCtt = '기록보존됨';
    processed.prsvCttDisplay = '기록보존됨';
    processed.prsvLabel = '보존여부';
  } else if (data.prsvCtt === '폐기') {
    processed.prsvCtt = '기록폐기됨';
    processed.prsvCttDisplay = '기록폐기됨';
    processed.prsvLabel = '폐기여부';
  }

  return processed;
}
