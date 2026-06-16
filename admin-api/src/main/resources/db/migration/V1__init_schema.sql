-- 0. 마켓 메타데이터 테이블 (Markets Settings)
CREATE TABLE IF NOT EXISTS markets (
    symbol VARCHAR(20) PRIMARY KEY,
    base_currency VARCHAR(10) NOT NULL,
    quote_currency VARCHAR(10) NOT NULL,
    fee_rate NUMERIC(10, 6) NOT NULL DEFAULT 0.001000, -- 수수료율 (기본 0.1%)
    price_decimals INT DEFAULT 2,
    min_qty NUMERIC(20, 8) DEFAULT 0.0001,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100),
    updated_by VARCHAR(100)
);


-- 1. 사용자 테이블 (Users)
CREATE TABLE IF NOT EXISTS users (
    user_id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    grade VARCHAR(20) DEFAULT 'STANDARD',
    refresh_token VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100),
    updated_by VARCHAR(100)
);

-- 2. 자산 지갑 테이블 (Wallets)
CREATE TABLE IF NOT EXISTS wallets (
    wallet_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    currency VARCHAR(10) NOT NULL,
    balance NUMERIC(36, 18) NOT NULL DEFAULT 0.0,
    locked_balance NUMERIC(36, 18) NOT NULL DEFAULT 0.0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100),
    updated_by VARCHAR(100),
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
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100),
    updated_by VARCHAR(100)
);

-- 4. 체결 내역 테이블 (Trades)
CREATE TABLE IF NOT EXISTS trades (
    trade_id BIGINT PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL,
    buy_order_id BIGINT NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
    sell_order_id BIGINT NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
    price BIGINT NOT NULL,
    qty BIGINT NOT NULL,
    fee_rate NUMERIC(10, 6) DEFAULT 0.0,
    fee_amount NUMERIC(36, 18) DEFAULT 0.0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100),
    updated_by VARCHAR(100)
);

-- 5. 자산 변경 이력 (Ledger Journal)
CREATE TABLE IF NOT EXISTS ledger_journal (
    journal_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    currency VARCHAR(10) NOT NULL,
    amount NUMERIC(36, 18) NOT NULL,
    type VARCHAR(30) NOT NULL, -- 'DEPOSIT', 'WITHDRAWAL', 'ORDER_HOLD', 'TRADE_SETTLE', 'CANCEL_RELEASE'
    reference_id BIGINT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100),
    updated_by VARCHAR(100)
);

-- 6. 사용자 지갑 입금용 암호화 주소 매핑 테이블
CREATE TABLE IF NOT EXISTS user_crypto_addresses (
    address_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    currency VARCHAR(10) NOT NULL,
    crypto_address VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100),
    updated_by VARCHAR(100),
    CONSTRAINT uq_user_crypto UNIQUE (user_id, currency)
);

-- 7. 암호화 자산 출금 요청 내역 관리 테이블
CREATE TABLE IF NOT EXISTS crypto_withdrawals (
    withdrawal_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    currency VARCHAR(10) NOT NULL,
    amount NUMERIC(36, 18) NOT NULL,
    to_address VARCHAR(100) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'APPROVED', 'REJECTED', 'BROADCASTED', 'SUCCESS', 'FAILED'
    confirmations INT NOT NULL DEFAULT 0,
    tx_hash VARCHAR(100),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100),
    updated_by VARCHAR(100)
);

-- 8. 거래소 시스템 운영용 핫월렛 주소 및 잔액 원장 관리 테이블
CREATE TABLE IF NOT EXISTS system_hot_wallets (
    wallet_id BIGSERIAL PRIMARY KEY,
    currency VARCHAR(10) NOT NULL UNIQUE,
    crypto_address VARCHAR(100) NOT NULL,
    balance NUMERIC(36, 18) NOT NULL DEFAULT 0.0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100),
    updated_by VARCHAR(100)
);

-- 테이블 및 컬럼 코멘트(COMMENT) 설정
COMMENT ON TABLE users IS '사용자 테이블';
COMMENT ON COLUMN users.user_id IS '사용자 고유 일련번호';
COMMENT ON COLUMN users.email IS '사용자 이메일 주소';
COMMENT ON COLUMN users.password_hash IS '비밀번호 단방향 암호화 해시';
COMMENT ON COLUMN users.status IS '사용자 상태 (ACTIVE, INACTIVE 등)';
COMMENT ON COLUMN users.grade IS '사용자 등급 (STANDARD, VIP 등)';
COMMENT ON COLUMN users.created_at IS '사용자 가입 및 생성 일시';

COMMENT ON TABLE wallets IS '자산 지갑 테이블';
COMMENT ON COLUMN wallets.wallet_id IS '지갑 고유 일련번호';
COMMENT ON COLUMN wallets.user_id IS '사용자 고유 일련번호 (users.user_id 참조)';
COMMENT ON COLUMN wallets.currency IS '통화 기호 (예: KRW, BTC, USD, ADA)';
COMMENT ON COLUMN wallets.balance IS '사용 가능 잔액';
COMMENT ON COLUMN wallets.locked_balance IS '거래 등으로 잠긴 거래 대기/보류 잔액';
COMMENT ON COLUMN wallets.updated_at IS '지갑 최종 업데이트 일시';

COMMENT ON TABLE orders IS '주문 원장 테이블';
COMMENT ON COLUMN orders.order_id IS '주문 고유 ID';
COMMENT ON COLUMN orders.user_id IS '주문을 접수한 사용자 고유 일련번호 (users.user_id 참조)';
COMMENT ON COLUMN orders.symbol IS '거래 쌍 심볼 (예: BTC-USD, ADA-KRW)';
COMMENT ON COLUMN orders.side IS '주문 방향 (BUY: 매수, SELL: 매도)';
COMMENT ON COLUMN orders.price IS '주문 가격 (정수형)';
COMMENT ON COLUMN orders.qty IS '주문 수량';
COMMENT ON COLUMN orders.remaining_qty IS '미체결 남은 수량';
COMMENT ON COLUMN orders.status IS '주문 상태 (NEW, PARTIALLY_FILLED, FILLED, CANCELLED)';
COMMENT ON COLUMN orders.created_at IS '주문 생성 일시';

COMMENT ON TABLE trades IS '체결 내역 테이블';
COMMENT ON COLUMN trades.trade_id IS '체결 고유 ID';
COMMENT ON COLUMN trades.symbol IS '거래 쌍 심볼 (예: BTC-USD, ADA-KRW)';
COMMENT ON COLUMN trades.buy_order_id IS '매수 주문 ID (orders.order_id 참조)';
COMMENT ON COLUMN trades.sell_order_id IS '매도 주문 ID (orders.order_id 참조)';
COMMENT ON COLUMN trades.price IS '체결 가격';
COMMENT ON COLUMN trades.qty IS '체결 수량';
COMMENT ON COLUMN trades.created_at IS '체결 일시';

COMMENT ON TABLE ledger_journal IS '자산 변경 이력 (원장 분개장)';
COMMENT ON COLUMN ledger_journal.journal_id IS '원장 기록 고유 일련번호';
COMMENT ON COLUMN ledger_journal.user_id IS '사용자 고유 일련번호 (users.user_id 참조)';
COMMENT ON COLUMN ledger_journal.currency IS '원장 변경 대상 통화';
COMMENT ON COLUMN ledger_journal.amount IS '자산 변경 수량 (부호에 따라 입/출금 등 판단)';
COMMENT ON COLUMN ledger_journal.type IS '자산 변경 유형 (DEPOSIT, WITHDRAWAL, ORDER_HOLD, TRADE_SETTLE, CANCEL_RELEASE)';
COMMENT ON COLUMN ledger_journal.reference_id IS '참조 ID (관련 주문 ID 또는 체결 ID 등)';
COMMENT ON COLUMN ledger_journal.created_at IS '원장 기록 생성 일시';

-- 5-1. 데이터 조회 성능 최적화를 위한 B-Tree 인덱스 구성 (Paging & Search)
-- 원장 조회 최적화 (유형 및 시간순)
CREATE INDEX IF NOT EXISTS idx_ledger_journal_type_created_at ON ledger_journal(type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_journal_user_type_created_at ON ledger_journal(user_id, type, created_at DESC);
-- 회원별 특정 자산의 원장 변경 히스토리 조회 최적화
CREATE INDEX IF NOT EXISTS idx_ledger_journal_user_currency_created_at ON ledger_journal(user_id, currency, created_at DESC);

-- 체결 내역 조회 최적화 (마켓별 최근 체결 및 차트 데이터 생성용)
CREATE INDEX IF NOT EXISTS idx_trades_symbol_created_at ON trades(symbol, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trades_created_at ON trades(created_at DESC);
-- 주문 삭제 시 CASCADE Sequential Scan 성능 저하 방지를 위한 외래키(FK) 인덱스
CREATE INDEX IF NOT EXISTS idx_trades_buy_order_id ON trades(buy_order_id);
CREATE INDEX IF NOT EXISTS idx_trades_sell_order_id ON trades(sell_order_id);

-- 사용자 주문 내역 및 정렬 최적화
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_user_symbol_created_at ON orders(user_id, symbol, created_at DESC);
-- 매칭 엔진 호가 스캔 및 주문서(Order Book) 최적화 (활성 주문 전용 부분 인덱스)
CREATE INDEX IF NOT EXISTS idx_orders_active_book 
ON orders (symbol, side, price, created_at) 
WHERE status IN ('NEW', 'PARTIALLY_FILLED');
