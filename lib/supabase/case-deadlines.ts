/**
 * 사건 데드라인 관리 Supabase 헬퍼 함수
 * @description 법무법인 더율 불변기간 데드라인 CRUD (Service Role Key 사용)
 *
 * 테이블: case_deadlines
 * 컬럼: id, case_number, deadline_type, trigger_date, deadline_date, deadline_datetime, notes, status, completed_at
 *
 * 자동 계산: trigger_date와 deadline_type만 제공하면
 *           deadline_date와 deadline_datetime이 트리거로 자동 계산됨
 */

import { createAdminClient } from './admin';
import type {
  CaseDeadline,
  CreateCaseDeadlineRequest,
  UpdateCaseDeadlineRequest,
  CaseDeadlineListQuery,
  UrgentDeadline,
} from '@/types/court-hearing';

/**
 * 사건 데드라인 목록 조회 (필터링 및 페이지네이션 지원, 테넌트 격리)
 * @param filters 필터 조건 (case_id 또는 case_number로 필터링)
 * @param tenantId 테넌트 ID (슈퍼 어드민은 undefined로 전달하여 전체 조회)
 * @param autoRegistered SCOURT 자동등록 기한만 조회 여부
 */
export async function getCaseDeadlines(
  filters?: CaseDeadlineListQuery,
  tenantId?: string,
  autoRegistered?: boolean
): Promise<{ data: CaseDeadline[]; count: number }> {
  const supabase = createAdminClient();
  let query = supabase.from('case_deadlines').select('*', { count: 'exact' });

  // 테넌트 격리 필터
  if (tenantId) {
    query = query.eq('tenant_id', tenantId);
  }

  // SCOURT 자동등록 기한만 필터링
  if (autoRegistered) {
    query = query.ilike('notes', '%[SCOURT 자동등록]%');
  }

  if (filters) {
    // case_id 우선 사용, 없으면 case_number 사용
    if (filters.case_id) {
      query = query.eq('case_id', filters.case_id);
    } else if (filters.case_number) {
      query = query.eq('case_number', filters.case_number);
    }
    if (filters.deadline_type) {
      query = query.eq('deadline_type', filters.deadline_type);
    }
    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.urgent_only) {
      // 7일 이내 만료 데드라인만 조회
      const today = new Date().toISOString().split('T')[0];
      const sevenDaysLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];
      query = query
        .eq('status', 'PENDING')
        .gte('deadline_date', today)
        .lte('deadline_date', sevenDaysLater);
    }
    if (filters.limit) {
      query = query.limit(filters.limit);
    }
    if (filters.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1);
    }
  }

  const { data, error, count } = await query.order('deadline_date', { ascending: true });

  if (error) {
    console.error('Error fetching case deadlines:', error);
    throw new Error(`데드라인 조회 실패: ${error.message}`);
  }

  return { data: data || [], count: count || 0 };
}

/**
 * 사건 데드라인 상세 조회
 */
export async function getCaseDeadlineById(id: string): Promise<CaseDeadline | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('case_deadlines')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    console.error('Error fetching case deadline:', error);
    throw new Error(`데드라인 조회 실패: ${error.message}`);
  }

  return data;
}

/**
 * 특정 사건의 데드라인 목록 조회
 */
export async function getCaseDeadlinesByCaseNumber(
  caseNumber: string
): Promise<CaseDeadline[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('case_deadlines')
    .select('*')
    .eq('case_number', caseNumber)
    .order('deadline_date', { ascending: true });

  if (error) {
    console.error('Error fetching deadlines by case:', error);
    throw new Error(`사건별 데드라인 조회 실패: ${error.message}`);
  }

  return data || [];
}

/**
 * 긴급 데드라인 조회 (VIEW 사용)
 *
 * VIEW: urgent_deadlines
 * - 7일 이내 만료 데드라인
 * - 상태가 PENDING인 데드라인만
 * - deadline_type_name, days_until_deadline 컬럼 포함
 */
export async function getUrgentDeadlines(): Promise<UrgentDeadline[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('urgent_deadlines')
    .select('*')
    .order('deadline_date', { ascending: true });

  if (error) {
    console.error('Error fetching urgent deadlines:', error);
    throw new Error(`긴급 데드라인 조회 실패: ${error.message}`);
  }

  return data || [];
}

/**
 * 사건 데드라인 생성 (테넌트 격리)
 *
 * 주의: deadline_date와 deadline_datetime은 자동 계산되므로 제공하지 않음
 *       trigger_date와 deadline_type만 제공
 * @param request 생성 요청 (case_id 필수, case_number 선택적)
 * @param tenantId 테넌트 ID
 */
export async function createCaseDeadline(
  request: CreateCaseDeadlineRequest,
  tenantId?: string
): Promise<CaseDeadline> {
  const supabase = createAdminClient();

  const insertData = {
    case_id: request.case_id,
    case_number: request.case_number || null,
    deadline_type: request.deadline_type,
    trigger_date: request.trigger_date,
    notes: request.notes || null,
    status: request.status || 'PENDING',
    tenant_id: tenantId || null,
    is_electronic_service: request.is_electronic_service || false,
  };

  const { data, error } = await supabase
    .from('case_deadlines')
    .insert(insertData)
    .select()
    .single();

  if (error) {
    console.error('Error creating case deadline:', error);
    throw new Error(`데드라인 생성 실패: ${error.message}`);
  }

  return data;
}

/**
 * 사건 데드라인 수정
 *
 * 주의: trigger_date를 변경하면 deadline_date도 자동 재계산됨
 */
export async function updateCaseDeadline(
  id: string,
  request: UpdateCaseDeadlineRequest
): Promise<CaseDeadline> {
  const supabase = createAdminClient();

  const updateData: Partial<CaseDeadline> = {};

  if (request.case_number !== undefined) updateData.case_number = request.case_number;
  if (request.deadline_type !== undefined) updateData.deadline_type = request.deadline_type;
  if (request.trigger_date !== undefined) updateData.trigger_date = request.trigger_date;
  if (request.notes !== undefined) updateData.notes = request.notes;
  if (request.status !== undefined) updateData.status = request.status;
  if (request.completed_at !== undefined) updateData.completed_at = request.completed_at;

  const { data, error } = await supabase
    .from('case_deadlines')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating case deadline:', error);
    throw new Error(`데드라인 수정 실패: ${error.message}`);
  }

  return data;
}

/**
 * 사건 데드라인 삭제
 */
export async function deleteCaseDeadline(id: string): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from('case_deadlines')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting case deadline:', error);
    throw new Error(`데드라인 삭제 실패: ${error.message}`);
  }
}

/**
 * 데드라인 완료 처리
 */
export async function completeDeadline(
  id: string,
  notes?: string
): Promise<CaseDeadline> {
  const supabase = createAdminClient();

  const updateData = {
    status: 'COMPLETED' as const,
    completed_at: new Date().toISOString(),
  };

  // notes가 제공되면 추가
  const finalUpdateData = notes
    ? { ...updateData, notes }
    : updateData;

  const { data, error } = await supabase
    .from('case_deadlines')
    .update(finalUpdateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error completing deadline:', error);
    throw new Error(`데드라인 완료 처리 실패: ${error.message}`);
  }

  return data;
}

/**
 * 데드라인 상태 변경
 */
export async function updateDeadlineStatus(
  id: string,
  status: CaseDeadline['status']
): Promise<CaseDeadline> {
  const supabase = createAdminClient();

  const updateData: Partial<CaseDeadline> = { status };

  // COMPLETED 상태로 변경 시 completed_at 자동 설정
  if (status === 'COMPLETED') {
    updateData.completed_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from('case_deadlines')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating deadline status:', error);
    throw new Error(`데드라인 상태 변경 실패: ${error.message}`);
  }

  return data;
}

/**
 * D-day 계산 (남은 일수)
 */
export function calculateDaysUntil(deadlineDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const deadline = new Date(deadlineDate);
  deadline.setHours(0, 0, 0, 0);

  const diffTime = deadline.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
}
