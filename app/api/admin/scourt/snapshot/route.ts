/**
 * 대법원 사건 스냅샷 조회/새로고침 API
 *
 * GET /api/admin/scourt/snapshot?caseId=xxx
 * - 저장된 스냅샷 데이터 조회 (진행사항, 기일, 서류 등)
 *
 * POST /api/admin/scourt/snapshot
 * - API를 사용하여 진행내용 새로고침
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { transformHearings, transformProgress } from '@/lib/scourt/field-transformer';
import { getScourtApiClient } from '@/lib/scourt/api-client';
import { scrapeProgress, closeBrowser } from '@/lib/scourt/progress-scraper';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const caseId = searchParams.get('caseId');

    if (!caseId) {
      return NextResponse.json(
        { error: 'caseId 파라미터가 필요합니다' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // 최신 스냅샷 조회
    const { data: snapshot, error: snapshotError } = await supabase
      .from('scourt_case_snapshots')
      .select('*')
      .eq('legal_case_id', caseId)
      .order('scraped_at', { ascending: false })
      .limit(1)
      .single();

    if (snapshotError && snapshotError.code !== 'PGRST116') {
      console.error('스냅샷 조회 에러:', snapshotError);
      return NextResponse.json(
        { error: '스냅샷 조회 실패' },
        { status: 500 }
      );
    }

    // 최근 업데이트 조회 (미읽음 우선)
    const { data: updates } = await supabase
      .from('scourt_case_updates')
      .select('*')
      .eq('legal_case_id', caseId)
      .order('detected_at', { ascending: false })
      .limit(10);

    // 사건의 scourt 연동 상태 조회
    const { data: legalCase } = await supabase
      .from('legal_cases')
      .select('scourt_last_sync, scourt_sync_status, court_case_number, enc_cs_no')
      .eq('id', caseId)
      .single();

    // 프로필 케이스 연동 여부 확인
    const { data: profileCase } = await supabase
      .from('scourt_profile_cases')
      .select('id, profile_id, enc_cs_no, wmonid')
      .eq('legal_case_id', caseId)
      .limit(1)
      .single();

    // 공용 함수로 데이터 변환 (API 필드 → UI 필드)
    const hearingsData = transformHearings(snapshot?.hearings || []);
    const progressData = transformProgress(snapshot?.progress || []);

    return NextResponse.json({
      success: true,
      hasSnapshot: !!snapshot,
      snapshot: snapshot ? {
        id: snapshot.id,
        scrapedAt: snapshot.scraped_at,
        caseType: snapshot.case_type,
        basicInfo: snapshot.basic_info,
        hearings: hearingsData,
        progress: progressData,
        documents: snapshot.documents || [],
        lowerCourt: snapshot.lower_court || [],
        relatedCases: snapshot.related_cases || [],
      } : null,
      updates: updates || [],
      syncStatus: {
        lastSync: legalCase?.scourt_last_sync,
        status: legalCase?.scourt_sync_status,
        caseNumber: legalCase?.court_case_number,
        isLinked: !!profileCase || !!legalCase?.enc_cs_no,
        profileId: profileCase?.profile_id,
      },
    });

  } catch (error) {
    console.error('스냅샷 API 에러:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '알 수 없는 에러' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/scourt/snapshot
 * Puppeteer를 사용하여 진행내용 + 기본정보 새로고침
 *
 * 요청 body:
 * - caseId: 사건 ID
 * - useScraper: Puppeteer 스크래퍼 사용 여부 (기본: true)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { caseId, useScraper = true } = body;

    if (!caseId) {
      return NextResponse.json(
        { error: 'caseId가 필요합니다' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // 사건 정보 조회 (enc_cs_no, wmonid, court_case_number 등)
    const { data: legalCase, error: caseError } = await supabase
      .from('legal_cases')
      .select('id, court_case_number, court_name, enc_cs_no, scourt_wmonid')
      .eq('id', caseId)
      .single();

    if (caseError || !legalCase) {
      return NextResponse.json(
        { error: '사건을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    if (!legalCase.court_case_number) {
      return NextResponse.json(
        { error: '사건번호가 없습니다.' },
        { status: 400 }
      );
    }

    console.log(`📍 스냅샷 새로고침 시작: ${legalCase.court_case_number} (${caseId})`);

    // Puppeteer 스크래퍼 사용 (기본값)
    if (useScraper) {
      console.log('🌐 Puppeteer 스크래퍼로 데이터 추출 중...');

      try {
        const scrapeResult = await scrapeProgress(legalCase.court_case_number);

        if (!scrapeResult.success) {
          console.log(`⚠️ 스크래퍼 실패: ${scrapeResult.error}`);
          // 스크래퍼 실패 시 API fallback
        } else {
          console.log(`✅ 스크래퍼 성공: 진행내용 ${scrapeResult.progress.length}건`);

          // 기존 스냅샷 조회
          const { data: existingSnapshot } = await supabase
            .from('scourt_case_snapshots')
            .select('id, basic_info')
            .eq('legal_case_id', caseId)
            .order('scraped_at', { ascending: false })
            .limit(1)
            .single();

          // 진행내용 DB 형식 변환
          const progressForDb = scrapeResult.progress.map(p => ({
            prcdDt: p.date.replace(/\./g, ''),
            prcdNm: p.content,
            prcdRslt: p.result,
          }));

          // basicInfo 병합 (기존 + 새로 추출된 정보)
          const existingBasicInfo = existingSnapshot?.basic_info || {};
          const updatedBasicInfo = {
            ...existingBasicInfo,
            ...(scrapeResult.basicInfo || {}),
          };

          if (existingSnapshot) {
            const { error: updateError } = await supabase
              .from('scourt_case_snapshots')
              .update({
                progress: progressForDb,
                basic_info: updatedBasicInfo,
                scraped_at: new Date().toISOString(),
              })
              .eq('id', existingSnapshot.id);

            if (updateError) {
              console.error('스냅샷 업데이트 실패:', updateError);
              return NextResponse.json(
                { error: '스냅샷 업데이트 실패' },
                { status: 500 }
              );
            }
            console.log(`📸 스냅샷 업데이트 완료 (스크래퍼): ${existingSnapshot.id}`);
          } else {
            const { error: insertError } = await supabase
              .from('scourt_case_snapshots')
              .insert({
                legal_case_id: caseId,
                case_number: legalCase.court_case_number,
                progress: progressForDb,
                basic_info: updatedBasicInfo,
                hearings: [],
                documents: [],
                lower_court: [],
                related_cases: [],
              });

            if (insertError) {
              console.error('스냅샷 생성 실패:', insertError);
              return NextResponse.json(
                { error: '스냅샷 생성 실패' },
                { status: 500 }
              );
            }
            console.log('📸 새 스냅샷 생성 완료 (스크래퍼)');
          }

          const transformedProgress = transformProgress(progressForDb);

          return NextResponse.json({
            success: true,
            method: 'scraper',
            progressCount: scrapeResult.progress.length,
            progress: transformedProgress,
            basicInfo: scrapeResult.basicInfo,
          });
        }
      } catch (scrapeError) {
        console.error('스크래퍼 에러:', scrapeError);
        // API fallback 계속 진행
      }
    }

    // API fallback (기존 로직)
    if (!legalCase.enc_cs_no || !legalCase.scourt_wmonid) {
      return NextResponse.json(
        { error: 'SCOURT 연동 정보가 없습니다. 먼저 사건을 검색해주세요.' },
        { status: 400 }
      );
    }

    console.log('📡 API로 진행내용 조회 중 (fallback)...');

    // 사건번호 파싱 (예: "2024드단23848" → csYear, csDvsCd, csSerial)
    const caseNumber = legalCase.court_case_number;
    const match = caseNumber.match(/(\d{4})([가-힣]+)(\d+)/);
    if (!match) {
      return NextResponse.json(
        { error: '사건번호 형식이 올바르지 않습니다' },
        { status: 400 }
      );
    }
    const [, csYear, csDvsNm, csSerial] = match;

    // 사건유형 코드 변환
    const caseTypeCodes: Record<string, string> = {
      '드단': '150', '드합': '151', '느단': '140', '느합': '141', '르': '160',
    };
    const csDvsCd = caseTypeCodes[csDvsNm] || csDvsNm;

    // 법원 코드 변환
    const courtCodes: Record<string, string> = {
      '수원가정법원': '000302', '수원가정': '000302',
      '수원가정법원 평택지원': '000305', '평택가정': '000305',
      '수원가정법원 성남지원': '000303', '성남가정': '000303',
      '서울가정법원': '000201', '서울가정': '000201',
    };
    const cortCd = courtCodes[legalCase.court_name] || legalCase.court_name;

    // API 클라이언트로 진행내용 조회
    const apiClient = getScourtApiClient();
    await apiClient.initSession(legalCase.scourt_wmonid);

    const progressResult = await apiClient.getCaseProgress({
      cortCd,
      csYear,
      csDvsCd,
      csSerial,
      encCsNo: legalCase.enc_cs_no,
    });

    if (!progressResult.success) {
      console.error('진행내용 API 실패:', progressResult.error);
      return NextResponse.json(
        { error: progressResult.error || '진행내용 조회 실패' },
        { status: 500 }
      );
    }

    console.log(`✅ 진행내용 ${progressResult.progress?.length || 0}건 조회 완료`);

    // DB 저장용 형식으로 변환 (prcdDt, prcdNm, prcdRslt)
    const progressForDb = progressResult.progress || [];

    // 기존 스냅샷 업데이트 (progress 필드만)
    const { data: existingSnapshot } = await supabase
      .from('scourt_case_snapshots')
      .select('id')
      .eq('legal_case_id', caseId)
      .order('scraped_at', { ascending: false })
      .limit(1)
      .single();

    if (existingSnapshot) {
      const { error: updateError } = await supabase
        .from('scourt_case_snapshots')
        .update({
          progress: progressForDb,
          scraped_at: new Date().toISOString(),
        })
        .eq('id', existingSnapshot.id);

      if (updateError) {
        console.error('스냅샷 업데이트 실패:', updateError);
        return NextResponse.json(
          { error: '스냅샷 업데이트 실패' },
          { status: 500 }
        );
      }

      console.log(`📸 스냅샷 업데이트 완료: ${existingSnapshot.id}`);
    } else {
      const { error: insertError } = await supabase
        .from('scourt_case_snapshots')
        .insert({
          legal_case_id: caseId,
          case_number: caseNumber,
          progress: progressForDb,
          basic_info: {},
          hearings: [],
          documents: [],
          lower_court: [],
          related_cases: [],
        });

      if (insertError) {
        console.error('스냅샷 생성 실패:', insertError);
        return NextResponse.json(
          { error: '스냅샷 생성 실패' },
          { status: 500 }
        );
      }

      console.log(`📸 새 스냅샷 생성 완료`);
    }

    // 변환된 진행내용 반환
    const transformedProgress = transformProgress(progressForDb);

    return NextResponse.json({
      success: true,
      progressCount: progressResult.progress?.length || 0,
      progress: transformedProgress,
    });

  } catch (error) {
    console.error('스냅샷 새로고침 에러:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '알 수 없는 에러' },
      { status: 500 }
    );
  }
}
