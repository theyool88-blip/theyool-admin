/**
 * 테넌트 외부 서비스 연동 관련 타입 정의
 */

// 지원하는 연동 프로바이더
export type IntegrationProvider = 'google_calendar' | 'google_drive';

// 연동 상태
export type IntegrationStatus = 'connected' | 'disconnected' | 'expired';

// Google Calendar 연동 설정
export interface GoogleCalendarSettings {
  calendarId?: string;
  calendarName?: string;
}

// Google Drive 연동 설정
export interface GoogleDriveSettings {
  folderId?: string;
  folderName?: string;
}

// 연동 설정 타입 맵
export interface IntegrationSettingsMap {
  google_calendar: GoogleCalendarSettings;
  google_drive: GoogleDriveSettings;
}

// 테넌트 연동 정보
export interface TenantIntegration<T extends IntegrationProvider = IntegrationProvider> {
  id: string;
  tenantId: string;
  provider: T;
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiry: string | null;
  settings: T extends keyof IntegrationSettingsMap ? IntegrationSettingsMap[T] : Record<string, unknown>;
  status: IntegrationStatus;
  connectedAt: string | null;
  connectedBy: string | null;
  webhookChannelId?: string | null;
  webhookResourceId?: string | null;
  webhookExpiry?: string | null;
  createdAt: string;
  updatedAt: string;
}

// DB 레코드 (snake_case)
export interface TenantIntegrationRecord {
  id: string;
  tenant_id: string;
  provider: IntegrationProvider;
  access_token: string | null;
  refresh_token: string | null;
  token_expiry: string | null;
  settings: Record<string, unknown>;
  status: IntegrationStatus;
  connected_at: string | null;
  connected_by: string | null;
  webhook_channel_id: string | null;
  webhook_resource_id: string | null;
  webhook_expiry: string | null;
  created_at: string;
  updated_at: string;
}

// OAuth State (CSRF 방지용)
export interface OAuthState {
  tenantId: string;
  provider: IntegrationProvider;
  nonce: string;
  timestamp: number;
}

// OAuth State 레코드
export interface OAuthStateRecord {
  id: string;
  state: string;
  tenant_id: string;
  provider: IntegrationProvider;
  user_id: string;
  expires_at: string;
  created_at: string;
}

// Google Calendar 목록 아이템
export interface GoogleCalendarListItem {
  id: string;
  summary: string;
  description?: string;
  primary?: boolean;
  accessRole?: string;
  backgroundColor?: string;
  foregroundColor?: string;
}

// Google Drive 폴더 아이템
export interface GoogleDriveFolderItem {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
}

// 연동 API 응답
export interface IntegrationResponse {
  success: boolean;
  data?: TenantIntegration | TenantIntegration[];
  error?: string;
}

// 연결 시작 API 응답
export interface ConnectIntegrationResponse {
  success: boolean;
  authUrl?: string;
  error?: string;
}

// 캘린더 목록 API 응답
export interface CalendarListResponse {
  success: boolean;
  data?: GoogleCalendarListItem[];
  error?: string;
}

// DB 레코드를 프론트엔드 형식으로 변환
export function toTenantIntegration(record: TenantIntegrationRecord): TenantIntegration {
  return {
    id: record.id,
    tenantId: record.tenant_id,
    provider: record.provider,
    accessToken: record.access_token,
    refreshToken: record.refresh_token,
    tokenExpiry: record.token_expiry,
    settings: record.settings as TenantIntegration['settings'],
    status: record.status,
    connectedAt: record.connected_at,
    connectedBy: record.connected_by,
    webhookChannelId: record.webhook_channel_id,
    webhookResourceId: record.webhook_resource_id,
    webhookExpiry: record.webhook_expiry,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

// 프로바이더별 표시 정보
export const PROVIDER_INFO: Record<IntegrationProvider, {
  name: string;
  nameKo: string;
  description: string;
  icon: string;
}> = {
  google_calendar: {
    name: 'Google Calendar',
    nameKo: 'Google 캘린더',
    description: '기일 동기화를 위한 Google Calendar 연동',
    icon: 'calendar',
  },
  google_drive: {
    name: 'Google Drive',
    nameKo: 'Google 드라이브',
    description: '파일 관리를 위한 Google Drive 연동',
    icon: 'folder',
  },
};
