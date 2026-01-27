/**
 * SCOURT 일반내용 동적 렌더링 컴포넌트
 *
 * API 응답 구조를 그대로 재현:
 * - dma_csBasCtt → Key-Value 섹션 (기본정보)
 * - dlt_* → 테이블 섹션 (당사자, 대리인, 기일 등)
 *
 * 목표: SCOURT "일반내용" 100% 재현, 버리는 데이터 없음
 */

import React from "react";
import {
  parseBasicInfo,
  parseFullApiResponse,
  extractRawApiData,
  VisibleField,
  getVisibleFields,
  sortFields,
} from "@/lib/scourt/field-renderer";

/** Legacy party for backward compatibility */
interface LegacyParty {
  btprtStndngNm?: string;
  partyType?: string;
  btprtNm?: string;
  name?: string;
  csUltmtDvsNm?: string;
  result?: string;
  csUltmtYmd?: string;
  resultDate?: string;
}

/** Legacy representative for backward compatibility */
interface LegacyRepresentative {
  btprtRltnCtt?: string;
  relation?: string;
  agntNm?: string;
  name?: string;
  jdafrCorpNm?: string;
  lawFirm?: string;
}

interface ScourtGeneralInfoProps {
  /** scourt_snapshot 테이블에서 가져온 raw 데이터 (전체 snapshot 객체 또는 basicInfo) */
  snapshotData: Record<string, unknown> | null;
  /** 컴팩트 모드 (기본정보만 표시) */
  compact?: boolean;
  /** 표시할 테이블 목록 (기본: 전체) */
  showTables?: string[];
}

/**
 * SCOURT 일반내용 전체 렌더링
 */
export function ScourtGeneralInfo({
  snapshotData,
  compact = false,
  showTables,
}: ScourtGeneralInfoProps) {
  // raw API 데이터 추출 시도
  const rawData = snapshotData ? extractRawApiData(snapshotData) : null;

  // raw API 데이터가 있으면 동적 렌더링
  if (rawData) {
    const parsed = parseFullApiResponse(rawData);

    return (
      <div className="space-y-6">
        {/* 기본정보 섹션 */}
        <BasicInfoSection data={parsed.basicInfo} />

        {/* 테이블 섹션들 (compact 모드가 아닐 때만) */}
        {!compact &&
          parsed.tables
            .filter((table) => !showTables || showTables.includes(table.key))
            .map((table) => (
              <TableSection
                key={table.key}
                title={table.title}
                columns={table.columns}
                columnLabels={table.columnLabels}
                rows={table.rows}
              />
            ))}
      </div>
    );
  }

  // Fallback: 기존 형식 데이터 (한글 키)
  // basicInfo가 직접 전달되었거나 snapshot.basicInfo 형태일 때
  interface LegacyBasicInfoType {
    parties?: LegacyParty[];
    representatives?: LegacyRepresentative[];
    [key: string]: unknown;
  }
  const snapshotObj = snapshotData as { basicInfo?: LegacyBasicInfoType } | null;
  const legacyBasicInfo: LegacyBasicInfoType | undefined = snapshotObj?.basicInfo || (snapshotData as LegacyBasicInfoType | undefined);
  if (legacyBasicInfo && typeof legacyBasicInfo === 'object') {
    const fields = getVisibleFields(legacyBasicInfo as Record<string, unknown>);
    const sortedFields = sortFields(fields);

    if (sortedFields.length > 0) {
      return (
        <div className="space-y-6">
          <LegacyBasicInfoSection fields={sortedFields} />

          {/* 기존 parties/representatives 테이블 */}
          {!compact && legacyBasicInfo.parties && legacyBasicInfo.parties.length > 0 && (
            <LegacyPartyTable
              title="당사자"
              parties={legacyBasicInfo.parties}
            />
          )}
          {!compact && legacyBasicInfo.representatives && legacyBasicInfo.representatives.length > 0 && (
            <LegacyRepresentativeTable
              title="대리인"
              representatives={legacyBasicInfo.representatives}
            />
          )}
        </div>
      );
    }
  }

  return (
    <div className="text-[var(--text-tertiary)] text-sm p-4">
      SCOURT 연동 데이터가 없습니다.
    </div>
  );
}

/**
 * 기본정보 Key-Value 섹션
 */
interface BasicInfoSectionProps {
  data: Record<string, unknown>;
}

export function BasicInfoSection({ data }: BasicInfoSectionProps) {
  const fields = parseBasicInfo(data);

  if (fields.length === 0) {
    return null;
  }

  // 필드를 그룹으로 나누기 (법원/사건/당사자/일자/금액/결과)
  const groups = groupFields(fields);

  return (
    <div className="card overflow-hidden">
      <div className="bg-[var(--bg-primary)] px-4 py-2 border-b border-[var(--border-default)]">
        <h3 className="text-sm font-medium text-[var(--text-secondary)]">기본정보</h3>
      </div>
      <div className="divide-y divide-[var(--border-subtle)]">
        {groups.map((group, idx) => (
          <div key={idx} className="px-4 py-3">
            <dl className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-2">
              {group.map((field) => (
                <FieldItem key={field.key} field={field} />
              ))}
            </dl>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * 개별 필드 항목
 */
function FieldItem({ field }: { field: VisibleField }) {
  const displayValue = field.value != null ? String(field.value) : '';
  return (
    <div className="flex flex-col">
      <dt className="text-xs text-[var(--text-tertiary)]">{field.label}</dt>
      <dd className="text-sm text-[var(--text-primary)] font-medium truncate" title={displayValue}>
        {displayValue}
      </dd>
    </div>
  );
}

/**
 * 테이블 섹션
 */
interface TableSectionProps {
  title: string;
  columns: string[];
  columnLabels: string[];
  rows: Record<string, unknown>[];
}

export function TableSection({
  title,
  columns,
  columnLabels,
  rows,
}: TableSectionProps) {
  if (rows.length === 0) {
    return null;
  }

  return (
    <div className="card overflow-hidden">
      <div className="bg-[var(--bg-primary)] px-4 py-2 border-b border-[var(--border-default)]">
        <h3 className="text-sm font-medium text-[var(--text-secondary)]">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-[var(--border-default)]">
          <thead className="bg-[var(--bg-primary)]">
            <tr>
              {columnLabels.map((label, idx) => (
                <th
                  key={idx}
                  scope="col"
                  className="px-4 py-2 text-left text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-[var(--bg-secondary)] divide-y divide-[var(--border-default)]">
            {rows.map((row, rowIdx) => (
              <tr key={rowIdx} className="hover:bg-[var(--bg-hover)]">
                {columns.map((col, colIdx) => (
                  <td
                    key={colIdx}
                    className="px-4 py-2 text-sm text-[var(--text-primary)] whitespace-nowrap"
                  >
                    {row[col] != null ? String(row[col]) : "-"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * 당사자 테이블 특화 컴포넌트
 * API의 titRprsPtnr, titRprsRqstr 라벨을 사용
 */
interface PartyTableProps {
  rawData: Record<string, unknown>;
}

interface PartyItem {
  btprtStndngNm?: string;
  btprtDvsNm?: string;
  btprtNm?: string;
  csUltmtDvsNm?: string;
}

export function PartyTable({ rawData }: PartyTableProps) {
  const parties = rawData?.dlt_btprtCttLst;
  if (!parties || !Array.isArray(parties) || parties.length === 0) {
    return null;
  }

  // API가 제공하는 당사자 라벨 (원고측/피고측)
  const dma = rawData?.dma_csBasCtt as Record<string, unknown> | undefined;
  const _plaintiffLabel = (dma?.titRprsPtnr as string) || "원고";
  const _defendantLabel = (dma?.titRprsRqstr as string) || "피고";

  // 당사자를 유형별로 그룹화
  const grouped: Record<string, PartyItem[]> = {};
  for (const party of parties as PartyItem[]) {
    const type = party.btprtStndngNm || party.btprtDvsNm || "기타";
    if (!grouped[type]) grouped[type] = [];
    grouped[type].push(party);
  }

  return (
    <div className="card overflow-hidden">
      <div className="bg-[var(--bg-primary)] px-4 py-2 border-b border-[var(--border-default)]">
        <h3 className="text-sm font-medium text-[var(--text-secondary)]">당사자</h3>
      </div>
      <div className="p-4 space-y-4">
        {Object.entries(grouped).map(([type, partyList]) => (
          <div key={type}>
            <h4 className="text-xs font-medium text-[var(--text-tertiary)] mb-2">{type}</h4>
            <ul className="space-y-1">
              {partyList.map((party, idx) => (
                <li key={idx} className="text-sm text-[var(--text-primary)]">
                  {party.btprtNm}
                  {party.csUltmtDvsNm && (
                    <span className="ml-2 text-xs text-[var(--text-tertiary)]">
                      ({party.csUltmtDvsNm})
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * 필드를 논리적 그룹으로 분류
 */
function groupFields(fields: VisibleField[]): VisibleField[][] {
  const groups: Record<string, VisibleField[]> = {
    case: [], // 법원, 사건번호, 사건명, 재판부
    party: [], // 원고, 피고, 채권자, 채무자 등
    date: [], // 접수일, 종국일, 확정일 등
    amount: [], // 인지액, 청구금액, 소가 등
    result: [], // 종국결과, 상소결과 등
    other: [], // 기타
  };

  const caseKeys = new Set([
    "cortNm",
    "userCsNo",
    "csNm",
    "jdbnNm",
    "jdbnTelno",
    "telNo",
    "csMrgTypNm",
    "csTkpDvsNm",
    "csTkpDvsCdNm",
  ]);

  const partyKeys = new Set([
    "rprsClmntNm",
    "rprsAcsdNm",
    "rprsPtnrNm",
    "rprsRqstrNm",
    "rprsAplcntNm",
    "rprsRspndnNm",
    "btprtNm",
    "thrdDbtrNm",
    "rprsGrnshNm",
    "clmntCnt",
    "acsdCnt",
    "ptnrCnt",
    "rqstrCnt",
    "grnshCnt",
    "prwlCnt",
    "rhblCmsnrNm",
    "rhblCmsnrTelno",
  ]);

  const dateKeys = new Set([
    "csRcptYmd",
    "csUltmtYmd",
    "csCfmtnYmd",
    "adjdocRchYmd",
    "aplYmd",
    "aplRjctnYmd",
    "dcsnstDlvrYmd",
    "prwcChgYmd",
    "csCmdcYmd",
    "crdtrDdlnYmd",
    "repayKjDay",
    "acsApelPrpndYmd",
    "aplPrpndRsltYmd",
    "btprtUltmtYmd",
    "btprtCfmtnYmd",
  ]);

  const amountKeys = new Set([
    "stmpAtchAmt",
    "clmntVsml",
    "acsdVsml",
    "csClmAmt",
    "stmpRfndAmt",
  ]);

  const resultKeys = new Set([
    "csUltmtDvsNm",
    "csUltmtDtlCtt",
    "csPrsrvYn",
    "aplPrpndRsltNm",
    "btprtUltmtThrstCtt",
    "crmcsUltmtDvsNm",
  ]);

  for (const field of fields) {
    if (caseKeys.has(field.key)) {
      groups.case.push(field);
    } else if (partyKeys.has(field.key)) {
      groups.party.push(field);
    } else if (dateKeys.has(field.key)) {
      groups.date.push(field);
    } else if (amountKeys.has(field.key)) {
      groups.amount.push(field);
    } else if (resultKeys.has(field.key)) {
      groups.result.push(field);
    } else {
      groups.other.push(field);
    }
  }

  // 빈 그룹 제외하고 반환
  return Object.values(groups).filter((g) => g.length > 0);
}

// ============================================================================
// Legacy 컴포넌트 (기존 한글 키 형식 데이터용)
// ============================================================================

/**
 * 기존 형식 기본정보 섹션
 */
function LegacyBasicInfoSection({ fields }: { fields: VisibleField[] }) {
  return (
    <div className="card overflow-hidden">
      <div className="bg-[var(--bg-primary)] px-4 py-2 border-b border-[var(--border-default)]">
        <h3 className="text-sm font-medium text-[var(--text-secondary)]">기본정보</h3>
      </div>
      <div className="px-4 py-3">
        <dl className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-2">
          {fields.map((field) => {
            const displayValue = field.value != null ? String(field.value) : '';
            return (
              <div key={field.key} className="flex flex-col">
                <dt className="text-xs text-[var(--text-tertiary)]">{field.label}</dt>
                <dd className="text-sm text-[var(--text-primary)] font-medium truncate" title={displayValue}>
                  {displayValue}
                </dd>
              </div>
            );
          })}
        </dl>
      </div>
    </div>
  );
}

/**
 * 기존 형식 당사자 테이블
 */
function LegacyPartyTable({ title, parties }: { title: string; parties: LegacyParty[] }) {
  if (!parties || parties.length === 0) return null;

  return (
    <div className="card overflow-hidden">
      <div className="bg-[var(--bg-primary)] px-4 py-2 border-b border-[var(--border-default)]">
        <h3 className="text-sm font-medium text-[var(--text-secondary)]">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-[var(--border-default)]">
          <thead className="bg-[var(--bg-primary)]">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-[var(--text-tertiary)]">구분</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-[var(--text-tertiary)]">이름</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-[var(--text-tertiary)]">종국결과</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-[var(--text-tertiary)]">종국일</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-default)]">
            {parties.map((party, idx) => (
              <tr key={idx} className="hover:bg-[var(--bg-hover)]">
                <td className="px-4 py-2 text-sm text-[var(--text-primary)]">
                  {party.btprtStndngNm || party.partyType || '-'}
                </td>
                <td className="px-4 py-2 text-sm text-[var(--text-primary)]">
                  {party.btprtNm || party.name || '-'}
                </td>
                <td className="px-4 py-2 text-sm text-[var(--text-primary)]">
                  {party.csUltmtDvsNm || party.result || '-'}
                </td>
                <td className="px-4 py-2 text-sm text-[var(--text-primary)]">
                  {party.csUltmtYmd || party.resultDate || '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * 기존 형식 대리인 테이블
 */
function LegacyRepresentativeTable({ title, representatives }: { title: string; representatives: LegacyRepresentative[] }) {
  if (!representatives || representatives.length === 0) return null;

  return (
    <div className="card overflow-hidden">
      <div className="bg-[var(--bg-primary)] px-4 py-2 border-b border-[var(--border-default)]">
        <h3 className="text-sm font-medium text-[var(--text-secondary)]">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-[var(--border-default)]">
          <thead className="bg-[var(--bg-primary)]">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-[var(--text-tertiary)]">관계</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-[var(--text-tertiary)]">대리인</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-[var(--text-tertiary)]">법무법인</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-default)]">
            {representatives.map((rep, idx) => (
              <tr key={idx} className="hover:bg-[var(--bg-hover)]">
                <td className="px-4 py-2 text-sm text-[var(--text-primary)]">
                  {rep.btprtRltnCtt || rep.relation || '-'}
                </td>
                <td className="px-4 py-2 text-sm text-[var(--text-primary)]">
                  {rep.agntNm || rep.name || '-'}
                </td>
                <td className="px-4 py-2 text-sm text-[var(--text-primary)]">
                  {rep.jdafrCorpNm || rep.lawFirm || '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ScourtGeneralInfo;
