-- PostgreSQL 거래소 데이터 스키마 초기화 스크립트

-- 1. 사용자 테이블 (Users)
CREATE TABLE IF NOT EXISTS users (
    user_id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    status VARCHAR(20) DEFAULT 'ACTIVE',
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

-- 초기 시드 데이터 인젝션
-- 비밀번호 해시는 단순 'password123' 가정
INSERT INTO users (user_id, email, password_hash)
VALUES 
(1, 'user1@exchange.com', '$2a$10$eImiTXuWVxfM37uY4JANjO'),
(2, 'user2@exchange.com', '$2a$10$eImiTXuWVxfM37uY4JANjO'),
(3, 'user3@exchange.com', '$2a$10$eImiTXuWVxfM37uY4JANjO')
ON CONFLICT (user_id) DO NOTHING;

-- 지갑 잔액 초기화 (사용자별 10억 KRW, 10 BTC, 10만 ADA 지원)
INSERT INTO wallets (user_id, currency, balance, locked_balance)
VALUES
(1, 'KRW', 1000000000.000000000000000000, 0.0),
(1, 'BTC', 10.000000000000000000, 0.0),
(1, 'ADA', 100000.000000000000000000, 0.0),
(2, 'KRW', 1000000000.000000000000000000, 0.0),
(2, 'BTC', 10.000000000000000000, 0.0),
(2, 'ADA', 100000.000000000000000000, 0.0),
(3, 'KRW', 1000000000.000000000000000000, 0.0),
(3, 'BTC', 10.000000000000000000, 0.0),
(3, 'ADA', 100000.000000000000000000, 0.0)
ON CONFLICT (user_id, currency) DO NOTHING;
