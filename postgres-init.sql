-- PostgreSQL 거래소 데이터 스키마 초기화 스크립트

-- 1. 사용자 테이블 (Users)
CREATE TABLE IF NOT EXISTS users (
    user_id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    grade VARCHAR(20) DEFAULT 'STANDARD',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. 자산 지갑 테이블 (Wallets)
CREATE TABLE IF NOT EXISTS wallets (
    wallet_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    currency VARCHAR(10) NOT NULL,
    balance NUMERIC(36, 18) NOT NULL DEFAULT 0.0,
    locked_balance NUMERIC(36, 18) NOT NULL DEFAULT 0.0,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_user_currency UNIQUE (user_id, currency)
);

-- 3. 주문 원장 테이블 (Orders)
CREATE TABLE IF NOT EXISTS orders (
    order_id BIGINT PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    symbol VARCHAR(20) NOT NULL,
    side VARCHAR(10) NOT NULL,
    price BIGINT NOT NULL,
    qty BIGINT NOT NULL,
    remaining_qty BIGINT NOT NULL,
    status VARCHAR(20) NOT NULL, -- 'NEW', 'PARTIALLY_FILLED', 'FILLED', 'CANCELLED'
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. 체결 내역 테이블 (Trades)
CREATE TABLE IF NOT EXISTS trades (
    trade_id BIGINT PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL,
    buy_order_id BIGINT NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
    sell_order_id BIGINT NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
    price BIGINT NOT NULL,
    qty BIGINT NOT NULL,
    executed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5. 자산 변경 이력 (Ledger Journal)
CREATE TABLE IF NOT EXISTS ledger_journal (
    journal_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    currency VARCHAR(10) NOT NULL,
    amount NUMERIC(36, 18) NOT NULL,
    type VARCHAR(30) NOT NULL, -- 'DEPOSIT', 'WITHDRAWAL', 'ORDER_HOLD', 'TRADE_SETTLE', 'CANCEL_RELEASE'
    reference_id BIGINT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 초기 시드 데이터 인젝션 (1000명의 사용자 자동 생성 및 최근 1년 동안 균등 분산)
-- 비밀번호 해시는 단순 'password123' 가정
INSERT INTO users (user_id, email, password_hash, created_at)
SELECT 
    i, 
    'user' || i || '@exchange.com', 
    '$2a$10$eImiTXuWVxfM37uY4JANjO',
    NOW() - (i * (365.0 / 1000.0) * INTERVAL '1 day')
FROM generate_series(1, 1000) AS i
ON CONFLICT (user_id) DO UPDATE SET created_at = EXCLUDED.created_at;


-- 지갑 잔액 초기화 (1000명의 사용자별 10억 KRW, 10 BTC, 10만 ADA 지원)
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
        ('ADA', 100000.000000000000000000)
) AS c(currency, initial_balance)
ON CONFLICT (user_id, currency) DO NOTHING;


-- 5-1. 데이터 조회 성능 최적화를 위한 B-Tree 인덱스 구성 (Paging & Search)
CREATE INDEX IF NOT EXISTS idx_ledger_journal_type_created_at ON ledger_journal(type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_journal_user_type_created_at ON ledger_journal(user_id, type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trades_executed_at ON trades(executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);


-- 6. 회원별 대용량 입금 내역 랜덤 시뮬레이션 데이터 인젝션
-- 각 회원별(1~1000명) 최근 1년 동안 최소 1번에서 최대 100번까지 다양한 금액(100만원 ~ 50억원 상당)으로 입금 감사 로그 및 지갑 잔고 추가
DO $$
DECLARE
    user_rec RECORD;
    num_deposits INT;
    currency_choices TEXT[] := ARRAY['KRW', 'USD', 'BTC', 'ADA'];
    selected_currency TEXT;
    dep_amount NUMERIC(36, 18);
    random_days INT;
    random_secs INT;
    dep_date TIMESTAMP;
BEGIN
    -- Loop through all users
    FOR user_rec IN SELECT user_id FROM users LOOP
        -- Random number of deposits between 1 and 100
        num_deposits := floor(random() * 100) + 1;
        
        FOR i IN 1..num_deposits LOOP
            -- Random currency
            selected_currency := currency_choices[floor(random() * 4) + 1];
            
            -- Random amount based on currency
            IF selected_currency = 'KRW' THEN
                -- Random between 1,000,000 (100만원) and 5,000,000,000 (50억원)
                dep_amount := floor(random() * (5000000000 - 1000000 + 1)) + 1000000;
            ELSIF selected_currency = 'USD' THEN
                -- Random between 1,000 and 5,000,000
                dep_amount := floor(random() * (5000000 - 1000 + 1)) + 1000;
            ELSIF selected_currency = 'BTC' THEN
                -- Random between 0.01 and 50.00
                dep_amount := round((random() * (50.0 - 0.01) + 0.01)::numeric, 8);
            ELSE
                -- ADA
                dep_amount := round((random() * (100000.0 - 10.0) + 10.0)::numeric, 8);
            END IF;
            
            -- Random date over the last 1 year (365 days)
            random_days := floor(random() * 365);
            random_secs := floor(random() * 86400);
            dep_date := NOW() - (random_days * INTERVAL '1 day') - (random_secs * INTERVAL '1 second');
            
            -- Insert into ledger_journal
            INSERT INTO ledger_journal (user_id, currency, amount, type, reference_id, created_at)
            VALUES (user_rec.user_id, selected_currency, dep_amount, 'DEPOSIT', NULL, dep_date);
            
            -- Update or insert wallet balance
            INSERT INTO wallets (user_id, currency, balance, locked_balance, updated_at)
            VALUES (user_rec.user_id, selected_currency, dep_amount, 0.0, dep_date)
            ON CONFLICT (user_id, currency) 
            DO UPDATE SET balance = wallets.balance + EXCLUDED.balance, updated_at = EXCLUDED.updated_at;
            
        END LOOP;
    END LOOP;
END $$;


-- 7. 최근 24시간 동안의 비트코인 5만건, 에이다 5만건 고정밀 체결 시드 대량 주입 (총 10만건 체결, 20만건 주문 생성)
-- 한글 주석을 자세히 추가하여 정밀한 난수 발생 및 집계 규칙을 가시화했습니다.

-- A. BTC-USD 매수 주문(Buy Orders) 5만 건 대량 주입
INSERT INTO orders (order_id, user_id, symbol, side, price, qty, remaining_qty, status, created_at)
SELECT 
    10000000 + i, -- 주문 ID 고유 범위 지정
    floor(random() * 999 + 1)::bigint, -- 임의의 회원 ID (1~1000)
    'BTC-USD',
    'BUY',
    -- 삼각함수(sin)를 융합하여 부드럽고 자연스러운 금융 시세의 파동(Wave)과 노이즈 변동성을 정밀 설계합니다.
    (6500000 + floor(sin(i::double precision / 200.0) * 120000) + floor(random() * 3000))::bigint,
    floor(random() * 500 + 1)::bigint, -- 수량 랜덤 주입
    0,
    'FILLED',
    -- 최근 24시간 전부터 현재까지 5만 건을 시간순으로 매우 정밀하게 등분 배치
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
INSERT INTO trades (trade_id, symbol, buy_order_id, sell_order_id, price, qty, executed_at)
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
INSERT INTO trades (trade_id, symbol, buy_order_id, sell_order_id, price, qty, executed_at)
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




