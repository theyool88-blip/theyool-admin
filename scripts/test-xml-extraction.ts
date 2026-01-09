/**
 * 동적 XML 추출 테스트
 *
 * 기본정보 XML에서 .setSrc() 패턴을 파싱하여
 * 하위 XML 경로가 제대로 추출되는지 확인
 */

import * as fs from "fs";
import * as path from "path";

// extractSubXmlPaths 함수 복사 (테스트용 - 두 패턴 지원)
function extractSubXmlPaths(basicInfoXml: string): Record<string, string> {
  const result: Record<string, string> = {};

  // 패턴 1: JavaScript .setSrc() 호출
  // 예: wfScrtyCttLst.setSrc("/ui/ssgo003/SSGO003FA0.xml")
  const jsSrcRegex = /wf(\w+)\.setSrc\([^"]*"\/ui\/([^"]+)"/g;
  let match;
  while ((match = jsSrcRegex.exec(basicInfoXml)) !== null) {
    const varName = match[1];
    const xmlPath = match[2];
    const dataListId = `dlt_${varName.charAt(0).toLowerCase()}${varName.slice(1)}`;
    result[dataListId] = xmlPath;
  }

  // 패턴 2: XML wframe src 속성
  // 예: <w2:wframe id="wfRcntDxdyLst" src="SSGO003F32.xml">
  const wframeSrcRegex = /<w2:wframe\s+id="wf(\w+)"\s+src="([^"]+)"/g;
  while ((match = wframeSrcRegex.exec(basicInfoXml)) !== null) {
    const varName = match[1];
    const xmlFileName = match[2];
    const dataListId = `dlt_${varName.charAt(0).toLowerCase()}${varName.slice(1)}`;
    // ssgo003/ 경로 prefix 추가 (상대 경로인 경우)
    const xmlPath = xmlFileName.startsWith("ssgo")
      ? xmlFileName
      : `ssgo003/${xmlFileName}`;
    result[dataListId] = xmlPath;
  }

  return result;
}

// 테스트할 XML 파일들
const testCases = [
  {
    name: "행정신청 (ssgo105)",
    file: "public/scourt-xml/ssgo105/SSGO105F01.xml",
    expected: [
      "dlt_scrtyCttLst", // 담보내용
      "dlt_crctnOrdLst", // 보정명령
      "dlt_rcntDxdyLst", // 최근기일
      "dlt_btprtCttLst", // 당사자
      "dlt_agntCttLst", // 대리인
    ],
  },
  {
    name: "가사 (ssgo102)",
    file: "public/scourt-xml/ssgo102/SSGO102F01.xml",
    expected: ["dlt_rcntDxdyLst", "dlt_btprtCttLst", "dlt_agntCttLst"],
  },
  {
    name: "민사 (ssgo101)",
    file: "public/scourt-xml/ssgo101/SSGO101F01.xml",
    expected: ["dlt_rcntDxdyLst", "dlt_btprtCttLst", "dlt_agntCttLst"],
  },
];

console.log("=== 동적 XML 추출 테스트 ===\n");

for (const testCase of testCases) {
  const filePath = path.join(process.cwd(), testCase.file);

  if (!fs.existsSync(filePath)) {
    console.log(`❌ ${testCase.name}: 파일 없음 (${testCase.file})\n`);
    continue;
  }

  const xmlContent = fs.readFileSync(filePath, "utf-8");
  const extracted = extractSubXmlPaths(xmlContent);

  console.log(`📄 ${testCase.name}`);
  console.log(`   파일: ${testCase.file}`);
  console.log(`   추출된 경로:`);

  for (const [dataListId, xmlPath] of Object.entries(extracted)) {
    console.log(`     - ${dataListId} → ${xmlPath}`);
  }

  // 기대 결과 확인
  const missing = testCase.expected.filter((key) => !extracted[key]);
  if (missing.length > 0) {
    console.log(`   ⚠️ 누락: ${missing.join(", ")}`);
  } else {
    console.log(`   ✅ 모든 기대 항목 추출됨`);
  }

  console.log();
}
