'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface CasePriority {
  caseId: string;
  caseNumber: string;
  caseName: string;
  clientName?: string;
  score: number;
  grade: 'A' | 'B' | 'C' | 'D';
  nextDeadline?: {
    date: string;
    typeName: string;
    daysRemaining: number;
  };
  nextHearing?: {
    date: string;
    typeName: string;
    daysRemaining: number;
  };
  riskFlags: Array<{
    id: string;
    severity: string;
    title: string;
  }>;
  recommendedActions: Array<{
    id: string;
    title: string;
    priority: string;
  }>;
}

interface Props {
  limit?: number;
}

export default function PriorityCasesWidget({ limit = 5 }: Props) {
  const [priorities, setPriorities] = useState<CasePriority[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPriorities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit]);

  async function fetchPriorities() {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/planning?limit=${limit}`);
      const data = await response.json();

      if (data.success) {
        setPriorities(data.data || []);
      } else {
        setError(data.error || '데이터를 불러오지 못했습니다');
      }
    } catch (err) {
      setError('서버 오류가 발생했습니다');
      console.error('Failed to fetch priorities:', err);
    } finally {
      setLoading(false);
    }
  }

  const gradeColors: Record<string, string> = {
    A: 'bg-[var(--color-danger-muted)] text-[var(--color-danger)] border-[var(--color-danger)]',
    B: 'bg-[var(--color-warning-muted)] text-[var(--color-warning)] border-[var(--color-warning)]',
    C: 'bg-[var(--color-warning-muted)] text-[var(--color-warning)] border-[var(--color-warning)]',
    D: 'bg-[var(--color-success-muted)] text-[var(--color-success)] border-[var(--color-success)]',
  };

  const gradeLabels: Record<string, string> = {
    A: '긴급',
    B: '높음',
    C: '보통',
    D: '낮음',
  };

  if (loading) {
    return (
      <div className="card">
        <div className="px-4 py-3 border-b border-[var(--border-subtle)]">
          <p className="text-sm font-medium text-[var(--text-primary)]">사건 우선순위</p>
        </div>
        <div className="p-4 flex justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-[var(--border-default)] border-t-[var(--sage-primary)]"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <div className="px-4 py-3 border-b border-[var(--border-subtle)]">
          <p className="text-sm font-medium text-[var(--text-primary)]">사건 우선순위</p>
        </div>
        <div className="p-4 text-center text-sm text-[var(--text-tertiary)]">{error}</div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="px-4 py-3 border-b border-[var(--border-subtle)] flex items-center justify-between">
        <p className="text-sm font-medium text-[var(--text-primary)]">사건 우선순위</p>
        <span className="text-xs text-[var(--text-tertiary)]">
          {priorities.filter((p) => p.grade === 'A').length}건 긴급
        </span>
      </div>

      {priorities.length === 0 ? (
        <div className="p-4 text-center text-sm text-[var(--text-tertiary)]">
          긴급한 사건이 없습니다
        </div>
      ) : (
        <div className="divide-y divide-[var(--border-subtle)]">
          {priorities.map((priority) => (
            <div
              key={priority.caseId}
              className="px-4 py-3 hover:bg-[var(--bg-hover)] transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2 min-w-0">
                  {/* 등급 배지 */}
                  <span
                    className={`flex-shrink-0 px-1.5 py-0.5 rounded text-xs font-medium border ${gradeColors[priority.grade]}`}
                  >
                    {gradeLabels[priority.grade]}
                  </span>

                  {/* 사건 정보 */}
                  <div className="min-w-0">
                    <Link
                      href={`/admin/cases?id=${priority.caseId}`}
                      className="text-sm font-medium text-[var(--text-primary)] hover:text-[var(--sage-primary)] block truncate"
                    >
                      {priority.caseNumber}
                    </Link>
                    {priority.clientName && (
                      <p className="text-xs text-[var(--text-tertiary)] truncate">
                        {priority.clientName}
                      </p>
                    )}
                  </div>
                </div>

                {/* 다음 기한/기일 */}
                <div className="flex-shrink-0 text-right">
                  {priority.nextDeadline ? (
                    <div>
                      <span
                        className={`text-xs font-medium ${
                          priority.nextDeadline.daysRemaining <= 3
                            ? 'text-[var(--color-danger)]'
                            : priority.nextDeadline.daysRemaining <= 7
                              ? 'text-[var(--color-warning)]'
                              : 'text-[var(--text-secondary)]'
                        }`}
                      >
                        {priority.nextDeadline.daysRemaining === 0
                          ? 'D-day'
                          : priority.nextDeadline.daysRemaining < 0
                            ? `D+${Math.abs(priority.nextDeadline.daysRemaining)}`
                            : `D-${priority.nextDeadline.daysRemaining}`}
                      </span>
                      <p className="text-xs text-[var(--text-tertiary)]">
                        {priority.nextDeadline.typeName}
                      </p>
                    </div>
                  ) : priority.nextHearing ? (
                    <div>
                      <span
                        className={`text-xs font-medium ${
                          priority.nextHearing.daysRemaining <= 3
                            ? 'text-[var(--color-danger)]'
                            : 'text-[var(--text-secondary)]'
                        }`}
                      >
                        D-{priority.nextHearing.daysRemaining}
                      </span>
                      <p className="text-xs text-[var(--text-tertiary)]">
                        {priority.nextHearing.typeName}
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* 리스크 플래그 */}
              {priority.riskFlags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {priority.riskFlags.slice(0, 2).map((flag) => (
                    <span
                      key={flag.id}
                      className={`text-xs px-1.5 py-0.5 rounded ${
                        flag.severity === 'critical'
                          ? 'bg-[var(--color-danger-muted)] text-[var(--color-danger)]'
                          : flag.severity === 'high'
                            ? 'bg-[var(--color-warning-muted)] text-[var(--color-warning)]'
                            : 'bg-[var(--color-warning-muted)] text-[var(--color-warning)]'
                      }`}
                    >
                      {flag.title}
                    </span>
                  ))}
                </div>
              )}

              {/* 추천 작업 */}
              {priority.recommendedActions.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs text-[var(--text-tertiary)]">
                    다음 작업: {priority.recommendedActions[0].title}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
