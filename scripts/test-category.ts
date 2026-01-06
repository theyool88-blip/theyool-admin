import { getCaseCategory } from '../lib/scourt/party-labels';

const testCases = [
  '2025즈기1108',
  '2025카단1234',
  '2025드단1234',
  '2025가단1234',
];

for (const c of testCases) {
  console.log(`${c} → ${getCaseCategory(c)}`);
}
