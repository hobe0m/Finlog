import {test,expect} from '@playwright/test';

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
  await expect(page.getByText('데모에서는 마감 전 요약만 확인할 수 있어요.',{exact:false})).toBeVisible();
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
