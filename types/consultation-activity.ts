/**
 * Consultation Activity Log Types
 * Tracks all changes and activities related to consultations
 */

// ============================================================================
// ENUMS & CONSTANTS
// ============================================================================

export type ActivityType =
  | 'created'         // Consultation created
  | 'status_changed'  // Status updated
  | 'assigned'        // Lawyer assigned/changed
  | 'scheduled'       // Schedule confirmed
  | 'rescheduled'     // Schedule changed or deleted
  | 'cancelled'       // Consultation cancelled
  | 'completed'       // Consultation completed
  | 'field_updated'   // Other field updated
  | 'note_added';     // Admin note added

export type ActorType =
  | 'admin'     // Admin user
  | 'system'    // System/automated
  | 'customer'; // Customer action

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Single activity log entry
 */
export interface ConsultationActivity {
  id: string;
  created_at: string;

  // References
  consultation_id: string;

  // Activity details
  activity_type: ActivityType;
  description: string; // Human-readable Korean description

  // Change tracking
  field_name?: string | null;
  old_value?: string | null;
  new_value?: string | null;

  // Actor tracking
  actor_type: ActorType;
  actor_id?: string | null;
  actor_name?: string | null;

  // Metadata
  metadata?: Record<string, any> | null;
  is_system_generated: boolean;
}

/**
 * Activity summary for a consultation
 */
export interface ActivitySummary {
  total_activities: number;
  last_activity_at: string | null;
  status_changes: number;
  schedule_changes: number;
  notes_added: number;
}

/**
 * Input for creating manual activity log
 */
export interface CreateActivityInput {
  consultation_id: string;
  activity_type: ActivityType;
  description: string;
  field_name?: string;
  old_value?: string;
  new_value?: string;
  actor_type?: ActorType;
  actor_id?: string;
  actor_name?: string;
  metadata?: Record<string, any>;
}

/**
 * Grouped activities by date
 */
export interface GroupedActivity {
  date: string; // YYYY-MM-DD
  activities: ConsultationActivity[];
}

// ============================================================================
// DISPLAY LABELS & COLORS
// ============================================================================

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  created: '등록',
  status_changed: '상태 변경',
  assigned: '담당자 배정',
  scheduled: '일정 확정',
  rescheduled: '일정 변경',
  cancelled: '취소',
  completed: '완료',
  field_updated: '정보 수정',
  note_added: '메모 추가',
};

export const ACTIVITY_TYPE_COLORS: Record<ActivityType, string> = {
  created: 'bg-blue-100 text-blue-800',
  status_changed: 'bg-purple-100 text-purple-800',
  assigned: 'bg-green-100 text-green-800',
  scheduled: 'bg-emerald-100 text-emerald-800',
  rescheduled: 'bg-orange-100 text-orange-800',
  cancelled: 'bg-red-100 text-red-800',
  completed: 'bg-gray-100 text-gray-800',
  field_updated: 'bg-yellow-100 text-yellow-800',
  note_added: 'bg-cyan-100 text-cyan-800',
};

export const ACTIVITY_TYPE_ICONS: Record<ActivityType, string> = {
  created: '➕',
  status_changed: '🔄',
  assigned: '👤',
  scheduled: '📅',
  rescheduled: '🔀',
  cancelled: '❌',
  completed: '✅',
  field_updated: '✏️',
  note_added: '📝',
};

export const ACTOR_TYPE_LABELS: Record<ActorType, string> = {
  admin: '관리자',
  system: '시스템',
  customer: '고객',
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Group activities by date
 */
export function groupActivitiesByDate(activities: ConsultationActivity[]): GroupedActivity[] {
  const grouped = new Map<string, ConsultationActivity[]>();

  activities.forEach((activity) => {
    const date = activity.created_at.split('T')[0]; // YYYY-MM-DD
    if (!grouped.has(date)) {
      grouped.set(date, []);
    }
    grouped.get(date)!.push(activity);
  });

  return Array.from(grouped.entries())
    .map(([date, activities]) => ({
      date,
      activities: activities.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ),
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Format activity time (e.g., "2분 전", "1시간 전", "2일 전")
 */
export function formatActivityTime(dateString: string): string {
  const now = new Date();
  const activityDate = new Date(dateString);
  const diffMs = now.getTime() - activityDate.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) {
    return '방금 전';
  } else if (diffMinutes < 60) {
    return `${diffMinutes}분 전`;
  } else if (diffHours < 24) {
    return `${diffHours}시간 전`;
  } else if (diffDays < 7) {
    return `${diffDays}일 전`;
  } else {
    // Format as Korean date: MM월 DD일 HH:MM
    const month = activityDate.getMonth() + 1;
    const day = activityDate.getDate();
    const hours = activityDate.getHours().toString().padStart(2, '0');
    const minutes = activityDate.getMinutes().toString().padStart(2, '0');
    return `${month}월 ${day}일 ${hours}:${minutes}`;
  }
}

/**
 * Format date as Korean (e.g., "2024년 1월 15일")
 */
export function formatActivityDate(dateString: string): string {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const dateOnly = dateString.split('T')[0];
  const todayOnly = today.toISOString().split('T')[0];
  const yesterdayOnly = yesterday.toISOString().split('T')[0];

  if (dateOnly === todayOnly) {
    return '오늘';
  } else if (dateOnly === yesterdayOnly) {
    return '어제';
  } else {
    return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
  }
}

/**
 * Get activity icon by type
 */
export function getActivityIcon(activityType: ActivityType): string {
  return ACTIVITY_TYPE_ICONS[activityType] || '📋';
}

/**
 * Get activity color class by type
 */
export function getActivityColorClass(activityType: ActivityType): string {
  return ACTIVITY_TYPE_COLORS[activityType] || 'bg-gray-100 text-gray-800';
}

/**
 * Check if activity shows significant change
 */
export function isSignificantActivity(activity: ConsultationActivity): boolean {
  return ['status_changed', 'assigned', 'scheduled', 'rescheduled', 'cancelled', 'completed'].includes(
    activity.activity_type
  );
}
