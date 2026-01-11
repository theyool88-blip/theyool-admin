-- 테스트 법무법인 (c7850d6f-387d-40d1-801c-f4096c20007c) 데이터 전체 삭제
-- Supabase SQL Editor에서 실행하세요

-- 1. case_deadlines (case_id 기반)
DELETE FROM case_deadlines WHERE case_id IN (SELECT id FROM legal_cases WHERE tenant_id = 'c7850d6f-387d-40d1-801c-f4096c20007c');

-- 2. case_documents (case_id 기반)
DELETE FROM case_documents WHERE case_id IN (SELECT id FROM legal_cases WHERE tenant_id = 'c7850d6f-387d-40d1-801c-f4096c20007c');

-- 3. case_expenses (case_id 기반)
DELETE FROM case_expenses WHERE case_id IN (SELECT id FROM legal_cases WHERE tenant_id = 'c7850d6f-387d-40d1-801c-f4096c20007c');

-- 4. case_notes (case_id 기반)
DELETE FROM case_notes WHERE case_id IN (SELECT id FROM legal_cases WHERE tenant_id = 'c7850d6f-387d-40d1-801c-f4096c20007c');

-- 5. case_parties (case_id 기반)
DELETE FROM case_parties WHERE case_id IN (SELECT id FROM legal_cases WHERE tenant_id = 'c7850d6f-387d-40d1-801c-f4096c20007c');

-- 6. court_hearings (case_id 기반)
DELETE FROM court_hearings WHERE case_id IN (SELECT id FROM legal_cases WHERE tenant_id = 'c7850d6f-387d-40d1-801c-f4096c20007c');

-- 7. receivables (case_id 기반)
DELETE FROM receivables WHERE case_id IN (SELECT id FROM legal_cases WHERE tenant_id = 'c7850d6f-387d-40d1-801c-f4096c20007c');

-- 8. payments (case_id 기반)
DELETE FROM payments WHERE case_id IN (SELECT id FROM legal_cases WHERE tenant_id = 'c7850d6f-387d-40d1-801c-f4096c20007c');

-- 9. scourt_case_snapshots (case_id 기반)
DELETE FROM scourt_case_snapshots WHERE case_id IN (SELECT id FROM legal_cases WHERE tenant_id = 'c7850d6f-387d-40d1-801c-f4096c20007c');

-- 10. 사건 삭제
DELETE FROM legal_cases WHERE tenant_id = 'c7850d6f-387d-40d1-801c-f4096c20007c';

-- 11. client_memos (client_id 기반)
DELETE FROM client_memos WHERE client_id IN (SELECT id FROM clients WHERE tenant_id = 'c7850d6f-387d-40d1-801c-f4096c20007c');

-- 12. 의뢰인 삭제
DELETE FROM clients WHERE tenant_id = 'c7850d6f-387d-40d1-801c-f4096c20007c';

-- 완료 확인
SELECT
  (SELECT COUNT(*) FROM legal_cases WHERE tenant_id = 'c7850d6f-387d-40d1-801c-f4096c20007c') as remaining_cases,
  (SELECT COUNT(*) FROM clients WHERE tenant_id = 'c7850d6f-387d-40d1-801c-f4096c20007c') as remaining_clients;
