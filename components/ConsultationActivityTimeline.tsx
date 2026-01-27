'use client';

import { useEffect, useState } from 'react';
import type { ConsultationActivity, ActivitySummary } from '@/types/consultation-activity';
import {
  groupActivitiesByDate,
  formatActivityTime,
  formatActivityDate,
  getActivityIcon,
  getActivityColorClass,
  ACTIVITY_TYPE_LABELS,
  ACTOR_TYPE_LABELS,
} from '@/types/consultation-activity';

interface ConsultationActivityTimelineProps {
  consultationId: string;
  showSummary?: boolean;
  compact?: boolean;
  maxItems?: number;
}

export default function ConsultationActivityTimeline({
  consultationId,
  showSummary = true,
  compact = false,
  maxItems,
}: ConsultationActivityTimelineProps) {
  const [activities, setActivities] = useState<ConsultationActivity[]>([]);
  const [summary, setSummary] = useState<ActivitySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    fetchActivities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consultationId]);

  const fetchActivities = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (showSummary) {
        params.append('include_summary', 'true');
      }

      const response = await fetch(
        `/api/admin/consultations/${consultationId}/activities?${params}`
      );

      if (!response.ok) {
        throw new Error('활동 이력을 불러오지 못했습니다.');
      }

      const data = await response.json();
      setActivities(data.data || []);
      if (data.summary) {
        setSummary(data.summary);
      }
    } catch (err) {
      console.error('Error fetching activities:', err);
      setError(err instanceof Error ? err.message : '활동 이력을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--sage-primary)]"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[var(--color-danger-muted)] border border-[var(--color-danger)] rounded-lg p-4 text-[var(--color-danger)] text-sm">
        {error}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-8 text-[var(--text-tertiary)]">
        <p>활동 기록이 없습니다.</p>
      </div>
    );
  }

  // Limit items if maxItems is set
  const displayActivities = maxItems && !showAll
    ? activities.slice(0, maxItems)
    : activities;

  const displayGrouped = groupActivitiesByDate(displayActivities);

  return (
    <div className="space-y-6">
      {/* Summary Statistics */}
      {showSummary && summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-[var(--sage-muted)] rounded-lg p-4">
            <p className="text-xs text-[var(--text-secondary)] mb-1">전체 활동</p>
            <p className="text-2xl font-bold text-[var(--text-primary)]">{summary.total_activities}</p>
          </div>
          <div className="bg-[var(--bg-tertiary)] rounded-lg p-4">
            <p className="text-xs text-[var(--text-secondary)] mb-1">상태 변경</p>
            <p className="text-2xl font-bold text-[var(--text-primary)]">{summary.status_changes}</p>
          </div>
          <div className="bg-[var(--bg-tertiary)] rounded-lg p-4">
            <p className="text-xs text-[var(--text-secondary)] mb-1">일정 변경</p>
            <p className="text-2xl font-bold text-[var(--text-primary)]">{summary.schedule_changes}</p>
          </div>
          <div className="bg-[var(--bg-tertiary)] rounded-lg p-4">
            <p className="text-xs text-[var(--text-secondary)] mb-1">메모 추가</p>
            <p className="text-2xl font-bold text-[var(--text-primary)]">{summary.notes_added}</p>
          </div>
        </div>
      )}

      {/* Activity Timeline */}
      <div className="space-y-6">
        {displayGrouped.map((group) => (
          <div key={group.date}>
            {/* Date Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-shrink-0">
                <div className="bg-[var(--sage-muted)] text-[var(--sage-primary)] px-3 py-1 rounded-full text-xs font-semibold">
                  {formatActivityDate(group.date)}
                </div>
              </div>
              <div className="flex-1 h-px bg-[var(--border-subtle)]"></div>
            </div>

            {/* Activities for this date */}
            <div className="space-y-3 ml-2">
              {group.activities.map((activity, index) => (
                <div
                  key={activity.id}
                  className={`relative flex gap-4 ${
                    index !== group.activities.length - 1 ? 'pb-3' : ''
                  }`}
                >
                  {/* Timeline line */}
                  {index !== group.activities.length - 1 && (
                    <div className="absolute left-[19px] top-10 bottom-0 w-px bg-[var(--border-subtle)]"></div>
                  )}

                  {/* Icon */}
                  <div className="flex-shrink-0">
                    <div
                      className={`w-10 h-10 rounded-full ${getActivityColorClass(
                        activity.activity_type
                      )} flex items-center justify-center text-lg shadow-sm`}
                    >
                      {getActivityIcon(activity.activity_type)}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div
                      className={`card p-4 hover:shadow-md transition-shadow ${
                        compact ? 'text-sm' : ''
                      }`}
                    >
                      {/* Header */}
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getActivityColorClass(
                              activity.activity_type
                            )}`}
                          >
                            {ACTIVITY_TYPE_LABELS[activity.activity_type]}
                          </span>
                          {!activity.is_system_generated && (
                            <span className="text-xs text-[var(--text-tertiary)]">
                              {activity.actor_name || ACTOR_TYPE_LABELS[activity.actor_type]}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-[var(--text-tertiary)] flex-shrink-0">
                          {formatActivityTime(activity.created_at)}
                        </span>
                      </div>

                      {/* Description */}
                      <p className="text-[var(--text-primary)] mb-2">{activity.description}</p>

                      {/* Change Details (if available) */}
                      {(activity.old_value || activity.new_value) && (
                        <div className="mt-3 pt-3 border-t border-[var(--border-subtle)] text-sm">
                          <div className="grid grid-cols-2 gap-3">
                            {activity.old_value && (
                              <div>
                                <p className="text-xs text-[var(--text-tertiary)] mb-1">이전</p>
                                <p className="text-[var(--text-secondary)] bg-[var(--bg-primary)] px-2 py-1 rounded">
                                  {activity.old_value}
                                </p>
                              </div>
                            )}
                            {activity.new_value && (
                              <div>
                                <p className="text-xs text-[var(--text-tertiary)] mb-1">이후</p>
                                <p className="text-[var(--text-primary)] bg-coral-50 px-2 py-1 rounded font-medium">
                                  {activity.new_value}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Metadata (if available) */}
                      {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                        <div className="mt-2 text-xs text-[var(--text-tertiary)]">
                          <details>
                            <summary className="cursor-pointer hover:text-[var(--text-secondary)]">
                              세부 정보
                            </summary>
                            <pre className="mt-2 p-2 bg-[var(--bg-primary)] rounded overflow-x-auto">
                              {JSON.stringify(activity.metadata, null, 2)}
                            </pre>
                          </details>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Show More Button */}
      {maxItems && activities.length > maxItems && (
        <div className="text-center pt-4">
          <button
            onClick={() => setShowAll(!showAll)}
            className="text-[var(--sage-primary)] hover:text-[var(--sage-dark)] font-medium text-sm"
          >
            {showAll ? '접기' : `${activities.length - maxItems}개 더 보기`}
          </button>
        </div>
      )}
    </div>
  );
}
