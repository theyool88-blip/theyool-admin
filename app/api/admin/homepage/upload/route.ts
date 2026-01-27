/**
 * POST /api/admin/homepage/upload
 * 홈페이지 콘텐츠용 이미지 업로드 (자동 최적화 포함)
 *
 * SEO 최적화:
 * - WebP 포맷 변환 (더 나은 압축률)
 * - 최대 너비 1920px로 리사이징
 * - 품질 80%로 압축
 * - GIF는 원본 유지 (애니메이션 보존)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { withHomepage } from '@/lib/api/with-homepage';
import sharp from 'sharp';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB (최적화 전 허용 크기 증가)
const MAX_WIDTH = 1920; // 최대 너비
const QUALITY = 80; // WebP 품질 (0-100)

interface OptimizedImage {
  buffer: Buffer;
  contentType: string;
  extension: string;
  width: number;
  height: number;
  originalSize: number;
  optimizedSize: number;
}

async function optimizeImage(
  inputBuffer: Buffer,
  mimeType: string
): Promise<OptimizedImage> {
  const originalSize = inputBuffer.length;

  // GIF는 애니메이션 보존을 위해 최적화하지 않음
  if (mimeType === 'image/gif') {
    const metadata = await sharp(inputBuffer).metadata();
    return {
      buffer: inputBuffer,
      contentType: 'image/gif',
      extension: 'gif',
      width: metadata.width || 0,
      height: metadata.height || 0,
      originalSize,
      optimizedSize: originalSize,
    };
  }

  // 이미지 메타데이터 확인
  const metadata = await sharp(inputBuffer).metadata();
  const needsResize = metadata.width && metadata.width > MAX_WIDTH;

  // Sharp 파이프라인 구성
  let pipeline = sharp(inputBuffer);

  // 필요시 리사이징
  if (needsResize) {
    pipeline = pipeline.resize(MAX_WIDTH, null, {
      withoutEnlargement: true,
      fit: 'inside',
    });
  }

  // WebP로 변환 및 압축
  const optimizedBuffer = await pipeline
    .webp({ quality: QUALITY })
    .toBuffer();

  // 최적화된 메타데이터
  const optimizedMetadata = await sharp(optimizedBuffer).metadata();

  return {
    buffer: optimizedBuffer,
    contentType: 'image/webp',
    extension: 'webp',
    width: optimizedMetadata.width || 0,
    height: optimizedMetadata.height || 0,
    originalSize,
    optimizedSize: optimizedBuffer.length,
  };
}

export const POST = withHomepage(async (request: NextRequest, { tenant }) => {
  try {
    if (!tenant.tenantId) {
      return NextResponse.json(
        { success: false, error: '테넌트 정보가 없습니다.' },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const folder = formData.get('folder') as string || 'general';

    if (!file) {
      return NextResponse.json(
        { success: false, error: '파일이 없습니다.' },
        { status: 400 }
      );
    }

    // 파일 타입 검증
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: '지원하지 않는 파일 형식입니다. (JPG, PNG, GIF, WebP만 가능)' },
        { status: 400 }
      );
    }

    // 파일 크기 검증
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { success: false, error: '파일 크기는 10MB를 초과할 수 없습니다.' },
        { status: 400 }
      );
    }

    // 파일을 Buffer로 변환
    const arrayBuffer = await file.arrayBuffer();
    const inputBuffer = Buffer.from(arrayBuffer);

    // 이미지 최적화
    const optimized = await optimizeImage(inputBuffer, file.type);

    const supabase = await createAdminClient();

    // 고유 파일명 생성 (최적화된 확장자 사용)
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const fileName = `${timestamp}-${randomStr}.${optimized.extension}`;
    const filePath = `${tenant.tenantId}/${folder}/${fileName}`;

    // Supabase Storage에 업로드
    const { data, error } = await supabase.storage
      .from('homepage-images')
      .upload(filePath, optimized.buffer, {
        contentType: optimized.contentType,
        upsert: false,
      });

    if (error) {
      console.error('Storage upload error:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));

      // 버킷이 없는 경우 안내
      if (error.message?.includes('not found') || error.message?.includes('does not exist')) {
        return NextResponse.json(
          { success: false, error: 'Storage 버킷이 설정되지 않았습니다. Supabase에서 homepage-images 버킷을 생성해주세요.' },
          { status: 500 }
        );
      }

      return NextResponse.json(
        { success: false, error: `파일 업로드에 실패했습니다: ${error.message}` },
        { status: 500 }
      );
    }

    // Public URL 생성
    const { data: urlData } = supabase.storage
      .from('homepage-images')
      .getPublicUrl(filePath);

    // 압축률 계산
    const compressionRatio = Math.round((1 - optimized.optimizedSize / optimized.originalSize) * 100);

    return NextResponse.json({
      success: true,
      data: {
        url: urlData.publicUrl,
        path: filePath,
        name: file.name,
        originalSize: optimized.originalSize,
        optimizedSize: optimized.optimizedSize,
        compressionRatio: `${compressionRatio}%`,
        width: optimized.width,
        height: optimized.height,
        type: optimized.contentType,
      },
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
});
