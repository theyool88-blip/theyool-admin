# 완전 통합 캘린더 모달 시스템 구현 계획
**날짜**: 2025-11-25
**접근 방식**: Complete Unification (완전 통합)

---

## 1. 현재 상태 및 문제점

### 기존 모달 시스템 (3개 모달 사용)

1. **UnifiedScheduleModal**
   - 현재 상태: 4가지 카테고리 생성 가능, 상담 편집만 부분 구현
   - 문제: 법원기일 편집 불가, report/status 수정 불가

2. **HearingDetailModal**  
   - 역할: 법원기일 전용 편집 모달
   - 기능: report(재판기일 보고서), result(변론기일 결과), status 수정, 보기/편집 토글

3. **ConsultationScheduleModal**
   - 역할: 상담 일정 확정 전용
   - 기능: 예약 가능 시간 조회, 담당 변호사 배정, 사무소 선택
   - API: `/api/admin/availability/slots` 연동

### 문제점
- **일관성 부족**: 이벤트 타입마다 다른 모달 사용
- **코드 중복**: 유사한 기능이 여러 모달에 중복
- **유지보수 어려움**: 변경 시 3곳 수정 필요
- **사용자 혼란**: 이벤트마다 다른 UX

---

## 2. 완전 통합 솔루션 설계

### 목표
모든 캘린더 이벤트를 **하나의 UnifiedScheduleModal**로 통합하여 **단일 진실의 원천(Single Source of Truth)** 확립

### 통합 후 구조
```
UnifiedScheduleModal (단일 모달)
├── COURT_HEARING (법원기일)
│   ├── 생성: 기본 정보 입력
│   └── 편집: 기본 정보 + report + result + status 수정
├── DEADLINE (데드라인)
│   ├── 생성: 기산일 입력
│   └── 편집: 기산일 수정
├── CONSULTATION (상담)
│   ├── 생성: 신청자 정보 입력
│   └── 편집: 정보 수정 + 일정 확정 + 담당 변호사 배정
└── GENERAL_SCHEDULE (일반일정)
    ├── 생성: 일정 정보 입력
    └── 편집: 일정 정보 수정
```

---

## 3. 핵심 구현 내용

### 3.1 EditScheduleData 인터페이스 확장

```typescript
export interface EditScheduleData {
  // 공통 필드
  id: string
  event_type: 'COURT_HEARING' | 'DEADLINE' | 'CONSULTATION' | 'GENERAL_SCHEDULE'
  event_subtype?: string | null
  
  // 사건/의뢰인 정보
  reference_id?: string | null
  case_name?: string | null
  case_id?: string | null
  
  // 날짜/시간
  event_date?: string
  event_time?: string | null
  trigger_date?: string | null  // DEADLINE 전용
  
  // 위치
  location?: string | null
  office_location?: string | null  // CONSULTATION 전용
  
  // 상태 및 설명
  status?: string | null
  description?: string | null
  
  // CONSULTATION 전용 필드
  preferred_date?: string | null
  preferred_time?: string | null
  confirmed_date?: string | null
  confirmed_time?: string | null
  assigned_lawyer?: string | null
  
  // COURT_HEARING 전용 필드 (신규 추가)
  report?: string | null  // 재판기일 보고서
  result?: string | null  // 변론기일 결과 (CONTINUED | CONCLUDED | POSTPONED | DISMISSED)
  judge_name?: string | null
}
```

### 3.2 동적 폼 렌더링 구조

```typescript
// 카테고리별로 다른 폼 필드를 동적으로 렌더링
const renderCategorySpecificFields = () => {
  switch (category) {
    case 'court_hearing':
      return (
        <>
          {renderBasicFields()}
          {editMode && renderCourtHearingEditFields()}  // report, result, status
        </>
      )
    case 'consultation':
      return (
        <>
          {renderConsultationBasicFields()}
          {editMode && renderConsultationSchedulingFields()}  // 예약 시간, 담당 변호사
        </>
      )
    // ... 다른 카테고리
  }
}
```

### 3.3 법원기일 편집 필드 (핵심 신규 기능)

```typescript
const renderCourtHearingEditFields = () => {
  if (!editMode) return null
  
  return (
    <>
      {/* 재판기일 보고서 */}
      <div>
        <label>재판기일 보고서</label>
        <textarea
          value={formData.report}
          onChange={(e) => setFormData(prev => ({ ...prev, report: e.target.value }))}
          rows={6}
          placeholder="재판 진행 내용, 결과, 다음 절차 등을 기록하세요"
        />
      </div>
      
      {/* 변론기일 결과 */}
      <div>
        <label>변론기일 결과</label>
        <select value={formData.result} onChange={...}>
          <option value="">선택 안 함</option>
          <option value="CONTINUED">속행 (변론이 계속 진행)</option>
          <option value="CONCLUDED">종결 (변론 종결)</option>
          <option value="POSTPONED">연기 (다음 기일로 연기)</option>
          <option value="DISMISSED">추정 (사건 추정)</option>
        </select>
      </div>
      
      {/* 상태 */}
      <div>
        <label>상태</label>
        <select value={formData.status} onChange={...}>
          <option value="SCHEDULED">예정</option>
          <option value="COMPLETED">완료</option>
          <option value="POSTPONED">연기</option>
          <option value="CANCELLED">취소</option>
        </select>
      </div>
    </>
  )
}
```

### 3.4 상담 일정 확정 필드 (핵심 신규 기능)

```typescript
const renderConsultationSchedulingFields = () => {
  if (!editMode) return null
  
  return (
    <>
      {/* 확정 날짜 선택 */}
      <div>
        <label>확정 날짜</label>
        <input
          type="date"
          value={formData.confirmed_date}
          onChange={(e) => {
            setFormData(prev => ({ ...prev, confirmed_date: e.target.value }))
            loadAvailableSlots(e.target.value)  // 예약 가능 시간 조회
          }}
        />
      </div>
      
      {/* 예약 가능 시간 선택 (API 연동) */}
      {formData.loadingSlots ? (
        <div>예약 가능 시간을 불러오는 중...</div>
      ) : (
        <div>
          <label>확정 시간</label>
          <div className="grid grid-cols-4 gap-2">
            {formData.availableSlots.map(slot => (
              <button
                key={slot.time}
                onClick={() => setFormData(prev => ({ ...prev, confirmed_time: slot.time }))}
                disabled={!slot.available}
                className={slot.time === formData.confirmed_time ? 'selected' : ''}
              >
                {slot.time}
                {slot.available && slot.remaining < slot.maxCapacity && (
                  <span>{slot.remaining}자리</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
      
      {/* 담당 변호사 */}
      <div>
        <label>담당 변호사</label>
        <select value={formData.assigned_lawyer} onChange={...}>
          <option value="">선택 안 함</option>
          <option value="육심원">육심원</option>
          <option value="임은지">임은지</option>
        </select>
      </div>
    </>
  )
}
```

### 3.5 통합 데이터 로딩

```typescript
const loadEventData = async (eventId: string, eventType: string) => {
  const supabase = createClient()
  
  switch (eventType) {
    case 'COURT_HEARING': {
      const { data } = await supabase
        .from('court_hearings')
        .select('*')
        .eq('id', eventId)
        .single()
      
      return {
        id: data.id,
        event_type: 'COURT_HEARING',
        event_subtype: data.hearing_type,
        reference_id: data.case_number,
        event_date: extractDate(data.hearing_date),
        event_time: extractTime(data.hearing_date),
        location: data.location,
        description: data.notes,
        status: data.status,
        report: data.report,  // 신규
        result: data.result,  // 신규
        judge_name: data.judge_name,
      }
    }
    
    case 'CONSULTATION': {
      const { data } = await supabase
        .from('consultations')
        .select('*')
        .eq('id', eventId)
        .single()
      
      return {
        id: data.id,
        event_type: 'CONSULTATION',
        event_subtype: data.request_type,
        reference_id: data.phone,
        case_name: data.name,
        event_date: data.preferred_date || data.confirmed_date,
        event_time: data.preferred_time || data.confirmed_time,
        location: data.office_location,
        description: data.message,
        status: data.status,
        preferred_date: data.preferred_date,  // 신규
        preferred_time: data.preferred_time,  // 신규
        confirmed_date: data.confirmed_date,  // 신규
        confirmed_time: data.confirmed_time,  // 신규
        assigned_lawyer: data.assigned_lawyer,  // 신규
      }
    }
    
    // ... DEADLINE, GENERAL_SCHEDULE
  }
}
```

### 3.6 통합 제출 로직

```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault()
  if (!validate()) return
  
  setLoading(true)
  
  try {
    if (editMode) {
      await handleUpdate()
    } else {
      await handleCreate()
    }
    
    alert(editMode ? '일정이 수정되었습니다.' : '일정이 추가되었습니다.')
    onSuccess()
  } catch (error) {
    alert(`${editMode ? '수정' : '추가'} 실패: ${error.message}`)
  } finally {
    setLoading(false)
  }
}

const handleUpdate = async () => {
  const supabase = createClient()
  
  switch (editData.event_type) {
    case 'COURT_HEARING': {
      const { error } = await supabase
        .from('court_hearings')
        .update({
          hearing_type: formData.subtype,
          hearing_date: `${formData.date}T${formData.time}:00`,
          location: formData.location || null,
          judge_name: formData.judge_name || null,
          report: formData.report || null,  // 신규
          result: formData.result || null,  // 신규
          notes: formData.notes || null,
          status: formData.status
        })
        .eq('id', editData.id)
      
      if (error) throw error
      break
    }
    
    case 'CONSULTATION': {
      const updates = {
        name: formData.name,
        phone: formData.phone,
        request_type: formData.subtype,
        preferred_date: formData.date,
        preferred_time: formData.time,
        office_location: formData.office_location,
        message: formData.notes,
        status: formData.consultation_status,
        assigned_lawyer: formData.assigned_lawyer,  // 신규
      }
      
      // 확정 일정 업데이트
      if (formData.confirmed_date && formData.confirmed_time) {
        updates.confirmed_date = formData.confirmed_date  // 신규
        updates.confirmed_time = formData.confirmed_time  // 신규
        if (formData.consultation_status === 'pending') {
          updates.status = 'confirmed'
        }
      }
      
      const { error } = await supabase
        .from('consultations')
        .update(updates)
        .eq('id', editData.id)
      
      if (error) throw error
      break
    }
    
    // ... DEADLINE, GENERAL_SCHEDULE
  }
}
```

---

## 4. Dashboard 및 Calendar 컴포넌트 수정

### 4.1 Dashboard.tsx 수정

```typescript
// 기존 (3가지 분기)
onScheduleClick={async (schedule) => {
  if (schedule.event_type === 'COURT_HEARING') {
    // HearingDetailModal 사용
    setShowHearingDetailModal(true)
  } else if (schedule.event_type === 'CONSULTATION') {
    // UnifiedScheduleModal 사용 (부분적)
    setShowUnifiedModal(true)
  } else {
    // 다른 처리
  }
}}

// 통합 후 (단일 경로)
onScheduleClick={async (schedule) => {
  // 모든 이벤트 타입을 UnifiedScheduleModal로 통합
  const editData = await loadEventData(schedule.id, schedule.event_type)
  
  if (editData) {
    setEditScheduleData(editData)
    setShowUnifiedModal(true)
  }
}}
```

### 4.2 MonthlyCalendar.tsx 수정

```typescript
// 기존 (2가지 분기)
onClick={async () => {
  if (schedule.type === 'consultation') {
    // ConsultationScheduleModal 사용
    setShowConsultationModal(true)
  } else {
    // UnifiedScheduleModal 사용
    setShowAddModal(true)
  }
}}

// 통합 후 (단일 경로)
onClick={async () => {
  // 모든 타입을 UnifiedScheduleModal로 통합
  const editData = await loadEventData(schedule.id, schedule.type)
  
  if (editData) {
    setEditingSchedule(editData)
    setShowAddModal(true)
  }
}}
```

---

## 5. 구현 단계

### Phase 1: UnifiedScheduleModal 확장 (핵심)
1. EditScheduleData 인터페이스에 report, result, confirmed_date/time, assigned_lawyer 필드 추가
2. formData 상태에 신규 필드 추가
3. loadEventData 함수 구현 (4가지 이벤트 타입 지원)
4. renderCourtHearingEditFields 구현
5. renderConsultationSchedulingFields 구현
6. loadAvailableSlots API 연동
7. handleUpdate 함수 확장 (4가지 이벤트 타입 지원)
8. useEffect 수정 (editMode 시 데이터 로딩)

### Phase 2: Dashboard 및 Calendar 수정
1. Dashboard.tsx - onScheduleClick 핸들러 통합
2. MonthlyCalendar.tsx - 일정 클릭 핸들러 통합
3. WeeklyCalendar.tsx - 확인 (부모 컴포넌트에서 처리)

### Phase 3: 기존 모달 제거
1. HearingDetailModal.tsx 사용처 확인 및 제거
2. ConsultationScheduleModal.tsx 사용처 확인 및 제거
3. 파일 삭제
4. import 정리

### Phase 4: 테스트 및 검수
1. 각 이벤트 타입별 생성/편집/삭제 테스트
2. 법원기일 report/result/status 수정 테스트
3. 상담 일정 확정 테스트
4. 통합 시나리오 테스트

---

## 6. 검수 체크리스트

### 기능 검수
- [ ] 법원기일 생성
- [ ] 법원기일 편집 (날짜, 시간, 위치)
- [ ] **법원기일 report(재판기일 보고서) 입력 및 수정**
- [ ] **법원기일 result(변론기일 결과) 선택 및 수정**
- [ ] **법원기일 status(상태) 수정**
- [ ] 법원기일 삭제

- [ ] 데드라인 생성
- [ ] 데드라인 편집
- [ ] 데드라인 삭제

- [ ] 상담 생성
- [ ] 상담 편집 (이름, 전화번호, 유형)
- [ ] **상담 일정 확정 (예약 가능 시간 조회)**
- [ ] **상담 담당 변호사 배정**
- [ ] **상담 사무소 선택**
- [ ] 상담 수임 처리 및 사건 생성
- [ ] 상담 삭제

- [ ] 일반일정 생성
- [ ] 일반일정 편집
- [ ] 일반일정 삭제

### UI/UX 검수
- [ ] 카테고리별 필드가 동적으로 표시/숨김 처리됨
- [ ] 편집 모드 진입 시 기존 데이터가 올바르게 로드됨
- [ ] 예약 가능 시간이 정상적으로 조회됨
- [ ] 로딩 상태 표시가 적절함
- [ ] 에러 메시지가 명확함
- [ ] 폼 검증이 올바르게 작동함

### 통합 검수
- [ ] Dashboard에서 모든 이벤트 타입 클릭 시 UnifiedScheduleModal 열림
- [ ] MonthlyCalendar에서 모든 이벤트 타입 클릭 시 UnifiedScheduleModal 열림
- [ ] WeeklyCalendar를 통한 클릭도 정상 작동
- [ ] **HearingDetailModal이 완전히 제거됨**
- [ ] **ConsultationScheduleModal이 완전히 제거됨**
- [ ] 기존 기능이 모두 UnifiedScheduleModal에서 작동함

### 데이터 무결성 검수
- [ ] 법원기일 수정 후 court_hearings 테이블에 정확히 저장됨
- [ ] 상담 확정 후 consultations 테이블에 confirmed_date/time 저장됨
- [ ] 데드라인 계산이 정확함
- [ ] unified_calendar VIEW가 정확히 업데이트됨

---

## 7. 장점 및 효과

### 단일 진실의 원천 (Single Source of Truth)
- 모든 캘린더 이벤트를 하나의 모달에서 처리
- 코드 중복 완전 제거
- 일관된 UX 제공

### 유지보수성
- 한 곳에서 모든 로직 관리
- 버그 수정 및 기능 추가 용이
- 테스트 범위 명확

### 확장성
- 새로운 이벤트 타입 추가 용이
- 필드 추가/수정이 간단
- API 통합이 체계적

### 사용자 경험
- 일관된 인터페이스
- 빠른 학습 곡선
- 예측 가능한 동작

---

## 8. 위험 요소 및 완화 전략

### 위험 1: 모달 복잡도 증가
**완화 전략**:
- 동적 렌더링으로 필요한 필드만 표시
- 명확한 섹션 구분
- 주석으로 각 섹션 설명

### 위험 2: 성능 문제
**완화 전략**:
- 필요한 데이터만 로드 (lazy loading)
- 예약 가능 시간 조회는 날짜 선택 시에만 실행
- 메모이제이션 활용

### 위험 3: 기존 기능 누락
**완화 전략**:
- 기존 모달의 모든 기능을 체크리스트로 확인
- 단계적 마이그레이션
- 철저한 테스트

---

## 9. Critical Files for Implementation

### 주요 수정 파일
1. **UnifiedScheduleModal.tsx** (`/Users/hskim/luseed/components/UnifiedScheduleModal.tsx`)
   - 이유: 모든 기능을 통합하는 핵심 컴포넌트
   - 작업: EditScheduleData 확장, 동적 폼 렌더링, 통합 제출 로직

2. **Dashboard.tsx** (`/Users/hskim/luseed/components/Dashboard.tsx`)
   - 이유: 메인 대시보드의 이벤트 클릭 핸들러 통합
   - 작업: onScheduleClick 단일화, 기존 모달 제거

3. **MonthlyCalendar.tsx** (`/Users/hskim/luseed/components/MonthlyCalendar.tsx`)
   - 이유: 월간 캘린더의 이벤트 클릭 핸들러 통합
   - 작업: onClick 단일화, ConsultationScheduleModal 제거

### 참고 파일
4. **HearingDetailModal.tsx** (`/Users/hskim/luseed/components/HearingDetailModal.tsx`)
   - 이유: report/result/status UI 패턴 참고
   - 작업: 기능 이전 후 삭제

5. **ConsultationScheduleModal.tsx** (`/Users/hskim/luseed/components/ConsultationScheduleModal.tsx`)
   - 이유: 예약 가능 시간 조회 로직 참고
   - 작업: 기능 이전 후 삭제

---

## 10. 최종 목표

모든 캘린더 이벤트가 **하나의 UnifiedScheduleModal**을 통해 생성되고 편집되며, 기존의 HearingDetailModal과 ConsultationScheduleModal은 완전히 제거되어 **단일 진실의 원천(Single Source of Truth)**을 확립합니다.

이를 통해:
1. 일관된 사용자 경험 제공
2. 코드 유지보수성 향상
3. 버그 발생 가능성 감소
4. 새로운 기능 추가 용이성 확보
