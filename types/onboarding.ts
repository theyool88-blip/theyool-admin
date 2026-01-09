/**
 * 대량 사건 등록 시스템 타입 정의
 */

// 당사자 역할 타입 (기존 PartyType과 호환)
export type ClientRole =
  | 'plaintiff'    // 원고
  | 'defendant'    // 피고
  | 'applicant'    // 신청인
  | 'respondent'   // 피신청인
  | 'creditor'     // 채권자
  | 'debtor'       // 채무자

// 표준 CSV 행 데이터
export interface StandardCaseRow {
  // 필수 필드
  court_case_number: string    // 사건번호 (예: 2024드단25547)
  court_name: string           // 법원명 (예: 수원가정법원 평택지원)
  client_name: string          // 의뢰인명

  // 선택 필드 (자동 처리됨)
  case_name?: string           // 사건명 (없으면 자동 생성)
  case_type?: string           // 사건유형 (없으면 "기타")
  client_role?: ClientRole     // 의뢰인 역할
  opponent_name?: string       // 상대방명
  assigned_lawyer?: string     // 담당변호사 (이름 또는 ID)
  assigned_staff?: string      // 담당직원 (이름 또는 ID)
  contract_date?: string       // 계약일 (YYYY-MM-DD)
  retainer_fee?: number        // 착수금 (원)
  success_fee_agreement?: string // 성공보수 약정
  notes?: string               // 메모
  client_phone?: string        // 의뢰인 연락처
  client_email?: string        // 의뢰인 이메일
}

// 파싱된 파일 결과
export interface ParsedFile {
  columns: string[]
  rows: Record<string, string>[]
  file_type: 'csv' | 'xlsx' | 'casenote'
  detected_encoding?: string
  row_count: number
}

// 컬럼 매핑 정보
export interface ColumnMapping {
  sourceColumn: string                          // 원본 파일의 컬럼명
  targetField: keyof StandardCaseRow | null     // 매핑된 표준 필드
  confidence: number                            // AI 매핑 신뢰도 (0-1)
  sampleValues: string[]                        // 샘플 값 (매핑 확인용)
}

// AI 매핑 결과
export interface ColumnMappingResult {
  mappings: Array<{
    sourceColumn: string
    targetField: keyof StandardCaseRow | null
    confidence: number
    reasoning: string
  }>
  unmappedColumns: string[]
  suggestions: string[]
}

// 가져오기 옵션
export interface ImportOptions {
  duplicateHandling: 'skip' | 'update' | 'error'  // 중복 사건 처리
  createNewClients: boolean                        // 신규 의뢰인 자동 생성
  linkScourt: boolean                              // SCOURT 연동 시도
  scourtDelayMs: number                            // SCOURT API 호출 간격
  dryRun: boolean                                  // 테스트 모드
}

// 가져오기 에러
export interface ImportError {
  field: string
  errorCode: string
  message: string
  originalValue?: string
}

// 가져오기 경고
export interface ImportWarning {
  field: string
  message: string
  suggestion?: string
}

// 단일 행 가져오기 결과
export interface ImportResult {
  rowIndex: number
  status: 'success' | 'failed' | 'partial' | 'skipped' | 'updated'
  originalData: Record<string, string>

  // 생성/연결된 데이터
  created?: {
    caseId?: string
    caseName?: string
    clientId?: string
    clientName?: string
    isNewClient?: boolean
  }

  // 오류 및 경고
  errors: ImportError[]
  warnings: ImportWarning[]

  // SCOURT 연동 결과
  scourtLinked?: boolean
  encCsNo?: string
}

// 가져오기 보고서
export interface ImportReport {
  // 요약
  summary: {
    total: number
    success: number
    failed: number
    partial: number
    skipped: number
    updated: number

    // 상세 통계
    newClientsCreated: number
    existingClientsMatched: number
    scourtLinked: number
    scourtFailed: number
  }

  // 상세 결과
  results: ImportResult[]

  // 부족한 정보 요약
  missingInfoSummary: Array<{
    field: string
    count: number
    affectedRows: number[]
  }>

  // 메타데이터
  createdAt: string
  importOptions: ImportOptions
}

// 유효성 검사 결과
export interface ValidationResult {
  isValid: boolean
  errors: ImportError[]
  warnings: ImportWarning[]
}

// 미리보기 데이터
export interface PreviewData {
  rows: Array<StandardCaseRow & {
    _rowIndex: number
    _validation: ValidationResult
    _existingCase?: {
      id: string
      caseName: string
    }
    _existingClient?: {
      id: string
      name: string
    }
  }>

  summary: {
    total: number
    valid: number
    hasErrors: number
    hasWarnings: number
    duplicates: number
  }
}

// 파일 형식 감지 결과
export type FileFormat = 'casenote' | 'standard' | 'unknown'

// 한글 역할 매핑
export const KOREAN_ROLE_MAP: Record<string, ClientRole> = {
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
}

// 한글 컬럼명 매핑
export const KOREAN_COLUMN_ALIASES: Record<string, keyof StandardCaseRow> = {
  '사건번호': 'court_case_number',
  '의뢰인': 'client_name',
  '의뢰인명': 'client_name',
  '의뢰인이름': 'client_name',
  '역할': 'client_role',
  '의뢰인역할': 'client_role',
  '원고피고': 'client_role',
  '사건명': 'case_name',
  '법원': 'court_name',
  '법원명': 'court_name',
  '유형': 'case_type',
  '사건유형': 'case_type',
  '상대방': 'opponent_name',
  '상대방명': 'opponent_name',
  '담당변호사': 'assigned_lawyer',
  '담당직원': 'assigned_staff',
  '담당자': 'assigned_lawyer',
  '계약일': 'contract_date',
  '수임일': 'contract_date',
  '착수금': 'retainer_fee',
  '착수료': 'retainer_fee',
  '성공보수': 'success_fee_agreement',
  '메모': 'notes',
  '비고': 'notes',
  '연락처': 'client_phone',
  '전화번호': 'client_phone',
  '의뢰인연락처': 'client_phone',
  '이메일': 'client_email',
  '의뢰인이메일': 'client_email',
}
