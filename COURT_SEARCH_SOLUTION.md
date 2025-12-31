# 대법원 사건검색 자동화 솔루션

## 📊 최종 결론

### ✅ 확인된 사실:

1. **저장된 사건은 세션 기반**
   - 최대 50건까지 저장
   - 같은 브라우저 세션 내에서만 유효
   - 새 브라우저 = 저장 목록 초기화

2. **캡챠 없이 접근 가능**
   - 초기 검색: 캡챠 필요 (1회)
   - 저장된 목록 보기: 캡챠 불필요 ✅
   - 사건 클릭/상세보기: 캡챠 불필요 ✅

3. **고유 URL 없음**
   - URL은 변하지 않음
   - 쿠키/세션으로만 관리
   - 직접 URL 접근 불가능

---

## 🔧 구현된 솔루션

### 1. 개선된 검색 스크립트
**파일**: `scripts/improved-search-with-session.ts`

**기능**:
- ✅ 캡챠 재시도 로직 (최대 5회)
- ✅ Vision API 신뢰도 확인
- ✅ 자동 폼 입력
- ✅ 세션 유지

**사용 방법**:
```typescript
const searcher = new CourtCaseSearcher();
await searcher.initialize();

// 1. 초기 검색 (캡챠 사용)
await searcher.searchCase({
  court: '수원가정법원',
  year: '2024',
  caseType: '드단',
  serialNumber: '26718',
  partyName: '김윤한'
});

// 2. 저장된 목록 접근 (캡챠 불필요!)
const saved = await searcher.accessSavedCases();

// 3. 사건 클릭 (캡챠 불필요!)
await searcher.clickSavedCase(0);
```

### 2. 핵심 개념: 세션 기반 접근

```
┌─────────────────────────────────────────┐
│  브라우저 세션 시작                        │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  1단계: 사건 검색                         │
│  - 캡챠 입력 (필수)                       │
│  - 저장 옵션 체크                         │
│  - 검색 결과 확인                         │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  사건 정보가 세션에 저장됨                 │
│  (최대 50건, 쿠키/세션 스토리지)           │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  2단계: 저장된 목록 접근                   │
│  - 페이지 새로고침                        │
│  - 캡챠 불필요! ✅                        │
│  - 저장된 사건 목록 표시                   │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  3단계: 사건 상세 보기                     │
│  - 저장된 사건 클릭                        │
│  - 캡챠 불필요! ✅                        │
│  - 사건 상세 정보 로드                     │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  추가 사건 접근 (반복 가능)                │
│  - 캡챠 불필요! ✅                        │
│  - 50건까지 자유롭게 접근                  │
└─────────────────────────────────────────┘
```

---

## 💡 활용 전략

### 전략 1: 배치 검색 + 세션 유지

```typescript
// 1. 여러 사건 검색 (캡챠 각 1회씩)
for (const caseInfo of casesToSearch) {
  await searcher.searchCase(caseInfo);
  // 각 사건이 저장 목록에 추가됨
}

// 2. 한 번에 모든 저장된 사건 접근 (캡챠 불필요!)
const allSaved = await searcher.accessSavedCases(); // 최대 50건

// 3. 모든 사건 상세 정보 수집 (캡챠 불필요!)
for (let i = 0; i < allSaved.length; i++) {
  await searcher.clickSavedCase(i);
  await extractCaseDetails();
}
```

### 전략 2: 주기적 업데이트

```typescript
// 한 번 검색해두면, 같은 세션에서 반복 확인 가능
await searcher.searchCase(caseInfo);

// 나중에 업데이트 확인 (캡챠 불필요!)
setInterval(async () => {
  const saved = await searcher.accessSavedCases();
  await searcher.clickSavedCase(0);
  // 기일 정보, 진행 상황 등 확인
}, 3600000); // 1시간마다
```

---

## 🚨 제한사항

### 1. 세션 유지 필요
- 브라우저를 닫으면 저장 목록 사라짐
- 장시간 유지 시 세션 만료 가능성
- **해결책**: `puppeteer.connect()` 사용하여 장기 세션 유지

### 2. 최대 50건 제한
- 최근 검색 사건 중 50건만 저장
- 오래된 사건은 자동 삭제됨
- **해결책**: 중요한 사건을 주기적으로 재검색

### 3. 초기 캡챠 필요
- 완전한 캡챠 우회는 불가능
- 첫 검색은 반드시 캡챠 입력 필요
- **현재 정확도**: Vision API 90%
  - **개선 방법**:
    - scikit-learn 자체 모델 학습
    - 재시도 로직 (현재 5회까지)
    - 수동 fallback 옵션

---

## 📈 성능 최적화

### 캡챠 인식 정확도 향상

**현재**: Vision API 90%

**개선 방안**:
1. **재시도 로직** ✅ (구현 완료)
   - 최대 5회 재시도
   - 신뢰도 낮으면 자동 재시도

2. **ML 모델 학습** (case-ing 방식)
   - scikit-learn 사용
   - 캡챠 이미지 수집 및 라벨링
   - 정확도 95%+ 가능

3. **하이브리드 접근**
   ```typescript
   // Vision API 실패 시 수동 입력
   const solved = await solveCaptchaWithRetry();
   if (!solved) {
     const manual = await askUserForCaptcha();
     await enterCaptcha(manual);
   }
   ```

---

## 🎯 최종 권장 사항

### 단기 (현재 구현)
✅ Vision API + 재시도 로직
✅ 세션 기반 저장된 사건 접근
✅ 배치 검색 후 일괄 수집

### 중기
- ML 모델 학습으로 캡챠 정확도 향상
- Supabase에 사건 정보 자동 저장
- 주기적 업데이트 스케줄러

### 장기
- CODEF API 같은 상용 서비스 검토
- 전자소송 포털 API 연동 (인증서 기반)
- 자체 사건 관리 시스템 구축

---

## 📝 사용 예시

```typescript
import { CourtCaseSearcher } from './lib/scourt/searcher';

async function main() {
  const searcher = new CourtCaseSearcher();
  await searcher.initialize();

  // 검색할 사건 목록
  const cases = [
    { court: '수원가정법원', year: '2024', caseType: '드단',
      serialNumber: '26718', partyName: '김윤한' },
    { court: '수원가정법원', year: '2024', caseType: '드단',
      serialNumber: '26719', partyName: '박철수' },
    // ... 최대 50건
  ];

  // 모든 사건 검색 (각 캡챠 1회)
  for (const caseInfo of cases) {
    const success = await searcher.searchCase(caseInfo);
    if (success) {
      console.log(`✅ ${caseInfo.serialNumber} 검색 성공`);
    }
  }

  // 저장된 모든 사건 접근 (캡챠 불필요!)
  const savedCases = await searcher.accessSavedCases();
  console.log(`💾 총 ${savedCases.length}건 저장됨`);

  // 각 사건 상세 정보 수집 (캡챠 불필요!)
  for (let i = 0; i < savedCases.length; i++) {
    await searcher.clickSavedCase(i);

    // 여기서 사건 상세 정보 추출
    const details = await searcher.extractCaseDetails();

    // Supabase에 저장
    await supabase.from('cases').upsert(details);
  }

  // 세션 유지 (1시간)
  await searcher.keepAlive(3600);
}
```

---

## 🔗 관련 파일

- `scripts/improved-search-with-session.ts` - 메인 스크립트
- `lib/google/vision-captcha-solver.ts` - Vision API 래퍼
- `lib/scourt/scraper-v2.ts` - 기존 스크래퍼
- `/tmp/case-ing/` - case-ing 프로젝트 참고 자료

---

## ✅ 검증 완료

- [x] 저장된 사건은 캡챠 없이 접근 가능
- [x] 세션 기반 저장 (최대 50건)
- [x] 고유 URL 없음 확인
- [x] 재시도 로직 구현
- [x] 클래스 기반 구조화
- [x] 브라우저 세션 유지 방법 확립

---

**작성일**: 2025-12-26
**버전**: 1.0
