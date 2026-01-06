/**
 * SCOURT 사건 저장 유틸리티
 *
 * encCsNo/WMONID 저장 로직을 통합하여 일관성 있는 데이터 관리
 */

import { createAdminClient } from '@/lib/supabase/admin';

export interface SaveEncCsNoParams {
  legalCaseId: string;
  encCsNo: string;
  wmonid: string;
  caseNumber: string;
  courtName?: string;
  caseLevel?: string;  // 심급: "1심", "항소심 (2심)", "상고심 (3심)"
}

export interface StoredEncCsNo {
  encCsNo: string;
  wmonid: string;
  caseNumber: string;
  lastSync: string | null;
}

/**
 * encCsNo와 WMONID를 legal_cases 테이블에 저장
 */
export async function saveEncCsNoToCase(params: SaveEncCsNoParams): Promise<void> {
  const { legalCaseId, encCsNo, wmonid, caseNumber, courtName, caseLevel } = params;
  const supabase = createAdminClient();

  const updateData: Record<string, unknown> = {
    enc_cs_no: encCsNo,
    scourt_wmonid: wmonid,
    scourt_last_sync: new Date().toISOString(),
    scourt_sync_status: 'synced',
  };

  // courtName이 있으면 함께 업데이트
  if (courtName) {
    updateData.court_name = courtName;
  }

  // caseLevel이 있으면 함께 업데이트 (심급 정보)
  if (caseLevel) {
    updateData.case_level = caseLevel;
  }

  const { error } = await supabase
    .from('legal_cases')
    .update(updateData)
    .eq('id', legalCaseId);

  if (error) {
    console.error('encCsNo 저장 에러:', error);
    throw new Error(`encCsNo 저장 실패: ${error.message}`);
  }

  console.log(`✅ encCsNo 저장 완료: ${caseNumber} → ${encCsNo.substring(0, 20)}...`);
}

/**
 * legal_cases에서 저장된 encCsNo 조회
 */
export async function getStoredEncCsNo(legalCaseId: string): Promise<StoredEncCsNo | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('legal_cases')
    .select('enc_cs_no, scourt_wmonid, court_case_number, scourt_last_sync')
    .eq('id', legalCaseId)
    .single();

  if (error || !data?.enc_cs_no) {
    return null;
  }

  return {
    encCsNo: data.enc_cs_no,
    wmonid: data.scourt_wmonid,
    caseNumber: data.court_case_number,
    lastSync: data.scourt_last_sync,
  };
}

/**
 * 동기화 상태 업데이트
 */
export async function updateSyncStatus(
  legalCaseId: string,
  status: 'syncing' | 'synced' | 'failed',
  error?: string
): Promise<void> {
  const supabase = createAdminClient();

  const updateData: Record<string, unknown> = {
    scourt_sync_status: status,
  };

  if (status === 'synced') {
    updateData.scourt_last_sync = new Date().toISOString();
  }

  if (error) {
    updateData.scourt_sync_error = error;
  }

  await supabase
    .from('legal_cases')
    .update(updateData)
    .eq('id', legalCaseId);
}

/**
 * 스냅샷 저장
 */
export interface SaveSnapshotParams {
  legalCaseId: string;
  caseNumber: string;
  courtCode: string;
  basicInfo: Record<string, unknown>;
  hearings: unknown[];
  progress: unknown[];
  documents?: unknown[];
  lowerCourt?: unknown[];
  relatedCases?: unknown[];
}

export async function saveSnapshot(params: SaveSnapshotParams): Promise<string | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('scourt_case_snapshots')
    .insert({
      legal_case_id: params.legalCaseId,
      case_number: params.caseNumber,
      court_code: params.courtCode,
      basic_info: params.basicInfo,
      hearings: params.hearings,
      progress: params.progress,
      documents: params.documents || [],
      lower_court: params.lowerCourt || [],
      related_cases: params.relatedCases || [],
    })
    .select('id')
    .single();

  if (error) {
    console.error('스냅샷 저장 에러:', error);
    return null;
  }

  console.log(`📸 스냅샷 저장 완료: 기일 ${params.hearings.length}건, 진행 ${params.progress.length}건`);
  return data.id;
}
