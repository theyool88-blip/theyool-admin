# 대법원 나의사건검색 API 분석

## 개요

브라우저(Puppeteer) 없이 직접 REST API 호출로 사건 검색 및 상세 조회가 가능함을 확인함.

**핵심 발견 (2025-12-31):**
- `encCsNo`는 **WMONID**에 바인딩됨 (JSESSIONID 아님)
- `csNoHistLst` 파라미터로 64자 encCsNo 획득 가능
- 64자 encCsNo + 동일 WMONID = **캡챠 없이 상세 조회 가능**

---

## 핵심 개념

### WMONID
- 대법원 서버가 발급하는 2년짜리 영구 쿠키
- encCsNo가 이 값에 바인딩됨
- 사용자별로 발급하여 관리해야 함

### encCsNo (암호화된 사건번호)
| 길이 | 용도 | 재사용 |
|------|------|--------|
| **64자** | csNoHistLst로 등록된 사건 | ✅ 캡챠 없이 재접근 가능 |
| 44자 | 일반 검색 결과 | ❌ 세션 종료 시 만료 |

### csNoHistLst
- 사건을 "저장된 사건"으로 등록하는 파라미터
- **포맷**: `연도(4) + 사건유형코드(3) + 일련번호(7)` = 14자
- 예: `2024드단26718` → `20241500026718`

---

## API 엔드포인트

### Base URL
```
https://ssgo.scourt.go.kr
```

### 1. 세션 초기화
```
GET /ssgo/index.on?cortId=www

Response Headers:
  Set-Cookie: WMONID=xxx; Expires=2년후; Path=/
  Set-Cookie: JSESSIONID=xxx; Path=/
```

### 2. 캡챠 이미지 획득
```
POST /ssgo/ssgo10l/getCaptchaInf.on

Headers:
  Content-Type: application/json;charset=UTF-8
  Cookie: WMONID=xxx; JSESSIONID=xxx

Body: ""

Response:
{
  "data": {
    "dma_captchaInf": {
      "image": "data:image/png;base64,..."
    }
  }
}
```

### 3. 사건 검색 (csNoHistLst로 등록)
```
POST /ssgo/ssgo10l/selectHmpgMain.on

Body:
{
  "dma_search": {
    "cortCd": "수원가정법원",
    "cdScope": "ALL",
    "csNoHistLst": "20241500026718",  // ⭐ 핵심: 14자 포맷
    "csDvsCd": "드단",
    "csYr": "2024",
    "csSerial": "26718",
    "btprNm": "김",                    // 당사자 성
    "answer": "158",                   // 캡챠 답변
    "fullCsNo": ""
  }
}

Response:
{
  "data": {
    "dlt_csNoHistLst": [
      {
        "encCsNo": "64자_토큰..."  // ⭐ 64자 = 캡챠없이 재사용 가능
      }
    ]
  }
}
```

### 4. 상세 조회 (캡챠 없이)
```
POST /ssgo/ssgo102/selectHmpgFmlyCsGnrlCtt.on

Headers:
  Cookie: WMONID=동일한값; JSESSIONID=새세션도OK

Body:
{
  "dma_search": {
    "cortCd": "000302",           // 법원코드 (숫자)
    "csNo": "",
    "encCsNo": "64자_토큰",       // ⭐ 저장된 encCsNo
    "csYear": "2024",
    "csDvsCd": "150",             // 사건유형코드 (숫자)
    "csSerial": "26718",
    "btprtNm": "",
    "captchaAnswer": ""           // ⭐ 비워도 됨!
  }
}

Response:
{
  "data": {
    "dma_csBasCtt": {
      "csNm": "이혼 등",          // 사건명
      "csNo": "2024드단26718",
      ...
    },
    "dlt_csSchdCtt": [...],       // 기일 정보
    "dlt_prcdRslt": [...]         // 진행 결과
  }
}
```

---

## 코드 매핑

### 법원 코드
| 법원명 | 코드 |
|--------|------|
| 수원가정법원 | 000302 |
| 수원가정법원 성남지원 | 000303 |
| 수원가정법원 여주지원 | 000304 |
| 수원가정법원 평택지원 | 000305 |
| 수원가정법원 안양지원 | 000306 |
| 수원가정법원 안산지원 | 000322 |
| 서울가정법원 | 000201 |
| 인천가정법원 | 000401 |

### 사건유형 코드
| 사건유형 | 코드 | csNoHistLst용 |
|---------|------|---------------|
| 드단 | 150 | 150 |
| 드합 | 151 | 151 |
| 느단 | 140 | 140 |
| 느합 | 141 | 141 |

### csNoHistLst 포맷
```
연도(4자) + 유형코드(3자) + 일련번호(7자, 0패딩) = 14자

예시:
2024드단26718 → 2024 + 150 + 0026718 = 20241500026718
2023느단1234  → 2023 + 140 + 0001234 = 20231400001234
```

---

## 전체 워크플로우

### 1단계: 사건 등록 (최초 1회, 캡챠 필요)

```typescript
// 1. 세션 생성 → WMONID 획득
const res = await fetch('https://ssgo.scourt.go.kr/ssgo/index.on?cortId=www');
const wmonid = res.headers.get('set-cookie').match(/WMONID=([^;]+)/)[1];

// 2. 캡챠 획득 및 해결
const captcha = await getCaptcha();
const answer = await solveCaptcha(captcha.image);

// 3. csNoHistLst로 검색 → 64자 encCsNo 획득
const result = await search({
  csNoHistLst: '20241500026718',  // 14자 포맷
  answer: answer,
  ...
});
const encCsNo = result.dlt_csNoHistLst[0].encCsNo;  // 64자

// 4. DB에 저장
await db.insert({ wmonid, encCsNo, case_number: '2024드단26718' });
```

### 2단계: 상세 조회 (이후, 캡챠 없음)

```typescript
// 1. DB에서 조회
const saved = await db.select({ case_number: '2024드단26718' });

// 2. 새 세션 (같은 WMONID 사용)
const res = await fetch('https://ssgo.scourt.go.kr/ssgo/index.on?cortId=www', {
  headers: { Cookie: `WMONID=${saved.wmonid}` }
});
const jsessionId = res.headers.get('set-cookie').match(/JSESSIONID=([^;]+)/)[1];

// 3. 캡챠 없이 상세 조회
const detail = await getDetail({
  encCsNo: saved.encCsNo,
  captchaAnswer: '',  // 비워도 됨!
});
```

---

## 데이터베이스 스키마

### scourt_user_wmonid (사용자별 WMONID)
```sql
CREATE TABLE scourt_user_wmonid (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  wmonid VARCHAR(20) NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,  -- issued_at + 2년
  status VARCHAR(20) DEFAULT 'active',  -- active, expiring, expired
  case_count INTEGER DEFAULT 0
);
```

### scourt_profile_cases (저장된 사건)
```sql
CREATE TABLE scourt_profile_cases (
  id UUID PRIMARY KEY,
  legal_case_id UUID UNIQUE REFERENCES legal_cases(id),
  case_number VARCHAR(50) NOT NULL,
  court_name VARCHAR(100),
  court_code VARCHAR(10),
  enc_cs_no TEXT,           -- 64자 암호화된 사건번호
  wmonid VARCHAR(20),       -- encCsNo가 바인딩된 WMONID
  user_wmonid_id UUID REFERENCES scourt_user_wmonid(id)
);
```

---

## 구현 파일

| 파일 | 역할 |
|------|------|
| `lib/scourt/api-client.ts` | API 클라이언트 |
| `lib/scourt/wmonid-manager.ts` | 사용자별 WMONID 관리 |
| `lib/google/vision-captcha-solver.ts` | Vision API 캡챠 해결 |
| `scripts/register-10-cases-api.ts` | 일괄 등록 테스트 |

---

## 테스트 결과 (2025-12-31)

```
✅ 세션 생성: WMONID + JSESSIONID 획득 성공
✅ 캡챠 해결: Vision API 인식 성공
✅ 사건 등록: 10/10 encCsNo 획득 (모두 64자)
✅ DB 저장: 10/10 성공
✅ 캡챠 없이 조회: 9/10 성공 (1건은 서버에 미등록)
```

---

## 주의사항

### WMONID 관리
- 사용자별로 발급 (통일 시 보안 위험)
- 만료 1개월 전 갱신 권장
- 갱신 시 모든 사건 재등록 필요

### 서버 제한
- 50건 제한은 **클라이언트 localStorage**에만 있음
- 서버에는 제한 없음 (수백 건 등록 가능)

### encCsNo 바인딩
- 64자 encCsNo는 WMONID에 바인딩됨
- JSESSIONID는 상관없음 (새 세션에서도 동작)
- 다른 WMONID로는 접근 불가

---

## 변경 이력

| 날짜 | 내용 |
|------|------|
| 2025-12-29 | 최초 작성, API 분석 |
| 2025-12-29 | 상세 API WebSquare5 차단 확인 |
| 2025-12-31 | **WMONID 바인딩 발견**, 캡챠 없이 상세 조회 성공 |
| 2025-12-31 | csNoHistLst 14자 포맷 확정, DB 스키마 추가 |
