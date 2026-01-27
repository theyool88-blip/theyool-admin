'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { AlertCircle, AlertTriangle, FileText, CheckCircle, type LucideIcon } from 'lucide-react';

interface RiskAlert {
  id: string;
  severity: 'critical' | 'high' | 'medium';
  title: string;
  description?: string;
  caseId: string;
  caseNumber: string;
  clientName?: string;
  actionRequired?: string;
}

interface Props {
  limit?: number;
}

export default function RiskAlertsWidget({ limit = 5 }: Props) {
  const [alerts, setAlerts] = useState<RiskAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAlerts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit]);

  async function fetchAlerts() {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/planning?limit=${limit * 2}`);
      const data = await response.json();

      if (data.success && data.data) {
        // 모든 사건의 리스크 플래그 수집
        const allAlerts: RiskAlert[] = [];

        for (const priority of data.data) {
          if (priority.riskFlags && priority.riskFlags.length > 0) {
            for (const flag of priority.riskFlags) {
              allAlerts.push({
                id: flag.id,
                severity: flag.severity as 'critical' | 'high' | 'medium',
                title: flag.title,
                description: flag.description,
                caseId: priority.caseId,
                caseNumber: priority.caseNumber,
                clientName: priority.clientName,
              });
            }
          }
        }

        // 심각도순 정렬
        const severityOrder = { critical: 0, high: 1, medium: 2 };
        allAlerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

        setAlerts(allAlerts.slice(0, limit));
      } else {
        setError(data.error || '데이터를 불러오지 못했습니다');
      }
    } catch (err) {
      setError('서버 오류가 발생했습니다');
      console.error('Failed to fetch alerts:', err);
    } finally {
      setLoading(false);
    }
  }

  const severityStyles: Record<string, { bg: string; text: string; icon: LucideIcon }> = {
    critical: {
      bg: 'bg-[var(--color-danger-muted)]',
      text: 'text-[var(--color-danger)]',
      icon: AlertCircle,
    },
    high: {
      bg: 'bg-[var(--color-warning-muted)]',
      text: 'text-[var(--color-warning)]',
      icon: AlertTriangle,
    },
    medium: {
      bg: 'bg-[var(--bg-tertiary)]',
      text: 'text-[var(--text-secondary)]',
      icon: FileText,
    },
  };

  const severityLabels: Record<string, string> = {
    critical: '긴급',
    high: '주의',
    medium: '참고',
  };

  if (loading) {
    return (
      <div className="card">
        <div className="px-4 py-3 border-b border-[var(--border-subtle)]">
          <p className="text-sm font-medium text-[var(--text-primary)]">리스크 알림</p>
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
          <p className="text-sm font-medium text-[var(--text-primary)]">리스크 알림</p>
        </div>
        <div className="p-4 text-center text-sm text-[var(--text-tertiary)]">{error}</div>
      </div>
    );
  }

  const criticalCount = alerts.filter((a) => a.severity === 'critical').length;

  return (
    <div className="card">
      <div className="px-4 py-3 border-b border-[var(--border-subtle)] flex items-center justify-between">
        <p className="text-sm font-medium text-[var(--text-primary)]">리스크 알림</p>
        {criticalCount > 0 && (
          <span className="px-2 py-0.5 bg-[var(--color-danger-muted)] text-[var(--color-danger)] text-xs font-medium rounded">
            긴급 {criticalCount}건
          </span>
        )}
      </div>

      {alerts.length === 0 ? (
        <div className="p-4 text-center">
          <CheckCircle className="w-8 h-8 mx-auto text-[var(--sage-primary)]" />
          <p className="text-sm text-[var(--text-tertiary)] mt-2">확인이 필요한 리스크가 없습니다</p>
        </div>
      ) : (
        <div className="divide-y divide-[var(--border-subtle)]">
          {alerts.map((alert, index) => {
            const style = severityStyles[alert.severity];
            return (
              <div
                key={`${alert.id}-${index}`}
                className={`px-4 py-3 ${style.bg} hover:opacity-90 transition-opacity`}
              >
                <div className="flex items-start gap-3">
                  {/* 아이콘 */}
                  <style.icon className={`w-5 h-5 flex-shrink-0 ${style.text}`} />

                  {/* 내용 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-medium px-1.5 py-0.5 rounded ${style.text} bg-white/50`}
                      >
                        {severityLabels[alert.severity]}
                      </span>
                      <span className={`text-sm font-medium ${style.text}`}>
                        {alert.title}
                      </span>
                    </div>
                    <Link
                      href={`/admin/cases?id=${alert.caseId}`}
                      className="text-xs text-[var(--text-secondary)] hover:text-[var(--sage-primary)] block truncate mt-1"
                    >
                      {alert.caseNumber}
                      {alert.clientName && ` · ${alert.clientName}`}
                    </Link>
                    {alert.description && (
                      <p className="text-xs text-[var(--text-tertiary)] mt-1 line-clamp-2">
                        {alert.description}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
