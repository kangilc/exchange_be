-- =========================================================================
-- Flyway DB Seed Data Migration (DML 전용)
-- =========================================================================

-- 1. 초기 시드 회원 데이터 인젝션 (1000명의 사용자 자동 생성 및 최근 1년 동안 균등 분산)
INSERT INTO users (user_id, email, password_hash, created_at)
SELECT 
    i, 
    'user' || i || '@exchange.com', 
    '$2a$10$eImiTXuWVxfM37uY4JANjO',
    NOW() - (i * (365.0 / 1000.0) * INTERVAL '1 day')
FROM generate_series(1, 1000) AS i
ON CONFLICT (user_id) DO UPDATE SET created_at = EXCLUDED.created_at;

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
