/**
 * 사건별 파일 목록 API
 * @description 의뢰인 포털에서 사건별 공개 파일 목록 조회
 * @endpoint GET /api/client/cases/[id]/files
 * @returns 문서 유형별로 그룹화된 파일 목록
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAuthenticated } from '@/lib/auth/auth'
import {
  CLIENT_DOC_TYPE_META,
  type CaseFileClassification,
  type ClientFile,
  type GroupedFiles,
  type CaseFilesResponse,
  type ClientDocType,
} from '@/types/case-files'

// 파일 분류 정보를 ClientFile로 변환
function toClientFile(file: CaseFileClassification): ClientFile {
  const docType = (file.client_doc_type || 'third_party') as ClientDocType
  const meta = CLIENT_DOC_TYPE_META[docType] || CLIENT_DOC_TYPE_META.third_party

  return {
    id: file.id,
    driveFileId: file.drive_file_id,
    fileName: file.file_name,
    docType,
    docTypeLabel: meta?.label || '기타',
    docTypeIcon: meta?.icon || '📁',
    mimeType: file.mime_type || 'application/octet-stream',
    fileSize: file.file_size,
    isLargeFile: file.is_large_file,
    createdAt: file.created_at,
  }
}

// 파일 목록을 유형별로 그룹화
function groupFilesByDocType(files: CaseFileClassification[]): GroupedFiles {
  const grouped: GroupedFiles = {
    brief_client: [],
    brief_defendant: [],
    evidence: [],
    third_party: [],
    judgment: [],
  }

  for (const file of files) {
    const clientFile = toClientFile(file)
    const docType = file.client_doc_type as keyof GroupedFiles

    if (docType && grouped[docType]) {
      grouped[docType].push(clientFile)
    } else {
      // 알 수 없는 유형은 third_party로 분류
      grouped.third_party.push(clientFile)
    }
  }

  return grouped
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authentication check
    const authenticated = await isAuthenticated()
    if (!authenticated) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    const supabase = createAdminClient()
    const { id: caseId } = await params

    // Validate caseId format (UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(caseId)) {
      return NextResponse.json(
        { error: '유효하지 않은 사건 ID입니다.' },
        { status: 400 }
      )
    }

    // 1. 사건 정보 조회 (권한 검증 겸용)
    const { data: caseInfo, error: caseError } = await supabase
      .from('legal_cases')
      .select('id, case_name, client_id')
      .eq('id', caseId)
      .single()

    if (caseError || !caseInfo) {
      return NextResponse.json(
        { error: '사건을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 2. 공개 파일 목록 조회 (client_visible = true)
    const { data: files, error: filesError } = await supabase
      .from('drive_file_classifications')
      .select('*')
      .eq('case_id', caseId)
      .eq('client_visible', true)
      .order('created_at', { ascending: false })

    if (filesError) {
      console.error('[Case Files] Files fetch error:', {
        caseId,
        error: filesError.message,
      })
      return NextResponse.json(
        { error: '파일 목록 조회 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }

    const filesList = (files || []) as CaseFileClassification[]

    // 3. 유형별 그룹화
    const grouped = groupFilesByDocType(filesList)

    // 4. 전체 파일 수 조회 (비공개 포함)
    const { count: totalCount } = await supabase
      .from('drive_file_classifications')
      .select('*', { count: 'exact', head: true })
      .eq('case_id', caseId)

    const response: CaseFilesResponse = {
      success: true,
      caseId,
      caseName: caseInfo.case_name,
      files: grouped,
      totalCount: totalCount || 0,
      visibleCount: filesList.length,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('[Case Files] Unexpected error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
    })

    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
