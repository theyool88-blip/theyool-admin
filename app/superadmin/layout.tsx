import SuperAdminSidebar from '@/components/superadmin/SuperAdminSidebar';

export const metadata = {
  title: '슈퍼 어드민 | Luseed',
  description: 'Luseed SaaS 관리 콘솔',
};

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen superadmin-theme">
      <SuperAdminSidebar />
      <main className="flex-1 lg:pl-0 bg-[--sa-bg-primary]">
        <div className="min-h-screen">
          {children}
        </div>
      </main>
    </div>
  );
}
