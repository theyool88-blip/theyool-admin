/**
 * 기일 동기화 디버그 스크립트
 */
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: "/Users/hskim/luseed/.env.local" });

import {
  parseHearingDateTime,
  mapScourtHearingType,
  mapScourtResult,
  generateHearingHash,
} from "../lib/scourt/hearing-sync";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  console.log("=== 기일 동기화 디버그 ===\n");

  // 테스트 기일 데이터 (SCOURT API 형식)
  const testHearings = [
    { date: "20260126", time: "1100", type: "조정기일", location: "", result: "" },
    { date: "20251112", time: "1100", type: "변론기일", location: "", result: "속행" },
    { date: "20250910", time: "1100", type: "변론기일", location: "", result: "속행" },
    { date: "20250723", time: "1100", type: "변론기일", location: "", result: "속행" },
  ];

  console.log("1. 날짜/시간 파싱 테스트:");
  for (const h of testHearings) {
    try {
      const parsed = parseHearingDateTime(h.date, h.time);
      console.log(`  ✅ ${h.date} ${h.time} → ${parsed}`);
    } catch (err) {
      console.log(`  ❌ ${h.date} ${h.time} → Error: ${err}`);
    }
  }

  console.log("\n2. 기일 유형 매핑 테스트:");
  for (const h of testHearings) {
    const mapped = mapScourtHearingType(h.type);
    console.log(`  ${h.type} → ${mapped}`);
  }

  console.log("\n3. 기일 결과 매핑 테스트:");
  for (const h of testHearings) {
    const mapped = mapScourtResult(h.result);
    console.log(`  "${h.result}" → ${mapped}`);
  }

  console.log("\n4. 해시 생성 테스트:");
  for (const h of testHearings) {
    const hash = generateHearingHash(h);
    console.log(`  ${h.date}|${h.type} → ${hash.substring(0, 16)}...`);
  }

  // 5. 직접 INSERT 테스트
  console.log("\n5. DB INSERT 테스트:");

  // 테스트용 사건 ID 조회
  const { data: testCase } = await supabase
    .from("legal_cases")
    .select("id, court_case_number")
    .not("enc_cs_no", "is", null)
    .limit(1)
    .single();

  if (!testCase) {
    console.log("  테스트 사건 없음");
    return;
  }

  console.log(`  테스트 사건: ${testCase.court_case_number}`);

  const h = testHearings[0];
  const insertData = {
    case_id: testCase.id,
    case_number: testCase.court_case_number,
    hearing_type: mapScourtHearingType(h.type),
    hearing_date: parseHearingDateTime(h.date, h.time),
    location: h.location || null,
    result: mapScourtResult(h.result),
    status: "SCHEDULED",
    source: "scourt",
    scourt_hearing_hash: generateHearingHash(h),
    notes: `SCOURT 동기화: ${h.type}`,
  };

  console.log("  Insert 데이터:", JSON.stringify(insertData, null, 2));

  const { error: insertError } = await supabase
    .from("court_hearings")
    .insert(insertData);

  if (insertError) {
    console.log(`  ❌ INSERT 실패: ${JSON.stringify(insertError, null, 2)}`);
  } else {
    console.log("  ✅ INSERT 성공");
  }

  // 결과 확인
  const { data: inserted, count } = await supabase
    .from("court_hearings")
    .select("*", { count: "exact" })
    .eq("case_id", testCase.id);

  console.log(`\n  최종 court_hearings 수: ${count}건`);
  if (inserted && inserted.length > 0) {
    inserted.forEach((r, i) => {
      console.log(`    ${i + 1}. ${r.hearing_type} - ${r.hearing_date}`);
    });
  }
}

run().catch((err) => {
  console.error("에러:", err);
});
