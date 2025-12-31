# 상담 유입 경로 UI 통합 가이드

## ✅ 완료된 작업

### 1. 유입 경로 관리 페이지
**위치**: `/admin/settings/sources`

**기능**:
- 유입 경로 목록 조회
- 새 유입 경로 추가
- 기존 유입 경로 수정
- 유입 경로 삭제/비활성화
- 사용 횟수 통계

**접근 방법**:
1. `/admin/settings` → "상담 유입 경로" 탭
2. "유입 경로 관리 페이지로 이동" 버튼 클릭
3. 또는 직접 `/admin/settings/sources` 접속

### 2. 재사용 가능한 컴포넌트
**파일**: `components/ConsultationSourceSelector.tsx`

**Props**:
```typescript
interface ConsultationSourceSelectorProps {
  value?: string;              // 현재 선택된 유입 경로
  onChange: (value: string) => void;  // 변경 핸들러
  required?: boolean;          // 필수 입력 여부
  disabled?: boolean;          // 비활성화 여부
  className?: string;          // 추가 CSS 클래스
  showLabel?: boolean;         // 라벨 표시 여부 (기본: true)
}
```

---

## 🚀 상담 폼에 통합하기

### 방법 1: 기존 폼에 추가

```typescript
import ConsultationSourceSelector from '@/components/ConsultationSourceSelector';

function ConsultationForm() {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    source: '',  // 추가
    // ... 기타 필드
  });

  return (
    <form>
      {/* 기존 필드들 */}
      <input
        type="text"
        value={formData.name}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
      />

      {/* 유입 경로 선택기 추가 */}
      <ConsultationSourceSelector
        value={formData.source}
        onChange={(source) => setFormData({ ...formData, source })}
        required
      />

      <button type="submit">제출</button>
    </form>
  );
}
```

### 방법 2: 상담 상세 모달에 추가

```typescript
// components/ConsultationDetailModal.tsx
import ConsultationSourceSelector from '@/components/ConsultationSourceSelector';

function ConsultationDetailModal({ consultation }) {
  const [source, setSource] = useState(consultation.source || '');

  const handleUpdate = async () => {
    await fetch(`/api/admin/consultations/${consultation.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source })
    });
  };

  return (
    <div className="modal">
      <h3>상담 정보</h3>

      {/* 유입 경로 표시/수정 */}
      <ConsultationSourceSelector
        value={source}
        onChange={setSource}
      />

      <button onClick={handleUpdate}>저장</button>
    </div>
  );
}
```

### 방법 3: 상담 목록 페이지에 필터 추가

```typescript
// app/admin/consultations/page.tsx
import { useState, useEffect } from 'react';
import type { ConsultationSource } from '@/types/consultation-source';
import { getSourceColorClass } from '@/types/consultation-source';

function ConsultationsPage() {
  const [sources, setSources] = useState<ConsultationSource[]>([]);
  const [sourceFilter, setSourceFilter] = useState<string>('all');

  // 유입 경로 목록 가져오기
  useEffect(() => {
    fetch('/api/admin/consultation-sources?active_only=true')
      .then(res => res.json())
      .then(data => setSources(data.data || []));
  }, []);

  return (
    <div>
      {/* 필터 UI */}
      <div className="flex gap-2 mb-4">
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="px-3 py-2 border rounded"
        >
          <option value="all">전체 유입 경로</option>
          {sources.map(source => (
            <option key={source.id} value={source.name}>
              {source.name}
            </option>
          ))}
        </select>
      </div>

      {/* 상담 목록 */}
      {consultations.map(consultation => (
        <div key={consultation.id}>
          <h4>{consultation.name}</h4>
          {consultation.source && (
            <span className={`px-2 py-1 rounded text-sm ${getSourceColorClass(consultation.source)}`}>
              {consultation.source}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
```

---

## 📊 대시보드 통계 위젯

### 유입 경로 분석 위젯

```typescript
// components/SourceStatsWidget.tsx
'use client';

import { useEffect, useState } from 'react';
import type { ConsultationSource } from '@/types/consultation-source';
import { getSourceColorClass } from '@/types/consultation-source';

export default function SourceStatsWidget() {
  const [stats, setStats] = useState<{
    source: ConsultationSource;
    count: number;
    percentage: number;
  }[]>([]);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      // 1. 유입 경로 목록 가져오기
      const sourcesRes = await fetch('/api/admin/consultation-sources');
      const sourcesData = await sourcesRes.json();
      const sources = sourcesData.data || [];

      // 2. 상담 목록 가져오기
      const consultationsRes = await fetch('/api/admin/consultations');
      const consultationsData = await consultationsRes.json();
      const consultations = consultationsData.data || [];

      // 3. 유입 경로별 집계
      const total = consultations.length;
      const counts = new Map<string, number>();

      consultations.forEach((c: any) => {
        if (c.source) {
          counts.set(c.source, (counts.get(c.source) || 0) + 1);
        }
      });

      // 4. 통계 생성
      const statsData = sources
        .map((source: ConsultationSource) => ({
          source,
          count: counts.get(source.name) || 0,
          percentage: total > 0 ? ((counts.get(source.name) || 0) / total) * 100 : 0,
        }))
        .sort((a, b) => b.count - a.count);

      setStats(statsData);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4">유입 경로 분석</h3>

      <div className="space-y-3">
        {stats.map(({ source, count, percentage }) => (
          <div key={source.id} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full bg-${source.color}-500`} />
              <span className={`px-2 py-1 rounded text-sm ${getSourceColorClass(source.color)}`}>
                {source.name}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-gray-600">{count}건</span>
              <span className="text-sm font-medium">{percentage.toFixed(1)}%</span>
            </div>
          </div>
        ))}
      </div>

      {stats.length === 0 && (
        <p className="text-center text-gray-500 py-8">
          데이터가 없습니다.
        </p>
      )}
    </div>
  );
}
```

**사용 방법**:
```typescript
// app/admin/page.tsx (대시보드)
import SourceStatsWidget from '@/components/SourceStatsWidget';

export default function DashboardPage() {
  return (
    <div className="grid grid-cols-2 gap-6">
      {/* 기존 위젯들 */}

      {/* 유입 경로 통계 위젯 추가 */}
      <SourceStatsWidget />
    </div>
  );
}
```

---

## 🎨 스타일링 예시

### 배지 표시

```typescript
import { getSourceColorClass } from '@/types/consultation-source';

// 상담 목록에서 유입 경로 배지 표시
<span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSourceColorClass(consultation.source_color)}`}>
  {consultation.source}
</span>
```

### 필터 버튼

```typescript
// 버튼 형태 필터
<div className="flex gap-2">
  <button
    onClick={() => setSourceFilter('all')}
    className={`px-3 py-1 rounded ${sourceFilter === 'all' ? 'bg-sage-600 text-white' : 'bg-gray-100'}`}
  >
    전체
  </button>
  {sources.map(source => (
    <button
      key={source.id}
      onClick={() => setSourceFilter(source.name)}
      className={`px-3 py-1 rounded ${sourceFilter === source.name ? `bg-${source.color}-600 text-white` : 'bg-gray-100'}`}
    >
      {source.name}
    </button>
  ))}
</div>
```

---

## 📱 사용 예시 화면

### 1. 유입 경로 관리 페이지
```
/admin/settings/sources

┌─────────────────────────────────────────────┐
│ 상담 유입 경로 관리        [+ 새 유입 경로] │
├─────────────────────────────────────────────┤
│ 이름      색상    순서  상태  기본  사용횟수│
│ 네이버    🟢      1     활성   -      0건  │
│ 홈페이지  🔵      2     활성   ✓      0건  │
│ 기타      ⚪      99    활성   -      6건  │
└─────────────────────────────────────────────┘
```

### 2. 상담 등록 폼
```
┌──────────────────────────┐
│ 이름: [_____________]    │
│ 전화: [_____________]    │
│ 유입 경로: [▼ 네이버 ]   │
│   선택됨: 🟢 네이버       │
│ 메시지: [_____________]  │
│         [_____________]  │
│                          │
│        [취소] [제출]     │
└──────────────────────────┘
```

### 3. 상담 목록 필터
```
┌─────────────────────────────────────┐
│ 필터: [▼ 전체 유입 경로]            │
├─────────────────────────────────────┤
│ □ 김철수 - 콜백 요청  🟢 네이버    │
│ □ 이영희 - 방문 상담  🔵 홈페이지  │
│ □ 박민수 - 화상 상담  ⚪ 기타       │
└─────────────────────────────────────┘
```

---

## 🔧 API 사용법

### 유입 경로 목록 조회
```typescript
const response = await fetch('/api/admin/consultation-sources?active_only=true');
const { data: sources } = await response.json();
```

### 새 유입 경로 추가
```typescript
const response = await fetch('/api/admin/consultation-sources', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: '인스타그램',
    color: 'pink',
    display_order: 4,
    description: '인스타그램 광고 및 프로필을 통한 유입'
  })
});
```

### 유입 경로 수정
```typescript
const response = await fetch(`/api/admin/consultation-sources/${sourceId}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: '네이버 광고',
    color: 'green',
    display_order: 1
  })
});
```

### 유입 경로 삭제
```typescript
const response = await fetch(`/api/admin/consultation-sources/${sourceId}`, {
  method: 'DELETE'
});

// 사용 중인 경우 비활성화됨
const { deactivated, deleted, message } = await response.json();
```

---

## 📝 체크리스트

### 현재 완료 ✅
- [x] Database 마이그레이션
- [x] TypeScript 타입 정의
- [x] REST API 엔드포인트
- [x] 유입 경로 관리 페이지
- [x] 재사용 가능한 선택 컴포넌트
- [x] 설정 페이지 통합

### 향후 작업 (선택사항)
- [ ] 상담 등록/수정 폼에 컴포넌트 통합
- [ ] 상담 목록 페이지에 필터 추가
- [ ] 대시보드에 통계 위젯 추가
- [ ] 상담 상세 보기에 유입 경로 표시
- [ ] Excel 내보내기에 유입 경로 컬럼 추가

---

**작성일**: 2025-11-25
**상태**: UI 시스템 완성, 통합 준비 완료
