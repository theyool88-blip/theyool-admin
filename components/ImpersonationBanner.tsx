'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, X, ExternalLink } from 'lucide-react';

interface ImpersonationData {
  isImpersonating: boolean;
  tenantId?: string;
  tenantName?: string;
  tenantSlug?: string;
  impersonatedAt?: string;
  expiresAt?: string;
}

export default function ImpersonationBanner() {
  const router = useRouter();
  const [data, setData] = useState<ImpersonationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [ending, setEnding] = useState(false);

  useEffect(() => {
    checkImpersonation();
  }, []);

  // 배너가 표시될 때 body에 padding 추가
  useEffect(() => {
    if (data?.isImpersonating) {
      document.body.style.paddingTop = '44px';
    } else {
      document.body.style.paddingTop = '0';
    }

    return () => {
      document.body.style.paddingTop = '0';
    };
  }, [data?.isImpersonating]);

  const checkImpersonation = async () => {
    try {
      const response = await fetch('/api/superadmin/impersonate');
      const result = await response.json();

      if (result.success) {
        setData(result.data);
      }
    } catch (error) {
      console.error('Check impersonation error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEndImpersonation = async () => {
    setEnding(true);
    try {
      const response = await fetch('/api/superadmin/impersonate', {
        method: 'DELETE',
      });
      const result = await response.json();

      if (result.success) {
        // 슈퍼 어드민으로 돌아가기
        window.close(); // 새 탭인 경우 닫기 시도
        // 닫히지 않으면 슈퍼 어드민 페이지로 이동
        setTimeout(() => {
          router.push('/superadmin/tenants');
        }, 100);
      }
    } catch (error) {
      console.error('End impersonation error:', error);
    } finally {
      setEnding(false);
    }
  };

  const handleBackToSuperAdmin = () => {
    window.open('/superadmin', '_blank');
  };

  if (loading || !data?.isImpersonating) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg">
      <div className="max-w-screen-2xl mx-auto px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1 bg-white/20 rounded-lg backdrop-blur-sm">
            <Shield className="w-4 h-4" />
            <span className="text-[12px] font-semibold uppercase tracking-wider">
              슈퍼 어드민 뷰
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-medium">
              <span className="opacity-80">테넌트:</span>{' '}
              <span className="font-semibold">{data.tenantName}</span>
            </span>
            <span className="text-[11px] opacity-70 px-2 py-0.5 bg-white/10 rounded">
              {data.tenantSlug}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleBackToSuperAdmin}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
          >
            슈퍼 어드민 열기
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleEndImpersonation}
            disabled={ending}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium bg-white text-orange-600 hover:bg-white/90 rounded-lg transition-colors disabled:opacity-50"
          >
            {ending ? (
              <>종료 중...</>
            ) : (
              <>
                <X className="w-3.5 h-3.5" />
                뷰 종료
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
