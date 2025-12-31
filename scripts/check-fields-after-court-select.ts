/**
 * 법원 선택 후 어떤 필드들이 활성화되는지 확인
 */

import puppeteer from 'puppeteer';

async function checkFields() {
  console.log('🔍 법원 선택 후 필드 상태 확인\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    page.on('dialog', async dialog => await dialog.accept());

    await page.goto('https://www.scourt.go.kr/portal/information/events/search/search.jsp', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    await new Promise(r => setTimeout(r, 10000));

    const targetFrame = page.frames().find(f => f.url().includes('ssgo.scourt.go.kr'));
    if (!targetFrame) throw new Error('iframe 없음');

    console.log('='.repeat(70));
    console.log('법원 선택 전 필드 상태:');
    console.log('='.repeat(70));

    const beforeSelect = await targetFrame.evaluate(() => {
      const fullCsNo = document.querySelector('#mf_ssgoTopMainTab_contents_content1_body_ibx_fullCsNo') as HTMLInputElement;
      const csYr = document.querySelector('#mf_ssgoTopMainTab_contents_content1_body_sbx_csYr') as HTMLSelectElement;
      const csDvsCd = document.querySelector('#mf_ssgoTopMainTab_contents_content1_body_sbx_csDvsCd') as HTMLSelectElement;
      const csSerial = document.querySelector('#mf_ssgoTopMainTab_contents_content1_body_ibx_csSerial') as HTMLInputElement;

      return {
        fullCsNo: {
          exists: !!fullCsNo,
          visible: fullCsNo ? window.getComputedStyle(fullCsNo).display !== 'none' : false,
          disabled: fullCsNo?.disabled || false,
          readonly: fullCsNo?.readOnly || false
        },
        csYr: {
          exists: !!csYr,
          visible: csYr ? window.getComputedStyle(csYr).display !== 'none' : false,
          disabled: csYr?.disabled || false
        },
        csDvsCd: {
          exists: !!csDvsCd,
          visible: csDvsCd ? window.getComputedStyle(csDvsCd).display !== 'none' : false,
          disabled: csDvsCd?.disabled || false
        },
        csSerial: {
          exists: !!csSerial,
          visible: csSerial ? window.getComputedStyle(csSerial).display !== 'none' : false,
          disabled: csSerial?.disabled || false,
          readonly: csSerial?.readOnly || false
        }
      };
    });

    console.log('\n전체 사건번호 필드 (ibx_fullCsNo):');
    console.log(`  - 존재: ${beforeSelect.fullCsNo.exists}`);
    console.log(`  - 보임: ${beforeSelect.fullCsNo.visible}`);
    console.log(`  - 비활성: ${beforeSelect.fullCsNo.disabled}`);
    console.log(`  - 읽기전용: ${beforeSelect.fullCsNo.readonly}`);

    console.log('\n연도 필드 (sbx_csYr):');
    console.log(`  - 존재: ${beforeSelect.csYr.exists}`);
    console.log(`  - 보임: ${beforeSelect.csYr.visible}`);
    console.log(`  - 비활성: ${beforeSelect.csYr.disabled}`);

    console.log('\n사건유형 필드 (sbx_csDvsCd):');
    console.log(`  - 존재: ${beforeSelect.csDvsCd.exists}`);
    console.log(`  - 보임: ${beforeSelect.csDvsCd.visible}`);
    console.log(`  - 비활성: ${beforeSelect.csDvsCd.disabled}`);

    console.log('\n일련번호 필드 (ibx_csSerial):');
    console.log(`  - 존재: ${beforeSelect.csSerial.exists}`);
    console.log(`  - 보임: ${beforeSelect.csSerial.visible}`);
    console.log(`  - 비활성: ${beforeSelect.csSerial.disabled}`);
    console.log(`  - 읽기전용: ${beforeSelect.csSerial.readonly}`);

    console.log('\n\n법원 선택 중...');
    await new Promise(r => setTimeout(r, 1000));
    await targetFrame.select('#mf_ssgoTopMainTab_contents_content1_body_sbx_cortCd', '수원가정법원');
    await new Promise(r => setTimeout(r, 2000));

    console.log('='.repeat(70));
    console.log('법원 선택 후 필드 상태:');
    console.log('='.repeat(70));

    const afterSelect = await targetFrame.evaluate(() => {
      const fullCsNo = document.querySelector('#mf_ssgoTopMainTab_contents_content1_body_ibx_fullCsNo') as HTMLInputElement;
      const csYr = document.querySelector('#mf_ssgoTopMainTab_contents_content1_body_sbx_csYr') as HTMLSelectElement;
      const csDvsCd = document.querySelector('#mf_ssgoTopMainTab_contents_content1_body_sbx_csDvsCd') as HTMLSelectElement;
      const csSerial = document.querySelector('#mf_ssgoTopMainTab_contents_content1_body_ibx_csSerial') as HTMLInputElement;

      return {
        fullCsNo: {
          exists: !!fullCsNo,
          visible: fullCsNo ? window.getComputedStyle(fullCsNo).display !== 'none' : false,
          disabled: fullCsNo?.disabled || false,
          readonly: fullCsNo?.readOnly || false,
          value: fullCsNo?.value || ''
        },
        csYr: {
          exists: !!csYr,
          visible: csYr ? window.getComputedStyle(csYr).display !== 'none' : false,
          disabled: csYr?.disabled || false,
          value: csYr?.value || ''
        },
        csDvsCd: {
          exists: !!csDvsCd,
          visible: csDvsCd ? window.getComputedStyle(csDvsCd).display !== 'none' : false,
          disabled: csDvsCd?.disabled || false,
          value: csDvsCd?.value || ''
        },
        csSerial: {
          exists: !!csSerial,
          visible: csSerial ? window.getComputedStyle(csSerial).display !== 'none' : false,
          disabled: csSerial?.disabled || false,
          readonly: csSerial?.readOnly || false,
          value: csSerial?.value || ''
        }
      };
    });

    console.log('\n전체 사건번호 필드 (ibx_fullCsNo):');
    console.log(`  - 존재: ${afterSelect.fullCsNo.exists}`);
    console.log(`  - 보임: ${afterSelect.fullCsNo.visible}`);
    console.log(`  - 비활성: ${afterSelect.fullCsNo.disabled}`);
    console.log(`  - 읽기전용: ${afterSelect.fullCsNo.readonly}`);
    console.log(`  - 현재값: "${afterSelect.fullCsNo.value}"`);

    console.log('\n연도 필드 (sbx_csYr):');
    console.log(`  - 존재: ${afterSelect.csYr.exists}`);
    console.log(`  - 보임: ${afterSelect.csYr.visible}`);
    console.log(`  - 비활성: ${afterSelect.csYr.disabled}`);
    console.log(`  - 현재값: "${afterSelect.csYr.value}"`);

    console.log('\n사건유형 필드 (sbx_csDvsCd):');
    console.log(`  - 존재: ${afterSelect.csDvsCd.exists}`);
    console.log(`  - 보임: ${afterSelect.csDvsCd.visible}`);
    console.log(`  - 비활성: ${afterSelect.csDvsCd.disabled}`);
    console.log(`  - 현재값: "${afterSelect.csDvsCd.value}"`);

    console.log('\n일련번호 필드 (ibx_csSerial):');
    console.log(`  - 존재: ${afterSelect.csSerial.exists}`);
    console.log(`  - 보임: ${afterSelect.csSerial.visible}`);
    console.log(`  - 비활성: ${afterSelect.csSerial.disabled}`);
    console.log(`  - 읽기전용: ${afterSelect.csSerial.readonly}`);
    console.log(`  - 현재값: "${afterSelect.csSerial.value}"`);

    console.log('\n\n💡 결론:');
    if (!afterSelect.fullCsNo.visible || afterSelect.fullCsNo.disabled) {
      console.log('   → 법원 선택 후 전체 사건번호 필드가 비활성화됨!');
      console.log('   → 연도/사건유형/일련번호를 따로 입력해야 함!');
    } else {
      console.log('   → 전체 사건번호 필드 사용 가능');
    }

    console.log('\n브라우저를 2분간 열어둡니다...');
    await new Promise(r => setTimeout(r, 120000));

  } finally {
    await browser.close();
  }
}

checkFields()
  .then(() => {
    console.log('\n✅ 완료');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ 에러:', error);
    process.exit(1);
  });
