/**
 * 표준 CSV 스키마 정의
 * 대량 사건 등록을 위한 필수/선택 필드 및 유효성 검사 규칙
 */

import type { StandardCaseRow, ClientRole, ImportError, ImportWarning } from '@/types/onboarding'
import { KOREAN_ROLE_MAP, KOREAN_COLUMN_ALIASES } from '@/types/onboarding'
import { getCaseTypeAuto } from '@/lib/constants/case-types'

// 필드 정의 타입
interface FieldDefinition {
  name: keyof StandardCaseRow
  label: string
  labelKorean: string
  type: 'string' | 'number' | 'date' | 'enum'
  required: boolean
  pattern?: RegExp
  enumValues?: string[]
  autoGenerate?: boolean
  defaultValue?: string | number
}

// 필수 필드 정의
export const REQUIRED_FIELDS: FieldDefinition[] = [
  {
    name: 'court_case_number',
    label: 'Court Case Number',
    labelKorean: '사건번호',
    type: 'string',
    required: true,
    pattern: /^(\d{4})?[가-힣]+\d+$/  // 예: 2024드단25547 또는 드단25547
  },
  {
    name: 'court_name',
    label: 'Court Name',
    labelKorean: '법원명',
    type: 'string',
    required: true
  },
  {
    name: 'client_name',
    label: 'Client Name',
    labelKorean: '의뢰인명',
    type: 'string',
    required: true
  }
]

// 선택 필드 정의
// case_type은 자동 분류로 처리되므로 사용자 입력에서 제거
export const OPTIONAL_FIELDS: FieldDefinition[] = [
  {
    name: 'case_name',
    label: 'Case Name',
    labelKorean: '사건명',
    type: 'string',
    required: false,
    autoGenerate: true  // 없으면 자동 생성
  },
  {
    name: 'client_role',
    label: 'Client Role',
    labelKorean: '의뢰인역할',
    type: 'enum',
    required: false,
    enumValues: ['plaintiff', 'defendant', 'applicant', 'respondent', 'creditor', 'debtor']
  },
  {
    name: 'opponent_name',
    label: 'Opponent Name',
    labelKorean: '상대방명',
    type: 'string',
    required: false
  },
  {
    name: 'assigned_lawyer',
    label: 'Assigned Lawyer',
    labelKorean: '담당변호사',
    type: 'string',
    required: false
  },
  {
    name: 'assigned_staff',
    label: 'Assigned Staff',
    labelKorean: '담당직원',
    type: 'string',
    required: false
  },
  {
    name: 'contract_date',
    label: 'Contract Date',
    labelKorean: '계약일',
    type: 'date',
    required: false,
    pattern: /^\d{4}-\d{2}-\d{2}$/  // YYYY-MM-DD
  },
  {
    name: 'retainer_fee',
    label: 'Retainer Fee',
    labelKorean: '착수금',
    type: 'number',
    required: false
  },
  {
    name: 'success_fee_agreement',
    label: 'Success Fee Agreement',
    labelKorean: '성공보수약정',
    type: 'string',
    required: false
  },
  {
    name: 'earned_success_fee',
    label: 'Earned Success Fee',
    labelKorean: '발생성공보수',
    type: 'number',
    required: false
  },
  {
    name: 'notes',
    label: 'Notes',
    labelKorean: '메모',
    type: 'string',
    required: false
  },
  {
    name: 'client_phone',
    label: 'Client Phone',
    labelKorean: '의뢰인연락처',
    type: 'string',
    required: false,
    pattern: /^[0-9-]+$/
  },
  {
    name: 'client_email',
    label: 'Client Email',
    labelKorean: '의뢰인이메일',
    type: 'string',
    required: false,
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  },
  {
    name: 'client_birth_date',
    label: 'Client Birth Date',
    labelKorean: '생년월일',
    type: 'date',
    required: false,
    pattern: /^\d{4}-\d{2}-\d{2}$/  // YYYY-MM-DD
  },
  {
    name: 'client_address',
    label: 'Client Address',
    labelKorean: '주소',
    type: 'string',
    required: false
  },
  {
    name: 'client_bank_account',
    label: 'Client Bank Account',
    labelKorean: '계좌번호',
    type: 'string',
    required: false
  }
]

// 모든 필드
export const ALL_FIELDS = [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS]

// 확정 열 순서 (SpreadsheetEditor용)
// 계약일 → 담당변호사 → 담당직원 → 법원명 → 사건번호 → 사건명 → 의뢰인명 → 상대방명 →
// 착수금 → 성공보수약정 → 발생성공보수 → 의뢰인연락처 → 계좌번호 → 의뢰인이메일 → 생년월일 → 주소 → 메모
export const COLUMN_ORDER: (keyof StandardCaseRow)[] = [
  'contract_date',
  'assigned_lawyer',
  'assigned_staff',
  'court_name',
  'court_case_number',
  'case_name',
  'client_name',
  'opponent_name',
  'retainer_fee',
  'success_fee_agreement',
  'earned_success_fee',
  'client_phone',
  'client_bank_account',
  'client_email',
  'client_birth_date',
  'client_address',
  'notes',
]

// 필드명으로 필드 정의 찾기
export function getFieldDefinition(fieldName: keyof StandardCaseRow): FieldDefinition | undefined {
  return ALL_FIELDS.find(f => f.name === fieldName)
}

/**
 * 컬럼명 정규화 (한글 → 영문)
 */
export function normalizeColumnName(column: string): keyof StandardCaseRow | null {
  const trimmed = column.trim().toLowerCase()

  // 영문 필드명 체크
  const field = ALL_FIELDS.find(f => f.name === trimmed || f.label.toLowerCase() === trimmed)
  if (field) return field.name

  // 한글 별칭 체크
  const aliasKey = Object.keys(KOREAN_COLUMN_ALIASES).find(
    k => k === column.trim() || k.toLowerCase() === trimmed
  )
  if (aliasKey) return KOREAN_COLUMN_ALIASES[aliasKey]

  return null
}

/**
 * 역할 정규화 (한글 → 영문)
 */
export function normalizeRole(role: string): ClientRole | null {
  const trimmed = role.trim()

  // 이미 영문인 경우
  const validRoles: ClientRole[] = ['plaintiff', 'defendant', 'applicant', 'respondent', 'creditor', 'debtor']
  if (validRoles.includes(trimmed as ClientRole)) {
    return trimmed as ClientRole
  }

  // 한글 역할 매핑
  return KOREAN_ROLE_MAP[trimmed] || null
}

/**
 * 단일 행 유효성 검사
 */
export function validateRow(row: Partial<StandardCaseRow>, _rowIndex: number): { isValid: boolean; errors: ImportError[]; warnings: ImportWarning[] } {
  const errors: ImportError[] = []
  const warnings: ImportWarning[] = []

  // 필수 필드 체크
  for (const field of REQUIRED_FIELDS) {
    const value = row[field.name]
    if (!value || (typeof value === 'string' && value.trim() === '')) {
      errors.push({
        field: field.name,
        errorCode: 'REQUIRED_FIELD_MISSING',
        message: `필수 필드 "${field.labelKorean}"이(가) 비어있습니다`
      })
    }
  }

  // 필드별 유효성 검사
  for (const field of ALL_FIELDS) {
    const value = row[field.name]
    if (!value) continue

    // 패턴 검사
    if (field.pattern && typeof value === 'string') {
      if (!field.pattern.test(value)) {
        if (field.required) {
          errors.push({
            field: field.name,
            errorCode: 'INVALID_FORMAT',
            message: `"${field.labelKorean}" 형식이 올바르지 않습니다`,
            originalValue: value
          })
        } else {
          warnings.push({
            field: field.name,
            message: `"${field.labelKorean}" 형식이 올바르지 않습니다`,
            suggestion: field.name === 'contract_date' ? 'YYYY-MM-DD 형식으로 입력해주세요' : undefined
          })
        }
      }
    }

    // 열거형 검사
    if (field.type === 'enum' && field.enumValues && typeof value === 'string') {
      const normalized = normalizeRole(value)
      if (!normalized && value.trim() !== '') {
        warnings.push({
          field: field.name,
          message: `알 수 없는 역할입니다: "${value}"`,
          suggestion: `사용 가능한 값: ${Object.keys(KOREAN_ROLE_MAP).join(', ')}`
        })
      }
    }

    // 숫자 필드 검사
    if (field.type === 'number') {
      const num = typeof value === 'number' ? value : parseFloat(String(value).replace(/,/g, ''))
      if (isNaN(num)) {
        warnings.push({
          field: field.name,
          message: `"${field.labelKorean}"은(는) 숫자여야 합니다`,
          suggestion: '숫자만 입력해주세요 (예: 3000000)'
        })
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * 원본 데이터를 표준 형식으로 변환
 */
export function convertToStandardRow(
  rawRow: Record<string, string>,
  columnMapping?: Map<string, keyof StandardCaseRow>
): Partial<StandardCaseRow> {
  const result: Partial<StandardCaseRow> = {}

  for (const [column, value] of Object.entries(rawRow)) {
    if (!value || value.trim() === '') continue

    // 컬럼 매핑 사용 또는 자동 감지
    let targetField: keyof StandardCaseRow | null = null
    if (columnMapping) {
      targetField = columnMapping.get(column) || null
    } else {
      targetField = normalizeColumnName(column)
    }

    if (!targetField) continue

    // 값 변환
    const fieldDef = getFieldDefinition(targetField)
    if (!fieldDef) continue

    switch (fieldDef.type) {
      case 'number':
        const num = parseFloat(value.replace(/,/g, ''))
        if (!isNaN(num)) {
          (result as Record<string, unknown>)[targetField] = num
        }
        break

      case 'enum':
        if (targetField === 'client_role') {
          const normalized = normalizeRole(value)
          if (normalized) {
            result.client_role = normalized
          }
        }
        break

      case 'date':
        // 다양한 날짜 형식 처리
        const dateStr = parseDateString(value)
        if (dateStr) {
          (result as Record<string, unknown>)[targetField] = dateStr
        }
        break

      default:
        (result as Record<string, unknown>)[targetField] = value.trim()
    }
  }

  return result
}

/**
 * 날짜 문자열 파싱 (다양한 형식 지원)
 */
function parseDateString(value: string): string | null {
  const trimmed = value.trim()

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed
  }

  // YYYY.MM.DD
  if (/^\d{4}\.\d{2}\.\d{2}$/.test(trimmed)) {
    return trimmed.replace(/\./g, '-')
  }

  // YYYY/MM/DD
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(trimmed)) {
    return trimmed.replace(/\//g, '-')
  }

  // YYYYMMDD
  if (/^\d{8}$/.test(trimmed)) {
    return `${trimmed.slice(0, 4)}-${trimmed.slice(4, 6)}-${trimmed.slice(6, 8)}`
  }

  return null
}

/**
 * 기본값 적용
 */
export function applyDefaults(row: Partial<StandardCaseRow>): StandardCaseRow & { case_type: string } {
  const result = { ...row } as StandardCaseRow & { case_type: string }

  // case_type 자동 분류 (사용자 입력 없음, 항상 자동 분류)
  const autoType = getCaseTypeAuto(result.court_case_number, result.case_name)
  result.case_type = autoType || '기타'

  // case_name 자동 생성
  if (!result.case_name) {
    if (result.client_name && result.case_type) {
      result.case_name = `${result.client_name} ${result.case_type}`
    } else if (result.court_case_number) {
      result.case_name = result.court_case_number
    }
  }

  // contract_date 기본값 (오늘)
  if (!result.contract_date) {
    result.contract_date = new Date().toISOString().split('T')[0]
  }

  return result
}

/**
 * 샘플 CSV 생성
 */
export function generateSampleCSV(): string {
  const headers = ALL_FIELDS.map(f => f.labelKorean).join(',')
  const sampleRow = [
    '2024드단25547',        // 사건번호
    '수원가정법원 평택지원', // 법원명
    '김철수',               // 의뢰인명
    '김철수 이혼',          // 사건명
    '이혼',                 // 사건유형
    '원고',                 // 의뢰인역할
    '이영희',               // 상대방명
    '변호사이름',           // 담당변호사
    '',                    // 담당직원
    '2024-01-15',          // 계약일
    '3000000',             // 착수금
    '',                    // 성공보수약정
    '',                    // 메모
    '010-1234-5678',       // 의뢰인연락처
    'client@example.com'   // 의뢰인이메일
  ].join(',')

  return `${headers}\n${sampleRow}`
}

/**
 * 템플릿 CSV 생성 (헤더만)
 */
export function generateTemplateCSV(): string {
  return ALL_FIELDS.map(f => f.labelKorean).join(',')
}
