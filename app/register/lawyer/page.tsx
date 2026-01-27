'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Building2,
  User,
  Mail,
  Lock,
  Phone,
  MapPin,
  Scale,
  Globe,
  ArrowRight,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';

type OfficeType = 'individual' | 'firm';

interface FormData {
  // 사용자 정보
  email: string;
  password: string;
  passwordConfirm: string;

  // 변호사 정보
  name: string;
  barNumber: string;
  phone: string;

  // 사무소 정보
  officeName: string;
  officeType: OfficeType;
  officePhone: string;
  officeAddress: string;

  // 서비스 옵션
  wantHomepage: boolean;

  // 약관 동의
  agreeTerms: boolean;
  agreePrivacy: boolean;
}

const initialFormData: FormData = {
  email: '',
  password: '',
  passwordConfirm: '',
  name: '',
  barNumber: '',
  phone: '',
  officeName: '',
  officeType: 'individual',
  officePhone: '',
  officeAddress: '',
  wantHomepage: false,
  agreeTerms: false,
  agreePrivacy: false,
};

export default function LawyerRegistrationPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const updateForm = (field: keyof FormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  const validateStep1 = () => {
    if (!formData.email) return '이메일을 입력해주세요.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) return '올바른 이메일 형식이 아닙니다.';
    if (!formData.password) return '비밀번호를 입력해주세요.';
    if (formData.password.length < 8) return '비밀번호는 8자 이상이어야 합니다.';
    if (!/[A-Za-z]/.test(formData.password)) return '비밀번호에 영문자가 포함되어야 합니다.';
    if (!/[0-9]/.test(formData.password)) return '비밀번호에 숫자가 포함되어야 합니다.';
    if (formData.password !== formData.passwordConfirm) return '비밀번호가 일치하지 않습니다.';
    if (!formData.name) return '이름을 입력해주세요.';
    return null;
  };

  const validateStep2 = () => {
    if (!formData.officeName) return '사무소명을 입력해주세요.';
    return null;
  };

  const validateStep3 = () => {
    if (!formData.agreeTerms) return '서비스 이용약관에 동의해주세요.';
    if (!formData.agreePrivacy) return '개인정보 처리방침에 동의해주세요.';
    return null;
  };

  const handleNext = () => {
    let validationError: string | null = null;

    if (step === 1) validationError = validateStep1();
    else if (step === 2) validationError = validateStep2();

    if (validationError) {
      setError(validationError);
      return;
    }

    setStep(step + 1);
  };

  const handleBack = () => {
    setStep(step - 1);
    setError('');
  };

  const handleSubmit = async () => {
    const validationError = validateStep3();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/register/lawyer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          name: formData.name,
          barNumber: formData.barNumber || undefined,
          phone: formData.phone || undefined,
          officeName: formData.officeName,
          officeType: formData.officeType,
          officePhone: formData.officePhone || undefined,
          officeAddress: formData.officeAddress || undefined,
          wantHomepage: formData.wantHomepage,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        setError(result.error || '회원가입에 실패했습니다.');
        setLoading(false);
        return;
      }

      setSuccess(true);
    } catch (err) {
      console.error('Registration error:', err);
      setError('서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)] px-4">
        <div className="w-full max-w-md text-center">
          <div className="card p-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--color-success-muted)] flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-[var(--color-success)]" />
            </div>
            <h1 className="text-xl font-bold text-[var(--text-primary)] mb-2">가입이 완료되었습니다</h1>
            <p className="text-sm text-[var(--text-secondary)] mb-6">
              입력하신 이메일({formData.email})로 인증 메일이 발송되었습니다.<br />
              이메일 인증 후 로그인해주세요.
            </p>
            <button
              onClick={() => router.push('/login')}
              className="btn btn-primary w-full h-10"
            >
              로그인 페이지로 이동
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)] px-4 py-8">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-6">
          <Scale className="w-10 h-10 mx-auto text-[var(--sage-primary)] mb-3" />
          <h1 className="text-xl font-bold text-[var(--text-primary)]">변호사 회원가입</h1>
          <p className="text-sm text-[var(--text-tertiary)] mt-1">사건관리 시스템을 시작해보세요</p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  step >= s
                    ? 'bg-[var(--sage-primary)] text-white'
                    : 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]'
                }`}
              >
                {s}
              </div>
              {s < 3 && (
                <div
                  className={`w-12 h-0.5 mx-1 transition-colors ${
                    step > s ? 'bg-[var(--sage-primary)]' : 'bg-[var(--bg-tertiary)]'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Form Card */}
        <div className="card p-6">
          {error && (
            <div className="mb-4 p-3 bg-[var(--color-danger-muted)] border border-[var(--color-danger)] rounded flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-[var(--color-danger)] mt-0.5 flex-shrink-0" />
              <p className="text-sm text-[var(--color-danger)]">{error}</p>
            </div>
          )}

          {/* Step 1: 기본 정보 */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-[var(--text-primary)] mb-4">기본 정보</h2>

              <div>
                <label className="form-label">
                  이메일 *
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => updateForm('email', e.target.value)}
                    className="form-input pl-10"
                    placeholder="lawyer@example.com"
                  />
                </div>
              </div>

              <div>
                <label className="form-label">
                  비밀번호 * <span className="font-normal text-[var(--text-tertiary)]">(8자 이상, 영문+숫자)</span>
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => updateForm('password', e.target.value)}
                    className="form-input pl-10"
                    placeholder="비밀번호 입력"
                  />
                </div>
              </div>

              <div>
                <label className="form-label">
                  비밀번호 확인 *
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                  <input
                    type="password"
                    value={formData.passwordConfirm}
                    onChange={(e) => updateForm('passwordConfirm', e.target.value)}
                    className="form-input pl-10"
                    placeholder="비밀번호 재입력"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">
                    이름 *
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => updateForm('name', e.target.value)}
                      className="form-input pl-10"
                      placeholder="홍길동"
                    />
                  </div>
                </div>

                <div>
                  <label className="form-label">
                    등록번호 <span className="font-normal text-[var(--text-tertiary)]">(선택)</span>
                  </label>
                  <div className="relative">
                    <Scale className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                    <input
                      type="text"
                      value={formData.barNumber}
                      onChange={(e) => updateForm('barNumber', e.target.value)}
                      className="form-input pl-10"
                      placeholder="12345"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="form-label">
                  연락처 <span className="font-normal text-[var(--text-tertiary)]">(선택)</span>
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => updateForm('phone', e.target.value)}
                    className="form-input pl-10"
                    placeholder="010-1234-5678"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: 사무소 정보 */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-[var(--text-primary)] mb-4">사무소 정보</h2>

              <div>
                <label className="form-label mb-2">
                  사무소 유형 *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => updateForm('officeType', 'individual')}
                    className={`p-4 rounded border-2 transition-colors ${
                      formData.officeType === 'individual'
                        ? 'border-[var(--sage-primary)] bg-[var(--sage-muted)]'
                        : 'border-[var(--border-default)] hover:border-[var(--border-subtle)]'
                    }`}
                  >
                    <User className={`w-6 h-6 mx-auto mb-2 ${formData.officeType === 'individual' ? 'text-[var(--sage-primary)]' : 'text-[var(--text-muted)]'}`} />
                    <p className={`text-sm font-medium ${formData.officeType === 'individual' ? 'text-[var(--sage-primary)]' : 'text-[var(--text-secondary)]'}`}>
                      개인 사무소
                    </p>
                    <p className="text-xs text-[var(--text-tertiary)] mt-1">1인 운영</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => updateForm('officeType', 'firm')}
                    className={`p-4 rounded border-2 transition-colors ${
                      formData.officeType === 'firm'
                        ? 'border-[var(--sage-primary)] bg-[var(--sage-muted)]'
                        : 'border-[var(--border-default)] hover:border-[var(--border-subtle)]'
                    }`}
                  >
                    <Building2 className={`w-6 h-6 mx-auto mb-2 ${formData.officeType === 'firm' ? 'text-[var(--sage-primary)]' : 'text-[var(--text-muted)]'}`} />
                    <p className={`text-sm font-medium ${formData.officeType === 'firm' ? 'text-[var(--sage-primary)]' : 'text-[var(--text-secondary)]'}`}>
                      법무법인
                    </p>
                    <p className="text-xs text-[var(--text-tertiary)] mt-1">팀원 초대 가능</p>
                  </button>
                </div>
              </div>

              <div>
                <label className="form-label">
                  사무소명 *
                </label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                  <input
                    type="text"
                    value={formData.officeName}
                    onChange={(e) => updateForm('officeName', e.target.value)}
                    className="form-input pl-10"
                    placeholder={formData.officeType === 'firm' ? '법무법인 OOO' : 'OOO 법률사무소'}
                  />
                </div>
              </div>

              <div>
                <label className="form-label">
                  사무소 전화번호 <span className="font-normal text-[var(--text-tertiary)]">(선택)</span>
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                  <input
                    type="tel"
                    value={formData.officePhone}
                    onChange={(e) => updateForm('officePhone', e.target.value)}
                    className="form-input pl-10"
                    placeholder="02-1234-5678"
                  />
                </div>
              </div>

              <div>
                <label className="form-label">
                  사무소 주소 <span className="font-normal text-[var(--text-tertiary)]">(선택)</span>
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                  <input
                    type="text"
                    value={formData.officeAddress}
                    onChange={(e) => updateForm('officeAddress', e.target.value)}
                    className="form-input pl-10"
                    placeholder="서울특별시 강남구..."
                  />
                </div>
              </div>

              {/* 홈페이지 서비스 옵션 */}
              <div className="mt-6 p-4 bg-[var(--bg-primary)] rounded-lg border border-[var(--border-default)]">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="wantHomepage"
                    checked={formData.wantHomepage}
                    onChange={(e) => updateForm('wantHomepage', e.target.checked)}
                    className="mt-1 w-4 h-4 text-[var(--sage-primary)] rounded border-[var(--border-default)] focus:ring-[var(--sage-primary)]"
                  />
                  <label htmlFor="wantHomepage" className="cursor-pointer">
                    <div className="flex items-center gap-2 mb-1">
                      <Globe className="w-4 h-4 text-[var(--sage-primary)]" />
                      <span className="text-sm font-medium text-[var(--text-primary)]">홈페이지 서비스 연결</span>
                    </div>
                    <p className="text-xs text-[var(--text-tertiary)]">
                      법률사무소 홈페이지를 함께 운영하면 온라인 상담 예약을 받을 수 있습니다.
                      나중에 설정할 수 있습니다.
                    </p>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: 약관 동의 */}
          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-[var(--text-primary)] mb-4">약관 동의</h2>

              {/* 입력 정보 요약 */}
              <div className="p-4 bg-[var(--bg-primary)] rounded-lg mb-6">
                <h3 className="text-xs font-medium text-[var(--text-tertiary)] mb-3">가입 정보 확인</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[var(--text-tertiary)]">이메일</span>
                    <span className="text-[var(--text-primary)]">{formData.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-tertiary)]">이름</span>
                    <span className="text-[var(--text-primary)]">{formData.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-tertiary)]">사무소</span>
                    <span className="text-[var(--text-primary)]">{formData.officeName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-tertiary)]">사무소 유형</span>
                    <span className="text-[var(--text-primary)]">
                      {formData.officeType === 'firm' ? '법무법인' : '개인 사무소'}
                    </span>
                  </div>
                  {formData.wantHomepage && (
                    <div className="flex justify-between">
                      <span className="text-[var(--text-tertiary)]">홈페이지 서비스</span>
                      <span className="text-[var(--sage-primary)]">신청</span>
                    </div>
                  )}
                </div>
              </div>

              {/* 약관 동의 */}
              <div className="space-y-3">
                <label className="flex items-start gap-3 p-3 border border-[var(--border-default)] rounded cursor-pointer hover:bg-[var(--bg-hover)]">
                  <input
                    type="checkbox"
                    checked={formData.agreeTerms}
                    onChange={(e) => updateForm('agreeTerms', e.target.checked)}
                    className="mt-0.5 w-4 h-4 text-[var(--sage-primary)] rounded border-[var(--border-default)] focus:ring-[var(--sage-primary)]"
                  />
                  <div className="flex-1">
                    <span className="text-sm text-[var(--text-secondary)]">
                      서비스 이용약관에 동의합니다 <span className="text-[var(--color-danger)]">*</span>
                    </span>
                    <Link href="/terms" className="text-xs text-[var(--sage-primary)] hover:underline ml-2">
                      보기
                    </Link>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 border border-[var(--border-default)] rounded cursor-pointer hover:bg-[var(--bg-hover)]">
                  <input
                    type="checkbox"
                    checked={formData.agreePrivacy}
                    onChange={(e) => updateForm('agreePrivacy', e.target.checked)}
                    className="mt-0.5 w-4 h-4 text-[var(--sage-primary)] rounded border-[var(--border-default)] focus:ring-[var(--sage-primary)]"
                  />
                  <div className="flex-1">
                    <span className="text-sm text-[var(--text-secondary)]">
                      개인정보 처리방침에 동의합니다 <span className="text-[var(--color-danger)]">*</span>
                    </span>
                    <Link href="/privacy" className="text-xs text-[var(--sage-primary)] hover:underline ml-2">
                      보기
                    </Link>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex gap-3 mt-6">
            {step > 1 && (
              <button
                type="button"
                onClick={handleBack}
                disabled={loading}
                className="btn btn-secondary flex-1 h-10"
              >
                이전
              </button>
            )}

            {step < 3 ? (
              <button
                type="button"
                onClick={handleNext}
                className="btn btn-primary flex-1 h-10 flex items-center justify-center gap-2"
              >
                다음
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className="btn btn-primary flex-1 h-10 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    처리 중...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    가입 완료
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-sm text-[var(--text-tertiary)]">
            이미 계정이 있으신가요?{' '}
            <Link href="/login" className="text-[var(--sage-primary)] hover:underline font-medium">
              로그인
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
