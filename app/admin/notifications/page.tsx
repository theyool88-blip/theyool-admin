'use client';

import { useState, useEffect, useCallback } from 'react';
import type {
  NotificationTemplate,
  NotificationLog,
  NotificationSchedule,
  NotificationChannel,
  TemplateCategory,
  NotificationStatus,
} from '@/types/notification';

// 상수 정의
const categoryLabels: Record<TemplateCategory, string> = {
  hearing_reminder: '재판기일 알림',
  consultation_reminder: '상담 리마인더',
  deadline_reminder: '기한 마감 알림',
  manual: '수동 발송',
};

const channelLabels: Record<NotificationChannel, string> = {
  sms: 'SMS',
  kakao_alimtalk: '카카오 알림톡',
};

const statusLabels: Record<NotificationStatus, string> = {
  pending: '대기',
  sent: '발송',
  delivered: '전달',
  failed: '실패',
};

const statusColors: Record<NotificationStatus, string> = {
  pending: 'text-[var(--color-warning)] bg-[var(--color-warning-muted)]',
  sent: 'text-[var(--sage-primary)] bg-[var(--sage-muted)]',
  delivered: 'text-[var(--color-success)] bg-[var(--color-success-muted)]',
  failed: 'text-[var(--color-danger)] bg-[var(--color-danger-muted)]',
};

type TabType = 'templates' | 'logs' | 'send' | 'settings';

export default function NotificationsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('templates');
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [schedules, setSchedules] = useState<NotificationSchedule[]>([]);
  const [_loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 템플릿 편집 상태
  const [editingTemplate, setEditingTemplate] = useState<NotificationTemplate | null>(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);

  // 수동 발송 상태
  const [sendForm, setSendForm] = useState({
    channel: 'sms' as NotificationChannel,
    templateId: '',
    customContent: '',
    recipientPhone: '',
    recipientName: '',
    recipientType: 'client' as 'client' | 'consultation',
  });
  const [sending, setSending] = useState(false);

  // 페이지네이션
  const [logPage, setLogPage] = useState(1);
  const [logTotal, setLogTotal] = useState(0);

  // 템플릿 목록 조회
  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/notifications/templates?active_only=false');
      const data = await res.json();
      if (data.success) {
        setTemplates(data.data);
      }
    } catch (_err) {
      setError('템플릿 조회 실패');
    } finally {
      setLoading(false);
    }
  }, []);

  // 발송 이력 조회
  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/notifications/logs?page=${logPage}&limit=20`);
      const data = await res.json();
      if (data.success) {
        setLogs(data.data);
        setLogTotal(data.pagination.total);
      }
    } catch (_err) {
      setError('발송 이력 조회 실패');
    } finally {
      setLoading(false);
    }
  }, [logPage]);

  // 자동 발송 설정 조회
  const fetchSchedules = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/notifications/schedules');
      const data = await res.json();
      if (data.success) {
        setSchedules(data.data);
      }
    } catch (_err) {
      setError('설정 조회 실패');
    } finally {
      setLoading(false);
    }
  }, []);

  // 탭 변경시 데이터 로드
  useEffect(() => {
    setError(null);
    if (activeTab === 'templates') {
      fetchTemplates();
    } else if (activeTab === 'logs') {
      fetchLogs();
    } else if (activeTab === 'settings') {
      fetchSchedules();
      fetchTemplates(); // 템플릿 선택 위해
    } else if (activeTab === 'send') {
      fetchTemplates(); // 템플릿 선택 위해
    }
  }, [activeTab, fetchTemplates, fetchLogs, fetchSchedules]);

  // 템플릿 저장
  const saveTemplate = async (template: Partial<NotificationTemplate>) => {
    try {
      setLoading(true);
      const isNew = !template.id;
      const url = isNew
        ? '/api/admin/notifications/templates'
        : `/api/admin/notifications/templates/${template.id}`;
      const method = isNew ? 'POST' : 'PUT';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(template),
      });

      const data = await res.json();
      if (data.success) {
        setShowTemplateModal(false);
        setEditingTemplate(null);
        fetchTemplates();
      } else {
        setError(data.error);
      }
    } catch (_err) {
      setError('템플릿 저장 실패');
    } finally {
      setLoading(false);
    }
  };

  // 템플릿 삭제
  const deleteTemplate = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;

    try {
      const res = await fetch(`/api/admin/notifications/templates/${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        fetchTemplates();
      } else {
        setError(data.error);
      }
    } catch (_err) {
      setError('템플릿 삭제 실패');
    }
  };

  // 수동 발송
  const handleSend = async () => {
    if (!sendForm.recipientPhone) {
      setError('수신자 전화번호를 입력해주세요.');
      return;
    }
    if (!sendForm.templateId && !sendForm.customContent) {
      setError('템플릿을 선택하거나 메시지를 입력해주세요.');
      return;
    }

    try {
      setSending(true);
      const res = await fetch('/api/admin/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: sendForm.channel,
          template_id: sendForm.templateId || undefined,
          custom_content: sendForm.customContent || undefined,
          recipients: [
            {
              type: sendForm.recipientType,
              phone: sendForm.recipientPhone,
              name: sendForm.recipientName,
            },
          ],
        }),
      });

      const data = await res.json();
      if (data.success) {
        alert('발송 완료!');
        setSendForm({
          ...sendForm,
          recipientPhone: '',
          recipientName: '',
          customContent: '',
        });
      } else {
        setError(data.error || data.message);
      }
    } catch (_err) {
      setError('발송 실패');
    } finally {
      setSending(false);
    }
  };

  // 자동 발송 설정 저장
  const saveSchedule = async (schedule: Partial<NotificationSchedule>) => {
    try {
      const res = await fetch('/api/admin/notifications/schedules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(schedule),
      });

      const data = await res.json();
      if (data.success) {
        fetchSchedules();
      } else {
        setError(data.error);
      }
    } catch (_err) {
      setError('설정 저장 실패');
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">알림 관리</h1>
          <p className="text-[var(--text-secondary)] mt-1">SMS 및 카카오 알림톡 발송 관리</p>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-[var(--color-danger-muted)] border border-[var(--color-danger)] rounded-lg text-[var(--color-danger)]">
            {error}
            <button onClick={() => setError(null)} className="ml-2 text-[var(--color-danger)]">
              ✕
            </button>
          </div>
        )}

        {/* 탭 네비게이션 */}
        <div className="border-b border-[var(--border-default)] mb-6">
          <nav className="-mb-px flex space-x-8">
            {[
              { key: 'templates', label: '템플릿 관리' },
              { key: 'logs', label: '발송 이력' },
              { key: 'send', label: '수동 발송' },
              { key: 'settings', label: '자동 발송 설정' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as TabType)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.key
                    ? 'border-[var(--sage-primary)] text-[var(--sage-primary)]'
                    : 'border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:border-[var(--border-default)]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* 템플릿 관리 탭 */}
        {activeTab === 'templates' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-medium text-[var(--text-primary)]">메시지 템플릿</h2>
              <button
                onClick={() => {
                  setEditingTemplate(null);
                  setShowTemplateModal(true);
                }}
                className="btn btn-primary px-4 py-2"
              >
                + 새 템플릿
              </button>
            </div>

            <div className="card overflow-hidden">
              <table className="min-w-full divide-y divide-[var(--border-default)]">
                <thead className="bg-[var(--bg-primary)]">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text-tertiary)] uppercase">이름</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text-tertiary)] uppercase">카테고리</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text-tertiary)] uppercase">채널</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text-tertiary)] uppercase">상태</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-[var(--text-tertiary)] uppercase">관리</th>
                  </tr>
                </thead>
                <tbody className="bg-[var(--bg-secondary)] divide-y divide-[var(--border-subtle)]">
                  {templates.map((template) => (
                    <tr key={template.id} className="hover:bg-[var(--bg-hover)]">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-[var(--text-primary)]">{template.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--text-tertiary)]">
                        {categoryLabels[template.category]}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--text-tertiary)]">
                        {channelLabels[template.channel]}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 text-xs rounded-full ${
                            template.is_active ? 'bg-[var(--color-success-muted)] text-[var(--color-success)]' : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'
                          }`}
                        >
                          {template.is_active ? '활성' : '비활성'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        <button
                          onClick={() => {
                            setEditingTemplate(template);
                            setShowTemplateModal(true);
                          }}
                          className="text-[var(--sage-primary)] hover:opacity-80 mr-3"
                        >
                          수정
                        </button>
                        <button
                          onClick={() => deleteTemplate(template.id)}
                          className="text-[var(--color-danger)] hover:opacity-80"
                        >
                          삭제
                        </button>
                      </td>
                    </tr>
                  ))}
                  {templates.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-[var(--text-tertiary)]">
                        등록된 템플릿이 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 발송 이력 탭 */}
        {activeTab === 'logs' && (
          <div>
            <h2 className="text-lg font-medium text-[var(--text-primary)] mb-4">발송 이력</h2>

            <div className="card overflow-hidden">
              <table className="min-w-full divide-y divide-[var(--border-default)]">
                <thead className="bg-[var(--bg-primary)]">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text-tertiary)] uppercase">일시</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text-tertiary)] uppercase">수신자</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text-tertiary)] uppercase">채널</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text-tertiary)] uppercase">상태</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text-tertiary)] uppercase">내용</th>
                  </tr>
                </thead>
                <tbody className="bg-[var(--bg-secondary)] divide-y divide-[var(--border-subtle)]">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-[var(--bg-hover)]">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--text-tertiary)]">
                        {new Date(log.created_at).toLocaleString('ko-KR')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-[var(--text-primary)]">{log.recipient_name || '-'}</div>
                        <div className="text-sm text-[var(--text-tertiary)]">{log.recipient_phone}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--text-tertiary)]">
                        {channelLabels[log.channel]}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs rounded-full ${statusColors[log.status]}`}>
                          {statusLabels[log.status]}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-[var(--text-tertiary)] max-w-xs truncate">
                        {log.content.substring(0, 50)}...
                      </td>
                    </tr>
                  ))}
                  {logs.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-[var(--text-tertiary)]">
                        발송 이력이 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* 페이지네이션 */}
              {logTotal > 20 && (
                <div className="px-6 py-4 border-t border-[var(--border-default)] flex justify-center gap-2">
                  <button
                    onClick={() => setLogPage((p) => Math.max(1, p - 1))}
                    disabled={logPage === 1}
                    className="btn btn-secondary px-3 py-1 disabled:opacity-50"
                  >
                    이전
                  </button>
                  <span className="px-3 py-1 text-[var(--text-secondary)]">
                    {logPage} / {Math.ceil(logTotal / 20)}
                  </span>
                  <button
                    onClick={() => setLogPage((p) => p + 1)}
                    disabled={logPage >= Math.ceil(logTotal / 20)}
                    className="btn btn-secondary px-3 py-1 disabled:opacity-50"
                  >
                    다음
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 수동 발송 탭 */}
        {activeTab === 'send' && (
          <div className="max-w-2xl">
            <h2 className="text-lg font-medium text-[var(--text-primary)] mb-4">수동 발송</h2>

            <div className="card p-6 space-y-4">
              {/* 채널 선택 */}
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">발송 채널</label>
                <select
                  value={sendForm.channel}
                  onChange={(e) => setSendForm({ ...sendForm, channel: e.target.value as NotificationChannel })}
                  className="form-input w-full"
                >
                  <option value="sms">SMS</option>
                  <option value="kakao_alimtalk">카카오 알림톡</option>
                </select>
              </div>

              {/* 템플릿 선택 */}
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">템플릿 (선택)</label>
                <select
                  value={sendForm.templateId}
                  onChange={(e) => {
                    setSendForm({ ...sendForm, templateId: e.target.value });
                    if (e.target.value) {
                      const template = templates.find((t) => t.id === e.target.value);
                      if (template) {
                        setSendForm((prev) => ({
                          ...prev,
                          templateId: e.target.value,
                          customContent: template.content,
                        }));
                      }
                    }
                  }}
                  className="form-input w-full"
                >
                  <option value="">직접 입력</option>
                  {templates
                    .filter((t) => t.is_active)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({categoryLabels[t.category]})
                      </option>
                    ))}
                </select>
              </div>

              {/* 메시지 내용 */}
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">메시지 내용</label>
                <textarea
                  value={sendForm.customContent}
                  onChange={(e) => setSendForm({ ...sendForm, customContent: e.target.value })}
                  rows={5}
                  className="form-input w-full"
                  placeholder="메시지 내용을 입력하세요. 변수는 {{이름}} 형식으로 사용합니다."
                />
                <div className="text-sm text-[var(--text-tertiary)] mt-1">
                  {sendForm.customContent.length}자 / {sendForm.customContent.length > 90 ? 'LMS' : 'SMS'}
                </div>
              </div>

              {/* 수신자 정보 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">수신자 이름</label>
                  <input
                    type="text"
                    value={sendForm.recipientName}
                    onChange={(e) => setSendForm({ ...sendForm, recipientName: e.target.value })}
                    className="form-input w-full"
                    placeholder="홍길동"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">전화번호 *</label>
                  <input
                    type="tel"
                    value={sendForm.recipientPhone}
                    onChange={(e) => setSendForm({ ...sendForm, recipientPhone: e.target.value })}
                    className="form-input w-full"
                    placeholder="01012345678"
                  />
                </div>
              </div>

              {/* 발송 버튼 */}
              <button
                onClick={handleSend}
                disabled={sending}
                className="btn btn-primary w-full py-3 disabled:opacity-50"
              >
                {sending ? '발송 중...' : '발송하기'}
              </button>
            </div>
          </div>
        )}

        {/* 자동 발송 설정 탭 */}
        {activeTab === 'settings' && (
          <div className="max-w-2xl">
            <h2 className="text-lg font-medium text-[var(--text-primary)] mb-4">자동 발송 설정</h2>

            <div className="space-y-4">
              {schedules.map((schedule) => (
                <div key={schedule.id} className="card p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-medium text-[var(--text-primary)]">{categoryLabels[schedule.category as TemplateCategory]}</h3>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={schedule.is_active}
                        onChange={(e) =>
                          saveSchedule({
                            category: schedule.category as TemplateCategory,
                            is_active: e.target.checked,
                          })
                        }
                        className="mr-2"
                      />
                      <span className="text-sm text-[var(--text-secondary)]">활성화</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">템플릿</label>
                      <select
                        value={schedule.template_id || ''}
                        onChange={(e) =>
                          saveSchedule({
                            category: schedule.category as TemplateCategory,
                            template_id: e.target.value || undefined,
                          })
                        }
                        className="form-input w-full"
                      >
                        <option value="">선택 안함</option>
                        {templates
                          .filter((t) => t.is_active && t.category === schedule.category)
                          .map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">발송 시각</label>
                      <input
                        type="time"
                        value={schedule.time_of_day}
                        onChange={(e) =>
                          saveSchedule({
                            category: schedule.category as TemplateCategory,
                            time_of_day: e.target.value,
                          })
                        }
                        className="form-input w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">일정 전 발송</label>
                      <select
                        value={schedule.days_before}
                        onChange={(e) =>
                          saveSchedule({
                            category: schedule.category as TemplateCategory,
                            days_before: parseInt(e.target.value),
                          })
                        }
                        className="form-input w-full"
                      >
                        <option value={0}>당일</option>
                        <option value={1}>1일 전</option>
                        <option value={2}>2일 전</option>
                        <option value={3}>3일 전</option>
                        <option value={7}>7일 전</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">발송 채널</label>
                      <select
                        value={schedule.channel}
                        onChange={(e) =>
                          saveSchedule({
                            category: schedule.category as TemplateCategory,
                            channel: e.target.value as NotificationChannel | 'both',
                          })
                        }
                        className="form-input w-full"
                      >
                        <option value="sms">SMS</option>
                        <option value="kakao_alimtalk">카카오 알림톡</option>
                        <option value="both">SMS + 알림톡</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}

              {schedules.length === 0 && (
                <div className="card p-6 text-center text-[var(--text-tertiary)]">
                  자동 발송 설정이 없습니다.
                </div>
              )}
            </div>
          </div>
        )}

        {/* 템플릿 편집 모달 */}
        {showTemplateModal && (
          <TemplateEditModal
            template={editingTemplate}
            onSave={saveTemplate}
            onClose={() => {
              setShowTemplateModal(false);
              setEditingTemplate(null);
            }}
          />
        )}
      </main>
    </div>
  );
}

// 템플릿 편집 모달 컴포넌트
function TemplateEditModal({
  template,
  onSave,
  onClose,
}: {
  template: NotificationTemplate | null;
  onSave: (template: Partial<NotificationTemplate>) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    name: template?.name || '',
    channel: template?.channel || 'sms',
    category: template?.category || 'manual',
    title: template?.title || '',
    content: template?.content || '',
    message_type: template?.message_type || 'SMS',
    is_active: template?.is_active !== false,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...form,
      id: template?.id,
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="card max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-[var(--border-default)]">
          <h2 className="text-lg font-medium text-[var(--text-primary)]">{template ? '템플릿 수정' : '새 템플릿'}</h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">템플릿 이름 *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="form-input w-full"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">채널</label>
              <select
                value={form.channel}
                onChange={(e) => setForm({ ...form, channel: e.target.value as NotificationChannel })}
                className="form-input w-full"
              >
                <option value="sms">SMS</option>
                <option value="kakao_alimtalk">카카오 알림톡</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">카테고리</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value as TemplateCategory })}
                className="form-input w-full"
              >
                <option value="hearing_reminder">재판기일 알림</option>
                <option value="consultation_reminder">상담 리마인더</option>
                <option value="deadline_reminder">기한 마감 알림</option>
                <option value="manual">수동 발송</option>
              </select>
            </div>
          </div>

          {form.channel === 'kakao_alimtalk' && (
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">제목 (알림톡)</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="form-input w-full"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">메시지 내용 *</label>
            <textarea
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              rows={8}
              className="form-input w-full font-mono text-sm"
              required
            />
            <div className="text-sm text-[var(--text-tertiary)] mt-1">
              사용 가능 변수: {'{{이름}}'}, {'{{날짜}}'}, {'{{시간}}'}, {'{{장소}}'}, {'{{사건번호}}'} 등
            </div>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="is_active"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              className="mr-2"
            />
            <label htmlFor="is_active" className="text-sm text-[var(--text-secondary)]">
              활성화
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border-default)]">
            <button type="button" onClick={onClose} className="btn btn-secondary px-4 py-2">
              취소
            </button>
            <button type="submit" className="btn btn-primary px-4 py-2">
              저장
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
