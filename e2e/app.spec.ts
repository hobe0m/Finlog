import {test,expect} from '@playwright/test';

test('목표 달력: 5개월 이동·연월 선택·미래 차단·키보드·목표 변경 기록 보존',async({page})=>{
  await page.clock.install({time:new Date('2026-10-18T03:00:00Z')});
  await page.goto('./#/app');await page.getByRole('button',{name:'지출 기록',exact:true}).click();
  await expect(page.getByRole('region',{name:'목표 기간 달력'})).toBeVisible();
  await page.getByRole('button',{name:'이전 달',exact:true}).click();
  await expect(page.getByRole('button',{name:'이전 달',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'2026년 9월 30일',exact:true}).focus();await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('button',{name:'2026년 10월 1일',exact:true})).toBeFocused();
  await page.keyboard.press('Enter');await expect(page.getByLabel('날짜',{exact:true})).toHaveValue('2026-10-01');
  await page.getByLabel('달력 연도').selectOption('2027');await expect(page.getByLabel('달력 월')).toHaveValue('1');
  await expect(page.getByRole('button',{name:'다음 달',exact:true})).toBeDisabled();
  await expect(page.getByRole('button',{name:'2027년 1월 15일 (미래 날짜)',exact:true})).toBeDisabled();
  await page.getByLabel('달력 연도').selectOption('2026');await page.getByLabel('달력 월').selectOption('10');
  await expect(page.getByRole('button',{name:'2026년 10월 19일 (미래 날짜)',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'오늘 선택',exact:true}).click();await expect(page.getByLabel('날짜',{exact:true})).toHaveValue('2026-10-18');
  await page.getByLabel('날짜',{exact:true}).fill('2026-09-16');await page.getByRole('textbox',{name:'얼마인가요?'}).fill('5000');await page.getByPlaceholder('어떤 기록인지 남겨 보세요').fill('목표 첫 달의 기록');
  await page.screenshot({path:'test-results/goal-calendar-desktop.png',fullPage:true});
  await page.getByRole('button',{name:'기록 반영하기'}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button',{name:'내 목표',exact:true}).click();await page.getByRole('button',{name:'조건 변경'}).click();await page.getByLabel('목표 종료일').fill('2026-10-10');
  await expect(page.getByText('새 목표 기간 밖 기록 4건',{exact:false})).toBeVisible();
  page.once('dialog',d=>d.dismiss());await page.getByRole('button',{name:'변경 확인 및 저장'}).click();await expect(page.getByLabel('목표 종료일')).toBeVisible();
  page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'변경 확인 및 저장'}).click();await expect(page.getByLabel('목표 종료일')).toHaveCount(0);
  await expect(page.locator('.goal-detail .big-amount')).toContainText('2,000,000');
  await page.getByRole('button',{name:'기록',exact:true}).click();await page.getByRole('button',{name:'전체 기간에서 보기'}).click();await expect(page.getByText('목표 첫 달의 기록')).toBeVisible();
  await expect(page.getByText('변경된 목표 기간 밖 기록 4건이 보존되어 있어요.',{exact:false})).toBeVisible();
});

test('모바일 목표 달력: 날짜 셀과 연월 선택이 360px 안에 표시된다',async({page})=>{
  await page.clock.install({time:new Date('2026-10-18T03:00:00Z')});await page.setViewportSize({width:360,height:800});
  await page.goto('./#/app');await page.getByRole('button',{name:'지출 기록',exact:true}).click();
  await page.getByRole('button',{name:'이전 달',exact:true}).click();await page.getByRole('button',{name:'2026년 9월 15일',exact:true}).click();
  await expect(page.getByLabel('날짜',{exact:true})).toHaveValue('2026-09-15');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  await page.getByRole('region',{name:'목표 기간 달력'}).screenshot({path:'test-results/goal-calendar-mobile.png'});
});

test('월급일 변경이 기간·날짜 제한·생활비·기록 조회에 즉시 반영된다',async({page})=>{
  await page.clock.install({time:new Date('2026-10-18T03:00:00Z')});
  await page.goto('./#/app/settings');
  await page.getByRole('textbox',{name:'예상 월 실수령액'}).fill('3400000');
  await page.getByRole('spinbutton',{name:'월급일',exact:true}).fill('10');
  await expect(page.getByText('변경 후 기간: 2026-10-10 ~ 2026-11-09')).toBeVisible();
  await page.getByRole('button',{name:'체험에 반영하기'}).click();
  await page.getByRole('button',{name:'홈',exact:true}).click();
  await expect(page.locator('.period-line')).toContainText('10.10 — 11.09');
  await page.getByRole('button',{name:'지출 기록',exact:true}).click();
  await expect(page.getByText('목표 기간:',{exact:false})).toContainText('2026-09-01 ~ 2027-01-31');
  await expect(page.getByRole('button',{name:'이전 달',exact:true})).toBeEnabled();
  await expect(page.getByText('기록 가능:',{exact:false})).toContainText('2026-09-01 ~ 2026-10-18');
  await page.getByRole('button',{name:'입력창 닫기'}).click();
  await page.getByRole('button',{name:'설정',exact:true}).click();
  await page.getByRole('spinbutton',{name:'월급일',exact:true}).fill('25');
  await expect(page.getByText('변경 후 기간: 2026-09-25 ~ 2026-10-24')).toBeVisible();
  await page.getByRole('button',{name:'체험에 반영하기'}).click();
  await page.getByRole('button',{name:'월급 계획',exact:true}).click();
  await expect(page.locator('.plan-income')).toContainText('3,400,000');
  await page.getByRole('button',{name:'기록하기',exact:true}).click();
  const date=page.getByLabel('날짜',{exact:true});
  await expect(page.locator('.selected-period-note')).toContainText('09.25 — 10.24');
  await date.fill('2026-08-31');expect(await date.evaluate((el:HTMLInputElement)=>el.validity.customError)).toBeTruthy();
  await date.fill('2026-09-26');await page.getByRole('textbox',{name:'얼마인가요?'}).fill('10000');await page.getByPlaceholder('어떤 기록인지 남겨 보세요').fill('지난달 날짜 체험');await page.getByRole('button',{name:'기록 반영하기'}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button',{name:'설정',exact:true}).click();await page.getByRole('spinbutton',{name:'월급일',exact:true}).fill('10');await page.getByRole('button',{name:'체험에 반영하기'}).click();
  await page.getByRole('button',{name:'기록',exact:true}).click();await expect(page.getByText('지난달 날짜 체험')).toHaveCount(0);
  await page.locator('.filter-bar select').first().selectOption('all');await expect(page.getByText('지난달 날짜 체험')).toBeVisible();
  await page.getByRole('button',{name:'홈',exact:true}).click();await expect(page.locator('.balance-card .big-amount')).toContainText('1,963,200');
});

test('PC: 서버 요청 없이 체험·기록·수정·취소·모든 화면 이동',async({page})=>{
  const requests:string[]=[],errors:string[]=[];
  page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api'))requests.push(r.url());});
  page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:1440,height:1080});
  await page.goto('./');await page.getByRole('button',{name:'데모 시작하기',exact:true}).click();
  await expect(page).toHaveURL(/\/Finlog\/#\/app$/);
  await expect(page.getByRole('heading',{name:'목표에 가까워지는 일상'})).toBeVisible();
  await page.screenshot({path:'test-results/desktop-demo.png',fullPage:true});
  await page.getByRole('button',{name:'지출 기록',exact:true}).click();
  await page.getByRole('textbox',{name:'얼마인가요?'}).fill('15000');
  await page.getByPlaceholder('어떤 기록인지 남겨 보세요').fill('데모 검증 점심');
  await page.getByRole('button',{name:'기록 반영하기'}).click();
  await expect(page.getByText('데모 검증 점심')).toBeVisible();
  await page.getByRole('button',{name:'기록',exact:true}).click();
  await page.getByRole('button',{name:'수정',exact:true}).first().click();
  await page.getByRole('textbox',{name:'얼마인가요?'}).fill('18000');
  await page.getByRole('button',{name:'수정 내용 저장'}).click();
  await expect(page.getByText('−18,000')).toBeVisible();
  page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'취소',exact:true}).first().click();
  await expect(page.getByText('데모 검증 점심')).toHaveCount(0);
  for(const name of ['내 목표','월급 계획','설정']){await page.getByRole('button',{name,exact:true}).click();await expect(page.locator('h1')).toBeVisible();}
  await expect(page.getByText('로그인 이메일')).toHaveCount(0);
  const file=page.waitForEvent('download');await page.getByRole('button',{name:'CSV 내보내기'}).click();expect((await file).suggestedFilename()).toBe('finlog-demo-transactions.csv');
  expect(requests).toEqual([]);expect(errors).toEqual([]);
});

test('새로고침·공유 주소·초기화: Pages 하위 경로에서 정상 동작',async({page})=>{
  await page.goto('./#/app');const original=await page.locator('.balance-card .big-amount').innerText();
  await page.getByRole('button',{name:'지출 기록',exact:true}).click();await page.getByRole('textbox',{name:'얼마인가요?'}).fill('20000');await page.getByRole('button',{name:'기록 반영하기'}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.balance-card .big-amount')).not.toHaveText(original);
  page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'처음부터 다시 체험'}).click();await expect(page.locator('.balance-card .big-amount')).toHaveText(original);
  await page.getByRole('button',{name:'기록하기',exact:true}).click();await page.getByRole('textbox',{name:'얼마인가요?'}).fill('1000');await page.getByRole('button',{name:'기록 반영하기'}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.reload();await expect(page.locator('.balance-card .big-amount')).toHaveText(original);
  for(const route of ['goal','transactions','plan','settings']){
    await page.goto('about:blank');
    const response=await page.goto('./#/app/'+route);expect(response?.status()).toBe(200);await expect(page.locator('h1')).toBeVisible();expect((await page.reload())?.status()).toBe(200);await expect(page.locator('h1')).toBeVisible();
  }
  await page.goto('about:blank');await page.goto('./#/app?record=1');await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page).toHaveURL(/#\/app$/);
});

test('목표·배분 변경: 화면에 반영되고 저축은 이중 차감되지 않는다',async({page})=>{
  await page.goto('./#/app');
  const original=await page.locator('.balance-card .big-amount').innerText();
  await page.getByRole('button',{name:'납부 기록'}).first().click();await page.getByRole('button',{name:'기록 반영하기'}).click();await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.locator('.balance-card .big-amount')).toHaveText(original);
  await page.getByRole('button',{name:'저축 기록',exact:true}).click();await page.getByRole('textbox',{name:'얼마인가요?'}).fill('10000');await expect(page.getByText('추가 배정과 생활비 감소를 확인했어요.')).toBeVisible();await expect(page.getByRole('button',{name:'기록 반영하기'})).toBeDisabled();await page.getByRole('checkbox').check();await page.getByRole('button',{name:'기록 반영하기'}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button',{name:'내 목표',exact:true}).click();await page.getByRole('button',{name:'조건 변경'}).click();await page.getByLabel('목표 이름').fill('데모 속 나의 여행');await page.getByRole('button',{name:'변경 확인 및 저장'}).click();await expect(page.getByRole('heading',{name:'데모 속 나의 여행'})).toBeVisible();
  await page.getByRole('button',{name:'월급 계획',exact:true}).click();await page.getByRole('textbox',{name:'여유 자금',exact:true}).fill('200000');await page.getByRole('button',{name:'변경 확인 및 확정'}).click();await expect(page.getByText('새 배분을 확정했어요.')).toBeVisible();
  await expect(page.getByText('목표 기간의 기록을 계속 남길 수 있어요.',{exact:false})).toBeVisible();
});

test('모바일 360px: 메뉴·입력창·뒤로가기·키보드 닫기',async({page})=>{
  await page.setViewportSize({width:360,height:800});await page.goto('./');await page.getByRole('button',{name:'예시로 먼저 둘러보기'}).click();await expect(page.locator('.bottom-nav')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  await page.screenshot({path:'test-results/mobile-demo.png',fullPage:true});
  await page.getByRole('button',{name:'지출 기록',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();await page.goBack();await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button',{name:'지출 기록',exact:true}).click();await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
  for(const name of ['내 목표','기록','월급 계획']){await page.locator('.bottom-nav').getByRole('button',{name,exact:true}).click();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();}
  await page.getByRole('button',{name:'설정',exact:true}).click();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
});
