/**
 * 불변기간 타입 마스터 데이터 Supabase 헬퍼 함수
 * @description 법무법인 더율 불변기간 마스터 데이터 조회 (Service Role Key 사용)
 *
 * 테이블: deadline_types
 * 컬럼: id, type, name, days, description
 *
 * 특징: 5개 고정 데이터, 읽기 전용 (생성/수정/삭제 불가)
 */

import { createAdminClient } from './admin';
import type { DeadlineTypeMaster, DeadlineType } from '@/types/court-hearing';

/**
 * 모든 불변기간 타입 조회
 */
export async function getDeadlineTypes(): Promise<DeadlineTypeMaster[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('deadline_types')
    .select('*')
    .order('days', { ascending: false });

  if (error) {
    console.error('Error fetching deadline types:', error);
    throw new Error(`불변기간 타입 조회 실패: ${error.message}`);
  }

  return data || [];
}

/**
 * 특정 불변기간 타입 조회 (type으로)
 */
export async function getDeadlineTypeByType(
  type: DeadlineType
): Promise<DeadlineTypeMaster | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('deadline_types')
    .select('*')
    .eq('type', type)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    console.error('Error fetching deadline type:', error);
    throw new Error(`불변기간 타입 조회 실패: ${error.message}`);
  }

  return data;
}

/**
 * 특정 불변기간 타입 조회 (id로)
 */
export async function getDeadlineTypeById(
  id: string
): Promise<DeadlineTypeMaster | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('deadline_types')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    console.error('Error fetching deadline type:', error);
    throw new Error(`불변기간 타입 조회 실패: ${error.message}`);
  }

  return data;
}

/**
 * 불변기간 타입 정보를 key-value 형태로 반환
 * (UI 셀렉트 박스용)
 */
export async function getDeadlineTypeOptions(): Promise<
  Array<{ value: DeadlineType; label: string; days: number }>
> {
  const types = await getDeadlineTypes();

  return types.map((type) => ({
    value: type.type,
    label: `${type.name} (${type.days}일)`,
    days: type.days,
  }));
}

/**
 * 불변기간 일수 조회
 */
export async function getDeadlineDays(type: DeadlineType): Promise<number> {
  const deadlineType = await getDeadlineTypeByType(type);

  if (!deadlineType) {
    throw new Error(`존재하지 않는 불변기간 타입: ${type}`);
  }

  return deadlineType.days;
}
