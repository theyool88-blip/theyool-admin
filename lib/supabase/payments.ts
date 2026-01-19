/**
 * Supabase Payments CRUD Functions
 * @description 입금 관리 시스템 데이터베이스 인터페이스
 */

import { createClient } from '@/lib/supabase/server';
import type {
  Payment,
  CreatePaymentRequest,
  UpdatePaymentRequest,
  PaymentListQuery,
  PaymentStatsByCategory,
  PaymentStatsByMonth,
  CasePaymentSummary,
  ConsultationPaymentSummary,
  PaymentDashboardStats,
} from '@/types/payment';

// =====================================================
// CREATE
// =====================================================

/**
 * 새 입금 내역 생성
 */
export async function createPayment(
  data: CreatePaymentRequest
): Promise<{ data: Payment | null; error: Error | null }> {
  try {
    const supabase = await createClient();
    const { data: userData } = await supabase.auth.getUser();
    const confirmedBy = userData?.user?.email || userData?.user?.id || null;

    let caseNameFromCase: string | null = null;
    // NOTE: legal_cases.client_id 컬럼은 case_clients 테이블로 이동됨
    // 사건에서 client_id를 가져오려면 case_clients 조인 필요
    if (data.case_id) {
      const { data: caseRow, error: caseError } = await supabase
        .from('legal_cases')
        .select('case_name')
        .eq('id', data.case_id)
        .single();
      if (!caseError) {
        caseNameFromCase = caseRow?.case_name || null;
      }
    }

    // NOTE: is_confirmed, confirmed_at, confirmed_by 컬럼이 스키마에서 제거됨
    const { data: payment, error } = await supabase
      .from('payments')
      .insert({
        payment_date: data.payment_date,
        depositor_name: data.depositor_name,
        amount: data.amount,
        payment_category: data.payment_category,
        case_id: data.case_id || null,
        case_name: data.case_name || caseNameFromCase || null,
        client_id: data.client_id || null,  // client_id는 직접 전달받거나 null
        consultation_id: data.consultation_id || null,
        receipt_type: data.receipt_type || null,
        receipt_issued_at: data.receipt_issued_at || null,
        phone: data.phone || null,
        memo: data.memo || null,
        admin_notes: data.admin_notes || null,
      })
      .select()
      .single();

    if (error) throw error;

    if (payment?.case_id) {
      const { data: sums } = await supabase
        .from('payments')
        .select('amount')
        .eq('case_id', payment.case_id);
      if (sums) {
        const total = sums.reduce((sum, p) => sum + p.amount, 0);
        await supabase
          .from('legal_cases')
          .update({ total_received: total })
          .eq('id', payment.case_id);
      }
    }

    return { data: payment, error: null };
  } catch (error) {
    console.error('[createPayment] Error:', error);
    return { data: null, error: error as Error };
  }
}

// =====================================================
// READ
// =====================================================

/**
 * 입금 목록 조회 (필터링, 정렬, 페이징 지원)
 */
export async function listPayments(
  query?: PaymentListQuery
): Promise<{ data: Payment[]; count: number; error: Error | null }> {
  try {
    const supabase = await createClient();
    let queryBuilder = supabase.from('payments').select('*', { count: 'exact' });

    // 필터 적용
    if (query?.payment_category) {
      queryBuilder = queryBuilder.eq('payment_category', query.payment_category);
    }
    if (query?.case_id) {
      queryBuilder = queryBuilder.eq('case_id', query.case_id);
    }
    if (query?.consultation_id) {
      queryBuilder = queryBuilder.eq('consultation_id', query.consultation_id);
    }
    if (query?.from_date) {
      queryBuilder = queryBuilder.gte('payment_date', query.from_date);
    }
    if (query?.to_date) {
      queryBuilder = queryBuilder.lte('payment_date', query.to_date);
    }
    if (query?.depositor_name) {
      queryBuilder = queryBuilder.ilike('depositor_name', `%${query.depositor_name}%`);
    }
    if (query?.phone) {
      queryBuilder = queryBuilder.ilike('phone', `%${query.phone}%`);
    }

    // 정렬
    const sortBy = query?.sort_by || 'payment_date';
    const sortOrder = query?.sort_order === 'asc' ? { ascending: true } : { ascending: false };
    queryBuilder = queryBuilder.order(sortBy, sortOrder);

    // 페이징
    if (query?.limit) {
      queryBuilder = queryBuilder.limit(query.limit);
    }
    if (query?.offset) {
      queryBuilder = queryBuilder.range(
        query.offset,
        query.offset + (query.limit || 50) - 1
      );
    }

    const { data, count, error } = await queryBuilder;

    if (error) throw error;
    return { data: data || [], count: count || 0, error: null };
  } catch (error) {
    console.error('[listPayments] Error:', error);
    return { data: [], count: 0, error: error as Error };
  }
}

/**
 * 입금 상세 조회
 */
export async function getPaymentById(
  id: string
): Promise<{ data: Payment | null; error: Error | null }> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('[getPaymentById] Error:', error);
    return { data: null, error: error as Error };
  }
}

/**
 * 사건별 입금 조회
 */
export async function getPaymentsByCaseId(
  caseId: string
): Promise<{ data: Payment[]; error: Error | null }> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('case_id', caseId)
      .order('payment_date', { ascending: false });

    if (error) throw error;
    return { data: data || [], error: null };
  } catch (error) {
    console.error('[getPaymentsByCaseId] Error:', error);
    return { data: [], error: error as Error };
  }
}

/**
 * 상담별 입금 조회
 */
export async function getPaymentsByConsultationId(
  consultationId: string
): Promise<{ data: Payment[]; error: Error | null }> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('consultation_id', consultationId)
      .order('payment_date', { ascending: false });

    if (error) throw error;
    return { data: data || [], error: null };
  } catch (error) {
    console.error('[getPaymentsByConsultationId] Error:', error);
    return { data: [], error: error as Error };
  }
}

/**
 * 의뢰인별 입금 조회 (직접 연결)
 */
export async function getPaymentsByClientId(
  clientId: string
): Promise<{ data: Payment[]; error: Error | null }> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('client_id', clientId)
      .order('payment_date', { ascending: false });

    if (error) throw error;
    return { data: data || [], error: null };
  } catch (error) {
    console.error('[getPaymentsByClientId] Error:', error);
    return { data: [], error: error as Error };
  }
}

// =====================================================
// UPDATE
// =====================================================

/**
 * 입금 내역 수정
 */
export async function updatePayment(
  id: string,
  data: UpdatePaymentRequest
): Promise<{ data: Payment | null; error: Error | null }> {
  try {
    const supabase = await createClient();
    const { data: userData } = await supabase.auth.getUser();
    const confirmedBy = userData?.user?.email || userData?.user?.id || null;

    let caseNameFromCase: string | null | undefined = undefined;
    // NOTE: legal_cases.client_id 컬럼은 case_clients 테이블로 이동됨
    if (data.case_id) {
      const { data: caseRow } = await supabase
        .from('legal_cases')
        .select('case_name')
        .eq('id', data.case_id)
        .single();
      caseNameFromCase = caseRow?.case_name || null;
    } else if (data.case_id === null) {
      caseNameFromCase = null;
    }

    // NOTE: is_confirmed, confirmed_at, confirmed_by 컬럼이 스키마에서 제거됨
    // 해당 필드들을 data 객체에서 제거
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { is_confirmed, confirmed_at, confirmed_by, ...cleanData } = data as Record<string, unknown>;

    const { data: payment, error } = await supabase
      .from('payments')
      .update({
        ...cleanData,
        case_name: data.case_name || caseNameFromCase || data.case_name,
        client_id: data.client_id !== undefined ? data.client_id : undefined,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    if (payment?.case_id) {
      const { data: sums } = await supabase
        .from('payments')
        .select('amount')
        .eq('case_id', payment.case_id);
      if (sums) {
        const total = sums.reduce((sum, p) => sum + p.amount, 0);
        await supabase
          .from('legal_cases')
          .update({ total_received: total })
          .eq('id', payment.case_id);
      }
    }

    return { data: payment, error: null };
  } catch (error) {
    console.error('[updatePayment] Error:', error);
    return { data: null, error: error as Error };
  }
}

// =====================================================
// DELETE
// =====================================================

/**
 * 입금 내역 삭제
 */
export async function deletePayment(
  id: string
): Promise<{ success: boolean; error: Error | null }> {
  try {
    const supabase = await createClient();

    const { error } = await supabase
      .from('payments')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return { success: true, error: null };
  } catch (error) {
    console.error('[deletePayment] Error:', error);
    return { success: false, error: error as Error };
  }
}

// =====================================================
// 통계 조회
// =====================================================

/**
 * 명목별 통계 조회
 */
export async function getPaymentStatsByCategory(): Promise<{
  data: PaymentStatsByCategory[];
  error: Error | null;
}> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('payment_stats_by_category')
      .select('*')
      .order('total_amount', { ascending: false });

    if (error) throw error;
    return { data: data || [], error: null };
  } catch (error) {
    console.error('[getPaymentStatsByCategory] Error:', error);
    return { data: [], error: error as Error };
  }
}

/**
 * 월별 통계 조회
 */
export async function getPaymentStatsByMonth(
  months: number = 12
): Promise<{
  data: PaymentStatsByMonth[];
  error: Error | null;
}> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('payment_stats_by_month')
      .select('*')
      .order('month', { ascending: false })
      .limit(months * 10);  // 각 월에 여러 카테고리가 있을 수 있으므로 여유있게

    if (error) throw error;
    return { data: data || [], error: null };
  } catch (error) {
    console.error('[getPaymentStatsByMonth] Error:', error);
    return { data: [], error: error as Error };
  }
}

/**
 * 사건별 입금 합계 조회
 */
export async function getCasePaymentSummary(
  caseId?: string
): Promise<{
  data: CasePaymentSummary[];
  error: Error | null;
}> {
  try {
    const supabase = await createClient();
    let query = supabase.from('case_payment_summary').select('*');

    if (caseId) {
      query = query.eq('case_id', caseId);
    }

    const { data, error } = await query.order('total_amount', { ascending: false });

    if (error) throw error;
    return { data: data || [], error: null };
  } catch (error) {
    console.error('[getCasePaymentSummary] Error:', error);
    return { data: [], error: error as Error };
  }
}

/**
 * 상담별 입금 합계 조회
 */
export async function getConsultationPaymentSummary(
  consultationId?: string
): Promise<{
  data: ConsultationPaymentSummary[];
  error: Error | null;
}> {
  try {
    const supabase = await createClient();
    let query = supabase.from('consultation_payment_summary').select('*');

    if (consultationId) {
      query = query.eq('consultation_id', consultationId);
    }

    const { data, error } = await query.order('total_amount', { ascending: false });

    if (error) throw error;
    return { data: data || [], error: null };
  } catch (error) {
    console.error('[getConsultationPaymentSummary] Error:', error);
    return { data: [], error: error as Error };
  }
}

/**
 * 대시보드 전체 통계 조회
 */
export async function getPaymentDashboardStats(): Promise<{
  data: PaymentDashboardStats | null;
  error: Error | null;
}> {
  try {
    const supabase = await createClient();

    // 전체 통계
    const { data: totalStats } = await supabase
      .from('payments')
      .select('amount');

    // 이번 달 통계
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .split('T')[0];

    const { data: thisMonthStats } = await supabase
      .from('payments')
      .select('amount')
      .gte('payment_date', thisMonthStart);

    // 저번 달 통계
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      .toISOString()
      .split('T')[0];
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)
      .toISOString()
      .split('T')[0];

    const { data: lastMonthStats } = await supabase
      .from('payments')
      .select('amount')
      .gte('payment_date', lastMonthStart)
      .lte('payment_date', lastMonthEnd);

    // 뷰 데이터 조회
    const { data: byCategory } = await supabase
      .from('payment_stats_by_category')
      .select('*')
      .order('total_amount', { ascending: false });

    const { data: byMonth } = await supabase
      .from('payment_stats_by_month')
      .select('*')
      .order('month', { ascending: false })
      .limit(120);

    // 집계
    const total_amount = totalStats?.reduce((sum, p) => sum + p.amount, 0) || 0;
    const total_count = totalStats?.length || 0;

    const this_month_amount =
      thisMonthStats?.reduce((sum, p) => sum + p.amount, 0) || 0;
    const last_month_amount =
      lastMonthStats?.reduce((sum, p) => sum + p.amount, 0) || 0;

    const month_growth_rate =
      last_month_amount > 0
        ? Math.round(((this_month_amount - last_month_amount) / last_month_amount) * 100)
        : this_month_amount > 0
          ? 100
          : 0;

    const stats: PaymentDashboardStats = {
      total_amount,
      this_month_amount,
      last_month_amount,
      month_growth_rate,
      total_count,
      by_category: byCategory || [],
      by_month: byMonth || [],
    };

    return { data: stats, error: null };
  } catch (error) {
    console.error('[getPaymentDashboardStats] Error:', error);
    return { data: null, error: error as Error };
  }
}
