# Google Cloud Vision API 설정 가이드

대법원 캡챠 자동 인식을 위한 Google Cloud Vision API 설정 방법입니다.

## 1. Google Cloud 프로젝트 생성

### 1-1. Google Cloud Console 접속
1. https://console.cloud.google.com/ 접속
2. Google 계정으로 로그인

### 1-2. 새 프로젝트 생성
1. 상단의 프로젝트 선택 드롭다운 클릭
2. "새 프로젝트" 클릭
3. 프로젝트 이름 입력 (예: `theyool-vision-api`)
4. "만들기" 클릭

## 2. Vision API 활성화

### 2-1. API 라이브러리 접속
1. 왼쪽 메뉴 → "API 및 서비스" → "라이브러리"
2. 검색창에 "Vision API" 입력
3. "Cloud Vision API" 선택
4. "사용 설정" 클릭

✅ Vision API가 활성화되었습니다!

## 3. 서비스 계정 생성

### 3-1. 서비스 계정 만들기
1. 왼쪽 메뉴 → "IAM 및 관리자" → "서비스 계정"
2. "서비스 계정 만들기" 클릭
3. 서비스 계정 세부정보 입력:
   - 이름: `theyool-vision-service`
   - ID: 자동 생성됨
   - 설명: `대법원 캡챠 인식용 서비스 계정`
4. "만들고 계속하기" 클릭

### 3-2. 역할 부여
1. "역할 선택" 드롭다운 클릭
2. "Cloud Vision" → "Cloud Vision API 사용자" 선택
3. "계속" 클릭
4. "완료" 클릭

### 3-3. 키 생성
1. 생성된 서비스 계정 클릭
2. "키" 탭 선택
3. "키 추가" → "새 키 만들기" 클릭
4. **JSON** 선택 (중요!)
5. "만들기" 클릭

→ JSON 파일이 자동으로 다운로드됩니다!

**⚠️ 중요: 이 JSON 파일은 안전하게 보관하세요!**

## 4. 환경변수 설정

다운로드한 JSON 파일을 환경변수로 설정합니다.

### 방법 1: JSON 내용을 환경변수로 (추천)

1. 다운로드한 JSON 파일 열기
2. 전체 내용 복사
3. `.env.local` 파일에 추가:

```bash
# Google Vision API 인증
GOOGLE_VISION_CREDENTIALS='{"type":"service_account","project_id":"your-project-id",...}'
```

**주의: 작은따옴표로 감싸고, JSON 전체를 한 줄로 입력!**

### 방법 2: 파일 경로 사용

1. JSON 파일을 프로젝트 루트에 저장 (예: `google-credentials.json`)
2. `.gitignore`에 추가:

```gitignore
google-credentials.json
```

3. `.env.local`에 경로 추가:

```bash
GOOGLE_APPLICATION_CREDENTIALS=/path/to/google-credentials.json
```

## 5. 테스트

다음 명령어로 설정이 올바른지 테스트합니다:

```bash
npx tsx scripts/test-vision-api.ts
```

## 비용 안내

### 무료 한도
- **월 1,000건까지 무료** ✅
- 이후 $1.50 / 1,000건

### 예상 비용 (월 100건 조회)
- **$0 (무료)** 🎉

### 비용 모니터링
1. Google Cloud Console
2. "결제" → "예산 및 알림"
3. 알림 설정 (예: $5 초과시 알림)

## 보안 주의사항

1. **서비스 계정 키 절대 공개 금지**
   - GitHub에 커밋 금지
   - `.env.local`은 `.gitignore`에 포함

2. **최소 권한 원칙**
   - Vision API 사용자 권한만 부여
   - 불필요한 권한 제거

3. **키 정기 교체**
   - 3-6개월마다 새 키 생성
   - 이전 키 비활성화

## 문제 해결

### "인증 실패" 에러
→ 환경변수 설정 확인:
```bash
echo $GOOGLE_VISION_CREDENTIALS
```

### "API가 활성화되지 않음" 에러
→ Vision API 활성화 재확인

### "할당량 초과" 에러
→ 무료 한도(1,000건) 초과
→ 결제 계정 등록 필요

## 다음 단계

✅ Google Cloud 설정 완료!

이제 다음을 진행할 수 있습니다:
1. 테스트 스크립트 실행
2. 실제 사건번호로 조회 테스트
3. API 엔드포인트 생성
