/**
 * 초대 수락 페이지 (서버 컴포넌트)
 */

import { Metadata } from 'next';
import AcceptInvitationClient from './AcceptInvitationClient';

export const metadata: Metadata = {
  title: '팀원 초대 | LuSeed',
  description: '팀원 초대를 수락하세요',
};

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function InvitePage({ params }: PageProps) {
  const { token } = await params;

  return <AcceptInvitationClient token={token} />;
}
