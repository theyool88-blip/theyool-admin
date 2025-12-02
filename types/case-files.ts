/**
 * 의뢰인 포털 - 소송 파일 관련 타입
 */

// 의뢰인용 문서 유형
export type ClientDocType =
  | 'brief_client'   // 의뢰인 서류 (01_서면)
  | 'brief_defendant' // 피고 서류
  | 'evidence'        // 증거 서류 (02_증거/갑, 을)
  | 'third_party'     // 제3자 제출 서류 (04_AI참고)
  | 'judgment'        // 판결문 (03_법원문서 중 판결/결정)

// 문서 유형별 메타데이터
export const CLIENT_DOC_TYPE_META: Record<ClientDocType, {
  label: string
  icon: string
  description: string
}> = {
  brief_client: {
    label: '의뢰인 서류',
    icon: '📄',
    description: '준비서면, 답변서 등 의뢰인 측 제출 서류',
  },
  brief_defendant: {
    label: '피고 서류',
    icon: '📋',
    description: '피고측 제출 서류',
  },
  evidence: {
    label: '증거 서류',
    icon: '📎',
    description: '증거 자료 (갑호증, 을호증)',
  },
  third_party: {
    label: '참고 서류',
    icon: '📁',
    description: '제3자 제출 서류, 참고 자료',
  },
  judgment: {
    label: '판결문',
    icon: '⚖️',
    description: '법원 판결문, 결정문',
  },
}

// 파일 분류 정보 (drive_file_classifications 테이블)
export interface CaseFileClassification {
  id: string
  drive_file_id: string
  file_name: string
  folder_path: string
  mime_type: string | null
  file_size: number | null
  case_id: string | null
  match_type: string
  match_score: number
  client_visible: boolean
  client_doc_type: ClientDocType | null
  is_large_file: boolean
  created_at: string
  updated_at: string
}

// 의뢰인에게 보여줄 파일 정보
export interface ClientFile {
  id: string
  driveFileId: string
  fileName: string
  docType: ClientDocType
  docTypeLabel: string
  docTypeIcon: string
  mimeType: string
  fileSize: number | null
  isLargeFile: boolean
  createdAt: string
}

// 문서 유형별로 그룹화된 파일 목록
export interface GroupedFiles {
  brief_client: ClientFile[]
  brief_defendant: ClientFile[]
  evidence: ClientFile[]
  third_party: ClientFile[]
  judgment: ClientFile[]
}

// API 응답
export interface CaseFilesResponse {
  success: boolean
  caseId: string
  caseName: string
  files: GroupedFiles
  totalCount: number
  visibleCount: number
  error?: string
}

// 파일 미리보기 응답
export interface FilePreviewResponse {
  success: boolean
  fileId: string
  fileName: string
  type: 'pdf' | 'image' | 'unsupported'
  previewUrl: string | null
  isLargeFile: boolean
  error?: string
}
