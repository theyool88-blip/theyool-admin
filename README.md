# 법무법인 더율 관리자 시스템 (theyool-admin)

**법무법인 더율**의 사건, 의뢰인, 상담, 재정을 통합 관리하는 관리자 시스템입니다.

---

## 기술 스택

- **Frontend**: Next.js 16.0.3 + React 19 + TypeScript
- **Styling**: Tailwind CSS + Sage Green 테마
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth + NextAuth v4
- **Deployment**: Vercel

---

## 주요 기능

| 모듈 | 설명 |
|------|------|
| **의뢰인 관리** | 의뢰인 정보, 사건 연결, 포털 미리보기 |
| **사건 관리** | 이혼/양육권/재산분할 등 사건 CRUD |
| **상담 관리** | 상담 신청/진행/완료 9단계 워크플로우 |
| **입금/지출 관리** | 5:5 파트너십 정산, 고정 지출 자동 생성 |
| **법원기일 관리** | 기일 등록, 데드라인 자동 계산 |
| **캘린더** | 통합 일정 조회, Google Calendar 연동 |

---

## 빠른 시작

```bash
# 1. 의존성 설치
npm install

# 2. 환경 변수 설정
cp .env.example .env.local

# 3. 개발 서버 실행
npm run dev
```

접속: http://localhost:3000

---

## 문서

| 문서 | 설명 |
|------|------|
| [초기 설정](docs/guides/SETUP_GUIDE.md) | 개발 환경 구성 |
| [배포 가이드](docs/guides/DEPLOYMENT_GUIDE.md) | Vercel 배포 |
| [DB 마이그레이션](docs/guides/MIGRATION_GUIDE.md) | Supabase 마이그레이션 |
| [API 레퍼런스](docs/guides/API_REFERENCE.md) | REST API 문서 |
| [시스템 문서](docs/systems/) | 각 시스템별 상세 설명 |
| [디자인 가이드](docs/design/SAGE_GREEN_THEME.md) | Sage Green 테마 |

전체 문서 목록: [docs/INDEX.md](docs/INDEX.md)

---

## 개발 명령어

| 명령어 | 설명 |
|--------|------|
| `npm run dev` | 개발 서버 (http://localhost:3000) |
| `npm run build` | 프로덕션 빌드 |
| `npm run lint` | ESLint 검사 |
| `npx tsc --noEmit` | TypeScript 타입 체크 |

---

## 프로젝트 구조

```
theyool-admin/
├── app/              # Next.js App Router
│   ├── admin/        # 관리자 페이지
│   ├── api/          # API 라우트
│   ├── cases/        # 사건 페이지
│   ├── clients/      # 의뢰인 페이지
│   └── schedules/    # 일정 페이지
│
├── components/       # React 컴포넌트
├── lib/              # 유틸리티 함수
├── types/            # TypeScript 타입
├── hooks/            # React 훅
├── scripts/          # 테스트/마이그레이션 스크립트
├── supabase/         # SQL 마이그레이션
└── docs/             # 프로젝트 문서
```

---

## 라이센스

Private - 법무법인 더율 내부 사용

