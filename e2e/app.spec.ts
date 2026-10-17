import {test,expect} from '@playwright/test';
test('PC 예시 체험: 기록·수정·취소와 주요 페이지',async({page})=>{
  await page.setViewportSize({width:1440,height:1080});
  await page.goto('/');await page.getByRole('button',{name:'예시로 먼저 둘러보기'}).click();
  await expect(page.getByRole('heading',{name:'목표에 가까워지는 일상'})).toBeVisible();
  await page.screenshot({path:'test-results/desktop-home.png',fullPage:true});
  await page.getByRole('button',{name:'지출 기록',exact:true}).click();
  await page.getByRole('textbox',{name:'얼마인가요?'}).fill('15000');
  await page.getByPlaceholder('어떤 기록인지 남겨 보세요').fill('브라우저 검증 점심');
  await page.getByRole('button',{name:'기록 저장하기'}).click();
  await expect(page.getByText('브라우저 검증 점심')).toBeVisible();
  await page.getByRole('button',{name:'기록',exact:true}).click();
  await page.getByRole('button',{name:'수정',exact:true}).first().click();
  await page.getByRole('textbox',{name:'얼마인가요?'}).fill('18000');await page.getByRole('button',{name:'수정 내용 저장'}).click();
  await expect(page.getByText('−18,000')).toBeVisible();
  page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'취소',exact:true}).first().click();
  await expect(page.getByText('브라우저 검증 점심')).toHaveCount(0);
  for(const name of ['내 목표','월급 계획','설정']){await page.getByRole('button',{name,exact:true}).click();await expect(page.locator('h1')).toBeVisible();}
});
test('실제 계정: 설정·서버 저장·새 탭 동기화·새로고침',async({page,context})=>{
  await page.goto('/login');await page.getByLabel('이메일 주소').fill(`browser-${Date.now()}@example.com`);await page.getByRole('button',{name:'이메일로 시작하기'}).click();await page.getByRole('link',{name:'개발용 링크로 로그인'}).click();
  await expect(page.locator('h1')).toHaveText('이번 월급부터, 가볍게 시작해요');
  await page.getByRole('button',{name:'다음으로'}).click();await page.getByRole('button',{name:'다음으로'}).click();await page.getByRole('button',{name:'다음으로'}).click();await page.getByRole('button',{name:'계획 확정하고 시작하기'}).click();
  await expect(page.getByRole('heading',{name:'목표에 가까워지는 일상'})).toBeVisible();const amount=await page.locator('.balance-card .big-amount').innerText();
  await page.getByRole('button',{name:'저축 기록',exact:true}).click();await page.getByRole('textbox',{name:'얼마인가요?'}).fill('50000');await page.getByRole('button',{name:'기록 저장하기'}).click();await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.locator('.balance-card .big-amount')).toHaveText(amount);
  const other=await context.newPage();await other.goto('/app');await expect(other.locator('.saving-strip-amount strong')).toContainText('50,000');await other.close();await page.reload();await expect(page.locator('.saving-strip-amount strong')).toContainText('50,000');
});
test('모바일 360px: 가로 넘침 없이 기록하고 뒤로가기로 닫기',async({page})=>{
  await page.setViewportSize({width:360,height:800});await page.goto('/');await page.getByRole('button',{name:'예시로 먼저 둘러보기'}).click();await expect(page.locator('.bottom-nav')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBeTruthy();
  await page.screenshot({path:'test-results/mobile-home.png',fullPage:true});
  await page.getByRole('button',{name:'지출 기록',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBeTruthy();await page.goBack();await expect(page.getByRole('dialog')).toHaveCount(0);
  for(const name of ['내 목표','기록','월급 계획']){await page.locator('.bottom-nav').getByRole('button',{name,exact:true}).click();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBeTruthy();}
});
