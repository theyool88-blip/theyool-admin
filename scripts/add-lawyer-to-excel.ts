/**
 * Excel 파일에 담당변호사 컬럼 추가 스크립트
 * 3명의 변호사에게 무작위 배정
 */

import * as XLSX from 'xlsx';
import * as path from 'path';

const INPUT_FILE = path.join(process.cwd(), '테스트_배치_281건.xlsx');
const OUTPUT_FILE = path.join(process.cwd(), '테스트_배치_281건_담당변호사.xlsx');

// 담당변호사 목록
const LAWYERS = ['김민수 변호사', '박지영 변호사', '이준호 변호사'];

/**
 * 1~3명의 변호사를 무작위로 선택
 */
function getRandomLawyers(): string {
  // 1~3명 중 무작위로 선택 (가중치: 1명 50%, 2명 35%, 3명 15%)
  const rand = Math.random();
  let count: number;
  if (rand < 0.50) {
    count = 1;
  } else if (rand < 0.85) {
    count = 2;
  } else {
    count = 3;
  }

  // 변호사 셔플 후 count만큼 선택
  const shuffled = [...LAWYERS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).join(', ');
}

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('       Excel 담당변호사 배정 스크립트');
  console.log('═══════════════════════════════════════════════════════');

  // 1. Excel 파일 읽기
  console.log(`\n📄 파일 읽기: ${INPUT_FILE}`);
  const workbook = XLSX.readFile(INPUT_FILE);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  // 2. JSON으로 변환
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as string[][];

  if (data.length < 2) {
    console.error('❌ 데이터가 부족합니다.');
    process.exit(1);
  }

  // 3. 헤더 확인
  const headers = data[0] as string[];
  console.log(`\n📋 컬럼 목록: ${headers.join(', ')}`);
  console.log(`   총 ${data.length - 1}건의 데이터`);

  // 4. 담당변호사 컬럼 추가 (없으면 추가, 있으면 덮어쓰기)
  let lawyerColIndex = headers.findIndex(h =>
    h && (h.includes('담당변호사') || h.includes('담당') || h.includes('assigned'))
  );

  if (lawyerColIndex === -1) {
    // 새 컬럼 추가
    lawyerColIndex = headers.length;
    headers.push('담당변호사');
    console.log(`\n✨ 담당변호사 컬럼 추가 (열 ${lawyerColIndex + 1})`);
  } else {
    console.log(`\n📌 기존 담당변호사 컬럼 사용 (열 ${lawyerColIndex + 1})`);
  }

  // 5. 무작위 변호사 배정 (1~3명)
  const assignmentCount: Record<string, number> = {};
  const multiAssignmentCount: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
  LAWYERS.forEach(l => (assignmentCount[l] = 0));

  for (let i = 1; i < data.length; i++) {
    // 행 배열 길이 보장
    while (data[i].length <= lawyerColIndex) {
      data[i].push('');
    }

    // 무작위 변호사 선택 (1~3명)
    const lawyerStr = getRandomLawyers();
    data[i][lawyerColIndex] = lawyerStr;

    // 통계 업데이트
    const selectedLawyers = lawyerStr.split(', ');
    multiAssignmentCount[selectedLawyers.length]++;
    selectedLawyers.forEach(l => assignmentCount[l]++);
  }

  // 6. 배정 통계 출력
  console.log('\n📊 배정 통계:');
  console.log('   [변호사별 배정 횟수]');
  Object.entries(assignmentCount).forEach(([lawyer, count]) => {
    console.log(`   - ${lawyer}: ${count}건`);
  });
  console.log('\n   [담당자 수별 사건 수]');
  console.log(`   - 1명 배정: ${multiAssignmentCount[1]}건`);
  console.log(`   - 2명 배정: ${multiAssignmentCount[2]}건`);
  console.log(`   - 3명 배정: ${multiAssignmentCount[3]}건`);

  // 7. 새 워크시트 생성
  const newWorksheet = XLSX.utils.aoa_to_sheet(data);
  workbook.Sheets[sheetName] = newWorksheet;

  // 8. 파일 저장
  XLSX.writeFile(workbook, OUTPUT_FILE);
  console.log(`\n✅ 파일 저장 완료: ${OUTPUT_FILE}`);

  // 9. 샘플 데이터 출력
  console.log('\n📝 샘플 데이터 (처음 5건):');
  console.log('┌─────────────────────────────────────────────────────────────────┐');
  for (let i = 1; i <= Math.min(5, data.length - 1); i++) {
    const row = data[i];
    console.log(`│ ${i}. ${row[0]} - ${row[lawyerColIndex]}`);
  }
  console.log('└─────────────────────────────────────────────────────────────────┘');
}

main().catch(console.error);
