# Party Data Flow Documentation

**Created**: 2026-01-28
**Purpose**: 당사자(party) 데이터의 입력/조회 흐름 문서화

---

## 1. Data Schema Structure

```
legal_cases (cache: primary_client_id, primary_client_name)
    ↓
case_clients (linkage: client_id, linked_party_id, is_primary_client)
    ↓
case_parties (data: party_name, party_type, representatives JSONB)
    ↓
representatives[] (JSONB: name, type_label, law_firm, is_our_firm)
```

---

## 2. Entry Points (Data Creation)

| # | File | Function | Data Transform | DB Table |
|---|------|----------|----------------|----------|
| 1 | `lib/scourt/party-sync.ts:242` | `syncPartiesFromScourtServer()` | SCOURT API → party records | `case_parties` (upsert by scourt_party_index) |
| 2 | `app/api/admin/cases/route.ts:479` | POST handler | Client name → party seeds | `case_parties` + `case_clients` |
| 3 | `app/api/admin/cases/[id]/parties/route.ts:136` | POST handler | Manual party input | `case_parties` |
| 4 | `app/api/admin/cases/[id]/clients/route.ts:204` | POST handler | Client-party linkage | `case_clients` |

---

## 3. Query Points (Data Retrieval)

| # | File | Function | Data Format | Source |
|---|------|----------|-------------|--------|
| 1 | `components/CaseDetail.tsx:538` | `fetchCaseParties()` | Array of CaseParty with linked client | GET `/api/admin/cases/${id}/parties` |
| 2 | `components/CasePartiesSection.tsx:95` | `fetchParties()` | `{parties: [], caseClients: []}` | Same API endpoint |
| 3 | `app/api/admin/cases/route.ts:31` | GET handler | Cache fields for list view | `legal_cases.primary_client_*` |

---

## 4. Legacy Field Status

### is_our_client (REMOVED from case_parties)
- **Status**: Deprecated, replaced by `case_clients` table
- **Replacement**: `case_clients.is_primary_client` + `linked_party_id` linkage

### client_role, opponent_name (legacy in legal_cases)
- **Status**: Deprecated, @deprecated annotations added
- **Replacement**: Use `case_parties` + `case_clients` tables

---

## 5. case_clients Table Usage

| Operation | File | Line | Description |
|-----------|------|------|-------------|
| GET | `app/api/admin/cases/[id]/clients/route.ts` | 52 | Retrieve all clients for a case |
| POST | `app/api/admin/cases/[id]/clients/route.ts` | 204 | Add client-party linkage |
| PATCH | `app/api/admin/cases/[id]/clients/route.ts` | 349 | Update linkage/fees |
| DELETE | `app/api/admin/cases/[id]/clients/route.ts` | 454 | Remove linkage |

---

## 6. Key Relationships

- **case_parties** ↔ **case_clients**: via `linked_party_id` foreign key
- **case_clients** ↔ **clients**: via `client_id` foreign key
- **Representatives**: Stored as JSONB array in `case_parties.representatives`
- **Cache Sync**: `primary_client_id/name` in legal_cases updated by triggers
