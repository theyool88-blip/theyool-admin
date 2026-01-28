// Database table types
export interface R2File {
  id: string
  tenant_id: string
  r2_key: string
  r2_etag: string | null
  original_name: string
  display_name: string
  mime_type: string | null
  file_size: number | null
  folder_id: string | null
  case_id: string | null
  doc_type: DocType | null
  doc_subtype: string | null
  parsed_date: string | null
  exhibit_number: string | null
  is_contract: boolean
  client_visible: boolean
  uploaded_by: string | null
  created_at: string
  updated_at: string
}

export interface R2Folder {
  id: string
  tenant_id: string
  name: string
  path: string
  parent_id: string | null
  case_id: string | null
  is_contract_folder: boolean
  depth: number
  display_order: number
  created_at: string
  updated_at: string
}

export interface TenantStorage {
  id: string
  tenant_id: string
  quota_bytes: number
  extra_quota_bytes: number
  used_bytes: number
  file_count: number
  extra_quota_started_at: string | null
  extra_quota_expires_at: string | null
  created_at: string
  updated_at: string
}

export interface InboxRule {
  id: string
  tenant_id: string
  name: string
  priority: number
  is_active: boolean
  conditions: RuleConditions
  actions: RuleActions
  created_at: string
  updated_at: string
}

// Supporting types
export type DocType = 'brief' | 'evidence' | 'court_doc' | 'reference' | null

export interface RuleConditions {
  filename_pattern?: string
  mime_types?: string[]
  size_min?: number
  size_max?: number
  case_type?: string
}

export interface RuleActions {
  target_folder: string
  rename_pattern?: string
  doc_type?: DocType
  client_visible?: boolean
}

// API request/response types
export interface UploadRequest {
  filename: string
  fileSize: number
  mimeType: string
  folderId?: string
  caseId?: string
}

export interface UploadResponse {
  success: boolean
  uploadUrl: string
  fileId: string
  expiresAt: string
}

export interface StorageUsage {
  usedBytes: number
  quotaBytes: number
  extraQuotaBytes: number
  totalQuotaBytes: number
  fileCount: number
  percentUsed: number
  byType: {
    documents: number
    images: number
    other: number
  }
}

export interface ClassificationResult {
  docType: DocType
  targetFolder: string
  displayName: string
  method: 'rule' | 'ai' | 'unclassified'
  confidence: number
}

// Insert types (for database operations)
export type R2FileInsert = Omit<R2File, 'id' | 'created_at' | 'updated_at'>
export type R2FolderInsert = Omit<R2Folder, 'id' | 'created_at' | 'updated_at'>
export type InboxRuleInsert = Omit<InboxRule, 'id' | 'created_at' | 'updated_at'>
