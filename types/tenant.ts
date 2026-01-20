/**
 * 멀티테넌트 시스템 타입 정의
 */

// 테넌트 타입
export type TenantType = 'individual' | 'firm';

// 테넌트 상태
export type TenantStatus = 'active' | 'suspended' | 'cancelled';

// 구독 플랜
export type SubscriptionPlan = 'basic' | 'professional' | 'enterprise';

// 멤버 역할 (계층: owner > admin > lawyer > staff)
export type MemberRole = 'owner' | 'admin' | 'lawyer' | 'staff';

// 멤버 상태
export type MemberStatus = 'active' | 'invited' | 'suspended';

// 세부 권한 타입
export type Permission =
  | 'finance:view'        // 회계 조회
  | 'finance:manage'      // 회계 관리
  | 'consultation:manage' // 상담 관리
  | 'client:manage'       // 의뢰인 관리
  | 'case:all';           // 모든 사건 접근

// 테넌트 기능 설정
export interface TenantFeatures {
  maxCases: number;      // -1 = 무제한
  maxClients: number;    // -1 = 무제한
  maxMembers: number;    // -1 = 무제한
  maxLawyers: number;    // -1 = 무제한, 테넌트에서 등록 가능한 변호사 수
  scourtSync: boolean;   // 대법원 연동
  clientPortal: boolean; // 의뢰인 포털
  homepage: boolean;     // 홈페이지 서비스
}

// 테넌트 설정
export interface TenantSettings {
  timezone: string;
  dateFormat: string;
  workingHours: {
    start: string;
    end: string;
  };
}

// 테넌트 정보
export interface Tenant {
  id: string;
  name: string;
  slug: string;
  type: TenantType;
  phone?: string;
  email?: string;
  address?: string;
  hasHomepage: boolean;
  homepageDomain?: string;
  homepageSubdomain?: string;
  plan: SubscriptionPlan;
  planStartedAt?: string;
  planExpiresAt?: string;
  features: TenantFeatures;
  settings: TenantSettings;
  status: TenantStatus;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

// 테넌트 멤버
export interface TenantMember {
  id: string;
  tenantId: string;
  userId: string;
  role: MemberRole;
  displayName?: string;
  title?: string;
  barNumber?: string;
  phone?: string;
  email?: string;
  permissions: string[];
  status: MemberStatus;
  invitedAt?: string;
  invitedBy?: string;
  joinedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// 슈퍼 어드민
export interface SuperAdmin {
  id: string;
  userId: string;
  permissions: string[];
  createdAt: string;
  createdBy?: string;
}

// 테넌트 컨텍스트 (현재 로그인한 사용자의 테넌트 정보)
export interface TenantContext {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  tenantType: TenantType;
  hasHomepage: boolean;
  plan: SubscriptionPlan;
  features: TenantFeatures;
  memberId: string;
  memberRole: MemberRole;
  memberDisplayName?: string;
  isSuperAdmin: boolean;
  isImpersonating?: boolean; // 슈퍼 어드민 대리 접속 여부
}

// 테넌트 초대
export interface TenantInvitation {
  id: string;
  tenantId: string;
  email: string;
  role: MemberRole;
  token: string;
  status: 'pending' | 'accepted' | 'expired';
  expiresAt: string;
  invitedBy: string;
  createdAt: string;
  acceptedAt?: string;
}

// 구독 플랜 정의
export interface SubscriptionPlanDefinition {
  id: string;
  name: string;
  nameKo: string;
  description?: string;
  features: TenantFeatures;
  priceMonthly: number;
  priceYearly: number;
  isActive: boolean;
  displayOrder: number;
}

// API 응답 타입
export interface TenantListResponse {
  tenants: Tenant[];
  total: number;
}

export interface TenantMemberListResponse {
  members: TenantMember[];
  total: number;
}

// 역할 계층 확인 함수용 상수
export const ROLE_HIERARCHY: Record<MemberRole, number> = {
  owner: 4,
  admin: 3,
  lawyer: 2,
  staff: 1,
};

// 역할 이상인지 확인
export function hasRoleOrHigher(userRole: MemberRole, requiredRole: MemberRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

// 역할 표시 이름
export const ROLE_DISPLAY_NAMES: Record<MemberRole, string> = {
  owner: '소유자',
  admin: '관리자',
  lawyer: '변호사',
  staff: '직원',
};

// 테넌트 타입 표시 이름
export const TENANT_TYPE_DISPLAY_NAMES: Record<TenantType, string> = {
  individual: '개인 사무소',
  firm: '법무법인',
};

// 플랜 표시 이름
export const PLAN_DISPLAY_NAMES: Record<SubscriptionPlan, string> = {
  basic: '베이직',
  professional: '프로페셔널',
  enterprise: '엔터프라이즈',
};

// 권한 표시 이름
export const PERMISSION_DISPLAY_NAMES: Record<Permission, string> = {
  'finance:view': '회계 조회',
  'finance:manage': '회계 관리',
  'consultation:manage': '상담 관리',
  'client:manage': '의뢰인 관리',
  'case:all': '모든 사건 접근',
};

// 담당자 역할
export type AssigneeRole = 'lawyer' | 'staff';

// 담당자 역할 표시 이름
export const ASSIGNEE_ROLE_DISPLAY_NAMES: Record<AssigneeRole, string> = {
  lawyer: '담당변호사',
  staff: '담당직원',
};

// 사건 담당자 (다중 지정) - 변호사 및 직원
export interface CaseAssignee {
  id: string;
  tenantId: string;
  caseId: string;
  memberId: string;
  assigneeRole: AssigneeRole;  // 'lawyer' | 'staff'
  isPrimary: boolean;          // lawyer만 true 가능
  createdAt: string;
  // 조인 데이터
  member?: TenantMember;
}

// 직원-변호사 매핑
export interface StaffLawyerAssignment {
  id: string;
  tenantId: string;
  staffMemberId: string;
  lawyerMemberId: string;
  createdAt: string;
  // 조인 데이터
  staffMember?: TenantMember;
  lawyerMember?: TenantMember;
}

// ============================================================================
// 홈페이지 연동 관련 타입
// ============================================================================

// 사무소 위치 설정
export interface OfficeLocation {
  id: string;
  name: string;           // 천안, 평택 등
  address: string;
  phone?: string;
  mapUrl?: string;
  isDefault?: boolean;
}

// 홈페이지 설정
export interface TenantHomepageSettings {
  enabled: boolean;
  domain?: string;                    // 커스텀 도메인
  subdomain?: string;                 // 서브도메인

  // 사무소 위치 (동적 정의)
  officeLocations: OfficeLocation[];

  // 상담 카테고리 (동적 정의)
  consultationCategories: string[];   // ['이혼', '위자료', '양육권', ...]

  // 브랜딩
  primaryColor?: string;
  logoUrl?: string;

  // 예약 설정
  defaultSlotDuration: number;        // 기본 30분
  allowVideoConsultation: boolean;
  allowVisitConsultation: boolean;
  allowPhoneConsultation: boolean;
  allowCallbackRequest: boolean;

  // 결제 설정
  defaultConsultationFee: number;     // 기본 상담료
  freeConsultationEnabled: boolean;   // 무료 상담 허용
}

// API 키
export interface TenantApiKey {
  id: string;
  tenantId: string;
  keyPrefix: string;          // pk_abc123 (표시용)
  name?: string;              // 키 이름
  scopes: string[];           // 허용된 스코프
  rateLimitPerMinute: number;
  allowedOrigins: string[];   // CORS 허용 도메인
  isActive: boolean;
  expiresAt?: string;
  lastUsedAt?: string;
  usageCount: number;
  createdAt: string;
}

// 방문자 세션
export interface VisitorSession {
  id: string;
  tenantId: string;
  visitorId: string;
  sessionId: string;
  referrer?: string;
  landingPage?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  userAgent?: string;
  deviceType?: 'mobile' | 'tablet' | 'desktop';
  visitCount: number;
  isReturning: boolean;
  startedAt: string;
  endedAt?: string;
  lastActivityAt: string;
}

// 페이지 뷰
export interface PageView {
  id: string;
  tenantId: string;
  sessionId: string;
  pagePath: string;
  pageTitle?: string;
  pageType?: 'home' | 'service' | 'blog' | 'case' | 'faq' | 'contact' | 'landing';
  contentId?: string;
  contentCategory?: string;
  timeOnPage?: number;
  scrollDepth?: number;
  clickCount: number;
  exitPage: boolean;
  viewedAt: string;
}

// 홈페이지 공개 설정 응답 (외부 홈페이지용)
export interface TenantPublicConfig {
  tenantId: string;
  name: string;                       // 사무소명

  // 홈페이지에서 사용할 동적 옵션
  lawyers: Array<{
    id: string;
    name: string;
    title?: string;
  }>;
  officeLocations: OfficeLocation[];
  consultationCategories: string[];

  // 예약 설정
  allowVideoConsultation: boolean;
  allowVisitConsultation: boolean;
  allowPhoneConsultation: boolean;
  allowCallbackRequest: boolean;
  defaultSlotDuration: number;

  // 브랜딩
  primaryColor?: string;
  logoUrl?: string;
}

// 상담 신청 요청 (홈페이지 → 사건관리)
export interface ConsultationRequest {
  // 필수
  name: string;
  phone: string;

  // 선택
  email?: string;
  category?: string;
  message?: string;
  preferredDate?: string;             // YYYY-MM-DD
  preferredTime?: string;             // HH:MM

  // 마케팅 추적
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  visitorSessionId?: string;
}

// 예약 요청 (홈페이지 → 사건관리)
export interface BookingRequest {
  // 필수
  name: string;
  phone: string;
  type: 'visit' | 'video' | 'phone';
  preferredDate: string;              // YYYY-MM-DD
  preferredTime: string;              // HH:MM

  // 선택
  email?: string;
  category?: string;
  message?: string;
  officeLocation?: string;            // 방문 상담 시
  preferredLawyerId?: string;         // 선호 변호사

  // 마케팅 추적
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  visitorSessionId?: string;
}

// 방문자 이벤트 (홈페이지 → 사건관리)
export interface VisitorEventRequest {
  visitorId: string;
  sessionId: string;
  eventType: 'session_start' | 'page_view' | 'session_end';

  // session_start 시
  referrer?: string;
  landingPage?: string;
  userAgent?: string;
  deviceType?: 'mobile' | 'tablet' | 'desktop';
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;

  // page_view 시
  pagePath?: string;
  pageTitle?: string;
  pageType?: string;
  contentId?: string;
  timeOnPage?: number;
  scrollDepth?: number;
}
