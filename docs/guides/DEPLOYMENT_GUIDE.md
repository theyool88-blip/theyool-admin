# 배포 가이드

**Last Updated**: 2025-12-02

Vercel을 통한 프로덕션 배포 절차 및 체크리스트입니다.

---

## 환경 변수

### 필수 환경 변수

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://kqqyipnlkmmprfgygauk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# NextAuth
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=...

# Google OAuth (선택)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALENDAR_ID=...
```

### 환경 변수 설정

1. **로컬**: `.env.local` 파일에 설정
2. **Vercel**: Project Settings → Environment Variables

---

## 배포 전 체크리스트

### 코드 검증

- [ ] TypeScript 에러 없음: `npx tsc --noEmit`
- [ ] ESLint 경고 해결: `npm run lint`
- [ ] 빌드 성공: `npm run build`

### 데이터베이스 검증

- [ ] 모든 테이블 생성 확인
- [ ] 모든 View 생성 확인
- [ ] 트리거 동작 확인
- [ ] RLS 정책 설정 확인

### API 테스트

- [ ] 로그인 정상 동작
- [ ] 주요 CRUD API 정상
- [ ] 권한 검증 동작

### UI 테스트

- [ ] 대시보드 로딩
- [ ] 각 페이지 접근 가능
- [ ] 모달/폼 동작

---

## Vercel 배포

### 첫 배포

```bash
# Vercel CLI 설치
npm i -g vercel

# 프로젝트 연결 및 배포
vercel

# 프로덕션 배포
vercel --prod
```

### Git 연동 배포

1. GitHub 리포지토리에 push
2. Vercel이 자동으로 빌드 및 배포
3. Preview URL에서 확인
4. Promote to Production

---

## Cron Job 설정

### vercel.json

```json
{
  "crons": [
    {
      "path": "/api/cron/generate-monthly-expenses",
      "schedule": "0 0 1 * *"
    },
    {
      "path": "/api/cron/aggregate-monthly-settlement",
      "schedule": "0 1 1 * *"
    },
    {
      "path": "/api/cron/daily-reminders",
      "schedule": "0 9 * * *"
    }
  ]
}
```

### Cron Secret 설정

```bash
# Vercel Dashboard → Settings → Environment Variables
CRON_SECRET=your-secret-key
```

---

## 배포 후 확인

### 기능 확인

- [ ] 프로덕션 URL 접근 가능
- [ ] 로그인 정상
- [ ] 대시보드 데이터 로딩
- [ ] 주요 기능 동작

### 성능 확인

- [ ] 페이지 로딩 2초 이내
- [ ] API 응답 500ms 이내
- [ ] 이미지 최적화

### 모니터링

- [ ] Vercel Analytics 활성화
- [ ] Error 로그 확인
- [ ] Database 성능 모니터링

---

## 롤백 절차

### Vercel 롤백

1. Vercel Dashboard → Deployments
2. 이전 배포 선택
3. "Promote to Production" 클릭

### 데이터베이스 롤백

1. Supabase Dashboard → Settings → Backups
2. 백업 선택 → Restore

---

## 알려진 이슈 해결

### 빌드 실패

```bash
# 캐시 삭제 후 재빌드
rm -rf .next node_modules
npm install
npm run build
```

### 환경 변수 누락

1. Vercel Dashboard에서 환경 변수 확인
2. 필요시 재배포

### 데이터베이스 연결 실패

1. Supabase 상태 확인
2. Connection Pooler 설정 확인
3. 환경 변수 URL 확인
