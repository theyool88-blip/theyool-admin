'use client';

import { useState } from 'react';
import {
  CreditCard,
  Settings,
  Check,
  X,
  Save,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';

interface PlanConfig {
  id: string;
  name: string;
  nameKo: string;
  price: number;
  features: {
    maxMembers: number | 'unlimited';
    storage: string;
    homepage: boolean;
    apiAccess: boolean;
    customDomain: boolean;
    support: string;
  };
}

const defaultPlans: PlanConfig[] = [
  {
    id: 'basic',
    name: 'Basic',
    nameKo: '베이직',
    price: 0,
    features: {
      maxMembers: 3,
      storage: '10GB',
      homepage: false,
      apiAccess: false,
      customDomain: false,
      support: '이메일',
    },
  },
  {
    id: 'professional',
    name: 'Professional',
    nameKo: '프로페셔널',
    price: 49000,
    features: {
      maxMembers: 10,
      storage: '50GB',
      homepage: true,
      apiAccess: false,
      customDomain: true,
      support: '이메일 + 채팅',
    },
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    nameKo: '엔터프라이즈',
    price: 99000,
    features: {
      maxMembers: 'unlimited',
      storage: '무제한',
      homepage: true,
      apiAccess: true,
      customDomain: true,
      support: '전담 매니저',
    },
  },
];

export default function PlansSettingsPage() {
  const [plans, setPlans] = useState<PlanConfig[]>(defaultPlans);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [editingPlan, setEditingPlan] = useState<string | null>(null);

  const formatCurrency = (amount: number) => {
    if (amount === 0) return '무료';
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const handleSave = async () => {
    setSaving(true);
    setSuccess(false);

    await new Promise((resolve) => setTimeout(resolve, 1000));

    setSaving(false);
    setSuccess(true);
    setEditingPlan(null);

    setTimeout(() => setSuccess(false), 3000);
  };

  const getPlanColor = (planId: string) => {
    switch (planId) {
      case 'professional': return 'blue';
      case 'enterprise': return 'violet';
      default: return 'default';
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-semibold text-[--sa-text-primary] tracking-tight">플랜 설정</h1>
          <p className="text-[13px] text-[--sa-text-tertiary] mt-1">구독 플랜 가격 및 기능 관리</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="sa-btn sa-btn-primary"
        >
          {saving ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          변경사항 저장
        </button>
      </div>

      {/* Success Message */}
      {success && (
        <div className="mb-6 p-4 bg-[--sa-accent-green-muted] border border-[--sa-accent-green]/20 rounded-xl flex items-center gap-3">
          <Check className="w-5 h-5 text-[--sa-accent-green] flex-shrink-0" />
          <p className="text-[13px] text-[--sa-accent-green]">플랜 설정이 저장되었습니다.</p>
        </div>
      )}

      {/* Info Banner */}
      <div className="mb-6 p-4 bg-[--sa-accent-yellow-muted] border border-[--sa-accent-yellow]/20 rounded-xl flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-[--sa-accent-yellow] flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-[13px] font-medium text-[--sa-accent-yellow]">플랜 설정 안내</p>
          <p className="text-[11px] text-[--sa-accent-yellow]/80 mt-1">
            플랜 설정 변경은 신규 가입자에게만 적용됩니다. 기존 구독자의 플랜은 변경되지 않습니다.
          </p>
        </div>
      </div>

      {/* Plan Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const color = getPlanColor(plan.id);
          const isEditing = editingPlan === plan.id;

          return (
            <div
              key={plan.id}
              className={`sa-card p-6 relative overflow-hidden ${
                color === 'blue'
                  ? 'ring-2 ring-[--sa-accent-blue]/30'
                  : color === 'violet'
                  ? 'ring-2 ring-[--sa-accent-violet]/30'
                  : ''
              }`}
            >
              {plan.id === 'professional' && (
                <div className="absolute top-4 right-4">
                  <span className="text-[11px] font-medium text-[--sa-accent-blue] bg-[--sa-accent-blue-muted] px-2 py-1 rounded-lg">
                    인기
                  </span>
                </div>
              )}

              <div className="mb-6">
                <div className={`w-12 h-12 rounded-xl ${
                  color === 'blue' ? 'bg-[--sa-accent-blue-muted]' : color === 'violet' ? 'bg-[--sa-accent-violet-muted]' : 'bg-[--sa-bg-tertiary]'
                } flex items-center justify-center mb-4`}>
                  <CreditCard className={`w-6 h-6 ${
                    color === 'blue' ? 'text-[--sa-accent-blue]' : color === 'violet' ? 'text-[--sa-accent-violet]' : 'text-[--sa-text-muted]'
                  }`} />
                </div>
                <h3 className="text-[16px] font-semibold text-[--sa-text-primary]">{plan.nameKo}</h3>
                <p className="text-[11px] text-[--sa-text-muted]">{plan.name}</p>
              </div>

              <div className="mb-6">
                {isEditing ? (
                  <input
                    type="number"
                    value={plan.price}
                    onChange={(e) => {
                      const newPlans = plans.map((p) =>
                        p.id === plan.id ? { ...p, price: parseInt(e.target.value) || 0 } : p
                      );
                      setPlans(newPlans);
                    }}
                    className="sa-input w-full text-[18px] font-bold"
                  />
                ) : (
                  <div className="text-[28px] font-bold text-[--sa-text-primary]">
                    {formatCurrency(plan.price)}
                    {plan.price > 0 && (
                      <span className="text-[13px] font-normal text-[--sa-text-muted]">/월</span>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-[--sa-text-muted]">최대 멤버</span>
                  <span className="font-medium text-[--sa-text-primary]">
                    {plan.features.maxMembers === 'unlimited' ? '무제한' : `${plan.features.maxMembers}명`}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-[--sa-text-muted]">저장 용량</span>
                  <span className="font-medium text-[--sa-text-primary]">{plan.features.storage}</span>
                </div>
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-[--sa-text-muted]">홈페이지</span>
                  {plan.features.homepage ? (
                    <Check className="w-4 h-4 text-[--sa-accent-green]" />
                  ) : (
                    <X className="w-4 h-4 text-[--sa-text-muted]" />
                  )}
                </div>
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-[--sa-text-muted]">API 접근</span>
                  {plan.features.apiAccess ? (
                    <Check className="w-4 h-4 text-[--sa-accent-green]" />
                  ) : (
                    <X className="w-4 h-4 text-[--sa-text-muted]" />
                  )}
                </div>
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-[--sa-text-muted]">커스텀 도메인</span>
                  {plan.features.customDomain ? (
                    <Check className="w-4 h-4 text-[--sa-accent-green]" />
                  ) : (
                    <X className="w-4 h-4 text-[--sa-text-muted]" />
                  )}
                </div>
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-[--sa-text-muted]">지원</span>
                  <span className="font-medium text-[--sa-text-primary]">{plan.features.support}</span>
                </div>
              </div>

              <button
                onClick={() => setEditingPlan(isEditing ? null : plan.id)}
                className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 text-[13px] font-medium rounded-xl transition-colors ${
                  isEditing
                    ? 'bg-[--sa-accent-green] text-white hover:bg-[--sa-accent-green]/90'
                    : 'bg-[--sa-bg-tertiary] text-[--sa-text-secondary] hover:bg-[--sa-bg-hover]'
                }`}
              >
                <Settings className="w-4 h-4" />
                {isEditing ? '완료' : '수정'}
              </button>
            </div>
          );
        })}
      </div>

      {/* Feature Matrix */}
      <div className="mt-8 sa-card p-6">
        <h2 className="text-[15px] font-semibold text-[--sa-text-primary] mb-6">기능 상세 비교</h2>

        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[--sa-border-default]">
                <th className="text-left py-3 px-4 font-medium text-[--sa-text-tertiary]">기능</th>
                <th className="text-center py-3 px-4 font-medium text-[--sa-text-tertiary]">베이직</th>
                <th className="text-center py-3 px-4 font-medium text-[--sa-accent-blue]">프로페셔널</th>
                <th className="text-center py-3 px-4 font-medium text-[--sa-accent-violet]">엔터프라이즈</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[--sa-border-subtle]">
              <tr className="hover:bg-[--sa-bg-hover]">
                <td className="py-3 px-4 text-[--sa-text-muted]">사건 관리</td>
                <td className="py-3 px-4 text-center"><Check className="w-4 h-4 text-[--sa-accent-green] mx-auto" /></td>
                <td className="py-3 px-4 text-center"><Check className="w-4 h-4 text-[--sa-accent-green] mx-auto" /></td>
                <td className="py-3 px-4 text-center"><Check className="w-4 h-4 text-[--sa-accent-green] mx-auto" /></td>
              </tr>
              <tr className="hover:bg-[--sa-bg-hover]">
                <td className="py-3 px-4 text-[--sa-text-muted]">의뢰인 관리</td>
                <td className="py-3 px-4 text-center"><Check className="w-4 h-4 text-[--sa-accent-green] mx-auto" /></td>
                <td className="py-3 px-4 text-center"><Check className="w-4 h-4 text-[--sa-accent-green] mx-auto" /></td>
                <td className="py-3 px-4 text-center"><Check className="w-4 h-4 text-[--sa-accent-green] mx-auto" /></td>
              </tr>
              <tr className="hover:bg-[--sa-bg-hover]">
                <td className="py-3 px-4 text-[--sa-text-muted]">일정 관리</td>
                <td className="py-3 px-4 text-center"><Check className="w-4 h-4 text-[--sa-accent-green] mx-auto" /></td>
                <td className="py-3 px-4 text-center"><Check className="w-4 h-4 text-[--sa-accent-green] mx-auto" /></td>
                <td className="py-3 px-4 text-center"><Check className="w-4 h-4 text-[--sa-accent-green] mx-auto" /></td>
              </tr>
              <tr className="hover:bg-[--sa-bg-hover]">
                <td className="py-3 px-4 text-[--sa-text-muted]">문서 관리</td>
                <td className="py-3 px-4 text-center text-[--sa-text-muted]">제한적</td>
                <td className="py-3 px-4 text-center"><Check className="w-4 h-4 text-[--sa-accent-green] mx-auto" /></td>
                <td className="py-3 px-4 text-center"><Check className="w-4 h-4 text-[--sa-accent-green] mx-auto" /></td>
              </tr>
              <tr className="hover:bg-[--sa-bg-hover]">
                <td className="py-3 px-4 text-[--sa-text-muted]">상담 예약</td>
                <td className="py-3 px-4 text-center"><X className="w-4 h-4 text-[--sa-text-muted] mx-auto" /></td>
                <td className="py-3 px-4 text-center"><Check className="w-4 h-4 text-[--sa-accent-green] mx-auto" /></td>
                <td className="py-3 px-4 text-center"><Check className="w-4 h-4 text-[--sa-accent-green] mx-auto" /></td>
              </tr>
              <tr className="hover:bg-[--sa-bg-hover]">
                <td className="py-3 px-4 text-[--sa-text-muted]">법원 연동 (SCOURT)</td>
                <td className="py-3 px-4 text-center"><X className="w-4 h-4 text-[--sa-text-muted] mx-auto" /></td>
                <td className="py-3 px-4 text-center"><Check className="w-4 h-4 text-[--sa-accent-green] mx-auto" /></td>
                <td className="py-3 px-4 text-center"><Check className="w-4 h-4 text-[--sa-accent-green] mx-auto" /></td>
              </tr>
              <tr className="hover:bg-[--sa-bg-hover]">
                <td className="py-3 px-4 text-[--sa-text-muted]">AI 분석</td>
                <td className="py-3 px-4 text-center"><X className="w-4 h-4 text-[--sa-text-muted] mx-auto" /></td>
                <td className="py-3 px-4 text-center text-[--sa-text-muted]">제한적</td>
                <td className="py-3 px-4 text-center"><Check className="w-4 h-4 text-[--sa-accent-green] mx-auto" /></td>
              </tr>
              <tr className="hover:bg-[--sa-bg-hover]">
                <td className="py-3 px-4 text-[--sa-text-muted]">데이터 내보내기</td>
                <td className="py-3 px-4 text-center"><X className="w-4 h-4 text-[--sa-text-muted] mx-auto" /></td>
                <td className="py-3 px-4 text-center"><Check className="w-4 h-4 text-[--sa-accent-green] mx-auto" /></td>
                <td className="py-3 px-4 text-center"><Check className="w-4 h-4 text-[--sa-accent-green] mx-auto" /></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
