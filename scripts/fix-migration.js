const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const csv = require('csv-parser');

const supabase = createClient(
  'https://kqqyipnlkmmprfgygauk.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtxcXlpcG5sa21tcHJmZ3lnYXVrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjMyNDQyOSwiZXhwIjoyMDc3OTAwNDI5fQ.nmE-asCNpDnxix4ZxyNlEyocJdG8kPEunx9MHOTnXS0'
);

const parseAmount = (str) => {
  if (!str) return null;
  const cleaned = str.replace(/[,\s원]/g, '');
  const num = parseInt(cleaned);
  return isNaN(num) ? null : num;
};

const parseDate = (str) => {
  if (!str) return null;
  const match = str.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  if (match) {
    const [, year, month, day] = match;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return null;
};

const extractName = (str) => {
  if (!str) return null;
  // "이름 (URL)" 형식에서 이름만 추출
  const match = str.match(/^([^(]+)/);
  return match ? match[1].trim() : str.trim();
};

const extractPhone = (str) => {
  if (!str) return null;
  // 여러 번호 중 첫 번째만 추출
  const phones = str.split(',').map(p => p.trim());
  return phones[0] || null;
};

const normalizeOffice = (office) => {
  if (!office) return null;
  if (office === '평택') return '평택';
  if (office === '천안') return '천안';
  if (office === '소송구조') return '소송구조';
  return null;
};

async function main() {
  console.log('기존 데이터 삭제 중...');

  // 기존 데이터 삭제
  await supabase.from('legal_cases').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('clients').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  console.log('CSV 파일 읽기 중...');

  const rows = [];

  fs.createReadStream('/Users/hskim/Desktop/Private & Shared 2/송무_사건목록_DB 60f2df1f3d9a4833b71f4a336511a1d4_all.csv')
    .pipe(csv())
    .on('data', (row) => rows.push(row))
    .on('end', async () => {
      console.log(`총 ${rows.length}개 행 읽음`);

      const clientsMap = new Map();
      const cases = [];

      for (const row of rows) {
        const caseName = row['﻿사건'] || row['사건'];
        if (!caseName || caseName.trim() === '') {
          continue;
        }

        // 의뢰인 정보 추출
        const clientName = extractName(row['의뢰인']);
        const phone = extractPhone(row['전화번호']);

        let clientId = null;

        if (clientName) {
          if (!clientsMap.has(clientName)) {
            // 새 의뢰인 생성
            const { data: newClient, error } = await supabase
              .from('clients')
              .insert({
                name: clientName,
                phone: phone
              })
              .select()
              .single();

            if (newClient) {
              clientsMap.set(clientName, newClient.id);
              clientId = newClient.id;
            }
          } else {
            clientId = clientsMap.get(clientName);
          }
        }

        // 사건 정보
        const contractNumber = row['계약서번호'] || null;
        const office = normalizeOffice(row['수임사무실']);
        const contractDate = parseDate(row['수임일']);
        const retainerFee = parseAmount(row['착수금']);
        const totalReceived = parseAmount(row['입금액']);
        const outstandingBalance = parseAmount(row['미수금']);
        const courtCaseNumber = row['사건번호'] || null;
        const courtName = row['관할법원'] || null;
        const caseType = row['사건종류'] || null;
        const status = row['진행'] === '종결' ? '종결' : '진행중';

        cases.push({
          case_name: caseName,
          client_id: clientId,
          contract_number: contractNumber,
          office: office,
          contract_date: contractDate,
          retainer_fee: retainerFee,
          total_received: totalReceived,
          outstanding_balance: outstandingBalance,
          court_case_number: courtCaseNumber,
          court_name: courtName,
          case_type: caseType,
          status: status
        });
      }

      console.log(`${clientsMap.size}명의 의뢰인 생성 완료`);
      console.log(`${cases.length}개 사건 삽입 중...`);

      // 사건 삽입 (배치로)
      const batchSize = 50;
      for (let i = 0; i < cases.length; i += batchSize) {
        const batch = cases.slice(i, i + batchSize);
        const { error } = await supabase.from('legal_cases').insert(batch);
        if (error) {
          console.error(`배치 ${i / batchSize + 1} 오류:`, error);
        } else {
          console.log(`${i + batch.length}/${cases.length} 완료`);
        }
      }

      console.log('마이그레이션 완료!');

      // 확인
      const { count: clientCount } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true });

      const { count: caseCount } = await supabase
        .from('legal_cases')
        .select('*', { count: 'exact', head: true });

      console.log(`최종: 의뢰인 ${clientCount}명, 사건 ${caseCount}건`);
    });
}

main().catch(console.error);
