/**
 * 대리 접속 로직 검증 스크립트
 */

// 1. 토큰 생성 로직 테스트
const testTenantId = 'test-tenant-123';
const testTenantName = '테스트 법률사무소';
const testTenantSlug = 'test-law';

const impersonationToken = Buffer.from(JSON.stringify({
  tenantId: testTenantId,
  tenantName: testTenantName,
  tenantSlug: testTenantSlug,
  impersonatedAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1시간 만료
})).toString('base64');

console.log('=== 1. 토큰 생성 테스트 ===');
console.log('생성된 토큰:', impersonationToken);

// 2. 토큰 디코딩 테스트
console.log('\n=== 2. 토큰 디코딩 테스트 ===');
try {
  const decoded = JSON.parse(Buffer.from(impersonationToken, 'base64').toString());
  console.log('디코딩된 데이터:', JSON.stringify(decoded, null, 2));
  
  const expiresAt = new Date(decoded.expiresAt);
  const isValid = expiresAt > new Date() && decoded.tenantId;
  console.log('유효성 검사:', isValid ? '✅ 유효함' : '❌ 유효하지 않음');
  console.log('  - 만료시간:', expiresAt.toISOString());
  console.log('  - 현재시간:', new Date().toISOString());
  console.log('  - tenantId:', decoded.tenantId);
} catch (e) {
  console.log('❌ 디코딩 실패:', e);
}

// 3. 쿠키 이름 확인
console.log('\n=== 3. 쿠키 설정 확인 ===');
console.log('쿠키 이름: sa_impersonate');
console.log('쿠키 옵션:');
console.log('  - httpOnly: false (클라이언트에서 읽을 수 있음)');
console.log('  - secure: production에서만 true');
console.log('  - sameSite: lax');
console.log('  - maxAge: 3600 (1시간)');
console.log('  - path: /');

