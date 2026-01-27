'use client';

import { useEffect, useState } from 'react';
import type { ConsultationSource } from '@/types/consultation-source';
import { getSourceColorClass } from '@/types/consultation-source';

interface ConsultationSourceSelectorProps {
  value?: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  showLabel?: boolean;
}

export default function ConsultationSourceSelector({
  value,
  onChange,
  required = false,
  disabled = false,
  className = '',
  showLabel = true,
}: ConsultationSourceSelectorProps) {
  const [sources, setSources] = useState<ConsultationSource[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSources();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchSources = async () => {
    try {
      const response = await fetch('/api/admin/consultation-sources?active_only=true');
      const data = await response.json();

      if (response.ok) {
        const sortedSources = (data.data || []).sort((a: ConsultationSource, b: ConsultationSource) => {
          return a.display_order - b.display_order;
        });
        setSources(sortedSources);

        // Set default value if none is selected
        if (!value && sortedSources.length > 0) {
          const defaultSource = sortedSources.find((s: ConsultationSource) => s.is_default);
          if (defaultSource) {
            onChange(defaultSource.name);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching consultation sources:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectedSource = sources.find(s => s.name === value);

  return (
    <div className={className}>
      {showLabel && (
        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
          유입 경로 {required && <span className="text-[var(--color-danger)]">*</span>}
        </label>
      )}

      <div className="space-y-2">
        {/* Select Dropdown */}
        <select
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled || loading}
          required={required}
          className="form-input w-full"
        >
          <option value="">선택하세요</option>
          {sources.map((source) => (
            <option key={source.id} value={source.name}>
              {source.name}
              {source.is_default && ' (기본값)'}
            </option>
          ))}
        </select>

        {/* Selected Source Badge */}
        {selectedSource && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-[var(--text-tertiary)]">선택됨:</span>
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getSourceColorClass(selectedSource.color)}`}>
              {selectedSource.name}
            </span>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <p className="text-sm text-[var(--text-tertiary)]">유입 경로를 불러오는 중...</p>
        )}

        {/* Empty State */}
        {!loading && sources.length === 0 && (
          <p className="text-sm text-[var(--color-danger)]">
            사용 가능한 유입 경로가 없습니다. 설정에서 추가해주세요.
          </p>
        )}
      </div>
    </div>
  );
}
