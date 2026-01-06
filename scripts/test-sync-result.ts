import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
  const response = await fetch('http://localhost:3000/api/admin/scourt/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      legalCaseId: '5379a691-5755-4fd5-9b09-2044a18f97a6',
      caseNumber: '2025가소73623',
      courtName: '수원지방법원 평택지원',
      partyName: '조',
      forceRefresh: true,
    }),
  });

  const result = await response.json();
  console.log('=== 동기화 결과 ===');
  console.log(JSON.stringify(result, null, 2));
}

main().catch(console.error);
