/**
 * 테넌트 컨텍스트 함수
 * 현재 로그인한 사용자의 테넌트 정보를 조회
 */

import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import type {
  TenantContext,
  Tenant,
  TenantMember,
  MemberRole,
  TenantFeatures,
  SubscriptionPlan,
  TenantType,
} from '@/types/tenant';

/**
 * 슈퍼 어드민 대리 접속 토큰 확인
 */
async function getImpersonationContext(): Promise<TenantContext | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('sa_impersonate')?.value;

    if (!token) {
      return null;
    }

    const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
    const expiresAt = new Date(decoded.expiresAt);

    if (expiresAt < new Date() || !decoded.tenantId) {
      return null;
    }

    // Admin client로 테넌트 정보 조회
    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: tenant, error } = await supabaseAdmin
      .from('tenants')
      .select('*')
      .eq('id', decoded.tenantId)
      .single();

    if (error || !tenant) {
      return null;
    }

    // 대리 접속 컨텍스트 반환 (슈퍼 어드민 + 테넌트 정보)
    return {
      tenantId: tenant.id,
      tenantName: tenant.name,
      tenantSlug: tenant.slug,
      tenantType: tenant.type as TenantType,
      hasHomepage: tenant.has_homepage,
      plan: tenant.plan as SubscriptionPlan,
      features: tenant.features as TenantFeatures,
      memberId: 'impersonation',
      memberRole: 'owner' as MemberRole,
      memberDisplayName: '슈퍼 어드민 (대리 접속)',
      isSuperAdmin: true,
      isImpersonating: true,
    };
  } catch {
    return null;
  }
}

/**
 * 현재 로그인한 사용자의 테넌트 컨텍스트 조회
 * @returns TenantContext | null
 */
export async function getCurrentTenantContext(): Promise<TenantContext | null> {
  // 먼저 대리 접속 확인
  const impersonationContext = await getImpersonationContext();
  if (impersonationContext) {
    return impersonationContext;
  }

  const supabase = await createClient();

  // 현재 사용자 확인
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return null;
  }

  // 슈퍼 어드민 확인
  const { data: superAdmin } = await supabase
    .from('super_admins')
    .select('id')
    .eq('user_id', user.id)
    .single();

  const isSuperAdmin = !!superAdmin;

  // 테넌트 멤버십 조회
  const { data: membership } = await supabase
    .from('tenant_members')
    .select(`
      id,
      role,
      display_name,
      tenant:tenants (
        id,
        name,
        slug,
        type,
        has_homepage,
        plan,
        features
      )
    `)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single();

  if (!membership || !membership.tenant) {
    // 슈퍼 어드민이지만 테넌트 멤버가 아닌 경우
    if (isSuperAdmin) {
      return {
        tenantId: '',
        tenantName: 'Super Admin',
        tenantSlug: '',
        tenantType: 'individual',
        hasHomepage: false,
        plan: 'enterprise',
        features: {
          maxCases: -1,
          maxClients: -1,
          maxMembers: -1,
          maxLawyers: -1,
          scourtSync: true,
          clientPortal: true,
          homepage: true,
        },
        memberId: '',
        memberRole: 'owner',
        memberDisplayName: 'Super Admin',
        isSuperAdmin: true,
      };
    }
    return null;
  }

  const tenant = membership.tenant as unknown as {
    id: string;
    name: string;
    slug: string;
    type: TenantType;
    has_homepage: boolean;
    plan: SubscriptionPlan;
    features: TenantFeatures;
  };

  return {
    tenantId: tenant.id,
    tenantName: tenant.name,
    tenantSlug: tenant.slug,
    tenantType: tenant.type,
    hasHomepage: tenant.has_homepage,
    plan: tenant.plan,
    features: tenant.features,
    memberId: membership.id,
    memberRole: membership.role as MemberRole,
    memberDisplayName: membership.display_name || undefined,
    isSuperAdmin,
  };
}

/**
 * 사용자가 속한 모든 테넌트 조회 (멀티 테넌트 지원)
 */
export async function getUserTenants(): Promise<TenantContext[]> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return [];
  }

  // 슈퍼 어드민 확인
  const { data: superAdmin } = await supabase
    .from('super_admins')
    .select('id')
    .eq('user_id', user.id)
    .single();

  const isSuperAdmin = !!superAdmin;

  // 모든 멤버십 조회
  const { data: memberships } = await supabase
    .from('tenant_members')
    .select(`
      id,
      role,
      display_name,
      tenant:tenants (
        id,
        name,
        slug,
        type,
        has_homepage,
        plan,
        features
      )
    `)
    .eq('user_id', user.id)
    .eq('status', 'active');

  if (!memberships) {
    return [];
  }

  return memberships
    .filter(m => m.tenant)
    .map(membership => {
      const tenant = membership.tenant as unknown as {
        id: string;
        name: string;
        slug: string;
        type: TenantType;
        has_homepage: boolean;
        plan: SubscriptionPlan;
        features: TenantFeatures;
      };

      return {
        tenantId: tenant.id,
        tenantName: tenant.name,
        tenantSlug: tenant.slug,
        tenantType: tenant.type,
        hasHomepage: tenant.has_homepage,
        plan: tenant.plan,
        features: tenant.features,
        memberId: membership.id,
        memberRole: membership.role as MemberRole,
        memberDisplayName: membership.display_name || undefined,
        isSuperAdmin,
      };
    });
}

/**
 * 슈퍼 어드민 여부 확인
 */
export async function isSuperAdmin(): Promise<boolean> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return false;
  }

  const { data: superAdmin } = await supabase
    .from('super_admins')
    .select('id')
    .eq('user_id', user.id)
    .single();

  return !!superAdmin;
}

/**
 * 특정 테넌트의 멤버인지 확인
 */
export async function isTenantMember(tenantId: string): Promise<boolean> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return false;
  }

  const { data: membership } = await supabase
    .from('tenant_members')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single();

  return !!membership;
}

/**
 * 특정 역할 이상인지 확인
 */
export async function hasRoleOrHigher(requiredRole: MemberRole): Promise<boolean> {
  const context = await getCurrentTenantContext();
  if (!context) {
    return false;
  }

  if (context.isSuperAdmin) {
    return true;
  }

  const roleHierarchy: Record<MemberRole, number> = {
    owner: 4,
    admin: 3,
    lawyer: 2,
    staff: 1,
  };

  return roleHierarchy[context.memberRole] >= roleHierarchy[requiredRole];
}

/**
 * 테넌트 상세 정보 조회
 */
export async function getTenantById(tenantId: string): Promise<Tenant | null> {
  const supabase = await createClient();

  const { data: tenant } = await supabase
    .from('tenants')
    .select('*')
    .eq('id', tenantId)
    .single();

  if (!tenant) {
    return null;
  }

  return {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    type: tenant.type as TenantType,
    phone: tenant.phone || undefined,
    email: tenant.email || undefined,
    address: tenant.address || undefined,
    hasHomepage: tenant.has_homepage,
    homepageDomain: tenant.homepage_domain || undefined,
    homepageSubdomain: tenant.homepage_subdomain || undefined,
    plan: tenant.plan as SubscriptionPlan,
    planStartedAt: tenant.plan_started_at || undefined,
    planExpiresAt: tenant.plan_expires_at || undefined,
    features: tenant.features as TenantFeatures,
    settings: tenant.settings,
    status: tenant.status,
    isVerified: tenant.is_verified,
    createdAt: tenant.created_at,
    updatedAt: tenant.updated_at,
  };
}

/**
 * 테넌트 멤버 목록 조회
 */
export async function getTenantMembers(tenantId: string): Promise<TenantMember[]> {
  const supabase = await createClient();

  const { data: members } = await supabase
    .from('tenant_members')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('role', { ascending: true })
    .order('display_name', { ascending: true });

  if (!members) {
    return [];
  }

  return members.map(m => ({
    id: m.id,
    tenantId: m.tenant_id,
    userId: m.user_id,
    role: m.role as MemberRole,
    displayName: m.display_name || undefined,
    title: m.title || undefined,
    barNumber: m.bar_number || undefined,
    phone: m.phone || undefined,
    email: m.email || undefined,
    permissions: m.permissions || [],
    status: m.status,
    invitedAt: m.invited_at || undefined,
    invitedBy: m.invited_by || undefined,
    joinedAt: m.joined_at || undefined,
    createdAt: m.created_at,
    updatedAt: m.updated_at,
  }));
}
