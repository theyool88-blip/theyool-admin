'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  Database,
  Server,
  Bell,
  Scale,
  RefreshCw,
  AlertCircle,
  ArrowUpRight,
  Cpu,
} from 'lucide-react';

interface SystemHealth {
  database: {
    status: 'healthy' | 'warning' | 'error';
    latency: number;
    connections: number;
  };
  api: {
    status: 'healthy' | 'warning' | 'error';
    uptime: number;
    responseTime: number;
  };
  scourt: {
    status: 'healthy' | 'warning' | 'error';
    queuedJobs: number;
    lastSync: string | null;
  };
  notifications: {
    status: 'healthy' | 'warning' | 'error';
    pendingCount: number;
    failedCount: number;
  };
}

export default function MonitoringOverviewPage() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchHealth = async () => {
    setLoading(true);
    setError('');

    try {
      // 실제 API가 준비되면 교체
      // 임시 데이터
      setHealth({
        database: {
          status: 'healthy',
          latency: 12,
          connections: 5,
        },
        api: {
          status: 'healthy',
          uptime: 99.9,
          responseTime: 45,
        },
        scourt: {
          status: 'healthy',
          queuedJobs: 0,
          lastSync: new Date().toISOString(),
        },
        notifications: {
          status: 'healthy',
          pendingCount: 0,
          failedCount: 0,
        },
      });
    } catch (err) {
      console.error('Health fetch error:', err);
      setError('시스템 상태 조회에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 30000); // 30초마다 갱신
    return () => clearInterval(interval);
  }, []);

  const formatTime = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('ko-KR');
  };

  if (loading && !health) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-5 h-5 animate-spin text-[--sa-text-muted] mx-auto mb-3" />
          <p className="text-[13px] text-[--sa-text-tertiary]">시스템 상태 확인 중...</p>
        </div>
      </div>
    );
  }

  if (error && !health) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full bg-[--sa-accent-red-muted] flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-5 h-5 text-[--sa-accent-red]" />
          </div>
          <p className="text-[13px] text-[--sa-text-secondary] mb-4">{error}</p>
          <button onClick={fetchHealth} className="sa-btn sa-btn-secondary">
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  if (!health) return null;

  const allHealthy = Object.values(health).every(s => s.status === 'healthy');
  const hasError = Object.values(health).some(s => s.status === 'error');

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-semibold text-[--sa-text-primary] tracking-tight">
            시스템 모니터링
          </h1>
          <p className="text-[13px] text-[--sa-text-tertiary] mt-1">
            플랫폼 상태 실시간 모니터링
          </p>
        </div>
        <button onClick={fetchHealth} className="sa-btn sa-btn-ghost">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          새로고침
        </button>
      </div>

      {/* Overall Status Banner */}
      <div className={`sa-card p-5 mb-6 ${
        allHealthy ? 'border-[--sa-accent-green]/20' :
        hasError ? 'border-[--sa-accent-red]/20' : 'border-[--sa-accent-amber]/20'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              allHealthy ? 'bg-[--sa-accent-green-muted]' :
              hasError ? 'bg-[--sa-accent-red-muted]' : 'bg-[--sa-accent-amber-muted]'
            }`}>
              {allHealthy ? (
                <CheckCircle2 className="w-6 h-6 text-[--sa-accent-green]" />
              ) : hasError ? (
                <XCircle className="w-6 h-6 text-[--sa-accent-red]" />
              ) : (
                <AlertCircle className="w-6 h-6 text-[--sa-accent-amber]" />
              )}
            </div>
            <div>
              <h2 className="text-[15px] font-semibold text-[--sa-text-primary]">
                {allHealthy ? '모든 시스템 정상' :
                 hasError ? '시스템 오류 감지' : '일부 시스템 주의 필요'}
              </h2>
              <p className="text-[12px] text-[--sa-text-muted] mt-0.5">
                마지막 확인: {new Date().toLocaleTimeString('ko-KR')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {Object.entries(health).map(([key, value]) => (
              <StatusPill key={key} name={key} status={value.status} />
            ))}
          </div>
        </div>
      </div>

      {/* System Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Database */}
        <SystemCard
          title="데이터베이스"
          subtitle="Supabase PostgreSQL"
          icon={<Database className="w-5 h-5" />}
          status={health.database.status}
          metrics={[
            { label: '응답 시간', value: `${health.database.latency}ms`, good: health.database.latency < 50 },
            { label: '연결 수', value: health.database.connections.toString() },
          ]}
        />

        {/* API Server */}
        <SystemCard
          title="API 서버"
          subtitle="Next.js Server"
          icon={<Server className="w-5 h-5" />}
          status={health.api.status}
          metrics={[
            { label: '업타임', value: `${health.api.uptime}%`, good: health.api.uptime >= 99.9 },
            { label: '평균 응답', value: `${health.api.responseTime}ms`, good: health.api.responseTime < 100 },
          ]}
        />

        {/* SCOURT */}
        <SystemCard
          title="SCOURT 연동"
          subtitle="법원 사건 동기화"
          icon={<Scale className="w-5 h-5" />}
          status={health.scourt.status}
          metrics={[
            { label: '대기 작업', value: health.scourt.queuedJobs.toString(), good: health.scourt.queuedJobs === 0 },
            { label: '마지막 동기화', value: health.scourt.lastSync ? formatTime(health.scourt.lastSync).split(' ')[1] || '-' : '-' },
          ]}
          href="/superadmin/monitoring/scourt"
        />

        {/* Notifications */}
        <SystemCard
          title="알림 시스템"
          subtitle="푸시/이메일/SMS"
          icon={<Bell className="w-5 h-5" />}
          status={health.notifications.status}
          metrics={[
            { label: '대기 중', value: health.notifications.pendingCount.toString() },
            { label: '실패', value: health.notifications.failedCount.toString(), bad: health.notifications.failedCount > 0 },
          ]}
          href="/superadmin/monitoring/notifications"
        />
      </div>

      {/* Quick Actions */}
      <div className="sa-card p-5">
        <h2 className="text-[13px] font-semibold text-[--sa-text-primary] mb-4">빠른 링크</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <QuickLink
            href="/superadmin/monitoring/scourt"
            icon={<Scale className="w-4 h-4" />}
            label="SCOURT 상태"
          />
          <QuickLink
            href="/superadmin/monitoring/notifications"
            icon={<Bell className="w-4 h-4" />}
            label="알림 시스템"
          />
          <QuickLink
            href="/superadmin/audit"
            icon={<Activity className="w-4 h-4" />}
            label="감사 로그"
          />
          <QuickLink
            href="/superadmin/settings"
            icon={<Cpu className="w-4 h-4" />}
            label="시스템 설정"
          />
        </div>
      </div>
    </div>
  );
}

// Status Pill Component
function StatusPill({ name, status }: { name: string; status: 'healthy' | 'warning' | 'error' }) {
  const displayName = {
    database: 'DB',
    api: 'API',
    scourt: 'SCOURT',
    notifications: 'Notify',
  }[name] || name;

  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-[--sa-bg-tertiary]">
      <span className={`sa-status-dot ${status}`} />
      <span className="text-[11px] font-medium text-[--sa-text-muted]">{displayName}</span>
    </div>
  );
}

// System Card Component
function SystemCard({
  title,
  subtitle,
  icon,
  status,
  metrics,
  href,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  status: 'healthy' | 'warning' | 'error';
  metrics: { label: string; value: string; good?: boolean; bad?: boolean }[];
  href?: string;
}) {
  const statusConfig = {
    healthy: {
      bg: 'bg-[--sa-accent-green-muted]',
      color: 'text-[--sa-accent-green]',
      label: '정상',
      icon: <CheckCircle2 className="w-4 h-4" />,
    },
    warning: {
      bg: 'bg-[--sa-accent-amber-muted]',
      color: 'text-[--sa-accent-amber]',
      label: '주의',
      icon: <Clock className="w-4 h-4" />,
    },
    error: {
      bg: 'bg-[--sa-accent-red-muted]',
      color: 'text-[--sa-accent-red]',
      label: '오류',
      icon: <XCircle className="w-4 h-4" />,
    },
  };

  const config = statusConfig[status];

  const cardContent = (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg ${config.bg} flex items-center justify-center`}>
            <span className={config.color}>{icon}</span>
          </div>
          <div>
            <h3 className="text-[13px] font-semibold text-[--sa-text-primary]">{title}</h3>
            <p className="text-[11px] text-[--sa-text-muted]">{subtitle}</p>
          </div>
        </div>
        <div className={`flex items-center gap-1.5 ${config.color}`}>
          {config.icon}
          <span className="text-[12px] font-medium">{config.label}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {metrics.map((metric, index) => (
          <div key={index} className="p-3 bg-[--sa-bg-tertiary] rounded-lg">
            <p className="text-[10px] text-[--sa-text-muted] uppercase tracking-wider mb-1">
              {metric.label}
            </p>
            <p className={`text-[16px] font-semibold tracking-tight ${
              metric.good ? 'text-[--sa-accent-green]' :
              metric.bad ? 'text-[--sa-accent-red]' : 'text-[--sa-text-primary]'
            }`}>
              {metric.value}
            </p>
          </div>
        ))}
      </div>

      {href && (
        <div className="mt-4 pt-3 border-t border-[--sa-border-subtle] flex items-center justify-end">
          <span className="text-[11px] text-[--sa-text-muted] group-hover:text-[--sa-text-secondary] flex items-center gap-1 transition-colors">
            상세 보기
            <ArrowUpRight className="w-3 h-3" />
          </span>
        </div>
      )}
    </>
  );

  if (href) {
    return (
      <Link href={href} className="sa-card p-5 cursor-pointer group">
        {cardContent}
      </Link>
    );
  }

  return (
    <div className="sa-card p-5 group">
      {cardContent}
    </div>
  );
}

// Quick Link Component
function QuickLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 p-3 bg-[--sa-bg-tertiary] hover:bg-[--sa-bg-hover] rounded-lg transition-colors group"
    >
      <span className="text-[--sa-text-muted] group-hover:text-[--sa-text-secondary] transition-colors">
        {icon}
      </span>
      <span className="text-[12px] font-medium text-[--sa-text-secondary] group-hover:text-[--sa-text-primary] transition-colors">
        {label}
      </span>
    </Link>
  );
}
