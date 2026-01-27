// scripts/load-test-xml.js
// k6 로드 테스트 스크립트
// 실행: k6 run scripts/load-test-xml.js

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';

// 커스텀 메트릭
const xmlCacheHits = new Counter('xml_cache_hits');
const xmlStaticHits = new Counter('xml_static_hits');
const xmlDownloads = new Counter('xml_downloads');
const xmlErrors = new Counter('xml_errors');
const xmlLatency = new Trend('xml_latency');

// 테스트 설정
export const options = {
  scenarios: {
    // 시나리오 1: 3000명 동시 접속 시뮬레이션
    concurrent_users: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 100 },   // 30초 동안 100명까지 증가
        { duration: '1m', target: 500 },    // 1분 동안 500명까지 증가
        { duration: '2m', target: 1000 },   // 2분 동안 1000명까지 증가
        { duration: '3m', target: 3000 },   // 3분 동안 3000명까지 증가
        { duration: '5m', target: 3000 },   // 5분 동안 3000명 유지
        { duration: '1m', target: 0 },      // 1분 동안 0명까지 감소
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    // 성공률 99% 이상
    'http_req_failed': ['rate<0.01'],
    // 응답 시간 p95 < 2초
    'http_req_duration': ['p(95)<2000'],
    // XML 에러 1% 미만
    'xml_errors': ['count<100'],
  },
};

// 테스트할 XML 경로 목록 (실제 /public/scourt-xml/ 디렉토리 기반 - 39개 전체)
const XML_PATHS = [
  // ssgo003 (일반) - 28 files
  'ssgo003/SSGO003F10.xml',
  'ssgo003/SSGO003F11.xml',
  'ssgo003/SSGO003F20.xml',
  'ssgo003/SSGO003F30.xml',
  'ssgo003/SSGO003F32.xml',
  'ssgo003/SSGO003F40.xml',
  'ssgo003/SSGO003F50.xml',
  'ssgo003/SSGO003F60.xml',
  'ssgo003/SSGO003F61.xml',
  'ssgo003/SSGO003F62.xml',
  'ssgo003/SSGO003F63.xml',
  'ssgo003/SSGO003F64.xml',
  'ssgo003/SSGO003F65.xml',
  'ssgo003/SSGO003F66.xml',
  'ssgo003/SSGO003F67.xml',
  'ssgo003/SSGO003F68.xml',
  'ssgo003/SSGO003F69.xml',
  'ssgo003/SSGO003F6A.xml',
  'ssgo003/SSGO003F6B.xml',
  'ssgo003/SSGO003F6C.xml',
  'ssgo003/SSGO003F70.xml',
  'ssgo003/SSGO003F71.xml',
  'ssgo003/SSGO003F80.xml',
  'ssgo003/SSGO003F90.xml',
  'ssgo003/SSGO003FA0.xml',
  'ssgo003/SSGO003FF0.xml',
  'ssgo003/SSGO003FG0.xml',
  'ssgo003/SSGO003FH0.xml',
  // ssgo101 (민사 1심) - 1 file
  'ssgo101/SSGO101F01.xml',
  // ssgo102 (민사 항소) - 1 file
  'ssgo102/SSGO102F01.xml',
  // ssgo105 (행정) - 1 file
  'ssgo105/SSGO105F01.xml',
  // ssgo106 (형사) - 1 file
  'ssgo106/SSGO106F01.xml',
  // ssgo107 (가사) - 1 file
  'ssgo107/SSGO107F01.xml',
  // ssgo108 (신청) - 1 file
  'ssgo108/SSGO108F01.xml',
  // ssgo10a (회생/파산) - 1 file
  'ssgo10a/SSGO10AF01.xml',
  // ssgo10c (집행) - 1 file
  'ssgo10c/SSGO10CF01.xml',
  // ssgo10g (지급명령) - 1 file
  'ssgo10g/SSGO10GF01.xml',
  // ssgo10i (조정) - 1 file
  'ssgo10i/SSGO10IF01.xml',
  // ssgo10j (화해) - 1 file
  'ssgo10j/SSGO10JF01.xml',
];

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  // 랜덤 XML 경로 선택
  const xmlPath = XML_PATHS[Math.floor(Math.random() * XML_PATHS.length)];

  // 1. GET 요청 (캐시 조회)
  const startTime = Date.now();
  const getRes = http.get(`${BASE_URL}/api/scourt/xml-cache?path=${encodeURIComponent(xmlPath)}`);
  const latency = Date.now() - startTime;
  xmlLatency.add(latency);

  const success = check(getRes, {
    'status is 200 or 404': (r) => r.status === 200 || r.status === 404,
  });

  if (!success) {
    xmlErrors.add(1);
    return;
  }

  if (getRes.status === 200) {
    const data = getRes.json();
    if (data.from_static) {
      xmlStaticHits.add(1);
    } else {
      xmlCacheHits.add(1);
    }
    return;
  }

  // 2. POST 요청 (다운로드)
  const postRes = http.post(
    `${BASE_URL}/api/scourt/xml-cache`,
    JSON.stringify({ xmlPath }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  const postSuccess = check(postRes, {
    'download status is 200 or 503': (r) => r.status === 200 || r.status === 503,
  });

  if (!postSuccess) {
    xmlErrors.add(1);
  } else if (postRes.status === 200) {
    xmlDownloads.add(1);
  }

  // 사용자 생각 시간 시뮬레이션 (1-3초)
  sleep(1 + Math.random() * 2);
}

export function handleSummary(data) {
  // k6 jslib의 textSummary 사용
  const summary = textSummary(data, { indent: ' ', enableColors: true });

  // 커스텀 메트릭 요약 추가
  const customSummary = `
=== XML Loading Custom Metrics ===

- Cache Hits: ${data.metrics.xml_cache_hits?.values?.count || 0}
- Static Hits: ${data.metrics.xml_static_hits?.values?.count || 0}
- Downloads: ${data.metrics.xml_downloads?.values?.count || 0}
- Errors: ${data.metrics.xml_errors?.values?.count || 0}
- Avg Latency: ${data.metrics.xml_latency?.values?.avg?.toFixed(2) || 0}ms
- P95 Latency: ${data.metrics.xml_latency?.values?.['p(95)']?.toFixed(2) || 0}ms
`;

  return {
    'stdout': summary + customSummary,
    'scripts/load-test-results.json': JSON.stringify(data, null, 2),
  };
}
