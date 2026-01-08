/**
 * SCOURT XML 캐시 API
 *
 * GET: 캐시된 XML 조회
 * POST: XML 다운로드 & 캐시 저장
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getCachedXml,
  fetchXml,
  downloadXmlFromScourt,
  saveCachedXml,
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
  try {
    const body = await request.json();
    const { xmlPath, caseType, forceRefresh = false } = body;

    if (!xmlPath) {
      return NextResponse.json(
        { error: "Missing required field: xmlPath" },
        { status: 400 }
      );
    }

    // 강제 갱신이 아니면 캐시 확인
    if (!forceRefresh) {
      const cached = await getCachedXml(xmlPath);
      if (cached) {
        return NextResponse.json({
          message: "XML already cached",
          xml_path: cached.xml_path,
          cached_at: cached.created_at,
          from_cache: true,
        });
      }
    }

    // SCOURT에서 다운로드
    const xmlContent = await downloadXmlFromScourt(xmlPath);

    // 캐시에 저장
    const saved = await saveCachedXml(xmlPath, xmlContent, caseType);

    if (!saved) {
      return NextResponse.json(
        { error: "Failed to save XML to cache" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "XML downloaded and cached",
      xml_path: saved.xml_path,
      cached_at: saved.created_at,
      from_cache: false,
    });
  } catch (error) {
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
