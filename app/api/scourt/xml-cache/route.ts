/**
 * SCOURT XML 캐시 API
 *
 * GET: 캐시된 XML 조회
 * POST: XML 다운로드 & 캐시 저장
 */

import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import {
  getCachedXml,
  downloadXmlWithProtection,
  RateLimitExceededError,
  DownloadTimeoutError,
} from "@/lib/scourt/xml-fetcher";

/**
 * GET /api/scourt/xml-cache?path=ssgo003/SSGO003F70.xml
 *
 * 캐시된 XML 조회 (없으면 404)
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const xmlPath = searchParams.get("path");

  if (!xmlPath) {
    return NextResponse.json(
      { error: "Missing required parameter: path" },
      { status: 400 }
    );
  }

  try {
    const cached = await getCachedXml(xmlPath);

    if (!cached) {
      if (!xmlPath.startsWith("/") && !xmlPath.includes("..")) {
        try {
          const publicPath = path.join(process.cwd(), "public", "scourt-xml", xmlPath);
          const xmlContent = await fs.readFile(publicPath, "utf8");
          return NextResponse.json({
            xml_path: xmlPath,
            xml_content: xmlContent,
            case_type: null,
            data_list_id: null,
            cached_at: null,
            from_static: true,
          });
        } catch (readError) {
          console.warn(`Static XML not found: ${xmlPath}`, readError);
        }
      }

      return NextResponse.json(
        { error: "XML not found in cache", xml_path: xmlPath },
        { status: 404 }
      );
    }

    return NextResponse.json({
      xml_path: cached.xml_path,
      xml_content: cached.xml_content,
      case_type: cached.case_type,
      data_list_id: cached.data_list_id,
      cached_at: cached.created_at,
    });
  } catch (error) {
    console.error("Error fetching XML cache:", error);
    return NextResponse.json(
      { error: "Failed to fetch XML cache" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/scourt/xml-cache
 *
 * XML 다운로드 & 캐시 저장
 *
 * Body:
 * - xmlPath: string (필수) - XML 파일 경로
 * - caseType?: string - 사건유형 코드
 * - forceRefresh?: boolean - 강제 갱신 여부
 */
export async function POST(request: NextRequest) {
  // request body 한 번만 파싱
  let body: { xmlPath?: string; caseType?: string; forceRefresh?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { xmlPath, caseType, forceRefresh = false } = body;

  if (!xmlPath) {
    return NextResponse.json(
      { error: "Missing required field: xmlPath" },
      { status: 400 }
    );
  }

  try {
    // 강제 갱신이 아니면 캐시 확인
    if (!forceRefresh) {
      const cached = await getCachedXml(xmlPath);
      if (cached && cached.xml_content !== '__DOWNLOADING__') {
        return NextResponse.json({
          message: "XML already cached",
          xml_path: cached.xml_path,
          cached_at: cached.created_at,
          from_cache: true,
        });
      }
    }

    // 통합 함수로 다운로드 (분산 락 + rate limit)
    const xmlContent = await downloadXmlWithProtection(xmlPath, caseType);

    return NextResponse.json({
      message: "XML downloaded and cached",
      xml_path: xmlPath,
      xml_content: xmlContent,
      from_cache: false,
    });

  } catch (error) {
    // Graceful Degradation: Rate limit 또는 타임아웃 시
    if (error instanceof RateLimitExceededError || error instanceof DownloadTimeoutError) {
      console.warn(`[XML] Graceful degradation for ${error.xmlPath}: ${error.name}`);

      // 1. 정적 파일 시도
      try {
        const publicPath = path.join(process.cwd(), "public", "scourt-xml", xmlPath);
        const xmlContent = await fs.readFile(publicPath, "utf8");
        return NextResponse.json({
          xml_path: xmlPath,
          xml_content: xmlContent,
          from_static: true,
          degraded: true,
          reason: error.name,
        });
      } catch {
        // 정적 파일 없음
      }

      // 2. 기존 캐시 반환 (stale이라도, __DOWNLOADING__ 제외)
      try {
        const cached = await getCachedXml(xmlPath);
        if (cached && cached.xml_content && cached.xml_content !== '__DOWNLOADING__') {
          return NextResponse.json({
            xml_path: cached.xml_path,
            xml_content: cached.xml_content,
            from_cache: true,
            degraded: true,
            reason: error.name,
          });
        }
      } catch {
        // 캐시 조회 실패
      }

      // 3. 정적 파일/캐시 모두 없으면 503 Service Unavailable
      return NextResponse.json(
        {
          error: "Service temporarily unavailable",
          reason: error.name,
          retry_after: 5,
        },
        { status: 503 }
      );
    }

    // 기타 에러 처리
    console.error("Error caching XML:", error);
    return NextResponse.json(
      {
        error: "Failed to download/cache XML",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
