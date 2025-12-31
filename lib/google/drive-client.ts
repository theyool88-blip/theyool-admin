/**
 * Google Drive 클라이언트 (Service Account)
 *
 * 의뢰인 포털에서 파일 미리보기/다운로드에 사용
 */

import { google, drive_v3 } from 'googleapis'

let driveClient: drive_v3.Drive | null = null

/**
 * Service Account로 인증된 Drive 클라이언트 반환
 */
function getServiceDriveClient(): drive_v3.Drive {
  if (driveClient) {
    return driveClient
  }

  const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  if (!serviceAccountKey) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY 환경변수가 설정되지 않았습니다.')
  }

  let credentials: {
    client_email: string
    private_key: string
  }

  try {
    credentials = JSON.parse(serviceAccountKey)
  } catch {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY JSON 파싱 실패')
  }

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: credentials.client_email,
      private_key: credentials.private_key,
    },
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  })

  driveClient = google.drive({ version: 'v3', auth })
  return driveClient
}

/**
 * 파일 메타데이터 조회
 */
export async function getFileMetadata(fileId: string): Promise<{
  id: string
  name: string
  mimeType: string
  size: number
  webViewLink: string | null
  thumbnailLink: string | null
}> {
  const drive = getServiceDriveClient()

  const response = await drive.files.get({
    fileId,
    fields: 'id, name, mimeType, size, webViewLink, thumbnailLink',
  })

  const file = response.data

  return {
    id: file.id || fileId,
    name: file.name || '',
    mimeType: file.mimeType || 'application/octet-stream',
    size: parseInt(file.size || '0', 10),
    webViewLink: file.webViewLink || null,
    thumbnailLink: file.thumbnailLink || null,
  }
}

/**
 * 파일 타입 확인
 * - PDF: 브라우저에서 직접 렌더링 가능
 * - 이미지: img 태그로 표시
 * - 기타: 다운로드만 지원
 */
export async function getFileType(fileId: string): Promise<{
  type: 'pdf' | 'image' | 'unsupported'
  mimeType: string
}> {
  const drive = getServiceDriveClient()

  const response = await drive.files.get({
    fileId,
    fields: 'mimeType',
  })

  const mimeType = response.data.mimeType || ''

  if (mimeType === 'application/pdf') {
    return { type: 'pdf', mimeType }
  }

  if (mimeType.startsWith('image/')) {
    return { type: 'image', mimeType }
  }

  return { type: 'unsupported', mimeType }
}

/**
 * 파일 다운로드 스트림 반환
 */
export async function downloadFile(
  fileId: string
): Promise<{
  stream: NodeJS.ReadableStream
  mimeType: string
  fileName: string
}> {
  const drive = getServiceDriveClient()

  // 메타데이터 조회
  const metaResponse = await drive.files.get({
    fileId,
    fields: 'name, mimeType',
  })

  const fileName = metaResponse.data.name || 'download'
  const mimeType = metaResponse.data.mimeType || 'application/octet-stream'

  // 파일 다운로드
  const response = await drive.files.get(
    {
      fileId,
      alt: 'media',
    },
    { responseType: 'stream' }
  )

  return {
    stream: response.data as unknown as NodeJS.ReadableStream,
    mimeType,
    fileName,
  }
}

/**
 * 파일 존재 여부 확인
 */
export async function fileExists(fileId: string): Promise<boolean> {
  try {
    const drive = getServiceDriveClient()
    await drive.files.get({
      fileId,
      fields: 'id',
    })
    return true
  } catch {
    return false
  }
}
