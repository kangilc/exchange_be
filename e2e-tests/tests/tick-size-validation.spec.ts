import { test, expect, request } from '@playwright/test';

test('지정가 주문에서 호가 단위 정책에 맞지 않는 비정상 가격 입력 시 차단 검증', async ({ page }) => {
  const apiContext = await request.newContext();

  // 1. 최고 관리자(Admin) 로그인하여 인증 토큰 발급 받기
  const adminLoginRes = await apiContext.post('http://localhost:8181/admin/auth/login', {
    data: { email: 'admin@javaf.net', password: 'admin123!@#' }
  });

  if (!adminLoginRes.ok()) {
    const errorBody = await adminLoginRes.text();
    throw new Error(`어드민 로그인 실패: HTTP ${adminLoginRes.status()} - ${errorBody}`);
  }

  const adminData = await adminLoginRes.json();
  const adminToken = adminData.data.accessToken;

  // 2. 신규 사용자 가입 신청
  const uniqueEmail = `e2e_tick_${Date.now()}@hfx.com`;
  const signupRes = await apiContext.post('http://localhost:8181/admin/auth/signup', {
    data: { email: uniqueEmail, password: 'password123!' }
  });
  if (!signupRes.ok()) {
    throw new Error(`회원가입 신청 실패`);
  }

  const signupJson = await signupRes.json();
  const userId = signupJson.data?.userId;

  // 3. 어드민 토큰으로 ACTIVE 승인
  await apiContext.put(`http://localhost:8181/admin/users/${userId}`, {
    headers: { 'Authorization': `Bearer ${adminToken}` },
    data: {
      email: uniqueEmail,
      status: 'ACTIVE',
      grade: 'STANDARD',
      role: 'USER'
    }
  });

  // 4. 신규 유저에게 100만 KRW 입금
  if (userId) {
    await apiContext.post(`http://localhost:8181/admin/users/${userId}/assets/adjust`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
      data: { currency: 'KRW', amount: 1000000 }
    });
  }

  // 5. 로그인 진행
  await page.goto('http://localhost:5173/');
  await page.getByRole('button', { name: '로그인' }).click();

  await page.locator('input[type="email"]').fill(uniqueEmail);
  await page.locator('input[type="password"]').fill('password123!');
  await page.getByRole('button', { name: '거래소 로그인' }).click();

  await expect(page.getByText(uniqueEmail)).toBeVisible({ timeout: 10000 });

  // 6. ADA-KRW 마켓으로 전환
  await page.getByRole('button', { name: 'ADA-KRW' }).click();
  await page.getByRole('button', { name: '지정가' }).click();

  // 7. 호가 단위(1 KRW)에 맞지 않는 1200.5원 비정상 가격 입력
  await page.locator('label', { hasText: '주문 가격' }).locator('..').locator('input[type="number"]').fill('1200.5');
  await page.locator('label', { hasText: '주문 수량' }).locator('..').locator('..').locator('input[type="number"]').fill('500');

  // 8. 브라우저 Alert 경고 검증 등록
  let dialogTriggered = false;
  page.on('dialog', async dialog => {
    expect(dialog.message()).toContain('주문 가격이 해당 가격대 호가 단위(1)의 배수가 아닙니다.');
    dialogTriggered = true;
    await dialog.accept();
  });

  // 9. 매수 주문 전송 버튼 클릭
  await page.getByRole('button', { name: '매수 주문 전송' }).click();

  // 대기 및 얼럿 트리거 여부 확인
  await page.waitForTimeout(1000);
  expect(dialogTriggered).toBe(true);

  // 주문 전송 로그가 출력되지 않았음을 확인 (차단 상태 검증)
  const logConsole = page.getByText('[주문 전송] 500 ADA @ 1,200.5 KRW');
  await expect(logConsole).not.toBeVisible();
});
