-- =========================================================================
-- Flyway DB Seed Data Migration (DML 전용)
-- =========================================================================

-- 0. 공통 코드 데이터 주입
INSERT INTO code_groups (group_code, group_name, description, created_by, updated_by) VALUES
('CURRENCY_DESC', '지원 자산 국문 설명', '거래소에서 지원하는 가상자산 및 법정화폐의 국문 명칭 정의', 'SYSTEM', 'SYSTEM'),
('LEDGER_TYPE_DESC', '원장 전표 유형 설명', '자산 변동 원장 기록 사유에 대한 국문 설명 매핑', 'SYSTEM', 'SYSTEM'),
('WITHDRAWAL_STATUS_DESC', '출금 상태 설명', '출금 요청 처리 진행 단계 설명', 'SYSTEM', 'SYSTEM')
ON CONFLICT (group_code) DO NOTHING;

INSERT INTO common_codes (group_code, code_value, code_name, description, display_order, is_active, created_by, updated_by) VALUES
('CURRENCY_DESC', 'KRW', '원화', '대한민국 법정화폐', 1, true, 'SYSTEM', 'SYSTEM'),
('CURRENCY_DESC', 'USD', '미국 달러', '미국 법정화폐', 2, true, 'SYSTEM', 'SYSTEM'),
('CURRENCY_DESC', 'BTC', '비트코인', '대장 가상자산', 3, true, 'SYSTEM', 'SYSTEM'),
('CURRENCY_DESC', 'ADA', '에이다', '카르다노 가상자산', 4, true, 'SYSTEM', 'SYSTEM'),
('CURRENCY_DESC', 'JAF', '자프 토큰', '거래소 유틸리티 토큰', 5, true, 'SYSTEM', 'SYSTEM'),

('LEDGER_TYPE_DESC', 'DEPOSIT', '입금 완료', '외부 입금 완료 처리', 1, true, 'SYSTEM', 'SYSTEM'),
('LEDGER_TYPE_DESC', 'WITHDRAWAL', '출금 완료', '외부 출금 승인 및 완료', 2, true, 'SYSTEM', 'SYSTEM'),
('LEDGER_TYPE_DESC', 'ORDER_HOLD', '주문 잠금', '주문 접수로 인한 자산 잠금', 3, true, 'SYSTEM', 'SYSTEM'),
('LEDGER_TYPE_DESC', 'TRADE_SETTLE', '체결 정산', '체결 거래 자산 교환 정산', 4, true, 'SYSTEM', 'SYSTEM'),
('LEDGER_TYPE_DESC', 'CANCEL_RELEASE', '취소 반환', '주문 취소에 따른 잠금 잔액 복원', 5, true, 'SYSTEM', 'SYSTEM'),
('LEDGER_TYPE_DESC', 'FEE_PAID', '수수료 납부', '거래 체결에 따른 수수료 납부', 6, true, 'SYSTEM', 'SYSTEM'),
('LEDGER_TYPE_DESC', 'FEE_REVENUE', '수수료 수급', '거래소 수수료 계정으로의 세입 적립', 7, true, 'SYSTEM', 'SYSTEM'),

('WITHDRAWAL_STATUS_DESC', 'PENDING', '대기 중', '관리자 승인 대기', 1, true, 'SYSTEM', 'SYSTEM'),
('WITHDRAWAL_STATUS_DESC', 'APPROVED', '승인됨', '출금 승인 완료', 2, true, 'SYSTEM', 'SYSTEM'),
('WITHDRAWAL_STATUS_DESC', 'REJECTED', '거절됨', '관리자 출금 반려', 3, true, 'SYSTEM', 'SYSTEM'),
('WITHDRAWAL_STATUS_DESC', 'BROADCASTED', '전파됨', '블록체인 네트워크 전송 진행 중', 4, true, 'SYSTEM', 'SYSTEM'),
('WITHDRAWAL_STATUS_DESC', 'SUCCESS', '성공', '블록체인 트랜잭션 최종 확정 완료', 5, true, 'SYSTEM', 'SYSTEM'),
('WITHDRAWAL_STATUS_DESC', 'FAILED', '실패', '네트워크 실패 등으로 인한 출금 전송 에러', 6, true, 'SYSTEM', 'SYSTEM')
ON CONFLICT (group_code, code_value) DO NOTHING;


-- 1. 초기 시드 회원 데이터 인젝션 (1000명의 사용자 자동 생성 및 최근 1년 동안 균등 분산)
INSERT INTO users (user_id, email, password_hash, created_at)
SELECT 
    i, 
    'user' || i || '@exchange.com', 
    '$2a$10$eImiTXuWVxfM37uY4JANjO',
    NOW() - (i * (365.0 / 1000.0) * INTERVAL '1 day')
FROM generate_series(1, 1000) AS i
ON CONFLICT (user_id) DO UPDATE SET created_at = EXCLUDED.created_at;

-- 1-1. 마켓별 시스템 수수료 수급용 계정 등록
INSERT INTO users (user_id, email, password_hash, role, created_at) VALUES
(1001, 'sys-fee-btc-usd@javaf.net', 'SYSTEM_ACCOUNT_NO_PASSWORD', 'SYSTEM', NOW()),
(1002, 'sys-fee-ada-krw@javaf.net', 'SYSTEM_ACCOUNT_NO_PASSWORD', 'SYSTEM', NOW())
ON CONFLICT (user_id) DO NOTHING;


-- 2. 지갑 잔액 초기화 (1000명의 사용자별 10억 KRW, 10 BTC, 10만 ADA 지원)
INSERT INTO wallets (user_id, currency, balance, locked_balance)
SELECT 
    u.user_id, 
    c.currency, 
    c.initial_balance, 
    0.0
FROM users u
CROSS JOIN (
    VALUES 
        ('KRW', 1000000000.000000000000000000),
        ('BTC', 10.000000000000000000),
        ('ADA', 100000.000000000000000000),
        ('JAF', 0.000000000000000000)
) AS c(currency, initial_balance)
ON CONFLICT (user_id, currency) DO NOTHING;

-- 3. 회원별 대용량 입금 내역 랜덤 시뮬레이션 데이터 인젝션 (총 20,000건 벌크 처리)
INSERT INTO ledger_journal (user_id, currency, amount, type, reference_id, created_at)
SELECT 
    u.user_id,
    currency_choice.currency,
    CASE 
        WHEN currency_choice.currency = 'KRW' THEN floor(random() * (5000000000 - 1000000 + 1)) + 1000000
        WHEN currency_choice.currency = 'USD' THEN floor(random() * (5000000 - 1000 + 1)) + 1000
        WHEN currency_choice.currency = 'BTC' THEN round((random() * (50.0 - 0.01) + 0.01)::numeric, 8)
        ELSE round((random() * (100000.0 - 10.0) + 10.0)::numeric, 8)
    END AS amount,
    'DEPOSIT',
    NULL,
    NOW() - (floor(random() * 365) * INTERVAL '1 day') - (floor(random() * 86400) * INTERVAL '1 second')
FROM users u
CROSS JOIN generate_series(1, 20) AS g(i)
CROSS JOIN LATERAL (
    SELECT (ARRAY['KRW', 'USD', 'BTC', 'ADA'])[floor(random() * 4) + 1] AS currency
) AS currency_choice;

-- 생성된 대량의 입금 데이터에 맞추어 지갑(wallets) 테이블에 일괄 합산 및 벌크 업데이트
INSERT INTO wallets (user_id, currency, balance, locked_balance, updated_at)
SELECT 
    user_id,
    currency,
    SUM(amount) AS balance,
    0.0,
    MAX(created_at) AS updated_at
FROM ledger_journal
WHERE type = 'DEPOSIT'
GROUP BY user_id, currency
ON CONFLICT (user_id, currency) 
DO UPDATE SET 
    balance = wallets.balance + EXCLUDED.balance, 
    updated_at = GREATEST(wallets.updated_at, EXCLUDED.updated_at);

-- 4. 최근 24시간 동안의 비트코인 5만건, 에이다 5만건 고정밀 체결 시드 대량 주입 (총 10만건 체결, 20만건 주문 생성)
-- A. BTC-USD 매수 주문(Buy Orders) 5만 건 대량 주입
INSERT INTO orders (order_id, user_id, symbol, side, price, qty, remaining_qty, status, created_at)
SELECT 
    10000000 + i, -- 주문 ID 고유 범위 지정
    floor(random() * 999 + 1)::bigint, -- 임의의 회원 ID (1~1000)
    'BTC-USD',
    'BUY',
    (6500000 + floor(sin(i::double precision / 200.0) * 120000) + floor(random() * 3000))::bigint,
    floor(random() * 500 + 1)::bigint, -- 수량 랜덤 주입
    0,
    'FILLED',
    NOW() - (24.0 / 50000.0 * (50000 - i) * INTERVAL '1 hour')
FROM generate_series(1, 50000) AS i;

-- B. BTC-USD 매도 주문(Sell Orders) 5만 건 대량 주입 (체결 대상)
INSERT INTO orders (order_id, user_id, symbol, side, price, qty, remaining_qty, status, created_at)
SELECT 
    10000000 + order_id,
    (floor(random() * 999 + 1)::bigint % 1000) + 1,
    'BTC-USD',
    'SELL',
    price,
    qty,
    0,
    'FILLED',
    created_at
FROM orders
WHERE order_id BETWEEN 10000001 AND 10050000;

-- C. BTC-USD 체결 내역(Trades) 5만 건 연결 생성
INSERT INTO trades (trade_id, symbol, buy_order_id, sell_order_id, price, qty, created_at)
SELECT 
    30000000 + (order_id - 10000000),
    'BTC-USD',
    order_id,
    order_id + 10000000,
    price,
    qty,
    created_at
FROM orders
WHERE order_id BETWEEN 10000001 AND 10050000;

-- D. ADA-KRW 매수 주문 5만 건 대량 주입
INSERT INTO orders (order_id, user_id, symbol, side, price, qty, remaining_qty, status, created_at)
SELECT 
    40000000 + i,
    floor(random() * 999 + 1)::bigint,
    'ADA-KRW',
    'BUY',
    (50000 + floor(sin(i::double precision / 500.0) * 2500) + floor(random() * 150))::bigint,
    floor(random() * 10000 + 100)::bigint,
    0,
    'FILLED',
    NOW() - (24.0 / 50000.0 * (50000 - i) * INTERVAL '1 hour')
FROM generate_series(1, 50000) AS i;

-- E. ADA-KRW 매도 주문 5만 건 대량 주입
INSERT INTO orders (order_id, user_id, symbol, side, price, qty, remaining_qty, status, created_at)
SELECT 
    10000000 + order_id,
    (floor(random() * 999 + 1)::bigint % 1000) + 1,
    'ADA-KRW',
    'SELL',
    price,
    qty,
    0,
    'FILLED',
    created_at
FROM orders
WHERE order_id BETWEEN 40000001 AND 40050000;

-- F. ADA-KRW 체결 내역 5만 건 연결 생성
INSERT INTO trades (trade_id, symbol, buy_order_id, sell_order_id, price, qty, created_at)
SELECT 
    60000000 + (order_id - 40000000),
    'ADA-KRW',
    order_id,
    order_id + 10000000,
    price,
    qty,
    created_at
FROM orders
WHERE order_id BETWEEN 40000001 AND 40050000;

-- 5. 시스템 운영용 핫월렛 시드 데이터 주입
INSERT INTO system_hot_wallets (currency, crypto_address, balance) VALUES
('BTC', '1BTC_HOT_WALLET_ADDRESS_XXXXXXXX', 50.00000000) ON CONFLICT (currency) DO NOTHING;
INSERT INTO system_hot_wallets (currency, crypto_address, balance) VALUES
('ETH', '0xETH_HOT_WALLET_ADDRESS_XXXXXXXX', 1000.00000000) ON CONFLICT (currency) DO NOTHING;
INSERT INTO system_hot_wallets (currency, crypto_address, balance) VALUES
('ADA', 'addr1_ADA_HOT_WALLET_ADDRESS_XXXX', 500000.00000000) ON CONFLICT (currency) DO NOTHING;
INSERT INTO system_hot_wallets (currency, crypto_address, balance) VALUES
('JAF', '0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1', 1000000.00000000) ON CONFLICT (currency) DO NOTHING;

-- 6. 사용자 입금용 암호화폐 주소 매핑 시드 데이터 주입
INSERT INTO user_crypto_addresses (user_id, currency, crypto_address) VALUES
(1, 'BTC', '1BTC_DEPOSIT_ADDR_USER1_XXXXXXXXX') ON CONFLICT ON CONSTRAINT uq_user_crypto DO NOTHING;
INSERT INTO user_crypto_addresses (user_id, currency, crypto_address) VALUES
(1, 'ETH', '0xETH_DEPOSIT_ADDR_USER1_XXXXXXXXX') ON CONFLICT ON CONSTRAINT uq_user_crypto DO NOTHING;
INSERT INTO user_crypto_addresses (user_id, currency, crypto_address) VALUES
(1, 'ADA', 'addr1_ADA_DEPOSIT_ADDR_USER1_XXXX') ON CONFLICT ON CONSTRAINT uq_user_crypto DO NOTHING;
INSERT INTO user_crypto_addresses (user_id, currency, crypto_address) VALUES
(1, 'JAF', '0xFFcf8FDEE72ac11b5c542428B35EEF5769C409f0') ON CONFLICT ON CONSTRAINT uq_user_crypto DO NOTHING;

INSERT INTO user_crypto_addresses (user_id, currency, crypto_address) VALUES
(2, 'BTC', '1BTC_DEPOSIT_ADDR_USER2_XXXXXXXXX') ON CONFLICT ON CONSTRAINT uq_user_crypto DO NOTHING;
INSERT INTO user_crypto_addresses (user_id, currency, crypto_address) VALUES
(2, 'ETH', '0xETH_DEPOSIT_ADDR_USER2_XXXXXXXXX') ON CONFLICT ON CONSTRAINT uq_user_crypto DO NOTHING;
INSERT INTO user_crypto_addresses (user_id, currency, crypto_address) VALUES
(2, 'ADA', 'addr1_ADA_DEPOSIT_ADDR_USER2_XXXX') ON CONFLICT ON CONSTRAINT uq_user_crypto DO NOTHING;
INSERT INTO user_crypto_addresses (user_id, currency, crypto_address) VALUES
(2, 'JAF', '0x22d491Bde2303f2f43325b2108D26f1eAbA1e32b') ON CONFLICT ON CONSTRAINT uq_user_crypto DO NOTHING;

-- 7. 초기 마켓 데이터 주입
INSERT INTO markets (symbol, base_currency, quote_currency, fee_rate, price_decimals, min_amt, listing_price, status, created_by, updated_by) VALUES
('BTC-USD', 'BTC', 'USD', 0.001000, 2, 0.00010000, 6500000, 'ACTIVE', 'SYSTEM', 'SYSTEM') ON CONFLICT (symbol) DO NOTHING;
INSERT INTO markets (symbol, base_currency, quote_currency, fee_rate, price_decimals, min_amt, listing_price, status, created_by, updated_by) VALUES
('ADA-KRW', 'ADA', 'KRW', 0.001500, 2, 0.00010000, 50000, 'ACTIVE', 'SYSTEM', 'SYSTEM') ON CONFLICT (symbol) DO NOTHING;


