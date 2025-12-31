/**
 * 나의사건검색 통합 검증 스크립트
 *
 * 검증 항목:
 * 1. 캡챠 모델 테스트 (PyTorch CBAM Multi-Head V2)
 * 2. DB 테이블 존재 확인
 * 3. 프로필 관리 테스트 (DB 조회)
 * 4. legal_cases 테스트 데이터 확인
 *
 * 실행: npx tsx scripts/verify-scourt-integration.ts
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  details?: any;
}

const results: TestResult[] = [];

function log(message: string) {
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${message}`);
}

function logResult(result: TestResult) {
  results.push(result);
  const status = result.passed ? '✅' : '❌';
  console.log(`${status} ${result.name}: ${result.message}`);
  if (result.details) {
    console.log(`   상세: ${JSON.stringify(result.details)}`);
  }
}

// ============================================================================
// 테스트 1: 캡챠 모델 검증 (Python subprocess로 직접 테스트)
// ============================================================================
async function testCaptchaModel(): Promise<TestResult> {
  log('캡챠 모델 테스트 시작...');

  const modelPath = path.join(process.cwd(), 'data', 'captcha-model', 'cbam_multihead_v2_final.pth');
  const scriptPath = path.join(process.cwd(), 'scripts', 'cbam_multihead_v2.py');

  // 모델 파일 존재 확인
  if (!fs.existsSync(modelPath) || !fs.existsSync(scriptPath)) {
    return {
      name: '캡챠 모델 존재',
      passed: false,
      message: '모델 파일 또는 스크립트가 없음',
    };
  }

  // Python으로 직접 테스트
  return new Promise((resolve) => {
    const pythonCode = `
import sys
sys.path.insert(0, '${path.join(process.cwd(), 'scripts')}')
import torch
import numpy as np
from PIL import Image
import cv2
import os
from cbam_multihead_v2 import CBAM_MultiHead_V2

MODEL_PATH = '${modelPath}'
TRAINING_DIR = '${path.join(process.cwd(), 'data', 'captcha-training')}'

# 모델 로드
model = CBAM_MultiHead_V2()
model.load_state_dict(torch.load(MODEL_PATH, map_location='cpu', weights_only=True))
model.eval()

# 샘플 테스트
files = [f for f in os.listdir(TRAINING_DIR) if f.endswith('.png')][:5]
correct = 0
results = []

for file in files:
    label = file.split('.')[0].split('_')[0]
    img_path = os.path.join(TRAINING_DIR, file)

    pil_img = Image.open(img_path)
    if pil_img.mode == 'RGBA':
        _, _, _, alpha = pil_img.split()
        img = np.array(alpha)
    else:
        img = np.array(pil_img.convert('L'))

    inverted = 255 - img
    resized = cv2.resize(inverted, (160, 50))
    normalized = resized.astype(np.float32) / 255.0
    tensor = torch.FloatTensor(normalized).unsqueeze(0).unsqueeze(0)

    with torch.no_grad():
        outputs = model(tensor)
        predictions = [torch.argmax(out, dim=1).item() for out in outputs]

    result = ''.join(map(str, predictions))
    is_correct = result == label
    if is_correct:
        correct += 1

    status = 'O' if is_correct else 'X'
    results.append(f'{status}:{label}:{result}')

print(f'{correct}/{len(files)}')
print('|'.join(results))
`;

    const python = spawn('python3', ['-c', pythonCode]);
    let output = '';
    let error = '';

    python.stdout.on('data', (data) => { output += data.toString(); });
    python.stderr.on('data', (data) => { error += data.toString(); });

    python.on('close', () => {
      const lines = output.trim().split('\n');
      if (lines.length >= 2) {
        const [counts, resultStr] = lines;
        const [correct, total] = counts.split('/').map(Number);
        const accuracy = (correct / total) * 100;
        const testResults = resultStr.split('|').map((r) => {
          const [status, label, pred] = r.split(':');
          return { label, prediction: pred, correct: status === 'O' };
        });

        resolve({
          name: '캡챠 모델 테스트',
          passed: accuracy >= 80,
          message: `정확도: ${accuracy.toFixed(1)}% (${correct}/${total})`,
          details: testResults,
        });
      } else {
        resolve({
          name: '캡챠 모델 테스트',
          passed: false,
          message: `에러: ${error || output}`,
        });
      }
    });
  });
}

// ============================================================================
// 테스트 2: DB 테이블 존재 확인
// ============================================================================
async function testDatabaseTables(): Promise<TestResult> {
  log('DB 테이블 확인...');

  const tables = [
    'scourt_profiles',
    'scourt_profile_cases',
    'scourt_user_settings',
    'scourt_case_snapshots',
    'scourt_case_updates',
    'scourt_sync_logs',
  ];

  const tableStatus: Record<string, boolean> = {};

  for (const table of tables) {
    const { error } = await supabase.from(table).select('*', { count: 'exact', head: true });
    tableStatus[table] = !error;
  }

  const allExist = Object.values(tableStatus).every((v) => v);

  return {
    name: 'DB 테이블 존재',
    passed: allExist,
    message: allExist ? '모든 테이블 존재' : '일부 테이블 누락',
    details: tableStatus,
  };
}

// ============================================================================
// 테스트 3: 프로필 관리 테스트 (DB 직접 조회)
// ============================================================================
async function testProfileManagement(): Promise<TestResult> {
  log('프로필 관리 테스트...');

  try {
    // 프로필 조회
    const { data: profiles, error: profileError } = await supabase
      .from('scourt_profiles')
      .select('*')
      .eq('status', 'active');

    if (profileError) {
      return {
        name: '프로필 관리',
        passed: false,
        message: `DB 에러: ${profileError.message}`,
      };
    }

    // 사용자 설정 조회
    const { data: settings } = await supabase
      .from('scourt_user_settings')
      .select('*')
      .is('user_id', null)
      .single();

    const maxProfiles = settings?.max_profiles || 6;
    const maxCasesPerProfile = settings?.max_cases_per_profile || 50;
    const maxTotalCases = maxProfiles * maxCasesPerProfile;

    const totalCases = profiles?.reduce((sum, p) => sum + (p.case_count || 0), 0) || 0;

    return {
      name: '프로필 관리',
      passed: true,
      message: `프로필 ${profiles?.length || 0}개, 사건 ${totalCases}/${maxTotalCases}`,
      details: {
        profiles: profiles?.map((p) => ({
          name: p.profile_name,
          caseCount: p.case_count,
          maxCases: p.max_cases,
          status: p.status,
        })),
        limits: {
          maxProfiles,
          maxCasesPerProfile,
          maxTotalCases,
        },
      },
    };
  } catch (error: any) {
    return {
      name: '프로필 관리',
      passed: false,
      message: `에러: ${error.message}`,
    };
  }
}

// ============================================================================
// 테스트 4: 프로필 디렉토리 확인
// ============================================================================
async function testProfileDirectory(): Promise<TestResult> {
  log('프로필 디렉토리 확인...');

  try {
    const profilesDir = path.join(process.cwd(), 'data', 'scourt-profiles');

    // 디렉토리 존재 확인
    if (!fs.existsSync(profilesDir)) {
      return {
        name: '프로필 디렉토리',
        passed: false,
        message: '프로필 디렉토리 없음',
      };
    }

    // 프로필 목록 확인
    const profiles = fs.readdirSync(profilesDir).filter((f) =>
      fs.statSync(path.join(profilesDir, f)).isDirectory() && f.startsWith('profile_')
    );

    return {
      name: '프로필 디렉토리',
      passed: true,
      message: `${profiles.length}개 프로필 디렉토리 발견`,
      details: { profiles },
    };
  } catch (error: any) {
    return {
      name: '프로필 디렉토리',
      passed: false,
      message: `에러: ${error.message}`,
    };
  }
}

// ============================================================================
// 테스트 5: legal_cases 테스트 데이터 확인
// ============================================================================
async function testLegalCasesData(): Promise<TestResult> {
  log('legal_cases 테스트 데이터 확인...');

  const { data: cases, error } = await supabase
    .from('legal_cases')
    .select('id, court_case_number, court_name, case_type, case_name')
    .not('court_case_number', 'is', null)
    .limit(5);

  if (error) {
    return {
      name: 'legal_cases 데이터',
      passed: false,
      message: `에러: ${error.message}`,
    };
  }

  const hasCases = cases && cases.length > 0;

  return {
    name: 'legal_cases 데이터',
    passed: hasCases,
    message: hasCases ? `${cases.length}건 발견` : '테스트용 사건 없음',
    details: cases?.map((c) => ({
      caseNumber: c.court_case_number,
      court: c.court_name,
      type: c.case_type,
    })),
  };
}

// ============================================================================
// 메인 실행
// ============================================================================
async function main() {
  console.log('');
  console.log('═'.repeat(60));
  console.log('  나의사건검색 통합 검증');
  console.log('═'.repeat(60));
  console.log('');

  // 테스트 실행
  logResult(await testCaptchaModel());
  console.log('');
  logResult(await testDatabaseTables());
  console.log('');
  logResult(await testProfileManagement());
  console.log('');
  logResult(await testProfileDirectory());
  console.log('');
  logResult(await testLegalCasesData());

  // 결과 요약
  console.log('');
  console.log('═'.repeat(60));
  console.log('  검증 결과 요약');
  console.log('═'.repeat(60));

  const passed = results.filter((r) => r.passed).length;
  const total = results.length;

  console.log(`총 ${total}개 테스트 중 ${passed}개 통과`);
  console.log('');

  if (passed === total) {
    console.log('✅ 모든 테스트 통과! API 검색 테스트를 진행할 수 있습니다.');
    console.log('');
    console.log('다음 단계:');
    console.log('  npx tsx scripts/test-scourt-search-flow.ts');
  } else {
    console.log('❌ 일부 테스트 실패. 위의 상세 내용을 확인하세요.');
  }

  console.log('');
}

main().catch(console.error);
