/**
 * Unified Consultation System - Supabase Functions
 * Handles all consultation types: callback, visit, video, info
 */

import { createClient } from '@/lib/supabase/server';
import type {
  Consultation,
  CreateConsultationInput,
  UpdateConsultationInput,
  ConsultationFilters,
  ConsultationStats,
  RequestType,
  ConsultationStatus,
} from '@/types/consultation';

// ============================================================================
// CREATE CONSULTATION
// ============================================================================

/**
 * Create a new consultation request (all types)
 * PUBLIC: Can be called from client-side forms
 */
export async function createConsultation(input: CreateConsultationInput): Promise<Consultation> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('consultations')
    .insert([input])
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create consultation: ${error.message}`);
  }

  return data as Consultation;
}

// ============================================================================
// READ CONSULTATIONS
// ============================================================================

/**
 * Get all consultations with filters
 * ADMIN ONLY
 */
export async function getConsultations(filters?: ConsultationFilters): Promise<Consultation[]> {
  const supabase = await createClient();

  let query = supabase
    .from('consultations')
    .select('*')
    .order('created_at', { ascending: false });

  // Apply filters
  if (filters?.request_type) {
    query = query.eq('request_type', filters.request_type);
  }

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  if (filters?.assigned_lawyer) {
    query = query.eq('assigned_lawyer', filters.assigned_lawyer);
  }

  if (filters?.office_location) {
    query = query.eq('office_location', filters.office_location);
  }

  if (filters?.payment_status) {
    query = query.eq('payment_status', filters.payment_status);
  }

  if (filters?.date_from) {
    query = query.gte('preferred_date', filters.date_from);
  }

  if (filters?.date_to) {
    query = query.lte('preferred_date', filters.date_to);
  }

  if (filters?.source) {
    query = query.eq('source', filters.source);
  }

  if (filters?.search) {
    // Search across multiple fields
    query = query.or(
      `name.ilike.%${filters.search}%,` +
      `phone.ilike.%${filters.search}%,` +
      `email.ilike.%${filters.search}%,` +
      `message.ilike.%${filters.search}%,` +
      `category.ilike.%${filters.search}%`
    );
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch consultations: ${error.message}`);
  }

  return data as Consultation[];
}

/**
 * Get a single consultation by ID
 * ADMIN ONLY
 */
export async function getConsultationById(id: string): Promise<Consultation | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('consultations')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Failed to fetch consultation: ${error.message}`);
  }

  return data as Consultation;
}

// ============================================================================
// UPDATE CONSULTATION
// ============================================================================

/**
 * Update a consultation
 * ADMIN ONLY
 */
export async function updateConsultation(
  id: string,
  input: UpdateConsultationInput
): Promise<Consultation> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('consultations')
    .update(input)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update consultation: ${error.message}`);
  }

  return data as Consultation;
}

// ============================================================================
// DELETE CONSULTATION
// ============================================================================

/**
 * Delete a consultation
 * ADMIN ONLY
 */
export async function deleteConsultation(id: string): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('consultations')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to delete consultation: ${error.message}`);
  }
}

// ============================================================================
// STATISTICS
// ============================================================================

/**
 * Get consultation statistics for admin dashboard
 * ADMIN ONLY
 */
export async function getConsultationStats(): Promise<ConsultationStats> {
  const supabase = await createClient();

  // Date calculations
  const today = new Date().toISOString().split('T')[0];

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); // Monday
  const weekStartStr = weekStart.toISOString().split('T')[0];

  const monthStart = new Date();
  monthStart.setDate(1);
  const monthStartStr = monthStart.toISOString().split('T')[0];

  // Fetch all consultations for detailed analysis
  const { data: allConsultations, error } = await supabase
    .from('consultations')
    .select('*');

  if (error) {
    throw new Error(`Failed to fetch consultation stats: ${error.message}`);
  }

  // Calculate counts
  const total = allConsultations.length;
  const pending = allConsultations.filter((c) => c.status === 'pending').length;
  const contacted = allConsultations.filter((c) => c.status === 'contacted').length;
  const confirmed = allConsultations.filter((c) => c.status === 'confirmed').length;
  const completed = allConsultations.filter((c) => c.status === 'completed').length;
  const cancelled = allConsultations.filter((c) => c.status === 'cancelled' || c.status === 'no_show').length;

  const todayConsultations = allConsultations.filter(
    (c) => c.created_at.split('T')[0] === today
  ).length;

  const thisWeekConsultations = allConsultations.filter(
    (c) => c.created_at.split('T')[0] >= weekStartStr
  ).length;

  const thisMonthConsultations = allConsultations.filter(
    (c) => c.created_at.split('T')[0] >= monthStartStr
  ).length;

  // Count by type
  const byType: Record<RequestType, number> = {
    callback: 0,
    visit: 0,
    video: 0,
    info: 0,
  };

  allConsultations.forEach((c) => {
    byType[c.request_type as RequestType]++;
  });

  // Count by status
  const byStatus: Record<ConsultationStatus, number> = {
    pending: 0,
    contacted: 0,
    confirmed: 0,
    payment_pending: 0,
    payment_confirmed: 0,
    payment_completed: 0,
    in_progress: 0,
    completed: 0,
    cancelled: 0,
    no_show: 0,
  };

  allConsultations.forEach((c) => {
    byStatus[c.status as ConsultationStatus]++;
  });

  // Count by lawyer
  const byLawyer: Record<string, number> = {
    '육심원': 0,
    '임은지': 0,
  };

  allConsultations.forEach((c) => {
    if (c.assigned_lawyer) {
      byLawyer[c.assigned_lawyer]++;
    }
  });

  // Calculate revenue
  const revenue = allConsultations
    .filter((c) => c.payment_status === 'completed')
    .reduce((sum, c) => sum + (c.consultation_fee || 0), 0);

  // Calculate average lead score
  const leadScores = allConsultations
    .filter((c) => c.lead_score !== null)
    .map((c) => c.lead_score || 0);

  const avgLeadScore = leadScores.length > 0
    ? Math.round(leadScores.reduce((a, b) => a + b, 0) / leadScores.length)
    : 0;

  return {
    total,
    pending,
    contacted,
    confirmed,
    completed,
    cancelled,
    today: todayConsultations,
    thisWeek: thisWeekConsultations,
    thisMonth: thisMonthConsultations,
    byType,
    byStatus,
    byLawyer: byLawyer as Record<'육심원' | '임은지', number>,
    revenue,
    avgLeadScore,
  };
}

/**
 * Get detailed consultation statistics for stats page
 * ADMIN ONLY
 */
export async function getDetailedConsultationStats() {
  const supabase = await createClient();

  const { data: consultations, error } = await supabase
    .from('consultations')
    .select('id, status, lead_score, created_at, contacted_at, source, utm_source, utm_medium, utm_campaign')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch consultation stats: ${error.message}`);
  }

  const total = consultations.length;

  // Status breakdown
  const retained = consultations.filter(c => c.status === 'retained').length;
  const byStatus = {
    pending: consultations.filter(c => c.status === 'pending').length,
    contacted: consultations.filter(c => c.status === 'contacted').length,
    confirmed: consultations.filter(c => c.status === 'confirmed').length,
    retained,
    cancelled: consultations.filter(c => c.status === 'cancelled').length,
  };

  // Lead score distribution
  const byLeadScore = {
    high: consultations.filter(c => (c.lead_score || 0) >= 80).length,
    medium: consultations.filter(c => (c.lead_score || 0) >= 50 && (c.lead_score || 0) < 80).length,
    low: consultations.filter(c => (c.lead_score || 0) < 50).length,
  };

  // Conversion rates by lead quality
  const highQualityConsultations = consultations.filter(c => (c.lead_score || 0) >= 80);
  const mediumQualityConsultations = consultations.filter(c => (c.lead_score || 0) >= 50 && (c.lead_score || 0) < 80);

  const conversionRate = {
    overall: total > 0 ? (retained / total) * 100 : 0,
    highQuality: highQualityConsultations.length > 0
      ? (highQualityConsultations.filter(c => c.status === 'retained').length / highQualityConsultations.length) * 100
      : 0,
    mediumQuality: mediumQualityConsultations.length > 0
      ? (mediumQualityConsultations.filter(c => c.status === 'retained').length / mediumQualityConsultations.length) * 100
      : 0,
  };

  // Monthly trend (last 6 months)
  const monthlyTrend = [];
  for (let i = 5; i >= 0; i--) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
    const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);

    const monthConsultations = consultations.filter(c => {
      const createdDate = new Date(c.created_at);
      return createdDate >= monthStart && createdDate <= monthEnd;
    });

    monthlyTrend.push({
      month: `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}`,
      total: monthConsultations.length,
      retained: monthConsultations.filter(c => c.status === 'retained').length,
    });
  }

  // Average response time
  const contactedConsultations = consultations.filter(
    c => c.status !== 'pending' && c.contacted_at && c.created_at
  );
  let averageResponseTime = '계산 중';
  if (contactedConsultations.length > 0) {
    const totalMinutes = contactedConsultations.reduce((sum, c) => {
      const created = new Date(c.created_at).getTime();
      const contacted = new Date(c.contacted_at!).getTime();
      return sum + (contacted - created) / (1000 * 60);
    }, 0);
    const avgMinutes = totalMinutes / contactedConsultations.length;

    if (avgMinutes < 60) {
      averageResponseTime = `${Math.round(avgMinutes)}분`;
    } else if (avgMinutes < 1440) {
      averageResponseTime = `${(avgMinutes / 60).toFixed(1)}시간`;
    } else {
      averageResponseTime = `${(avgMinutes / 1440).toFixed(1)}일`;
    }
  }

  // Channel performance (by source/utm_source)
  const channelStats: Record<string, {
    total: number;
    retained: number;
    leadScores: number[];
    highQuality: number;
  }> = {};

  consultations.forEach(c => {
    const channel = c.utm_source || c.source || '직접방문';
    if (!channelStats[channel]) {
      channelStats[channel] = { total: 0, retained: 0, leadScores: [], highQuality: 0 };
    }
    channelStats[channel].total++;
    if (c.status === 'retained') channelStats[channel].retained++;
    if (c.lead_score) channelStats[channel].leadScores.push(c.lead_score);
    if ((c.lead_score || 0) >= 80) channelStats[channel].highQuality++;
  });

  const byChannel = Object.entries(channelStats).map(([channel, stats]) => ({
    channel,
    total: stats.total,
    retained: stats.retained,
    conversionRate: stats.total > 0 ? (stats.retained / stats.total) * 100 : 0,
    avgLeadScore: stats.leadScores.length > 0
      ? stats.leadScores.reduce((a, b) => a + b, 0) / stats.leadScores.length
      : 0,
    highQuality: stats.highQuality,
  })).sort((a, b) => b.conversionRate - a.conversionRate);

  // Time pattern (hour x day of week heatmap)
  const timePattern: number[][] = Array(7).fill(0).map(() => Array(24).fill(0));
  const timeConversions: number[][] = Array(7).fill(0).map(() => Array(24).fill(0));

  consultations.forEach(c => {
    const date = new Date(c.created_at);
    const day = date.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
    const hour = date.getHours();

    timePattern[day][hour]++;
    if (c.status === 'retained') {
      timeConversions[day][hour]++;
    }
  });

  const heatmapData = timePattern.map((dayData, day) =>
    dayData.map((count, hour) => ({
      day,
      hour,
      count,
      conversionRate: count > 0 ? (timeConversions[day][hour] / count) * 100 : 0,
    }))
  );

  return {
    total,
    byStatus,
    byLeadScore,
    conversionRate,
    monthlyTrend,
    averageResponseTime,
    byChannel,
    heatmapData,
  };
}

// ============================================================================
// SCHEDULING HELPERS
// ============================================================================

/**
 * Check if a time slot is available
 * ADMIN ONLY
 */
export async function checkSlotAvailability(
  date: string,
  time: string,
  officeLocation?: string
): Promise<boolean> {
  const supabase = await createClient();

  let query = supabase
    .from('consultations')
    .select('id')
    .eq('preferred_date', date)
    .eq('preferred_time', time)
    .not('status', 'in', '(cancelled,no_show)');

  if (officeLocation) {
    query = query.eq('office_location', officeLocation);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to check slot availability: ${error.message}`);
  }

  return !data || data.length === 0;
}

/**
 * Get upcoming consultations for today and tomorrow
 * ADMIN ONLY
 */
export async function getUpcomingConsultations(): Promise<Consultation[]> {
  const supabase = await createClient();

  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('consultations')
    .select('*')
    .in('request_type', ['visit', 'video'])
    .in('status', ['confirmed', 'in_progress'])
    .gte('preferred_date', today)
    .lte('preferred_date', tomorrowStr)
    .order('preferred_date', { ascending: true })
    .order('preferred_time', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch upcoming consultations: ${error.message}`);
  }

  return data as Consultation[];
}
