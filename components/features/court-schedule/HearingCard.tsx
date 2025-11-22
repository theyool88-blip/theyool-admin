'use client';

import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Calendar, Clock, MapPin, User, AlertCircle, FileText, Users } from 'lucide-react';
import {
  CourtHearing,
  HearingStatus,
  HEARING_TYPE_LABELS,
  HEARING_STATUS_LABELS,
} from '@/types/court-hearing';

interface HearingCardProps {
  hearing: CourtHearing & {
    case?: {
      case_number: string;
      client_name: string;
      opponent_name: string;
    };
  };
  onEdit?: (id: string) => void;
  onPostpone?: (id: string) => void;
  onComplete?: (id: string) => void;
  onCancel?: (id: string) => void;
}

const statusColors: Record<HearingStatus, string> = {
  SCHEDULED: 'bg-blue-100 text-blue-800 border-blue-200',
  COMPLETED: 'bg-green-100 text-green-800 border-green-200',
  POSTPONED: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  CANCELLED: 'bg-gray-100 text-gray-800 border-gray-200',
};

const typeColors: Record<string, string> = {
  HEARING_MAIN: 'border-blue-500',
  HEARING_INTERIM: 'border-purple-500',
  HEARING_MEDIATION: 'border-green-500',
  HEARING_INVESTIGATION: 'border-amber-500',
  HEARING_PARENTING: 'border-pink-500',
  HEARING_JUDGMENT: 'border-red-500',
};

export default function HearingCard({
  hearing,
  onEdit,
  onPostpone,
  onComplete,
  onCancel,
}: HearingCardProps) {
  const hearingDate = new Date(hearing.scheduled_date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const daysUntil = Math.ceil(
    (hearingDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  const isUrgent = daysUntil <= 3 && daysUntil >= 0 && hearing.status === 'SCHEDULED';
  const isToday = daysUntil === 0;
  const isPast = daysUntil < 0 && hearing.status === 'SCHEDULED';

  return (
    <div
      className={`
        bg-white rounded-lg shadow-md hover:shadow-lg transition-all duration-200
        border-l-4 ${typeColors[hearing.hearing_type]}
        ${isUrgent ? 'ring-2 ring-red-500 ring-opacity-50' : ''}
        ${isPast ? 'opacity-75' : ''}
      `}
    >
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              {HEARING_TYPE_LABELS[hearing.hearing_type]}
              {hearing.hearing_detail && (
                <span className="text-sm font-normal text-gray-600">
                  · {hearing.hearing_detail}
                </span>
              )}
            </h3>

            {hearing.case && (
              <p className="text-sm text-gray-600 mt-1">
                <span className="font-medium">{hearing.case.case_number}</span>
                <span className="mx-2">|</span>
                {hearing.case.client_name} vs {hearing.case.opponent_name}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isToday && (
              <span className="px-2 py-1 bg-red-500 text-white rounded-full text-xs font-bold animate-pulse">
                오늘
              </span>
            )}
            {isUrgent && !isToday && (
              <span className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-semibold">
                <AlertCircle className="w-3 h-3" />
                D-{daysUntil}
              </span>
            )}
            {isPast && (
              <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-semibold">
                기일 경과
              </span>
            )}
            <span
              className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                statusColors[hearing.status]
              }`}
            >
              {HEARING_STATUS_LABELS[hearing.status]}
            </span>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-6 py-4 space-y-3">
        {/* 날짜 및 시간 */}
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2 text-gray-700">
            <Calendar className="w-4 h-4 text-gray-400" />
            <span className="font-medium">
              {format(hearingDate, 'yyyy년 M월 d일 (EEEE)', { locale: ko })}
            </span>
          </div>
          {hearing.scheduled_time && (
            <div className="flex items-center gap-2 text-gray-700">
              <Clock className="w-4 h-4 text-gray-400" />
              <span>{hearing.scheduled_time.slice(0, 5)}</span>
            </div>
          )}
        </div>

        {/* 법원 정보 */}
        {(hearing.court_name || hearing.courtroom) && (
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <MapPin className="w-4 h-4 text-gray-400" />
            <span>
              {hearing.court_name}
              {hearing.courtroom && (
                <span className="text-gray-500 ml-1">({hearing.courtroom})</span>
              )}
            </span>
          </div>
        )}

        {/* 출석 요구사항 */}
        <div className="flex gap-4">
          <div
            className={`flex items-center gap-2 text-sm ${
              hearing.lawyer_attendance_required
                ? 'text-blue-600 font-medium'
                : 'text-gray-400'
            }`}
          >
            <User className="w-4 h-4" />
            <span>변호사 출석</span>
            {hearing.lawyer_attendance_required && (
              <span className="text-blue-600">●</span>
            )}
          </div>
          <div
            className={`flex items-center gap-2 text-sm ${
              hearing.client_attendance_required
                ? 'text-blue-600 font-medium'
                : 'text-gray-400'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>당사자 출석</span>
            {hearing.client_attendance_required && (
              <span className="text-blue-600">●</span>
            )}
          </div>
        </div>

        {/* 메모 */}
        {hearing.notes && (
          <div className="pt-2 border-t border-gray-100">
            <div className="flex items-start gap-2">
              <FileText className="w-4 h-4 text-gray-400 mt-0.5" />
              <p className="text-sm text-gray-600 leading-relaxed">{hearing.notes}</p>
            </div>
          </div>
        )}

        {/* 결과 */}
        {hearing.result && hearing.status === 'COMPLETED' && (
          <div className="pt-2 border-t border-gray-100">
            <p className="text-sm">
              <span className="font-medium text-gray-700">기일 결과:</span>
              <span className="ml-2 text-gray-600">{hearing.result}</span>
            </p>
          </div>
        )}
      </div>

      {/* Actions */}
      {hearing.status === 'SCHEDULED' && (
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 rounded-b-lg">
          <div className="flex gap-2">
            <button
              onClick={() => onComplete?.(hearing.id)}
              className="flex-1 px-3 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
            >
              완료 처리
            </button>
            <button
              onClick={() => onPostpone?.(hearing.id)}
              className="flex-1 px-3 py-2 bg-yellow-600 text-white text-sm font-medium rounded-lg hover:bg-yellow-700 transition-colors"
            >
              기일 연기
            </button>
            <button
              onClick={() => onCancel?.(hearing.id)}
              className="flex-1 px-3 py-2 bg-gray-600 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors"
            >
              취소
            </button>
            <button
              onClick={() => onEdit?.(hearing.id)}
              className="px-3 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              수정
            </button>
          </div>
        </div>
      )}

      {/* Completed Actions */}
      {hearing.status === 'COMPLETED' && (
        <div className="px-6 py-3 bg-green-50 border-t border-green-100 rounded-b-lg">
          <p className="text-sm text-green-800 text-center">
            ✓ 기일 완료됨
          </p>
        </div>
      )}

      {/* Postponed Actions */}
      {hearing.status === 'POSTPONED' && (
        <div className="px-6 py-3 bg-yellow-50 border-t border-yellow-100 rounded-b-lg">
          <p className="text-sm text-yellow-800 text-center">
            ⏸ 기일이 연기되었습니다
          </p>
        </div>
      )}

      {/* Cancelled Actions */}
      {hearing.status === 'CANCELLED' && (
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 rounded-b-lg">
          <p className="text-sm text-gray-600 text-center">
            기일이 취소되었습니다
          </p>
        </div>
      )}
    </div>
  );
}