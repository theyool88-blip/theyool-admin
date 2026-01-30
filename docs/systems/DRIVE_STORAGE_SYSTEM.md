# Drive Storage System

**Last Updated**: 2026-01-30

Luseed Drive는 법률 문서 관리를 위한 파일 스토리지 시스템입니다. Cloudflare R2를 백엔드로 사용하며, 테넌트별 용량 관리를 제공합니다.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  FileExplorer.tsx                                           ││
│  │  - useDriveFolder() hook for folders/files                  ││
│  │  - useStorageUsage() hook for quota info                    ││
│  │  - FileUploader component for uploads                       ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        API Layer                                 │
│  ┌───────────────┐ ┌───────────────┐ ┌───────────────────────┐  │
│  │ /api/drive/   │ │ /api/drive/   │ │ /api/drive/files/[id] │  │
│  │   folders     │ │   storage     │ │   (CRUD)              │  │
│  └───────────────┘ └───────────────┘ └───────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Service Layer                                │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  StorageService (lib/r2/storage-service.ts)                 ││
│  │  - updateUsage() → atomic RPC                               ││
│  │  - moveFolder() → recursive path update                     ││
│  │  - renameFolder() → recursive path update                   ││
│  └─────────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  QuotaAlerts (lib/storage/quota-alerts.ts)                  ││
│  │  - checkAndCreateQuotaAlert() at 80%, 90%, 100%             ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Database Layer                               │
│  ┌───────────────────┐  ┌───────────────────────────────────┐   │
│  │  tenant_storage   │  │  r2_files / r2_folders            │   │
│  │  - quota_bytes    │  │  - path (folder hierarchy)        │   │
│  │  - used_bytes     │  │  - tenant_id (RLS)                │   │
│  │  - file_count     │  │                                   │   │
│  └───────────────────┘  └───────────────────────────────────┘   │
│  ┌───────────────────┐  ┌───────────────────────────────────┐   │
│  │  storage_alerts   │  │  RPC Functions                    │   │
│  │  - threshold      │  │  - update_tenant_storage_atomic   │   │
│  │  - is_read        │  │  - update_folder_paths_recursive  │   │
│  └───────────────────┘  └───────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Storage Backend                              │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Cloudflare R2 (S3-compatible)                              ││
│  │  - Presigned URLs for upload/download                       ││
│  │  - Object storage with key-based access                     ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

---

## Core Features

### 1. Atomic Storage Updates

**Problem**: 동시 업로드/삭제 시 race condition으로 인한 용량 계산 오류

**Solution**: PostgreSQL RPC 함수를 통한 atomic increment/decrement

```sql
-- update_tenant_storage_atomic RPC
INSERT INTO tenant_storage (tenant_id, used_bytes, file_count, ...)
VALUES (p_tenant_id, GREATEST(0, p_delta_bytes), ...)
ON CONFLICT (tenant_id) DO UPDATE SET
  used_bytes = GREATEST(0, tenant_storage.used_bytes + p_delta_bytes),
  file_count = GREATEST(0, tenant_storage.file_count + p_delta_files);
```

**Usage**:
```typescript
// lib/r2/storage-service.ts
await supabase.rpc('update_tenant_storage_atomic', {
  p_tenant_id: tenantId,
  p_delta_bytes: fileSize,    // positive for upload
  p_delta_files: 1,           // positive for upload
})

// For delete, use negative values:
await supabase.rpc('update_tenant_storage_atomic', {
  p_tenant_id: tenantId,
  p_delta_bytes: -fileSize,   // negative for delete
  p_delta_files: -1,          // negative for delete
})
```

### 2. Recursive Folder Path Updates

**Problem**: 폴더 이동/이름 변경 시 하위 폴더 경로가 갱신되지 않음

**Solution**: Recursive CTE로 모든 하위 폴더 경로 일괄 업데이트

```sql
-- update_folder_paths_recursive RPC
UPDATE r2_folders SET
  path = p_new_path || SUBSTRING(path FROM LENGTH(p_old_path) + 1)
WHERE path LIKE p_old_path || '/%';
```

**Usage**:
```typescript
// lib/r2/storage-service.ts - moveFolder(), renameFolder()
await supabase.rpc('update_folder_paths_recursive', {
  p_tenant_id: tenantId,
  p_old_path: '/old/path',
  p_new_path: '/new/path',
})
```

### 3. Permanent Delete

**Flow**:
1. 파일/폴더 삭제 요청
2. R2 스토리지에서 즉시 삭제
3. 데이터베이스 레코드 삭제
4. 용량 카운터 차감

**API Endpoints**:
- `DELETE /api/drive/files/[id]` - Permanently delete file

### 4. Quota Alerts

**Thresholds**: 80%, 90%, 100%

**Implementation**:
```typescript
// lib/storage/quota-alerts.ts
export async function checkAndCreateQuotaAlert(
  tenantId: string,
  usedBytes: number,
  quotaBytes: number
) {
  const usagePercent = (usedBytes / quotaBytes) * 100

  // Determine threshold (highest applicable)
  let threshold: number | null = null
  if (usagePercent >= 100) threshold = 100
  else if (usagePercent >= 90) threshold = 90
  else if (usagePercent >= 80) threshold = 80

  if (!threshold) return

  // Check for existing daily alert
  const existingAlert = await checkExistingAlert(tenantId, threshold)
  if (existingAlert) return

  // Create new alert
  await createAlert(tenantId, threshold, usedBytes, quotaBytes)
}
```

### 5. Auto Storage Initialization

**Trigger**: 테넌트 생성 시 자동으로 `tenant_storage` 레코드 생성

```sql
CREATE OR REPLACE FUNCTION init_tenant_storage()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO tenant_storage (tenant_id, quota_bytes, used_bytes, file_count)
  VALUES (NEW.id, 53687091200, 0, 0)  -- 50GB default
  ON CONFLICT (tenant_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_tenant_created
  AFTER INSERT ON tenants
  FOR EACH ROW EXECUTE FUNCTION init_tenant_storage();
```

---

## Data Flow

### File Upload
```
1. Client → POST /api/drive/files (presigned URL request)
2. Client → PUT to R2 presigned URL (direct upload)
3. Client → POST /api/drive/files/confirm
4. Server → INSERT r2_files
5. Server → RPC update_tenant_storage_atomic (+bytes, +1 file)
6. Server → checkAndCreateQuotaAlert()
```

### File Delete
```
1. Client → DELETE /api/drive/files/[id]
2. Server → DELETE from R2 storage
3. Server → DELETE FROM r2_files
4. Server → RPC update_tenant_storage_atomic (-bytes, -1 file)
```

---

## SWR Hooks

### useDriveFolder
```typescript
// hooks/useDrive.ts
export function useDriveFolder(tenantId: string, parentId?: string | null, caseId?: string) {
  const { data, error, isLoading, mutate } = useSWR<DriveFolderData>(
    `/api/drive/folders?tenantId=${tenantId}&parentId=${parentId}`,
    fetcher,
    { revalidateOnFocus: false }
  )

  return {
    folders: data?.folders || [],
    files: data?.files || [],
    currentFolder: data?.currentFolder || null,
    breadcrumbs: data?.breadcrumbs || [],
    isLoading,
    mutate,
  }
}
```

### useStorageUsage
```typescript
export function useStorageUsage() {
  const { data, error, isLoading, mutate } = useSWR<StorageData>(
    '/api/drive/storage',
    fetcher,
    { refreshInterval: 30000 }  // 30-second auto-refresh
  )

  return {
    storage: data?.storage || null,
    isLoading,
    mutate,
  }
}
```

### Cache Invalidation
```typescript
// After upload/delete:
invalidateDriveCache(tenantId, parentId, caseId)
invalidateStorageCache()
```

---

## Database Tables

### tenant_storage
| Column | Type | Description |
|--------|------|-------------|
| tenant_id | UUID | FK to tenants (PK) |
| quota_bytes | BIGINT | Base quota (default 50GB) |
| extra_quota_bytes | BIGINT | Purchased extra quota |
| used_bytes | BIGINT | Current usage |
| file_count | INT | Total file count |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### storage_alerts
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | PK |
| tenant_id | UUID | FK to tenants |
| threshold | INT | 80, 90, or 100 |
| used_bytes | BIGINT | Usage at alert time |
| quota_bytes | BIGINT | Quota at alert time |
| is_read | BOOLEAN | Dismissed by user |
| created_at | TIMESTAMPTZ | |

### r2_files
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | PK |
| tenant_id | UUID | FK to tenants |
| r2_key | TEXT | R2 object key |
| original_name | TEXT | Original filename |
| display_name | TEXT | Display name |
| mime_type | TEXT | File MIME type |
| file_size | BIGINT | File size in bytes |
| folder_id | UUID | FK to r2_folders |
| case_id | UUID | FK to cases (optional) |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### r2_folders
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | PK |
| tenant_id | UUID | FK to tenants |
| name | TEXT | Folder name |
| path | TEXT | Full path |
| parent_id | UUID | FK to self |
| case_id | UUID | FK to cases (optional) |
| depth | INT | Folder depth |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

---

## Migration Files

| File | Description |
|------|-------------|
| `20260128800000_r2_storage_schema.sql` | Core schema for R2 storage |
| `20260130_atomic_storage_usage.sql` | Atomic storage RPC function |
| `20260130_update_folder_paths.sql` | Recursive path update RPC |
| `20260130_storage_alerts.sql` | Storage alerts table |
| `20260130_auto_storage_init.sql` | Auto-init trigger |

---

## Configuration

### Default Quota
- Base: 50GB (53687091200 bytes)
- Configurable via `tenant_storage.quota_bytes`
- Extra quota via `extra_quota_bytes`

---

## Security

### RLS Policies
- All tables use `tenant_id` for tenant isolation

### API Authentication
- All endpoints require authenticated session

### File Access
- R2 presigned URLs for secure direct upload/download
- Short expiration times (15 minutes)
