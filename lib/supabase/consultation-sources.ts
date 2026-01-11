/**
 * Consultation Sources - Supabase Helper Functions
 * 상담 유입 경로 관리 헬퍼 함수
 */

import { createClient } from './server';
import type {
  ConsultationSource,
  CreateConsultationSourceInput,
  UpdateConsultationSourceInput,
} from '@/types/consultation-source';

/**
 * Get all consultation sources
 */
export async function getConsultationSources(activeOnly = false): Promise<ConsultationSource[]> {
  const supabase = await createClient();

  let query = supabase
    .from('consultation_sources')
    .select('*')
    .order('display_order', { ascending: true });

  if (activeOnly) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching consultation sources:', error);
    throw new Error('Failed to fetch consultation sources');
  }

  return data || [];
}

/**
 * Get a single consultation source by ID
 */
export async function getConsultationSourceById(id: string): Promise<ConsultationSource | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('consultation_sources')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    console.error('Error fetching consultation source:', error);
    throw new Error('Failed to fetch consultation source');
  }

  return data;
}

/**
 * Get default consultation source
 */
export async function getDefaultConsultationSource(): Promise<ConsultationSource | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('consultation_sources')
    .select('*')
    .eq('is_active', true)
    .eq('is_default', true)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No default found, return first active source
      const sources = await getConsultationSources(true);
      return sources[0] || null;
    }
    console.error('Error fetching default consultation source:', error);
    return null;
  }

  return data;
}

/**
 * Create a new consultation source
 */
export async function createConsultationSource(
  input: CreateConsultationSourceInput
): Promise<ConsultationSource> {
  const supabase = await createClient();

  // If this is set as default, unset other defaults
  if (input.is_default) {
    await supabase
      .from('consultation_sources')
      .update({ is_default: false })
      .eq('is_default', true);
  }

  const { data, error } = await supabase
    .from('consultation_sources')
    .insert([{
      name: input.name.trim(),
      display_order: input.display_order ?? 0,
      color: input.color ?? 'gray',
      is_active: input.is_active ?? true,
      is_default: input.is_default ?? false,
      description: input.description || null,
    }])
    .select()
    .single();

  if (error) {
    console.error('Error creating consultation source:', error);
    throw new Error('Failed to create consultation source');
  }

  return data;
}

/**
 * Update a consultation source
 */
export async function updateConsultationSource(
  id: string,
  input: UpdateConsultationSourceInput
): Promise<ConsultationSource> {
  const supabase = await createClient();

  // If this is being set as default, unset other defaults
  if (input.is_default === true) {
    await supabase
      .from('consultation_sources')
      .update({ is_default: false })
      .eq('is_default', true)
      .neq('id', id);
  }

  const updateData: Partial<{
    name: string;
    display_order: number;
    color: string;
    is_active: boolean;
    is_default: boolean;
    description: string | null;
  }> = {};
  if (input.name !== undefined) updateData.name = input.name.trim();
  if (input.display_order !== undefined) updateData.display_order = input.display_order;
  if (input.color !== undefined) updateData.color = input.color;
  if (input.is_active !== undefined) updateData.is_active = input.is_active;
  if (input.is_default !== undefined) updateData.is_default = input.is_default;
  if (input.description !== undefined) updateData.description = input.description;

  const { data, error } = await supabase
    .from('consultation_sources')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating consultation source:', error);
    throw new Error('Failed to update consultation source');
  }

  return data;
}

/**
 * Delete or deactivate a consultation source
 * If the source is being used, it will be deactivated instead of deleted
 */
export async function deleteConsultationSource(id: string): Promise<{
  deleted: boolean;
  deactivated: boolean;
  message: string;
}> {
  const supabase = await createClient();

  // Check if source is being used
  const { data: source } = await supabase
    .from('consultation_sources')
    .select('name, usage_count')
    .eq('id', id)
    .single();

  if (!source) {
    throw new Error('Consultation source not found');
  }

  if (source.usage_count > 0) {
    // Don't delete if it's being used, just deactivate
    await supabase
      .from('consultation_sources')
      .update({ is_active: false })
      .eq('id', id);

    return {
      deleted: false,
      deactivated: true,
      message: `'${source.name}'은(는) 사용 중이므로 비활성화되었습니다. (사용 횟수: ${source.usage_count}건)`,
    };
  }

  // If not being used, actually delete
  const { error } = await supabase
    .from('consultation_sources')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting consultation source:', error);
    throw new Error('Failed to delete consultation source');
  }

  return {
    deleted: true,
    deactivated: false,
    message: '유입 경로가 삭제되었습니다.',
  };
}

/**
 * Get source statistics
 */
export async function getSourceStatistics(
  startDate?: string,
  endDate?: string
): Promise<{
  name: string;
  count: number;
  percentage: number;
  color: string;
}[]> {
  const supabase = await createClient();

  let query = supabase
    .from('consultations')
    .select('source');

  if (startDate) {
    query = query.gte('created_at', startDate);
  }

  if (endDate) {
    query = query.lte('created_at', endDate);
  }

  const { data: consultations, error } = await query;

  if (error) {
    console.error('Error fetching consultation statistics:', error);
    throw new Error('Failed to fetch source statistics');
  }

  // Get sources with their colors
  const sources = await getConsultationSources();
  const sourceMap = new Map(sources.map(s => [s.name, s]));

  // Count by source
  const counts = new Map<string, number>();
  consultations?.forEach(c => {
    if (c.source) {
      counts.set(c.source, (counts.get(c.source) || 0) + 1);
    }
  });

  const total = consultations?.length || 0;

  // Build statistics
  const stats = Array.from(counts.entries()).map(([name, count]) => ({
    name,
    count,
    percentage: total > 0 ? (count / total) * 100 : 0,
    color: sourceMap.get(name)?.color || 'gray',
  }));

  // Sort by count descending
  stats.sort((a, b) => b.count - a.count);

  return stats;
}
