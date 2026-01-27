import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: "/Users/hskim/luseed/.env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  console.log("=== court_hearings 테이블 확인 ===\n");

  // 1. court_hearings 데이터 확인
  const { data: hearings, error: hearingError } = await supabase
    .from('court_hearings')
    .select('*')
    .limit(5);

  if (hearingError) {
    console.error("court_hearings 조회 에러:", hearingError.message);
  } else {
    console.log("court_hearings 레코드 수:", hearings?.length || 0);
    if (hearings && hearings.length > 0) {
      console.log("\n컬럼 목록:", Object.keys(hearings[0]).join(', '));
      console.log("\n샘플 데이터:");
      hearings.forEach((h: any, i: number) => {
        const caseIdShort = h.case_id ? h.case_id.slice(0, 8) : 'N/A';
        console.log(`[${i+1}] case_id: ${caseIdShort}... | type: ${h.hearing_type} | date: ${h.hearing_date}`);
      });
    }
  }

  // 2. attending_lawyer_id 컬럼 존재 확인
  const { data: testData, error: testError } = await supabase
    .from('court_hearings')
    .select('attending_lawyer_id')
    .limit(1);

  if (testError && testError.message.includes('attending_lawyer_id')) {
    console.log("\n⚠️  attending_lawyer_id 컬럼이 없습니다.");
    console.log("Supabase SQL Editor에서 마이그레이션을 실행해주세요.");
  } else if (testError) {
    console.log("\n다른 에러:", testError.message);
  } else {
    console.log("\n✅ attending_lawyer_id 컬럼이 존재합니다.");
  }

  // 3. 전체 레코드 수 확인
  const { count } = await supabase
    .from('court_hearings')
    .select('*', { count: 'exact', head: true });

  console.log("\n전체 court_hearings 레코드 수:", count);
}

run().catch(console.error);
