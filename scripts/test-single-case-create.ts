/**
 * 단일 사건 생성 테스트
 * 에러 원인 파악용
 */

import { config } from 'dotenv';
import * as XLSX from 'xlsx';
import * as path from 'path';

config({ path: '.env.local' });

const API_URL = 'http://localhost:3000/api/admin/onboarding/batch-create-stream';

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('       단일 사건 생성 API 테스트');
  console.log('═══════════════════════════════════════════════════════\n');

  // Excel에서 첫 번째 행만 읽기
  const filePath = path.join(process.cwd(), '테스트_배치_281건_담당변호사.xlsx');
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet) as Record<string, unknown>[];

  // 첫 3건만 테스트
  const testData = data.slice(0, 3);
  console.log(`📄 테스트 데이터: ${testData.length}건\n`);

  // 컬럼 매핑 (한글 -> 영문)
  const columnMapping: Record<string, string> = {
    '계약일': 'contract_date',
    '담당변호사': 'assigned_lawyer',
    '담당직원': 'assigned_staff',
    '법원명': 'court_name',
    '사건번호': 'court_case_number',
    '사건명': 'case_name',
    '의뢰인명': 'client_name',
    '상대방명': 'opponent_name',
    '착수금': 'retainer_fee',
    '성공보수약정': 'success_fee_agreement',
    '발생성공보수': 'earned_success_fee',
    '의뢰인연락처': 'client_phone',
    '계좌번호': 'bank_account',
    '의뢰인이메일': 'client_email',
    '생년월일': 'birth_date',
    '주소': 'address',
    '메모': 'notes',
  };

  // 데이터 변환
  const mappedData = testData.map(row => {
    const mapped: Record<string, unknown> = {};
    for (const [korKey, value] of Object.entries(row)) {
      const engKey = columnMapping[korKey] || korKey;
      mapped[engKey] = value;
    }
    return mapped;
  });

  console.log('📝 변환된 첫 번째 행:');
  console.log(JSON.stringify(mappedData[0], null, 2));

  // API 호출
  console.log('\n🚀 API 호출 중...\n');

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': 'sb-feqxrodutqwliucfllgr-auth-token=base64-eyJhY2Nlc3NfdG9rZW4iOiJleUpoYkdjaU9pSklVekkxTmlJc0ltdHBaQ0k2SW5sTWRqbFVjV2t5VGxwNmJVMGlMQ0owZVhBaU9pSktWMVFpZlEuZXlKaGRXUWlPaUpoZFhSb1pXNTBhV05oZEdWa0lpd2laWGh3SWpveE56WTVNRFF5T1RrMUxDSnBZWFFpT2pFM05qa3dNemt5T1RVc0ltbHpjeUk2SW1oMGRIQnpPaTh2Wm1WeGVISnZaSFYwY1hkc2FYVmpiR3huY2k1emRYQmhZbUZ6WlM1amJ5OWhkWFJvTDNZeElpd2ljM1ZpSWpvaVlXSTFOelZpT0RZdFl6RmpOaTAwWXpjMUxUbGtOREl0WldabFkySmxOMlF3WXpNeElpd2laVzFoYVd3aU9pSnNZWGQ1WlhKQWRHaGxlVzl2YkM1cmNpSXNJbkJvYjI1bElqb2lJaXdpWVhCd1gyMWxkR0ZrWVhSaElqcDdJbkJ5YjNacFpHVnlJam9pWlcxaGFXd2lMQ0p3Y205MmFXUmxjbk1pT2xzaVpXMWhhV3dpWFgwc0luVnpaWEpmYldWMFlXUmhkR0VpT25zaWJtRnRaU0k2SWx4MVFqUTNNbHgxUWpRMk5DQmNkVUl6TWpGY2RVTkdPVEVpTENKeWIyeGxJam9pYkdGM2VXVnlJbjBzSW5KdmJHVWlPaUpoZFhSb1pXNTBhV05oZEdWa0lpd2lZV0ZzSWpvaVlXRnNNU0lzSW1GdGNpSTZXM3NpYldWMGFHOWtJam9pY0dGemMzZHZjbVFpTENKMGFXMWxjM1JoYlhBaU9qRTNOamt3TXpreU9UVjlYU3dpYzJWemMybHZibDlwWkNJNkltSTRNV1F4T1dZMkxXVmtNVEV0TkRRMk9DMWhNbVkxTFRVME9HVmlNRFE0TmpSbE5pSXNJbWx6WDJGdWIyNTViVzkxY3lJNlptRnNjMlY5LnNYYllrWHk1Rk1aUkpmZkViaXFZZjlXVjNYalZrTEU1LTRyMmpZSk1VbmciLCJ0b2tlbl90eXBlIjoiYmVhcmVyIiwiZXhwaXJlc19pbiI6MzYwMCwiZXhwaXJlc19hdCI6MTc2OTA0Mjk5NSwicmVmcmVzaF90b2tlbiI6IlpUWTRCdklGTlNpYk55NFZ4TGpCOGciLCJ1c2VyIjp7ImlkIjoiYWI1NzViODYtYzFjNi00Yzc1LTlkNDItZWZlY2JlN2QwYzMxIiwiYXVkIjoiYXV0aGVudGljYXRlZCIsInJvbGUiOiJhdXRoZW50aWNhdGVkIiwiZW1haWwiOiJsYXd5ZXJAdGhleW9vbC5rciIsImVtYWlsX2NvbmZpcm1lZF9hdCI6IjIwMjUtMDQtMDhUMDk6MzI6NDUuMTQwMjQ5WiIsInBob25lIjoiIiwiY29uZmlybWVkX2F0IjoiMjAyNS0wNC0wOFQwOTozMjo0NS4xNDAyNDlaIiwibGFzdF9zaWduX2luX2F0IjoiMjAyNi0wMS0yMlQwMjozNDo1NS42NjI5OTRaIiwiYXBwX21ldGFkYXRhIjp7InByb3ZpZGVyIjoiZW1haWwiLCJwcm92aWRlcnMiOlsiZW1haWwiXX0sInVzZXJfbWV0YWRhdGEiOnsibmFtZSI6Iu2YkeusuOuyleumrCDrjZTsnKgiLCJyb2xlIjoibGF3eWVyIn0sImlkZW50aXRpZXMiOlt7ImlkZW50aXR5X2lkIjoiZDVhNGZiNmItZjRhNC00Nzk0LWIxNDctYjgyNWI0ODQzMGRlIiwiaWQiOiJhYjU3NWI4Ni1jMWM2LTRjNzUtOWQ0Mi1lZmVjYmU3ZDBjMzEiLCJ1c2VyX2lkIjoiYWI1NzViODYtYzFjNi00Yzc1LTlkNDItZWZlY2JlN2QwYzMxIiwiaWRlbnRpdHlfZGF0YSI6eyJlbWFpbCI6Imxhd3llckB0aGV5b29sLmtyIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsInBob25lX3ZlcmlmaWVkIjpmYWxzZSwic3ViIjoiYWI1NzViODYtYzFjNi00Yzc1LTlkNDItZWZlY2JlN2QwYzMxIn0sInByb3ZpZGVyIjoiZW1haWwiLCJsYXN0X3NpZ25faW5fYXQiOiIyMDI1LTA0LTA4VDA5OjMyOjQ1LjEzNzE3NloiLCJjcmVhdGVkX2F0IjoiMjAyNS0wNC0wOFQwOTozMjo0NS4xMzcyMjRaIiwidXBkYXRlZF9hdCI6IjIwMjUtMDQtMDhUMDk6MzI6NDUuMTM3MjI0WiJ9XSwiY3JlYXRlZF9hdCI6IjIwMjUtMDQtMDhUMDk6MzI6NDUuMTM0MTc0WiIsInVwZGF0ZWRfYXQiOiIyMDI2LTAxLTIyVDAyOjM0OjU1LjY2NDkzN1oiLCJpc19hbm9ueW1vdXMiOmZhbHNlfX0='
      },
      body: JSON.stringify({
        rows: mappedData,
        options: {
          createNewClients: true,
          duplicateHandling: 'skip',
          linkScourt: false,
        }
      }),
    });

    console.log(`📡 응답 상태: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`❌ 에러 응답:\n${errorText}`);
      return;
    }

    // 스트림 응답 읽기
    const reader = response.body?.getReader();
    if (!reader) {
      console.log('❌ 스트림 리더 없음');
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // 줄바꿈으로 분리
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim()) {
          try {
            const event = JSON.parse(line);
            if (event.type === 'result') {
              const status = event.data.status;
              const rowIndex = event.data.rowIndex;
              if (status === 'failed') {
                console.log(`\n❌ 행 ${rowIndex} 실패:`);
                console.log(`   에러: ${JSON.stringify(event.data.errors, null, 2)}`);
              } else {
                console.log(`✅ 행 ${rowIndex}: ${status}`);
              }
            } else if (event.type === 'error') {
              console.log(`\n❌ 전역 에러: ${event.data.message}`);
            }
          } catch (e) {
            // JSON 파싱 실패는 무시
          }
        }
      }
    }

    console.log('\n완료!');

  } catch (error) {
    console.log(`\n❌ 요청 실패: ${error}`);
  }
}

main().catch(console.error);
