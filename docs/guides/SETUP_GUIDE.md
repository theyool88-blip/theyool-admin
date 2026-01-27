# 초기 설정 가이드

**Last Updated**: 2025-12-02

luseed 프로젝트 초기 설정 및 개발 환경 구성 가이드입니다.

---

## 요구 사항

- Node.js 18+
- npm 또는 yarn
- Supabase 계정 및 프로젝트

---

## 설치

### 1. 프로젝트 클론

```bash
git clone https://github.com/your-repo/luseed.git
cd luseed
```

### 2. 의존성 설치

```bash
npm install
```

### 3. 환경 변수 설정

```bash
# .env.local 파일 생성
cp .env.example .env.local
```

**.env.local 내용:**
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://kqqyipnlkmmprfgygauk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-nextauth-secret

# Google OAuth (선택)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

### 4. 개발 서버 실행

```bash
npm run dev
```

접속: http://localhost:3000

---

## Supabase 설정

### 프로젝트 연결

```bash
# Supabase CLI 설치
npm install -g supabase

# 로그인
supabase login

# 프로젝트 연결
supabase link --project-ref kqqyipnlkmmprfgygauk
```

### 데이터베이스 마이그레이션

```bash
# 마이그레이션 푸시
supabase db push

# 또는 SQL Editor에서 직접 실행
```

---

## 관리자 계정 생성

### Supabase Auth Dashboard

1. Supabase Dashboard → Authentication → Users
2. "Add user" 클릭
3. 이메일/비밀번호 입력
4. "Create user" 클릭

### 로그인 테스트

1. http://localhost:3000/login 접속
2. 생성한 계정으로 로그인
3. 대시보드 접근 확인

---

## 개발 명령어

| 명령어 | 설명 |
|--------|------|
| `npm run dev` | 개발 서버 (http://localhost:3000) |
| `npm run build` | 프로덕션 빌드 |
| `npm run start` | 빌드된 앱 실행 |
| `npm run lint` | ESLint 검사 |
| `npx tsc --noEmit` | TypeScript 타입 체크 |

---

## 테스트 스크립트

```bash
# 컴포넌트 테스트
node scripts/test-components.js

# 캘린더 API 테스트
node scripts/test-calendar-api.js

# 입금 시스템 테스트
node scripts/test-payments-system.js
```

---

## 프로젝트 구조

```
luseed/
├── app/              # Next.js App Router
│   ├── admin/        # 관리자 페이지
│   ├── api/          # API 라우트
│   ├── cases/        # 사건 페이지
│   ├── clients/      # 의뢰인 페이지
│   └── schedules/    # 일정 페이지
│
├── components/       # React 컴포넌트
├── lib/              # 유틸리티 함수
│   └── supabase/     # Supabase 클라이언트
├── types/            # TypeScript 타입
├── hooks/            # React 훅
├── scripts/          # 테스트/마이그레이션 스크립트
└── supabase/         # SQL 마이그레이션
```

---

## 코딩 스타일

- TypeScript + React 함수 컴포넌트
- 2-space 들여쓰기
- 싱글 쿼트, 세미콜론 없음
- `@/` 경로 별칭 사용
- Tailwind CSS + 전역 CSS 변수

---

## 문제 해결

### 의존성 충돌

```bash
rm -rf node_modules package-lock.json
npm install
```

### 환경 변수 인식 안됨

- `.env.local` 파일명 확인
- 개발 서버 재시작

### Supabase 연결 실패

- 환경 변수 URL/Key 확인
- 네트워크 상태 확인
- Supabase 프로젝트 상태 확인
