import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const key = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '{}');

console.log('📋 서비스 계정 정보:\n');
console.log('Project ID:', key.project_id);
console.log('Client Email:', key.client_email);
console.log('Client ID:', key.client_id);
console.log('Private Key ID:', key.private_key_id);

// 프로젝트 번호 확인 (client_id가 프로젝트 번호일 수 있음)
console.log('\n🔍 에러에서 언급된 프로젝트 번호: 1015967372686');
console.log('서비스 계정 Client ID: ' + key.client_id);
console.log('일치 여부:', key.client_id === '1015967372686' ? '✅ 일치' : '❌ 불일치');
