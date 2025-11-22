# 법무법인 더율 - 이혼사건 기일 관리 시스템 구현 계획

## 📌 구현 완료 현황

### ✅ 완료된 작업
1. **데이터베이스 스키마** (`/supabase/migrations/20251122_court_schedule_system.sql`)
   - 6개 주요 테이블 설계 완료
   - ENUM 타입 정의
   - 인덱스 및 트리거 설정
   - 뷰 및 헬퍼 함수 구현

2. **TypeScript 타입 정의** (`/types/court-hearing.ts`)
   - 기일 및 불변기간 타입
   - API 요청/응답 타입
   - 필터 및 유틸리티 타입

3. **UI 컴포넌트 샘플** (`/components/features/court-schedule/HearingCard.tsx`)
   - 기일 카드 컴포넌트
   - 상태별 색상 및 액션
   - 긴급도 표시 로직

4. **아키텍처 문서** (`/COURT_SCHEDULE_ARCHITECTURE.md`)
   - 전체 시스템 설계
   - UI/UX 가이드라인
   - 구현 로드맵

---

## 🚀 즉시 실행 가능한 다음 단계

### Step 1: 데이터베이스 마이그레이션 실행

```bash
# 1. 마이그레이션 파일 실행
npx supabase db push

# 또는 직접 SQL 실행
npx supabase db execute -f supabase/migrations/20251122_court_schedule_system.sql
```

### Step 2: Supabase 클라이언트 함수 구현

```typescript
// lib/supabase/court-hearings.ts
import { createClient } from '@/lib/supabase/client';
import { CourtHearing, HearingFilter } from '@/types/court-hearing';

export async function getHearings(filter?: HearingFilter) {
  const supabase = createClient();

  let query = supabase
    .from('court_hearings')
    .select(`
      *,
      legal_case:legal_cases(
        case_number,
        client_name,
        opponent_name
      )
    `);

  // 필터 적용
  if (filter?.case_id) {
    query = query.eq('case_id', filter.case_id);
  }
  if (filter?.status) {
    query = query.in('status', filter.status);
  }
  if (filter?.date_from) {
    query = query.gte('hearing_date', filter.date_from);
  }
  if (filter?.date_to) {
    query = query.lte('hearing_date', filter.date_to);
  }

  const { data, error } = await query
    .order('hearing_date', { ascending: true });

  if (error) throw error;
  return data;
}

export async function createHearing(hearing: Partial<CourtHearing>) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('court_hearings')
    .insert(hearing)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateHearing(id: string, updates: Partial<CourtHearing>) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('court_hearings')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}
```

### Step 3: 관리자 페이지 구현

```typescript
// app/admin/court-schedule/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { CourtHearing } from '@/types/court-hearing';
import HearingCard from '@/components/features/court-schedule/HearingCard';
import { getHearings } from '@/lib/supabase/court-hearings';

export default function CourtSchedulePage() {
  const [hearings, setHearings] = useState<CourtHearing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHearings();
  }, []);

  async function loadHearings() {
    try {
      const data = await getHearings();
      setHearings(data);
    } catch (error) {
      console.error('Error loading hearings:', error);
    } finally {
      setLoading(false);
    }
  }

  const handleComplete = async (id: string) => {
    // 완료 처리 로직
  };

  const handlePostpone = async (id: string) => {
    // 연기 처리 로직
  };

  const handleEdit = (id: string) => {
    // 수정 페이지로 이동
  };

  if (loading) return <div>로딩 중...</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">기일 관리</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {hearings.map(hearing => (
          <HearingCard
            key={hearing.id}
            hearing={hearing}
            onComplete={handleComplete}
            onPostpone={handlePostpone}
            onEdit={handleEdit}
          />
        ))}
      </div>
    </div>
  );
}
```

---

## 📋 구현 우선순위 및 일정

### Phase 1: 기본 기능 (1주차)
- [ ] **Day 1-2**: 데이터베이스 마이그레이션 및 테스트
  - legal_cases 테이블 확인 및 연동
  - 샘플 데이터 입력
  - 기본 CRUD 테스트

- [ ] **Day 3-4**: API 엔드포인트 구현
  - `/api/admin/court-hearings` CRUD
  - `/api/admin/court-deadlines` CRUD
  - 필터링 및 정렬 로직

- [ ] **Day 5-7**: 관리자 UI 기본 구현
  - 기일 목록 페이지
  - 기일 등록 폼
  - 기일 수정/삭제 기능

### Phase 2: 고급 기능 (2주차)
- [ ] **Week 2**: 캘린더 뷰 및 불변기간 관리
  - 월간/주간 캘린더 컴포넌트
  - 불변기간 자동 계산
  - 알림 설정 UI

### Phase 3: 통합 및 최적화 (3주차)
- [ ] **Week 3**: 기존 시스템 통합
  - case_schedules 마이그레이션
  - 대시보드 위젯
  - 성능 최적화

---

## 🔧 기술적 고려사항

### 1. legal_cases 테이블 확인
```sql
-- legal_cases 테이블 존재 여부 확인
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name = 'legal_cases'
);

-- 없으면 생성
CREATE TABLE IF NOT EXISTS legal_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_number TEXT NOT NULL UNIQUE,
  client_name TEXT NOT NULL,
  opponent_name TEXT NOT NULL,
  court_name TEXT,
  judge_name TEXT,
  case_type TEXT,
  status TEXT DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2. 기존 case_schedules와의 관계
- 점진적 마이그레이션 전략 채택
- 신규 기일은 court_hearings에 저장
- 기존 데이터는 배치 작업으로 이관

### 3. 알림 시스템 연동
- 기존 SMS 시스템 활용 (`/lib/sms`)
- 이메일 알림 추가 (`/lib/email`)
- 카카오톡 알림 준비

---

## 📊 성공 지표

### 단기 목표 (1개월)
- ✅ 모든 신규 기일 등록
- ✅ 기일 누락 0건
- ✅ 관리자 만족도 90% 이상

### 중기 목표 (3개월)
- ✅ 자동 알림 발송률 95% 이상
- ✅ 평균 기일 등록 시간 2분 이내
- ✅ 모바일 앱 연동 준비 완료

### 장기 목표 (6개월)
- ✅ 의뢰인 포털 통합
- ✅ AI 기반 일정 최적화
- ✅ 타 법무법인 확장 가능

---

## 🎯 핵심 체크리스트

### 필수 구현 사항
- [ ] court_hearings 테이블 생성 및 테스트
- [ ] court_deadlines 테이블 생성 및 테스트
- [ ] 기본 CRUD API 구현
- [ ] 관리자 기일 목록 페이지
- [ ] 기일 등록/수정 폼
- [ ] 상태 변경 기능 (완료/연기/취소)
- [ ] 불변기간 자동 계산
- [ ] 긴급 기일 알림

### 선택 구현 사항
- [ ] 캘린더 뷰
- [ ] 문서 관리 연동
- [ ] 변호사별 일정 관리
- [ ] 통계 대시보드
- [ ] 엑셀 내보내기
- [ ] 인쇄용 보고서

---

## 💡 구현 팁

### 1. 점진적 개발
- MVP 먼저 구현 (기본 CRUD)
- 사용자 피드백 수집
- 반복적 개선

### 2. 코드 재사용
- 기존 컴포넌트 활용 (PageLayout, 폼 컴포넌트)
- 공통 유틸리티 함수 작성
- 디자인 시스템 일관성 유지

### 3. 테스트 우선
- 샘플 데이터 준비
- 엣지 케이스 처리
- 사용자 시나리오 테스트

---

## 📞 지원 및 문의

구현 중 문제가 발생하면:
1. 기존 코드베이스 참조 (blog, cases 등)
2. Supabase 문서 확인
3. TypeScript 타입 체크 활용

이 문서는 실제 구현 진행에 따라 업데이트됩니다.