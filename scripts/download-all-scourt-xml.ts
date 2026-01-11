/**
 * 대법원 나의사건검색 XML 전체 다운로드 스크립트
 *
 * 가능한 모든 XML 파일을 다운로드하여 public/scourt-xml에 저장
 */

import * as fs from "fs";
import * as path from "path";

const SCOURT_XML_BASE_URL = "https://ssgo.scourt.go.kr/ssgo/ui";
const OUTPUT_DIR = path.join(process.cwd(), "public/scourt-xml");

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// 다운로드할 XML 경로 목록 생성
function generateXmlPaths(): string[] {
  const paths: string[] = [];

  // 1. 기본정보 XML (사건유형별)
  const basicInfoTypes = [
    "ssgo101", // 민사
    "ssgo102", // 가사
    "ssgo103", // ?
    "ssgo104", // ?
    "ssgo105", // 신청/보전
    "ssgo106", // 기타
    "ssgo107", // 회생/파산
    "ssgo108", // 항고/재항고
    "ssgo109", // ?
    "ssgo10a", // 집행/경매
    "ssgo10b", // ?
    "ssgo10c", // 전자독촉
    "ssgo10d", // ?
    "ssgo10e", // ?
    "ssgo10f", // ?
    "ssgo10g", // 형사
    "ssgo10h", // ?
    "ssgo10i", // 보호
    "ssgo10j", // ?
    "ssgo10k", // ?
  ];

  for (const type of basicInfoTypes) {
    const suffix = type.slice(-1).toUpperCase(); // 101 -> 1, 10a -> A
    // F01: 기본정보, F02: 진행내용 등 가능
    for (let i = 1; i <= 5; i++) {
      const num = i.toString().padStart(2, "0");
      paths.push(`${type}/SSGO${type.slice(4).toUpperCase()}F${num}.xml`);
    }
  }

  // 2. 공통 XML (ssgo003) - 가능한 모든 번호 시도
  const ssgo003Suffixes = [
    // 10번대: 심급
    "10", "11", "12", "13", "14", "15",
    // 20번대: 심리진행
    "20", "21", "22", "23", "24", "25",
    // 30번대: 기일
    "30", "31", "32", "33", "34", "35",
    // 40번대: 서류
    "40", "41", "42", "43", "44", "45",
    // 50번대: 관련사건
    "50", "51", "52", "53", "54", "55",
    // 60번대: 당사자 (60-6F)
    "60", "61", "62", "63", "64", "65", "66", "67", "68", "69",
    "6A", "6B", "6C", "6D", "6E", "6F",
    // 70번대: 대리인/변호인
    "70", "71", "72", "73", "74", "75",
    // 80번대: 관계인
    "80", "81", "82", "83", "84", "85",
    // 90번대: 후견인
    "90", "91", "92", "93", "94", "95",
    // A0번대: 담보
    "A0", "A1", "A2", "A3", "A4", "A5",
    // B0번대: 정정명령
    "B0", "B1", "B2", "B3", "B4", "B5",
    // C0번대: ?
    "C0", "C1", "C2", "C3", "C4", "C5",
    // D0번대: ?
    "D0", "D1", "D2", "D3", "D4", "D5",
    // E0번대: 병합
    "E0", "E1", "E2", "E3", "E4", "E5",
    // F0번대: 사건명
    "F0", "F1", "F2", "F3", "F4", "F5",
    // G0번대: 보호처분
    "G0", "G1", "G2", "G3", "G4", "G5",
    // H0번대: 임시조치
    "H0", "H1", "H2", "H3", "H4", "H5",
    // I0-Z0 번대도 시도
    "I0", "J0", "K0", "L0", "M0", "N0", "O0", "P0", "Q0", "R0", "S0", "T0", "U0", "V0", "W0", "X0", "Y0", "Z0",
  ];

  for (const suffix of ssgo003Suffixes) {
    paths.push(`ssgo003/SSGO003F${suffix}.xml`);
  }

  return paths;
}

async function downloadXml(xmlPath: string): Promise<string | null> {
  const url = `${SCOURT_XML_BASE_URL}/${xmlPath}`;

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/xml, text/xml, */*",
      },
    });

    if (!response.ok) {
      return null;
    }

    const content = await response.text();

    // HTML 응답 차단 (에러 페이지)
    if (content.includes("<!DOCTYPE html") || content.includes("<html")) {
      return null;
    }

    // WebSquare XML 확인
    if (!content.includes("<?xml") && !content.includes("<w2:") && !content.includes("<xf:")) {
      return null;
    }

    return content;
  } catch {
    return null;
  }
}

function saveXml(xmlPath: string, content: string): void {
  const outputPath = path.join(OUTPUT_DIR, xmlPath);
  const dir = path.dirname(outputPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(outputPath, content, "utf-8");
}

async function main() {
  console.log("🔍 대법원 XML 다운로드 시작...\n");

  const paths = generateXmlPaths();
  console.log(`📋 시도할 XML 경로: ${paths.length}개\n`);

  const results = {
    success: [] as string[],
    failed: [] as string[],
    skipped: [] as string[],
  };

  for (const xmlPath of paths) {
    // 이미 존재하는 파일 스킵
    const localPath = path.join(OUTPUT_DIR, xmlPath);
    if (fs.existsSync(localPath)) {
      results.skipped.push(xmlPath);
      continue;
    }

    process.stdout.write(`⏳ ${xmlPath}... `);

    const content = await downloadXml(xmlPath);

    if (content) {
      saveXml(xmlPath, content);
      console.log("✅ 성공");
      results.success.push(xmlPath);
    } else {
      console.log("❌ 없음");
      results.failed.push(xmlPath);
    }

    // Rate limiting
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  console.log("\n" + "=".repeat(50));
  console.log("📊 결과 요약");
  console.log("=".repeat(50));
  console.log(`✅ 새로 다운로드: ${results.success.length}개`);
  console.log(`⏭️  이미 존재: ${results.skipped.length}개`);
  console.log(`❌ 없음/실패: ${results.failed.length}개`);

  if (results.success.length > 0) {
    console.log("\n📥 새로 다운로드된 파일:");
    results.success.forEach((p) => console.log(`   - ${p}`));
  }
}

main().catch(console.error);
