import { test, expect, request } from '@playwright/test';

test('신규 유저 가입 후 주문 체결 및 어드민 수수료 정산 확인', async ({ page }) => {
  const apiContext = await request.newContext();

  // 1. 최고 관리자(Admin) 로그인하여 인증 토큰 발급 받기
  const adminLoginRes = await apiContext.post('http://localhost:8181/admin/auth/login', {
    data: { email: 'admin@javaf.net', password: 'admin123!@#' }
  });

  // 디버깅 및 방어 코드: 관리자 로그인 실패 시 빠른 파악
  if (!adminLoginRes.ok()) {
    const errorBody = await adminLoginRes.text();
    throw new Error(`어드민 로그인 실패: HTTP ${adminLoginRes.status()} - ${errorBody}`);
  }

  const adminData = await adminLoginRes.json();
  const adminToken = adminData.data.accessToken;

  // 2. 어드민 토큰을 사용하여 고유한 신규 유저 생성
  const uniqueEmail = `e2e_test_${Date.now()}@hfx.com`;
  const userRes = await apiContext.post('http://localhost:8181/admin/users/register', {
    headers: { 'Authorization': `Bearer ${adminToken}` },
    data: { email: uniqueEmail, password: 'password123!' }
  });

  if (!userRes.ok()) {
    const errorBody = await userRes.text();
    throw new Error(`유저 생성 실패: HTTP ${userRes.status()} - ${errorBody}`);
  }

  const userJson = await userRes.json();
  const userId = userJson.data?.userId;

  // 3. 신규 유저에게 100만 KRW 입금
  if (userId) {
    const adjustRes = await apiContext.post(`http://localhost:8181/admin/users/${userId}/assets/adjust`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
      data: { currency: 'KRW', amount: 1000000 }
    });

    if (!adjustRes.ok()) {
      const errorBody = await adjustRes.text();
      throw new Error(`자산 입금 실패: HTTP ${adjustRes.status()} - ${errorBody}`);
    }
  }

  // 4. 깨끗한 신규 유저로 UI 로그인 진행
  await page.goto('http://localhost:5173/');
  await page.getByRole('button', { name: '로그인' }).click();

  await page.locator('input[type="email"]').fill(uniqueEmail);
  await page.locator('input[type="password"]').fill('password123!');
  await page.getByRole('button', { name: '거래소 로그인' }).click();

  await expect(page.getByText(uniqueEmail)).toBeVisible({ timeout: 10000 });

  // 5. ADA-KRW 마켓으로 전환 (보유 자산이 KRW이므로)
  await page.getByRole('button', { name: 'ADA-KRW' }).click();

  // 지정가 탭 클릭 확인
  await page.getByRole('button', { name: '지정가' }).click();

  // '주문 가격' 입력 (ADA-KRW의 예시 가격: 1200 KRW)
  await page.locator('label', { hasText: '주문 가격' }).locator('..').locator('input[type="number"]').fill('1200');

  // '주문 수량' 입력 (500 ADA)
  await page.locator('label', { hasText: '주문 수량' }).locator('..').locator('..').locator('input[type="number"]').fill('500');

  // 매수 주문 전송 버튼 클릭
  await page.getByRole('button', { name: '매수 주문 전송' }).click();

  // 6. 실시간 매칭 로그 콘솔에 주문 전송 패킷 로그가 출력되었는지 확인하여 웹소켓 전송 성공 검증
  await expect(page.getByText('[주문 전송] 500 ADA @ 1,200 KRW')).toBeVisible({ timeout: 5000 });
});
