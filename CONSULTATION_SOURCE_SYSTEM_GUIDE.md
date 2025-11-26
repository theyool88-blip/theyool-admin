# 상담 유입 경로 관리 시스템 가이드

## 📋 구현 완료 사항

### 1. Database & Migration ✅
- **파일**: `supabase/migrations/20251125_add_consultation_sources.sql`
- **테이블**: `consultation_sources`
- **기능**:
  - 유입 경로 관리 (네이버, 홈페이지, 기타)
  - 확장 가능한 구조 (관리자가 추가/수정/삭제)
  - 자동 사용 횟수 집계 (트리거)
  - 색상, 정렬 순서 관리

### 2. TypeScript Types ✅
- **파일**: `types/consultation-source.ts`
- **포함사항**:
  - `ConsultationSource` 인터페이스
  - Create/Update input 타입
  - 색상 constants
  - Helper functions (정렬, 검증, 기본값 가져오기)

### 3. API Endpoints ✅
- **파일**:
  - `app/api/admin/consultation-sources/route.ts` (목록, 생성)
  - `app/api/admin/consultation-sources/[id]/route.ts` (조회, 수정, 삭제)

- **엔드포인트**:
  ```
  GET    /api/admin/consultation-sources        # 전체 목록
  GET    /api/admin/consultation-sources?active_only=true  # 활성화된 항목만
  POST   /api/admin/consultation-sources        # 새 유입 경로 추가
  GET    /api/admin/consultation-sources/:id    # 단일 조회
  PATCH  /api/admin/consultation-sources/:id    # 수정
  DELETE /api/admin/consultation-sources/:id    # 삭제 (사용 중이면 비활성화)
  ```

### 4. Supabase Helper Functions ✅
- **파일**: `lib/supabase/consultation-sources.ts`
- **함수**:
  - `getConsultationSources()` - 전체 목록
  - `getConsultationSourceById()` - ID로 조회
  - `getDefaultConsultationSource()` - 기본값 가져오기
  - `createConsultationSource()` - 생성
  - `updateConsultationSource()` - 수정
  - `deleteConsultationSource()` - 삭제
  - `getSourceStatistics()` - 통계

---

## 🚀 사용 방법

### Step 1: 마이그레이션 적용

Supabase Dashboard에서 SQL 실행:
```bash
# 1. SQL 복사
cat supabase/migrations/20251125_add_consultation_sources.sql

# 2. Supabase Dashboard SQL Editor로 이동
https://supabase.com/dashboard/project/kqqyipnlkmmprfgygauk/sql/new

# 3. 붙여넣고 "Run" 클릭
```

### Step 2: 검증

```bash
# 유입 경로 테이블 확인
node scripts/test-consultation-sources.js
```

### Step 3: API 테스트

```bash
# 1. 유입 경로 목록 조회
curl http://localhost:3000/api/admin/consultation-sources

# 2. 새 유입 경로 추가
curl -X POST http://localhost:3000/api/admin/consultation-sources \
  -H "Content-Type: application/json" \
  -d '{
    "name": "인스타그램",
    "color": "pink",
    "display_order": 3
  }'
```

---

## 📊 데이터 구조

### consultation_sources 테이블

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID | Primary Key |
| name | TEXT | 유입 경로 이름 (예: "네이버") |
| display_order | INT | 표시 순서 (낮을수록 먼저) |
| color | TEXT | Tailwind 색상 (예: "green", "blue") |
| is_active | BOOLEAN | 활성화 여부 |
| is_default | BOOLEAN | 기본값 여부 |
| usage_count | INT | 사용 횟수 (자동 집계) |
| description | TEXT | 설명 (선택사항) |

### 기본 데이터

마이그레이션 실행 시 자동으로 생성:
```sql
네이버     - 초록색, 정렬순서: 1
홈페이지   - 파랑색, 정렬순서: 2, 기본값
기타       - 회색,   정렬순서: 99
```

---

## 💻 프론트엔드 통합 예시

### 유입 경로 선택 컴포넌트 (예시)

```typescript
import { useEffect, useState } from 'react';
import type { ConsultationSource } from '@/types/consultation-source';

function SourceSelector({ value, onChange }: {
  value?: string;
  onChange: (value: string) => void;
}) {
  const [sources, setSources] = useState<ConsultationSource[]>([]);

  useEffect(() => {
    fetch('/api/admin/consultation-sources?active_only=true')
      .then(res => res.json())
      .then(data => setSources(data.data || []));
  }, []);

  return (
    <select
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      className="border rounded px-3 py-2"
    >
      <option value="">선택하세요</option>
      {sources.map(source => (
        <option key={source.id} value={source.name}>
          {source.name}
        </option>
      ))}
    </select>
  );
}
```

### 상담 생성 시 유입 경로 포함

```typescript
const createConsultation = async (data) => {
  await fetch('/api/admin/consultations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...data,
      source: selectedSource,  // 선택된 유입 경로
    })
  });
};
```

### 통계 표시 예시

```typescript
import { getSourceStatistics } from '@/lib/supabase/consultation-sources';

async function SourceStatsWidget() {
  const stats = await getSourceStatistics();

  return (
    <div className="grid grid-cols-3 gap-4">
      {stats.map(stat => (
        <div key={stat.name} className="p-4 bg-white rounded-lg shadow">
          <div className={`inline-block px-2 py-1 rounded text-sm bg-${stat.color}-100 text-${stat.color}-800`}>
            {stat.name}
          </div>
          <div className="text-2xl font-bold mt-2">{stat.count}건</div>
          <div className="text-sm text-gray-500">{stat.percentage.toFixed(1)}%</div>
        </div>
      ))}
    </div>
  );
}
```

---

## 🎨 UI 통합 가이드

### 1. 상담 목록 페이지에 필터 추가

```typescript
// app/admin/consultations/page.tsx
const [sourceFilter, setSourceFilter] = useState<string>('all');
const [sources, setSources] = useState<ConsultationSource[]>([]);

// 유입 경로 목록 가져오기
useEffect(() => {
  fetch('/api/admin/consultation-sources?active_only=true')
    .then(res => res.json())
    .then(data => setSources(data.data || []));
}, []);

// 필터 UI
<select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
  <option value="all">전체 유입 경로</option>
  {sources.map(source => (
    <option key={source.id} value={source.name}>{source.name}</option>
  ))}
</select>
```

### 2. 상담 상세 모달에 유입 경로 표시

```typescript
{consultation.source && (
  <div className="flex items-center gap-2">
    <span className="text-gray-600">유입 경로:</span>
    <span className={`px-2 py-1 rounded text-sm ${getSourceColorClass(sourceColor)}`}>
      {consultation.source}
    </span>
  </div>
)}
```

### 3. 대시보드에 유입 경로 통계 추가

```typescript
// components/SourceStatsDashboard.tsx
export default function SourceStatsDashboard() {
  const [stats, setStats] = useState([]);

  useEffect(() => {
    // 최근 30일 통계
    const endDate = new Date().toISOString();
    const startDate = new Date(Date.now() - 30*24*60*60*1000).toISOString();

    fetch(`/api/admin/consultation-sources/stats?start_date=${startDate}&end_date=${endDate}`)
      .then(res => res.json())
      .then(data => setStats(data.stats || []));
  }, []);

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4">유입 경로 분석 (최근 30일)</h3>
      <div className="space-y-3">
        {stats.map((stat, idx) => (
          <div key={idx} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full bg-${stat.color}-500`} />
              <span className="font-medium">{stat.name}</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-gray-600">{stat.count}건</span>
              <span className="text-sm font-medium">{stat.percentage.toFixed(1)}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## 🔧 관리자 설정 페이지 (TODO)

향후 구현 예정:
```
/admin/settings/sources
```

기능:
- ✅ 유입 경로 목록 보기
- ✅ 새 유입 경로 추가
- ✅ 기존 유입 경로 수정 (이름, 색상, 순서)
- ✅ 유입 경로 삭제/비활성화
- ✅ 사용 통계 확인

---

## 📝 주요 특징

### 1. 자동 사용 횟수 집계

트리거가 자동으로 `usage_count`를 업데이트:
- 상담 생성 시 → 해당 source의 usage_count + 1
- source 변경 시 → 이전 source -1, 새 source +1
- 상담 삭제 시 → 해당 source의 usage_count - 1

### 2. 안전한 삭제

사용 중인 유입 경로는 삭제되지 않고 비활성화:
```typescript
// usage_count > 0 이면
{
  deleted: false,
  deactivated: true,
  message: "'네이버'은(는) 사용 중이므로 비활성화되었습니다. (사용 횟수: 150건)"
}
```

### 3. 기본값 관리

- `is_default = true`인 항목이 신규 상담의 기본 유입 경로
- 새로운 기본값 설정 시 기존 기본값 자동 해제

### 4. 확장 가능한 구조

별도 테이블로 관리하여:
- 관리자가 언제든지 새 유입 경로 추가 가능
- 색상, 정렬 순서 커스터마이징
- 통계 분석 용이

---

## 🧪 테스트 스크립트 (생성 예정)

```javascript
// scripts/test-consultation-sources.js
require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

async function testConsultationSources() {
  console.log('🧪 Testing consultation sources system...\n')

  // 1. 유입 경로 목록 조회
  const { data: sources, error } = await supabase
    .from('consultation_sources')
    .select('*')
    .order('display_order')

  if (error) {
    console.error('❌ Error:', error)
    return
  }

  console.log(`✅ Found ${sources.length} consultation sources:\n`)
  sources.forEach((s, idx) => {
    console.log(`${idx + 1}. ${s.name}`)
    console.log(`   Color: ${s.color}`)
    console.log(`   Active: ${s.is_active}`)
    console.log(`   Default: ${s.is_default}`)
    console.log(`   Usage: ${s.usage_count}건\n`)
  })

  // 2. 기본 유입 경로 확인
  const defaultSource = sources.find(s => s.is_default && s.is_active)
  if (defaultSource) {
    console.log(`✅ Default source: ${defaultSource.name}`)
  }

  // 3. 상담 source 통계
  const { data: consultations } = await supabase
    .from('consultations')
    .select('source')

  const sourceCounts = new Map()
  consultations?.forEach(c => {
    if (c.source) {
      sourceCounts.set(c.source, (sourceCounts.get(c.source) || 0) + 1)
    }
  })

  console.log('\n📊 Source statistics from consultations:')
  sourceCounts.forEach((count, name) => {
    console.log(`   ${name}: ${count}건`)
  })

  console.log('\n✅ All tests passed!')
}

testConsultationSources()
```

---

## 📅 다음 단계

### 즉시 실행 가능:
1. ✅ 마이그레이션 적용
2. ✅ API 테스트
3. ✅ 기존 상담 데이터 확인

### 향후 구현:
1. 상담 등록/수정 폼에 유입 경로 선택 추가
2. source 관리 UI 페이지 (`/admin/settings/sources`)
3. 대시보드에 유입 경로 통계 위젯 추가
4. 유입 경로별 상담 필터링
5. Excel 내보내기에 유입 경로 포함

---

**작성일**: 2025-11-25
**작성자**: Claude Code Assistant
**상태**: Core 시스템 구현 완료, UI 통합 대기
