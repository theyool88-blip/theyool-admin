'use client';

import { useEffect, useState } from 'react';
import {
  Bell,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
  Mail,
  MessageSquare,
  Smartphone,
  Send,
  Filter,
} from 'lucide-react';

interface NotificationStats {
  total: number;
  pending: number;
  sent: number;
  failed: number;
  byType: {
    email: number;
    sms: number;
    push: number;
    kakao: number;
  };
}

interface RecentNotification {
  id: string;
  type: 'email' | 'sms' | 'push' | 'kakao';
  recipient: string;
  subject: string;
  status: 'pending' | 'sent' | 'failed';
  created_at: string;
  sent_at?: string;
  error?: string;
}

export default function NotificationsMonitoringPage() {
  const [stats, setStats] = useState<NotificationStats | null>(null);
  const [notifications, setNotifications] = useState<RecentNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  const fetchData = async () => {
    setLoading(true);
    setError('');

    try {
      setStats({
        total: 1250,
        pending: 3,
        sent: 1235,
        failed: 12,
        byType: {
          email: 890,
          sms: 120,
          push: 200,
          kakao: 40,
        },
      });

      setNotifications([
        {
          id: '1',
          type: 'email',
          recipient: 'user@example.com',
          subject: '사건 진행 알림',
          status: 'sent',
          created_at: new Date(Date.now() - 3600000).toISOString(),
          sent_at: new Date(Date.now() - 3500000).toISOString(),
        },
        {
          id: '2',
          type: 'kakao',
          recipient: '010-1234-5678',
          subject: '상담 일정 확인',
          status: 'sent',
          created_at: new Date(Date.now() - 7200000).toISOString(),
          sent_at: new Date(Date.now() - 7100000).toISOString(),
        },
        {
          id: '3',
          type: 'sms',
          recipient: '010-9876-5432',
          subject: '기일 알림',
          status: 'failed',
          created_at: new Date(Date.now() - 10800000).toISOString(),
          error: '잘못된 전화번호',
        },
        {
          id: '4',
          type: 'push',
          recipient: 'device_token_abc',
          subject: '새 메시지 도착',
          status: 'pending',
          created_at: new Date(Date.now() - 60000).toISOString(),
        },
      ]);
    } catch (err) {
      console.error('Notifications fetch error:', err);
      setError('알림 데이터 조회에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formatAge = (dateString: string) => {
    const diff = Date.now() - new Date(dateString).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}분 전`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}시간 전`;
    const days = Math.floor(hours / 24);
    return `${days}일 전`;
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'email': return <Mail className="w-4 h-4" />;
      case 'sms': return <Smartphone className="w-4 h-4" />;
      case 'push': return <Bell className="w-4 h-4" />;
      case 'kakao': return <MessageSquare className="w-4 h-4" />;
      default: return <Send className="w-4 h-4" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'email': return '이메일';
      case 'sms': return 'SMS';
      case 'push': return '푸시';
      case 'kakao': return '카카오';
      default: return type;
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'sent':
        return {
          icon: <CheckCircle2 className="w-4 h-4" />,
          color: 'text-[--sa-accent-green]',
          bg: 'bg-[--sa-accent-green-muted]',
          label: '발송 완료',
        };
      case 'failed':
        return {
          icon: <XCircle className="w-4 h-4" />,
          color: 'text-[--sa-accent-red]',
          bg: 'bg-[--sa-accent-red-muted]',
          label: '실패',
        };
      default:
        return {
          icon: <Clock className="w-4 h-4" />,
          color: 'text-[--sa-accent-yellow]',
          bg: 'bg-[--sa-accent-yellow-muted]',
          label: '대기 중',
        };
    }
  };

  const filteredNotifications = notifications.filter((n) => {
    if (typeFilter && n.type !== typeFilter) return false;
    if (statusFilter && n.status !== statusFilter) return false;
    return true;
  });

  if (loading && !stats) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-5 h-5 animate-spin text-[--sa-text-muted] mx-auto mb-3" />
          <p className="text-[13px] text-[--sa-text-tertiary]">데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-6 h-6 text-[--sa-accent-red] mx-auto mb-3" />
          <p className="text-[13px] text-[--sa-accent-red] mb-4">{error}</p>
          <button
            onClick={fetchData}
            className="text-[13px] text-[--sa-text-secondary] hover:text-[--sa-text-primary] underline"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-semibold text-[--sa-text-primary] tracking-tight">알림 시스템 모니터링</h1>
          <p className="text-[13px] text-[--sa-text-tertiary] mt-1">이메일, SMS, 푸시, 카카오 알림 현황</p>
        </div>
        <button onClick={fetchData} className="sa-btn sa-btn-secondary">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          새로고침
        </button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="sa-card p-5">
          <div className="w-10 h-10 rounded-xl bg-[--sa-accent-blue-muted] flex items-center justify-center mb-3">
            <Send className="w-5 h-5 text-[--sa-accent-blue]" />
          </div>
          <div className="text-[24px] font-bold text-[--sa-text-primary]">{stats.total.toLocaleString()}</div>
          <p className="text-[11px] text-[--sa-text-tertiary] mt-1">전체 알림</p>
        </div>

        <div className="sa-card p-5">
          <div className="w-10 h-10 rounded-xl bg-[--sa-accent-yellow-muted] flex items-center justify-center mb-3">
            <Clock className="w-5 h-5 text-[--sa-accent-yellow]" />
          </div>
          <div className="text-[24px] font-bold text-[--sa-accent-yellow]">{stats.pending}</div>
          <p className="text-[11px] text-[--sa-text-tertiary] mt-1">대기 중</p>
        </div>

        <div className="sa-card p-5">
          <div className="w-10 h-10 rounded-xl bg-[--sa-accent-green-muted] flex items-center justify-center mb-3">
            <CheckCircle2 className="w-5 h-5 text-[--sa-accent-green]" />
          </div>
          <div className="text-[24px] font-bold text-[--sa-accent-green]">{stats.sent.toLocaleString()}</div>
          <p className="text-[11px] text-[--sa-text-tertiary] mt-1">발송 완료</p>
        </div>

        <div className="sa-card p-5">
          <div className="w-10 h-10 rounded-xl bg-[--sa-accent-red-muted] flex items-center justify-center mb-3">
            <XCircle className="w-5 h-5 text-[--sa-accent-red]" />
          </div>
          <div className="text-[24px] font-bold text-[--sa-accent-red]">{stats.failed}</div>
          <p className="text-[11px] text-[--sa-text-tertiary] mt-1">실패</p>
        </div>
      </div>

      {/* By Type */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="sa-card p-6">
          <h2 className="text-[15px] font-semibold text-[--sa-text-primary] mb-4">채널별 현황</h2>
          <div className="space-y-4">
            {[
              { key: 'email', label: '이메일', count: stats.byType.email, color: '--sa-accent-blue' },
              { key: 'sms', label: 'SMS', count: stats.byType.sms, color: '--sa-accent-green' },
              { key: 'push', label: '푸시', count: stats.byType.push, color: '--sa-accent-violet' },
              { key: 'kakao', label: '카카오', count: stats.byType.kakao, color: '--sa-accent-yellow' },
            ].map((item) => (
              <div key={item.key} className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl bg-[${item.color}-muted] flex items-center justify-center`}>
                  {getTypeIcon(item.key)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[13px] font-medium text-[--sa-text-primary]">{item.label}</span>
                    <span className="text-[13px] text-[--sa-text-muted]">{item.count.toLocaleString()}건</span>
                  </div>
                  <div className="h-2 bg-[--sa-bg-tertiary] rounded-full overflow-hidden">
                    <div
                      className={`h-full bg-[${item.color}] rounded-full`}
                      style={{ width: `${(item.count / stats.total) * 100}%`, backgroundColor: `var(${item.color})` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Success Rate */}
        <div className="sa-card p-6">
          <h2 className="text-[15px] font-semibold text-[--sa-text-primary] mb-4">성공률</h2>
          <div className="flex items-center justify-center">
            <div className="relative w-48 h-48">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="96"
                  cy="96"
                  r="80"
                  fill="none"
                  stroke="var(--sa-bg-tertiary)"
                  strokeWidth="16"
                />
                <circle
                  cx="96"
                  cy="96"
                  r="80"
                  fill="none"
                  stroke="var(--sa-accent-green)"
                  strokeWidth="16"
                  strokeDasharray={`${(stats.sent / (stats.sent + stats.failed)) * 502.65} 502.65`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[32px] font-bold text-[--sa-text-primary]">
                  {((stats.sent / (stats.sent + stats.failed)) * 100).toFixed(1)}%
                </span>
                <span className="text-[12px] text-[--sa-text-tertiary]">성공률</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Notifications */}
      <div className="sa-card overflow-hidden">
        <div className="p-5 border-b border-[--sa-border-default]">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-semibold text-[--sa-text-primary]">최근 알림</h2>
            <div className="flex items-center gap-3">
              <Filter className="w-4 h-4 text-[--sa-text-muted]" />
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="sa-input text-[13px]"
              >
                <option value="">전체 채널</option>
                <option value="email">이메일</option>
                <option value="sms">SMS</option>
                <option value="push">푸시</option>
                <option value="kakao">카카오</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="sa-input text-[13px]"
              >
                <option value="">전체 상태</option>
                <option value="pending">대기 중</option>
                <option value="sent">발송 완료</option>
                <option value="failed">실패</option>
              </select>
            </div>
          </div>
        </div>

        <div className="divide-y divide-[--sa-border-subtle]">
          {filteredNotifications.length === 0 ? (
            <div className="p-8 text-center text-[13px] text-[--sa-text-muted]">
              알림 내역이 없습니다.
            </div>
          ) : (
            filteredNotifications.map((notification) => {
              const statusConfig = getStatusConfig(notification.status);
              return (
                <div key={notification.id} className="p-4 hover:bg-[--sa-bg-hover] transition-colors">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-[--sa-bg-tertiary] flex items-center justify-center flex-shrink-0 text-[--sa-text-muted]">
                      {getTypeIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[11px] font-medium text-[--sa-text-tertiary] bg-[--sa-bg-tertiary] px-2 py-0.5 rounded">
                          {getTypeLabel(notification.type)}
                        </span>
                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded flex items-center gap-1 ${statusConfig.bg} ${statusConfig.color}`}>
                          {statusConfig.icon}
                          {statusConfig.label}
                        </span>
                      </div>
                      <p className="text-[13px] font-medium text-[--sa-text-primary] truncate">
                        {notification.subject}
                      </p>
                      <p className="text-[11px] text-[--sa-text-tertiary] truncate">
                        {notification.recipient}
                      </p>
                      {notification.error && (
                        <p className="text-[11px] text-[--sa-accent-red] mt-1">
                          오류: {notification.error}
                        </p>
                      )}
                    </div>
                    <div className="text-right text-[11px] text-[--sa-text-muted] flex-shrink-0">
                      <p>{formatAge(notification.created_at)}</p>
                      {notification.sent_at && (
                        <p className="text-[--sa-accent-green]">발송됨</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
