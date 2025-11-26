'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { ConsultationSource } from '@/types/consultation-source';
import { getSourceColorClass } from '@/types/consultation-source';

interface SourceStats {
  source: ConsultationSource;
  count: number;
  percentage: number;
}

export default function SourceStatsWidget() {
  const [stats, setStats] = useState<SourceStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);

      // 1. Fetch active consultation sources
      const sourcesRes = await fetch('/api/admin/consultation-sources?active_only=true');
      const sourcesData = await sourcesRes.json();

      if (!sourcesRes.ok) {
        throw new Error('Failed to fetch consultation sources');
      }

      const sources = sourcesData.data || [];

      // 2. Fetch all consultations
      const consultationsRes = await fetch('/api/admin/consultations');
      const consultationsData = await consultationsRes.json();

      if (!consultationsRes.ok) {
        throw new Error('Failed to fetch consultations');
      }

      const consultations = consultationsData.data || [];

      // 3. Count consultations by source
      const total = consultations.length;
      const counts = new Map<string, number>();

      consultations.forEach((consultation: any) => {
        if (consultation.source) {
          counts.set(consultation.source, (counts.get(consultation.source) || 0) + 1);
        }
      });

      // 4. Generate statistics
      const statsData = sources
        .map((source: ConsultationSource) => ({
          source,
          count: counts.get(source.name) || 0,
          percentage: total > 0 ? ((counts.get(source.name) || 0) / total) * 100 : 0,
        }))
        .sort((a: { count: number }, b: { count: number }) => b.count - a.count);

      setStats(statsData);
    } catch (err) {
      console.error('Error fetching source statistics:', err);
      setError(err instanceof Error ? err.message : 'Failed to load statistics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4 text-gray-900">유입 경로 분석</h3>
        <div className="flex items-center justify-center py-8 text-gray-500">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sage-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4 text-gray-900">유입 경로 분석</h3>
        <div className="text-center py-8 text-red-600">
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">유입 경로 분석</h3>
        <Link
          href="/admin/settings/sources"
          className="text-xs text-sage-600 hover:text-sage-800 font-medium"
        >
          관리 →
        </Link>
      </div>

      <div className="space-y-3">
        {stats.length === 0 ? (
          <p className="text-center text-gray-500 py-8">
            데이터가 없습니다.
          </p>
        ) : (
          stats.map(({ source, count, percentage }) => (
            <div key={source.id} className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1">
                <div
                  className={`w-3 h-3 rounded-full`}
                  style={{ backgroundColor: `var(--color-${source.color}-500, #6b7280)` }}
                />
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSourceColorClass(source.color)}`}>
                  {source.name}
                </span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-gray-600 text-sm">{count}건</span>
                <span className="text-sm font-medium text-gray-900 w-12 text-right">
                  {percentage.toFixed(1)}%
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Progress bars */}
      {stats.length > 0 && (
        <div className="mt-6 space-y-2">
          {stats.slice(0, 5).map(({ source, percentage }) => (
            <div key={`bar-${source.id}`} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600">{source.name}</span>
                <span className="font-medium text-gray-900">{percentage.toFixed(1)}%</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full ${getSourceColorClass(source.color).split(' ')[0]} transition-all duration-500`}
                  style={{ width: `${Math.max(percentage, 2)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {stats.length > 5 && (
        <p className="mt-4 text-xs text-center text-gray-500">
          상위 5개 유입 경로만 표시됩니다
        </p>
      )}
    </div>
  );
}
