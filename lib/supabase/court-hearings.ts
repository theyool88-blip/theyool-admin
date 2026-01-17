/**
 * 법원 기일 관리 Supabase 헬퍼 함수
 * @description 법무법인 더율 법원 기일 CRUD (Service Role Key 사용)
 *
 * 테이블: court_hearings
 * 컬럼: id, case_number, hearing_type, hearing_date, location, judge_name, notes, status
 */

import { createAdminClient } from './admin';
import type {
  CourtHearing,
  CreateCourtHearingRequest,
  UpdateCourtHearingRequest,
  CourtHearingListQuery,
  UpcomingHearing,
} from '@/types/court-hearing';

/**
 * 법원 기일 목록 조회 (필터링 및 페이지네이션 지원, 테넌트 격리)
 * @param filters 필터 조건 (case_id 또는 case_number로 필터링)
 * @param tenantId 테넌트 ID (슈퍼 어드민은 undefined로 전달하여 전체 조회)
 */
export async function getCourtHearings(
  filters?: CourtHearingListQuery,
  tenantId?: string
): Promise<{ data: CourtHearing[]; count: number }> {
  const supabase = createAdminClient();
  let query = supabase.from('court_hearings').select('*', { count: 'exact' });

  // 테넌트 격리 필터
  if (tenantId) {
    query = query.eq('tenant_id', tenantId);
  }

  if (filters) {
    // case_id 우선 사용, 없으면 case_number 사용
    if (filters.case_id) {
      query = query.eq('case_id', filters.case_id);
    } else if (filters.case_number) {
      query = query.eq('case_number', filters.case_number);
    }
    if (filters.hearing_type) {
      query = query.eq('hearing_type', filters.hearing_type);
    }
    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.from_date) {
      query = query.gte('hearing_date', filters.from_date);
    }
    if (filters.to_date) {
      query = query.lte('hearing_date', filters.to_date);
    }
    if (filters.limit) {
      query = query.limit(filters.limit);
    }
    if (filters.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1);
    }
  }

  const { data, error, count } = await query.order('hearing_date', { ascending: true });

  if (error) {
    console.error('Error fetching court hearings:', error);
    throw new Error(`법원 기일 조회 실패: ${error.message}`);
  }

  return { data: data || [], count: count || 0 };
}

/**
 * 법원 기일 상세 조회
 */
export async function getCourtHearingById(id: string): Promise<CourtHearing | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('court_hearings')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    console.error('Error fetching court hearing:', error);
    throw new Error(`법원 기일 조회 실패: ${error.message}`);
  }

  return data;
}

/**
 * 특정 사건의 법원 기일 목록 조회
 */
export async function getCourtHearingsByCaseNumber(
  caseNumber: string
): Promise<CourtHearing[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('court_hearings')
    .select('*')
    .eq('case_number', caseNumber)
    .order('hearing_date', { ascending: true });

  if (error) {
    console.error('Error fetching court hearings by case:', error);
    throw new Error(`사건별 법원 기일 조회 실패: ${error.message}`);
  }

  return data || [];
}

/**
 * 다가오는 법원 기일 조회 (VIEW 사용)
 *
 * VIEW: upcoming_hearings
 * - 향후 30일 이내 예정된 기일
 * - 상태가 SCHEDULED인 기일만
 * - days_until_hearing 컬럼 포함
 */
export async function getUpcomingHearings(): Promise<UpcomingHearing[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('upcoming_hearings')
    .select('*')
    .order('hearing_date', { ascending: true });

  if (error) {
    console.error('Error fetching upcoming hearings:', error);
    throw new Error(`다가오는 기일 조회 실패: ${error.message}`);
  }

  return data || [];
}

/**
 * 법원 기일 유형에 따른 자동 데드라인 매핑
 */
const AUTO_DEADLINE_MAPPING: Record<string, string> = {
  'HEARING_JUDGMENT': 'DL_APPEAL',           // 선고기일 → 상소기간
  'HEARING_MEDIATION': 'DL_MEDIATION_OBJ',   // 조정기일 → 조정·화해 이의기간
};

/**
 * 법원 기일 생성 (자동 데드라인 생성 옵션 포함, 테넌트 격리)
 * @param request 생성 요청 (case_id 필수, case_number 선택적)
 * @param tenantId 테넌트 ID
 */
export async function createCourtHearing(
  request: CreateCourtHearingRequest & { auto_create_deadline?: boolean },
  tenantId?: string
): Promise<CourtHearing> {
  const supabase = createAdminClient();

  const insertData = {
    case_id: request.case_id,
    case_number: request.case_number || null,
    hearing_type: request.hearing_type,
    hearing_date: request.hearing_date,
    location: request.location || null,
    judge_name: request.judge_name || null,
    notes: request.notes || null,
    status: request.status || 'SCHEDULED',
    tenant_id: tenantId || null,
  };

  const { data, error } = await supabase
    .from('court_hearings')
    .insert(insertData)
    .select()
    .single();

  if (error) {
    console.error('Error creating court hearing:', error);
    throw new Error(`법원 기일 생성 실패: ${error.message}`);
  }

  // 자동 데드라인 생성 (선고기일, 조정기일인 경우)
  if (request.auto_create_deadline !== false) {
    const deadlineType = AUTO_DEADLINE_MAPPING[request.hearing_type];

    if (deadlineType) {
      try {
        const triggerDate = new Date(request.hearing_date).toISOString().split('T')[0];

        await supabase.from('case_deadlines').insert({
          case_id: request.case_id,
          case_number: request.case_number || null,
          deadline_type: deadlineType,
          trigger_date: triggerDate,
          notes: `${data.hearing_type === 'HEARING_JUDGMENT' ? '선고일' : '조정일'}로부터 자동 생성`,
          status: 'PENDING',
          tenant_id: tenantId || null,
        });

        console.log(`✅ 자동 데드라인 생성: ${deadlineType}`);
      } catch (deadlineError) {
        console.error('⚠️  자동 데드라인 생성 실패 (법원 기일은 정상 생성됨):', deadlineError);
      }
    }
  }

  return data;
}

/**
 * 법원 기일 수정
 */
export async function updateCourtHearing(
  id: string,
  request: UpdateCourtHearingRequest
): Promise<CourtHearing> {
  const supabase = createAdminClient();

  const updateData: Partial<CourtHearing> = {};

  if (request.case_number !== undefined) updateData.case_number = request.case_number;
  if (request.hearing_type !== undefined) updateData.hearing_type = request.hearing_type;
  if (request.hearing_date !== undefined) updateData.hearing_date = request.hearing_date;
  if (request.location !== undefined) updateData.location = request.location;
  if (request.judge_name !== undefined) updateData.judge_name = request.judge_name;
  if (request.notes !== undefined) updateData.notes = request.notes;
  if (request.status !== undefined) updateData.status = request.status;
  if (request.attending_lawyer_id !== undefined) (updateData as Record<string, unknown>).attending_lawyer_id = request.attending_lawyer_id;

  const { data, error } = await supabase
    .from('court_hearings')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating court hearing:', error);
    throw new Error(`법원 기일 수정 실패: ${error.message}`);
  }

  return data;
}

/**
 * 법원 기일 삭제
 */
export async function deleteCourtHearing(id: string): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from('court_hearings')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting court hearing:', error);
    throw new Error(`법원 기일 삭제 실패: ${error.message}`);
  }
}

/**
 * 법원 기일 상태 변경
 */
export async function updateHearingStatus(
  id: string,
  status: CourtHearing['status']
): Promise<CourtHearing> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('court_hearings')
    .update({ status })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating hearing status:', error);
    throw new Error(`기일 상태 변경 실패: ${error.message}`);
  }

  return data;
}
