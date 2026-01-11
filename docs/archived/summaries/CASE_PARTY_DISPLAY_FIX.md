# 사건 상세 당사자 표시/수정 로직 정리

**Last Updated**: 2026-01-11

## 목표
- 사건 상세의 히어로/일반 탭 당사자 표시를 `case_parties` 기준으로 일관화
- 마스킹/다수당사자 케이스에서 1명만 정확히 수정되도록 처리
- 상대방 미지정 알림에서 입력된 상대방 이름을 즉시 반영

## 핵심 변경 사항
- 일반 탭 당사자 수정 모달 저장 시 즉시 PATCH로 반영되도록 변경
- `is_primary`(대표 당사자) 변경 시 같은 측 대표가 중복되지 않도록 임시 표시에서도 통일
- 히어로 표시에서 의뢰인 측은 라벨만 표시하고 이름/전화번호는 기존 규칙 유지
- 상대방 이름 미지정 알림 처리 시 `case_parties`의 상대방 1명만 업데이트
- 당사자 표에서 수정 버튼 노출 조건을 마스킹 여부가 아닌 “매칭 성공 여부”로 변경

## 로직 요약
1. 당사자 표시 데이터는 `case_parties` + pending edits를 합친 상태를 기준으로 사용
2. 대표 당사자(`is_primary`)가 지정되면 해당 측은 대표 1명만 우선 표시
3. 마스킹 이름은 `preservePrefix`로 번호/외N 접두사를 유지하며 1명만 치환
4. 상대방 미지정 알림 입력값은 `case_parties`에 즉시 저장 후 역할 확정 진행

## 수정된 파일
- `components/CaseDetail.tsx`
- `components/scourt/ScourtGeneralInfoXml.tsx`

## 관련 마이그레이션
- `supabase/migrations/20260214_case_parties_scourt_schema.sql`

## 테스트
- 로컬 테스트 미실행
