/**
 * AI 컬럼 매퍼 (Gemini 기반)
 * 비표준 파일의 컬럼을 표준 형식으로 매핑
 */

import { getAIClient, isAIAvailable } from '@/lib/ai/simple-ai-client'
import type { ColumnMappingResult, StandardCaseRow, ColumnMapping } from '@/types/onboarding'
import { ALL_FIELDS, normalizeColumnName } from './csv-schema'

// AI 매핑용 시스템 프롬프트
const SYSTEM_PROMPT = `당신은 법률사무소 사건관리 시스템의 CSV 데이터 변환 전문가입니다.
사용자가 업로드한 파일의 컬럼을 표준 형식으로 매핑해야 합니다.

## 표준 필드 목록

### 필수 필드
- court_case_number (사건번호): 법원 사건번호 (예: 2024드단25547, 2024가합12345)
- court_name (법원명): 법원 이름 (예: 서울가정법원, 수원지방법원)
- client_name (의뢰인명): 의뢰인의 이름

### 선택 필드
- case_name (사건명): 사건 제목/이름
- case_type (사건유형): 이혼, 재산분할, 양육권, 위자료, 상간소송, 가처분 등
- client_role (의뢰인역할): plaintiff(원고), defendant(피고), applicant(신청인), respondent(피신청인), creditor(채권자), debtor(채무자)
- opponent_name (상대방명): 상대방 이름
- assigned_lawyer (담당변호사): 담당 변호사 이름 또는 ID
- assigned_staff (담당직원): 담당 직원 이름 또는 ID
- contract_date (계약일): 계약/수임일 (YYYY-MM-DD)
- retainer_fee (착수금): 착수금 금액 (숫자)
- success_fee_agreement (성공보수약정): 성공보수 약정 내용
- notes (메모): 비고/메모
- client_phone (의뢰인연락처): 의뢰인 전화번호
- client_email (의뢰인이메일): 의뢰인 이메일

## 매핑 규칙
1. 컬럼명이 한글이면 해당하는 영문 필드로 매핑
2. 유사한 의미의 컬럼을 적절한 필드로 매핑
3. 매핑할 수 없는 컬럼은 targetField를 null로 설정
4. 신뢰도(confidence)는 0.0~1.0 사이로 설정
   - 1.0: 정확히 일치
   - 0.8~0.9: 높은 확신 (유사한 이름)
   - 0.5~0.7: 보통 확신 (샘플 데이터 기반 추론)
   - 0.5 미만: 낮은 확신

## 응답 형식
반드시 아래 JSON 형식으로만 응답하세요:
{
  "mappings": [
    {
      "sourceColumn": "원본 컬럼명",
      "targetField": "표준 필드명 또는 null",
      "confidence": 0.0-1.0,
      "reasoning": "매핑 이유 (간단히)"
    }
  ],
  "unmappedColumns": ["매핑 불가 컬럼들"],
  "suggestions": ["데이터 품질 개선 제안"]
}`

/**
 * AI를 사용한 컬럼 매핑 분석
 */
export async function analyzeColumnMapping(
  columns: string[],
  sampleRows: Record<string, string>[]
): Promise<ColumnMappingResult> {
  // AI가 사용 불가능하면 휴리스틱 매핑 사용
  if (!isAIAvailable()) {
    console.log('[AI Column Mapper] AI 사용 불가, 휴리스틱 매핑 사용')
    return heuristicMapping(columns, sampleRows)
  }

  const aiClient = getAIClient()

  const prompt = `## 파일 정보

### 컬럼 목록
${JSON.stringify(columns, null, 2)}

### 샘플 데이터 (첫 3행)
${JSON.stringify(sampleRows.slice(0, 3), null, 2)}

각 컬럼을 표준 필드에 매핑해주세요.`

  try {
    const result = await aiClient.completeJSON<ColumnMappingResult>(prompt, SYSTEM_PROMPT)

    // 결과 검증 및 보정
    return validateAndNormalizeMappingResult(result, columns)
  } catch (error) {
    console.error('[AI Column Mapper] AI 매핑 실패:', error)
    // 폴백: 휴리스틱 매핑
    return heuristicMapping(columns, sampleRows)
  }
}

/**
 * 휴리스틱 기반 컬럼 매핑 (AI 사용 불가 시)
 */
function heuristicMapping(
  columns: string[],
  sampleRows: Record<string, string>[]
): ColumnMappingResult {
  const mappings: ColumnMappingResult['mappings'] = []
  const unmappedColumns: string[] = []
  const suggestions: string[] = []

  for (const column of columns) {
    const normalized = normalizeColumnName(column)

    if (normalized) {
      mappings.push({
        sourceColumn: column,
        targetField: normalized,
        confidence: 0.9,
        reasoning: '컬럼명 직접 매칭'
      })
    } else {
      // 샘플 데이터 기반 추론 시도
      const inferred = inferFieldFromSamples(column, sampleRows)

      if (inferred) {
        mappings.push({
          sourceColumn: column,
          targetField: inferred.field,
          confidence: inferred.confidence,
          reasoning: inferred.reasoning
        })
      } else {
        mappings.push({
          sourceColumn: column,
          targetField: null,
          confidence: 0,
          reasoning: '매핑 불가'
        })
        unmappedColumns.push(column)
      }
    }
  }

  // 필수 필드 누락 체크
  const mappedFields = mappings.map(m => m.targetField).filter(Boolean)
  const requiredFields = ['court_case_number', 'court_name', 'client_name']

  for (const required of requiredFields) {
    if (!mappedFields.includes(required as keyof StandardCaseRow)) {
      suggestions.push(`필수 필드 "${required}"에 매핑되는 컬럼이 없습니다. 수동으로 매핑해주세요.`)
    }
  }

  return { mappings, unmappedColumns, suggestions }
}

/**
 * 샘플 데이터 기반 필드 추론
 */
function inferFieldFromSamples(
  column: string,
  sampleRows: Record<string, string>[]
): { field: keyof StandardCaseRow; confidence: number; reasoning: string } | null {
  const samples = sampleRows.map(r => r[column]).filter(Boolean)
  if (samples.length === 0) return null

  // 사건번호 패턴 체크
  const caseNumberPattern = /\d{4}[가-힣]+\d+/
  if (samples.some(s => caseNumberPattern.test(s))) {
    return {
      field: 'court_case_number',
      confidence: 0.7,
      reasoning: '사건번호 패턴 감지'
    }
  }

  // 전화번호 패턴 체크
  const phonePattern = /^0[0-9]{1,2}-?[0-9]{3,4}-?[0-9]{4}$/
  if (samples.some(s => phonePattern.test(s.replace(/\s/g, '')))) {
    return {
      field: 'client_phone',
      confidence: 0.8,
      reasoning: '전화번호 패턴 감지'
    }
  }

  // 이메일 패턴 체크
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (samples.some(s => emailPattern.test(s))) {
    return {
      field: 'client_email',
      confidence: 0.9,
      reasoning: '이메일 패턴 감지'
    }
  }

  // 날짜 패턴 체크
  const datePattern = /^\d{4}[-./]\d{2}[-./]\d{2}$/
  if (samples.some(s => datePattern.test(s))) {
    return {
      field: 'contract_date',
      confidence: 0.6,
      reasoning: '날짜 패턴 감지'
    }
  }

  // 숫자 (금액) 패턴 체크
  const numberPattern = /^[\d,]+$/
  const allNumbers = samples.every(s => numberPattern.test(s.replace(/\s/g, '')))
  if (allNumbers && samples.some(s => parseInt(s.replace(/,/g, '')) > 100000)) {
    return {
      field: 'retainer_fee',
      confidence: 0.5,
      reasoning: '금액 패턴 감지'
    }
  }

  // 법원명 패턴 체크
  const courtPattern = /법원|지원|지청/
  if (samples.some(s => courtPattern.test(s))) {
    return {
      field: 'court_name',
      confidence: 0.8,
      reasoning: '법원명 패턴 감지'
    }
  }

  return null
}

/**
 * 매핑 결과 검증 및 정규화
 */
function validateAndNormalizeMappingResult(
  result: ColumnMappingResult,
  originalColumns: string[]
): ColumnMappingResult {
  const validFields = ALL_FIELDS.map(f => f.name)
  const normalizedMappings: ColumnMappingResult['mappings'] = []

  // 각 매핑 검증
  for (const mapping of result.mappings) {
    if (mapping.targetField && !validFields.includes(mapping.targetField)) {
      // 유효하지 않은 필드명 → null로 변경
      normalizedMappings.push({
        ...mapping,
        targetField: null,
        reasoning: `${mapping.reasoning} (유효하지 않은 필드)`
      })
    } else {
      normalizedMappings.push(mapping)
    }
  }

  // 누락된 컬럼 추가
  const mappedColumns = normalizedMappings.map(m => m.sourceColumn)
  for (const column of originalColumns) {
    if (!mappedColumns.includes(column)) {
      normalizedMappings.push({
        sourceColumn: column,
        targetField: null,
        confidence: 0,
        reasoning: 'AI가 매핑하지 않음'
      })
    }
  }

  // 중복 targetField 체크
  const usedFields = new Set<string>()
  const suggestions = [...(result.suggestions || [])]

  for (const mapping of normalizedMappings) {
    if (mapping.targetField) {
      if (usedFields.has(mapping.targetField)) {
        suggestions.push(
          `"${mapping.targetField}" 필드에 여러 컬럼이 매핑되었습니다. 확인이 필요합니다.`
        )
      }
      usedFields.add(mapping.targetField)
    }
  }

  // unmappedColumns 재계산
  const unmappedColumns = normalizedMappings
    .filter(m => !m.targetField)
    .map(m => m.sourceColumn)

  return {
    mappings: normalizedMappings,
    unmappedColumns,
    suggestions
  }
}

/**
 * 매핑 결과를 Map으로 변환
 */
export function mappingResultToMap(
  result: ColumnMappingResult
): Map<string, keyof StandardCaseRow> {
  const map = new Map<string, keyof StandardCaseRow>()

  for (const mapping of result.mappings) {
    if (mapping.targetField) {
      map.set(mapping.sourceColumn, mapping.targetField)
    }
  }

  return map
}

/**
 * 매핑 신뢰도 계산
 */
export function calculateOverallConfidence(result: ColumnMappingResult): number {
  const validMappings = result.mappings.filter(m => m.targetField)
  if (validMappings.length === 0) return 0

  const sum = validMappings.reduce((acc, m) => acc + m.confidence, 0)
  return sum / validMappings.length
}

/**
 * 필수 필드 매핑 여부 확인
 */
export function hasRequiredFieldsMapped(result: ColumnMappingResult): boolean {
  const mappedFields = result.mappings
    .filter(m => m.targetField)
    .map(m => m.targetField)

  const requiredFields = ['court_case_number', 'court_name', 'client_name']
  return requiredFields.every(f => mappedFields.includes(f as keyof StandardCaseRow))
}

/**
 * ColumnMapping 배열로 변환 (UI용)
 */
export function toColumnMappingArray(result: ColumnMappingResult): ColumnMapping[] {
  return result.mappings.map(m => ({
    sourceColumn: m.sourceColumn,
    targetField: m.targetField,
    confidence: m.confidence,
    sampleValues: [] // 나중에 채워짐
  }))
}
