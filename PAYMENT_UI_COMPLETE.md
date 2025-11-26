# 입금 UI 기능 완료

## 📋 구현 내용

### 1. 입금 내역 모달 (`CasePaymentsModal`)
**위치**: `/Users/hskim/theyool-admin/components/CasePaymentsModal.tsx`

**주요 기능**:
- ✅ 사건별 입금 내역 목록 표시
- ✅ 총 입금액 및 건수 요약 통계
- ✅ 입금 추가 폼 (토글)
- ✅ 입금 삭제 기능
- ✅ 실시간 데이터 동기화

**모달 구성**:
```
┌─────────────────────────────────────┐
│  사건명: 홍길동v김철수              │
│  총 입금액: ₩5,000,000 | 3건        │
├─────────────────────────────────────┤
│  [+ 입금 추가] 버튼                 │
│                                     │
│  입금 내역 테이블                   │
│  ┌────┬────┬────┬────┬────┬────┐  │
│  │날짜│입금자│금액│명목│사무소│삭제│  │
│  └────┴────┴────┴────┴────┴────┘  │
└─────────────────────────────────────┘
```

**입금 추가 폼 필드**:
- 입금일 (필수) - date picker
- 입금자명 (필수) - text input
- 금액 (필수) - 자동 포맷팅 (천 단위 쉼표)
- 명목 (필수) - select (착수금, 잔금, 성공보수 등)
- 사무소 (선택) - select (평택, 천안)
- 메모 (선택) - text input

---

### 2. 사건 목록 페이지 개선 (`CasesList`)
**위치**: `/Users/hskim/theyool-admin/components/CasesList.tsx`

**추가된 기능**:

#### A. 입금액 클릭 기능
- 입금액 컬럼 클릭 시 → 입금 내역 모달 오픈
- 마우스 오버 시 하이라이트 (hover:bg-blue-50)
- 입금 내역이 있는 경우에만 클릭 가능

**Before:**
```tsx
<td>
  ₩5,000,000
  3건
</td>
```

**After:**
```tsx
<td>
  <div
    className="cursor-pointer hover:bg-blue-50"
    onClick={(e) => handleOpenPaymentModal(e, legalCase)}
  >
    ₩5,000,000
    3건
  </div>
</td>
```

#### B. "입금추가" 버튼 컬럼 추가
- 테이블에 새로운 컬럼 추가
- 모든 사건에 대해 "입금추가" 버튼 표시
- 클릭 시 입금 내역 모달 오픈 (추가 폼 바로 표시 가능)
- 녹색 버튼 (bg-green-600)으로 시각적 구분

**테이블 구조**:
```
| 계약일 | 사건종류 | 의뢰인 | 사건명 | 입금 | 지점 | 상태 | 일정 | 입금추가 |
|--------|----------|--------|--------|------|------|------|------|----------|
| 25.11.20 | 이혼 | 홍길동 | 홍v김 | [클릭 가능] | 평택 | 진행중 | [기일추가] | [입금추가] |
```

---

## 🔄 데이터 흐름

### 입금 추가 플로우
```
1. 사용자: "입금추가" 버튼 클릭
   ↓
2. CasePaymentsModal 오픈
   ↓
3. "+ 입금 추가" 버튼 클릭
   ↓
4. AddPaymentForm 표시
   ↓
5. 폼 작성 및 제출
   ↓
6. POST /api/admin/payments
   ↓
7. Supabase payments 테이블 INSERT
   ↓
8. 모달 내 목록 새로고침
   ↓
9. 부모 컴포넌트 payment_info 새로고침 (onPaymentAdded 콜백)
   ↓
10. 테이블에 업데이트된 금액 표시
```

### 입금 내역 조회 플로우
```
1. 페이지 로드 시
   ↓
2. fetchPaymentInfo() 실행
   ↓
3. SELECT * FROM case_payment_summary
   ↓
4. 각 사건에 payment_info 매핑
   ↓
5. 테이블에 표시

OR

1. 사용자: 입금액 클릭
   ↓
2. CasePaymentsModal 오픈
   ↓
3. SELECT * FROM payments WHERE case_id = ?
   ↓
4. 모달에 상세 내역 표시
```

---

## 🎨 UI/UX 특징

### 시각적 요소
- **입금액 컬럼**: 파란색 텍스트, 호버 시 하이라이트
- **입금추가 버튼**: 녹색 배경 (bg-green-600)
- **모달 헤더**: 파란색 그라데이션 배경
- **통계 카드**: 흰 배경 + 그림자
- **테이블**: 깔끔한 그리드 레이아웃

### 사용성
- **클릭 영역 명확화**: 입금액 전체 영역 클릭 가능
- **즉시 피드백**: 버튼 호버 시 색상 변경
- **직관적 레이블**: "입금추가", "삭제" 등 명확한 액션 표시
- **자동 포맷팅**: 금액 입력 시 천 단위 쉼표 자동 추가

---

## 📊 통합 상태

### 연결된 컴포넌트
1. **CasesList.tsx** - 사건 목록 페이지
   - 입금 정보 표시
   - 입금 모달 트리거

2. **CasePaymentsModal.tsx** - 입금 내역 모달
   - 입금 목록 표시
   - 입금 추가/삭제

### 연결된 API
- `GET /api/admin/payments` - 입금 목록 조회
- `POST /api/admin/payments` - 입금 추가
- `DELETE /api/admin/payments/[id]` - 입금 삭제

### 사용된 데이터베이스 뷰
- `case_payment_summary` - 사건별 입금 통계
  - case_id
  - total_amount (총 입금액)
  - payment_count (입금 건수)

---

## 🚀 다음 단계

### 권장 개선 사항
1. **사건 상세 페이지**
   - 사건 상세 페이지에도 동일한 입금액 클릭 기능 추가
   - 입금 내역 섹션 통합

2. **입금 통계**
   - 대시보드에 입금 통계 위젯 추가
   - 월별/사무소별 입금 차트

3. **알림 기능**
   - 입금 추가 시 알림 표시 (toast notification)
   - 성공/실패 피드백 개선

4. **일괄 처리**
   - 여러 건의 입금 한 번에 추가
   - CSV 업로드 기능

5. **검색 및 필터**
   - 입금 내역 모달에 날짜 필터 추가
   - 입금자명 검색 기능

---

## ✅ 테스트 체크리스트

- [x] 입금액 클릭 시 모달 오픈
- [x] "입금추가" 버튼 클릭 시 모달 오픈
- [x] 입금 추가 폼 제출
- [x] 입금 삭제 기능
- [x] 입금 추가 후 목록 자동 새로고침
- [x] 금액 포맷팅 (천 단위 쉼표)
- [x] 필수 필드 검증
- [x] 모달 닫기 기능
- [x] 반응형 레이아웃

---

## 📝 코드 예시

### 모달 사용법
```tsx
import CasePaymentsModal from '@/components/CasePaymentsModal'

function MyComponent() {
  const [showModal, setShowModal] = useState(false)

  return (
    <>
      <button onClick={() => setShowModal(true)}>
        입금 내역 보기
      </button>

      <CasePaymentsModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        caseId="uuid-of-case"
        caseName="홍길동v김철수"
        onPaymentAdded={() => {
          // 부모 컴포넌트 데이터 새로고침
          fetchPaymentInfo()
        }}
      />
    </>
  )
}
```

---

## 🎯 완료 일시
- **날짜**: 2025-11-23
- **작업자**: Claude Code
- **소요 시간**: 약 30분
- **관련 파일**:
  - `/Users/hskim/theyool-admin/components/CasePaymentsModal.tsx` (신규)
  - `/Users/hskim/theyool-admin/components/CasesList.tsx` (수정)
