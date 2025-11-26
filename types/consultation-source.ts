/**
 * Consultation Source Management Types
 * 상담 유입 경로 관리
 */

// ============================================================================
// INTERFACES
// ============================================================================

export interface ConsultationSource {
  id: string;
  created_at: string;
  updated_at: string;

  // Core fields
  name: string;                 // 유입 경로 이름 (예: "네이버", "홈페이지")
  display_order: number;        // 표시 순서
  color: string;                // 표시 색상 (tailwind color name)
  is_active: boolean;           // 활성화 여부
  is_default: boolean;          // 기본값 여부

  // Statistics
  usage_count: number;          // 사용 횟수

  // Description
  description?: string | null;  // 설명
}

// ============================================================================
// CREATE/UPDATE INPUT TYPES
// ============================================================================

export interface CreateConsultationSourceInput {
  name: string;
  display_order?: number;
  color?: string;
  is_active?: boolean;
  is_default?: boolean;
  description?: string;
}

export interface UpdateConsultationSourceInput {
  name?: string;
  display_order?: number;
  color?: string;
  is_active?: boolean;
  is_default?: boolean;
  description?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Available colors for source display
 */
export const SOURCE_COLORS = [
  { value: 'gray', label: '회색', class: 'bg-gray-100 text-gray-800' },
  { value: 'red', label: '빨강', class: 'bg-red-100 text-red-800' },
  { value: 'orange', label: '주황', class: 'bg-orange-100 text-orange-800' },
  { value: 'yellow', label: '노랑', class: 'bg-yellow-100 text-yellow-800' },
  { value: 'green', label: '초록', class: 'bg-green-100 text-green-800' },
  { value: 'blue', label: '파랑', class: 'bg-blue-100 text-blue-800' },
  { value: 'indigo', label: '남색', class: 'bg-indigo-100 text-indigo-800' },
  { value: 'purple', label: '보라', class: 'bg-purple-100 text-purple-800' },
  { value: 'pink', label: '분홍', class: 'bg-pink-100 text-pink-800' },
] as const;

/**
 * Default sources (used for initialization)
 */
export const DEFAULT_SOURCES = [
  { name: '네이버', color: 'green', display_order: 1 },
  { name: '홈페이지', color: 'blue', display_order: 2, is_default: true },
  { name: '기타', color: 'gray', display_order: 99 },
] as const;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get Tailwind CSS classes for source badge display
 */
export function getSourceColorClass(color: string): string {
  const colorMap: Record<string, string> = {
    gray: 'bg-gray-100 text-gray-800',
    red: 'bg-red-100 text-red-800',
    orange: 'bg-orange-100 text-orange-800',
    yellow: 'bg-yellow-100 text-yellow-800',
    green: 'bg-green-100 text-green-800',
    blue: 'bg-blue-100 text-blue-800',
    indigo: 'bg-indigo-100 text-indigo-800',
    purple: 'bg-purple-100 text-purple-800',
    pink: 'bg-pink-100 text-pink-800',
  };

  return colorMap[color] || colorMap.gray;
}

/**
 * Validate source name (no special characters, max length)
 */
export function isValidSourceName(name: string): boolean {
  if (!name || name.trim().length === 0) return false;
  if (name.length > 50) return false;

  // Allow Korean, English, numbers, spaces, and common punctuation
  const validPattern = /^[가-힣a-zA-Z0-9\s\-_()]+$/;
  return validPattern.test(name);
}

/**
 * Sort sources by display order
 */
export function sortSources(sources: ConsultationSource[]): ConsultationSource[] {
  return [...sources].sort((a, b) => {
    // Active sources first
    if (a.is_active && !b.is_active) return -1;
    if (!a.is_active && b.is_active) return 1;

    // Then by display order
    return a.display_order - b.display_order;
  });
}

/**
 * Get default source from list
 */
export function getDefaultSource(sources: ConsultationSource[]): ConsultationSource | null {
  const defaultSource = sources.find(s => s.is_default && s.is_active);
  return defaultSource || (sources.find(s => s.is_active) || null);
}

// ============================================================================
// STATISTICS TYPES
// ============================================================================

export interface SourceStatistics {
  name: string;
  count: number;
  percentage: number;
  color: string;
  trend?: 'up' | 'down' | 'stable';  // 이전 기간 대비 추세
}

export interface SourceAnalytics {
  total_consultations: number;
  by_source: SourceStatistics[];
  top_source: string;
  lowest_source: string;
  period: {
    start_date: string;
    end_date: string;
  };
}
