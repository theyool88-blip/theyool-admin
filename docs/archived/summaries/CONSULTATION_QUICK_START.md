# 상담 관리 시스템 - 빠른 시작 가이드

**5분 안에 시작하기** ⚡

---

## 1. 로컬 테스트 (1분)

```bash
# luseed 디렉토리로 이동
cd /Users/hskim/luseed

# 개발 서버 시작
npm run dev

# 브라우저에서 열기
open http://localhost:3000/admin/consultations
```

---

## 2. 로그인 (30초)

1. 로그인 페이지로 리다이렉트되면:
   - 이메일: `admin@theyool.com`
   - 비밀번호: (기존 비밀번호)

2. 로그인 후 `/admin/consultations` 자동 이동

---

## 3. 주요 기능 (3분)

### 통계 확인
- 상단 4개 카드: 총 상담, 대기 중, 확정, 완료

### 검색 및 필터
- **검색창**: 이름, 전화번호, 메시지 검색
- **상태 필터**: 9개 상태 선택
- **유형 필터**: 콜백/방문/화상/문의

### 상담 처리
1. 테이블에서 리드 스코어(🔥) 확인
2. 상세보기 클릭
3. 전화번호 클릭하여 전화
4. 상태 드롭다운에서 변경
5. 관리자 메모 입력 (자동 저장)

### CSV 내보내기
- 우측 상단 "CSV 내보내기" 버튼 클릭

---

## 4. 주요 파일 위치

```
/Users/hskim/luseed/
├── app/admin/consultations/page.tsx     # 관리자 UI
├── app/api/admin/consultations/         # API 라우트
├── lib/supabase/consultations.ts        # 데이터 액세스
├── types/consultation.ts                # 타입 정의
└── CONSULTATION_SETUP_GUIDE.md          # 상세 가이드
```

---

## 5. 자주 사용하는 기능

### 리드 스코어 해석
- 🔥🔥🔥 (5-7점): 최우선 처리 필요
- 🔥🔥 (3-4점): 우선 처리
- 🔥 (0-2점): 일반 처리

### 상태 변경 워크플로우
```
콜백 요청: 대기중 → 연락완료 → 완료
방문/화상: 대기중 → 연락완료 → 확정 → 진행중 → 완료
```

### 빠른 검색 팁
- 전화번호 일부만 입력: "010" → 모든 010 번호
- 이름 검색: "김" → 김씨 성을 가진 모든 상담
- 복합 필터: 검색 + 상태 + 유형 동시 적용

---

## 6. 문제 해결

### 빈 목록이 나올 때
- Supabase에 데이터가 있는지 확인
- 필터를 "전체"로 설정

### 통계가 0으로 나올 때
- 브라우저 새로고침 (Ctrl/Cmd + R)
- API 응답 확인: 개발자 도구 → Network 탭

### 인증 오류 (401)
- 로그아웃 후 재로그인
- 쿠키 삭제 후 재시도

---

## 7. 다음 단계

- 📖 **상세 가이드**: `CONSULTATION_SETUP_GUIDE.md` 읽기
- 🔍 **분석 문서**: `CONSULTATION_MIGRATION_ANALYSIS.md` 읽기
- 📝 **요약 보고서**: `CONSULTATION_MIGRATION_SUMMARY.md` 읽기

---

**준비 완료!** 🎉

이제 `/admin/consultations`에서 상담을 관리할 수 있습니다.
