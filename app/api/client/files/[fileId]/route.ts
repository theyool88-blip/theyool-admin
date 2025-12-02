/**
 * 파일 미리보기/다운로드 API
 * @description 의뢰인 포털에서 파일 미리보기 URL 또는 다운로드 스트림 제공
 * @endpoint GET /api/client/files/[fileId]?action=preview|download
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAuthenticated } from '@/lib/auth/auth'
import { getFileType, downloadFile, fileExists } from '@/lib/google/drive-client'
import type { FilePreviewResponse } from '@/types/case-files'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
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
    const { fileId } = await params
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') || 'preview'

    // 1. 파일 정보 조회 (공개 파일만)
    const { data: file, error: fileError } = await supabase
      .from('drive_file_classifications')
      .select('*')
      .eq('id', fileId)
      .eq('client_visible', true)
      .single()

    if (fileError || !file) {
      return NextResponse.json(
        { error: '파일을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 2. 고용량 파일 체크 (다운로드 불가)
    if (file.is_large_file) {
      return NextResponse.json(
        {
          success: false,
          error: '고용량 파일은 다운로드할 수 없습니다.',
          fileName: file.file_name,
          fileSize: file.file_size,
          isLargeFile: true,
        },
        { status: 403 }
      )
    }

    // 3. Drive 파일 존재 여부 확인
    const driveFileId = file.drive_file_id
    const exists = await fileExists(driveFileId)

    if (!exists) {
      return NextResponse.json(
        { error: '파일이 Google Drive에서 삭제되었거나 접근할 수 없습니다.' },
        { status: 404 }
      )
    }

    // 4-A. 파일 타입 확인 (미리보기용)
    if (action === 'preview') {
      const fileType = await getFileType(driveFileId)

      const response: FilePreviewResponse = {
        success: true,
        fileId: file.id,
        fileName: file.file_name,
        type: fileType.type,
        previewUrl: null, // 브라우저에서 직접 렌더링
        isLargeFile: false,
      }

      return NextResponse.json(response)
    }

    // 4-B. 인라인 보기 (PDF/이미지를 브라우저에서 직접 렌더링)
    if (action === 'view') {
      try {
        const { stream, mimeType, fileName } = await downloadFile(driveFileId)

        return new NextResponse(stream as unknown as ReadableStream, {
          headers: {
            'Content-Type': mimeType,
            'Content-Disposition': `inline; filename="${encodeURIComponent(fileName)}"`,
            'Cache-Control': 'private, max-age=3600',
          },
        })
      } catch (viewError) {
        console.error('[File View] Error:', viewError)
        return NextResponse.json(
          { error: '파일 로딩 중 오류가 발생했습니다.' },
          { status: 500 }
        )
      }
    }

    // 4-B. 파일 다운로드
    if (action === 'download') {
      try {
        const { stream, mimeType, fileName } = await downloadFile(driveFileId)

        // Content-Disposition 헤더에 파일명 인코딩
        const encodedFileName = encodeURIComponent(fileName)

        return new NextResponse(stream as unknown as ReadableStream, {
          headers: {
            'Content-Type': mimeType,
            'Content-Disposition': `attachment; filename*=UTF-8''${encodedFileName}`,
            'Cache-Control': 'private, max-age=3600',
          },
        })
      } catch (downloadError) {
        console.error('[File Download] Error:', downloadError)
        return NextResponse.json(
          { error: '파일 다운로드 중 오류가 발생했습니다.' },
          { status: 500 }
        )
      }
    }

    // 알 수 없는 action
    return NextResponse.json(
      { error: '올바른 action을 지정하세요. (preview 또는 download)' },
      { status: 400 }
    )
  } catch (error) {
    console.error('[File API] Unexpected error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
    })

    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
