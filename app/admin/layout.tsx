import ImpersonationBanner from '@/components/ImpersonationBanner';
import AdminLayoutClient from '@/components/AdminLayoutClient';

export const metadata = {
  title: '관리자 | Luseed',
  description: 'Luseed 관리자 대시보드',
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <ImpersonationBanner />
      <div className="impersonation-wrapper">
        <AdminLayoutClient>
          {children}
        </AdminLayoutClient>
      </div>
    </>
  );
}
