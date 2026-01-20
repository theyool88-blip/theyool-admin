# 문서 인덱스

**Last Updated**: 2026-01-20

법무법인 더율 관리자 시스템 (luseed) 문서 목록입니다.

---

## 시스템 문서 (Systems)

각 시스템의 상세 설명, 데이터 모델, API 구조를 다룹니다.

| 문서 | 설명 |
|------|------|
| [MULTI_TENANT_SYSTEM.md](systems/MULTI_TENANT_SYSTEM.md) | 멀티테넌트 아키텍처, RLS 정책 |
| [GOOGLE_INTEGRATION.md](systems/GOOGLE_INTEGRATION.md) | Google Calendar/Drive OAuth 연동 |
| [PAYMENT_SYSTEM.md](systems/PAYMENT_SYSTEM.md) | 입금/지출 관리, 5:5 파트너십 정산 |
| [RECEIVABLES_SYSTEM.md](systems/RECEIVABLES_SYSTEM.md) | 미수금 관리, 등급/메모/포기 처리 |
| [CONSULTATION_SYSTEM.md](systems/CONSULTATION_SYSTEM.md) | 상담 관리 (4유형, 9상태), 리드 스코어링 |
| [COURT_HEARING_SYSTEM.md](systems/COURT_HEARING_SYSTEM.md) | 법원기일, 불변기간 데드라인 자동 계산 |
| [CASE_ASSIGNEES_SYSTEM.md](systems/CASE_ASSIGNEES_SYSTEM.md) | 사건 담당자 다중 지정 시스템 |
| [CALENDAR_SYSTEM.md](systems/CALENDAR_SYSTEM.md) | 통합 캘린더, Google Calendar 연동 |
| [CLIENT_PORTAL.md](systems/CLIENT_PORTAL.md) | 의뢰인 포털 미리보기 API |
| [SCOURT_API_ANALYSIS.md](systems/SCOURT_API_ANALYSIS.md) | 대법원 나의사건검색 API 분석 |
| [SCOURT_INTEGRATION.md](systems/SCOURT_INTEGRATION.md) | SCOURT 통합 시스템 (동기화, 필드매핑) |
| [SCOURT_SYNC_SYSTEM.md](systems/SCOURT_SYNC_SYSTEM.md) | SCOURT 사건 갱신 시스템 (진행/일반 분리) |
| [CLIENT_PARTY_SYNC_SYSTEM.md](systems/CLIENT_PARTY_SYNC_SYSTEM.md) | 의뢰인/당사자 이름 동기화 시스템 |
| [CAPTCHA_MODEL.md](systems/CAPTCHA_MODEL.md) | 캡차 인식 ML 모델 |
| [SUPERADMIN_IMPERSONATION.md](systems/SUPERADMIN_IMPERSONATION.md) | 슈퍼 어드민 테넌트 impersonation |

---

## 개발 가이드 (Guides)

개발 환경 설정, 배포, API 사용법을 다룹니다.

| 문서 | 설명 |
|------|------|
| [SETUP_GUIDE.md](guides/SETUP_GUIDE.md) | 초기 설정, 환경 변수, 개발 서버 |
| [DEPLOYMENT_GUIDE.md](guides/DEPLOYMENT_GUIDE.md) | Vercel 배포, Cron 설정 |
| [MIGRATION_GUIDE.md](guides/MIGRATION_GUIDE.md) | Supabase 마이그레이션, RLS 정책 |
| [API_REFERENCE.md](guides/API_REFERENCE.md) | REST API 엔드포인트, 타입 정의 |
| [GOOGLE_VISION_SETUP.md](guides/GOOGLE_VISION_SETUP.md) | Google Vision API 설정 (캡차용) |

---

## 디자인 시스템 (Design)

UI/UX 디자인 가이드라인, 컴포넌트 패턴을 다룹니다.

| 문서 | 설명 |
|------|------|
| [SAGE_GREEN_THEME.md](design/SAGE_GREEN_THEME.md) | Sage Green 색상 팔레트, 유틸리티 클래스 |

---

## 과거 문서 (Archived)

완료된 과거 작업의 기록입니다.

```
archived/
├── plans/        # 계획 문서
├── progress/     # 진행 상태 문서
└── summaries/    # 완료 보고서
```

---

## 빠른 참조

### 자주 사용하는 문서

1. **새 개발자**: [SETUP_GUIDE.md](guides/SETUP_GUIDE.md) 먼저 읽기
2. **멀티테넌트**: [MULTI_TENANT_SYSTEM.md](systems/MULTI_TENANT_SYSTEM.md) 참조
3. **Google 연동**: [GOOGLE_INTEGRATION.md](systems/GOOGLE_INTEGRATION.md) 참조
4. **API 개발**: [API_REFERENCE.md](guides/API_REFERENCE.md) 참조
5. **UI 작업**: [SAGE_GREEN_THEME.md](design/SAGE_GREEN_THEME.md) 참조

### 코드 레퍼런스

| 위치 | 설명 |
|------|------|
| `app/api/admin/` | 관리자 API 엔드포인트 |
| `app/api/admin/tenant/` | 테넌트 관리 API |
| `lib/supabase/` | Supabase 헬퍼 함수 |
| `lib/api/with-tenant.ts` | 테넌트 미들웨어 |
| `lib/google-calendar.ts` | Google OAuth 함수 |
| `lib/scourt/` | 대법원 연동 함수 |
| `types/` | TypeScript 타입 정의 |
| `components/` | React 컴포넌트 |
| `scripts/` | 유틸리티 스크립트 (데드라인 관리, 백필 등) |

### 데이터베이스

| 테이블 | 설명 |
|--------|------|
| `tenants` | 테넌트 (법무법인) |
| `tenant_integrations` | 테넌트별 외부 서비스 연동 |
| `clients` | 의뢰인 |
| `legal_cases` | 사건 |
| `case_parties` | 사건 당사자 (의뢰인/상대방) |
| `payments` | 입금 |
| `expenses` | 지출 |
| `consultations` | 상담 |
| `court_hearings` | 법원기일 |
| `case_deadlines` | 데드라인 |
| `scourt_profiles` | 대법원 프로필 |
| `scourt_sessions` | 대법원 세션 |
| `drive_file_classifications` | Google Drive 파일 분류 |

---

## 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (Next.js)                      │
├─────────────────────────────────────────────────────────────┤
│  app/admin/          │  app/superadmin/    │  app/register/ │
│  - 관리자 대시보드    │  - 슈퍼관리자       │  - 변호사 등록  │
│  - 사건/의뢰인 관리   │  - 테넌트 관리      │                │
│  - 캘린더/상담       │                     │                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    API Routes (Next.js)                      │
├─────────────────────────────────────────────────────────────┤
│  /api/admin/*        │  /api/superadmin/*  │  /api/auth/*   │
│  - withTenant 미들웨어│  - 슈퍼관리자 전용  │  - OAuth 콜백  │
│  - RLS 자동 적용     │                     │                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Supabase (PostgreSQL)                   │
├─────────────────────────────────────────────────────────────┤
│  - Row Level Security (tenant_id 기반)                       │
│  - Edge Functions (Cron jobs)                                │
│  - Storage (logos, files)                                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    External Services                         │
├─────────────────────────────────────────────────────────────┤
│  Google Calendar  │  Google Drive  │  대법원 나의사건검색     │
│  (테넌트별 OAuth) │  (테넌트별)    │  (wmonid 기반)          │
└─────────────────────────────────────────────────────────────┘
```

---

## 문서 업데이트

문서 수정 시:

1. 해당 문서의 `Last Updated` 날짜 업데이트
2. 관련된 다른 문서도 함께 수정
3. 대규모 변경 시 이 INDEX.md도 업데이트
