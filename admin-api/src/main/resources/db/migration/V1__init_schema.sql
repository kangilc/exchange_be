-- 0-0. 공통 코드 관리 테이블 (Common Codes)
CREATE TABLE IF NOT EXISTS code_groups (
    group_code VARCHAR(50) PRIMARY KEY,
    group_name VARCHAR(100) NOT NULL,
    description VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100),
    updated_by VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS common_codes (
    group_code VARCHAR(50) NOT NULL REFERENCES code_groups(group_code) ON DELETE CASCADE,
    code_value VARCHAR(50) NOT NULL,
    code_name VARCHAR(100) NOT NULL,
    description VARCHAR(255),
    display_order INT DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100),
    updated_by VARCHAR(100),
    PRIMARY KEY (group_code, code_value)
);

COMMENT ON TABLE code_groups IS '공통 코드 그룹 테이블';
COMMENT ON COLUMN code_groups.group_code IS '그룹 코드 식별자';
COMMENT ON COLUMN code_groups.group_name IS '그룹 코드명';
COMMENT ON COLUMN code_groups.description IS '그룹 코드 설명';

COMMENT ON TABLE common_codes IS '공통 세부 코드 테이블';
COMMENT ON COLUMN common_codes.group_code IS '그룹 코드 식별자 (code_groups.group_code 참조)';
COMMENT ON COLUMN common_codes.code_value IS '세부 코드값';
COMMENT ON COLUMN common_codes.code_name IS '세부 코드명';
COMMENT ON COLUMN common_codes.description IS '세부 코드 설명';
COMMENT ON COLUMN common_codes.display_order IS '화면 표시 순서';
COMMENT ON COLUMN common_codes.is_active IS '사용 여부 활성화 상태';


-- 0. 마켓 메타데이터 테이블 (Markets Settings)
CREATE TABLE IF NOT EXISTS markets (
    symbol VARCHAR(20) PRIMARY KEY,
    base_currency VARCHAR(10) NOT NULL,
    quote_currency VARCHAR(10) NOT NULL,
    fee_rate NUMERIC(10, 6) NOT NULL DEFAULT 0.001000, -- 수수료율 (기본 0.1%)
    price_decimals INT DEFAULT 2,
    min_amt NUMERIC(20, 8) DEFAULT 0.0001, -- 최소 주문 금액 (min_qty에서 컬럼명 변경)
    listing_price BIGINT DEFAULT 0, -- 상장 기준 가격 추가
    status VARCHAR(20) DEFAULT 'ACTIVE',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100),
    updated_by VARCHAR(100)
);


-- 0-1. 마켓 변경 이력 테이블 (Markets Modification History)
CREATE TABLE IF NOT EXISTS market_histories (
    history_id BIGSERIAL PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL, -- 물리 FK 제거 (markets.symbol 논리 참조)
    fee_rate NUMERIC(10, 6) NOT NULL,
    price_decimals INT NOT NULL,
    min_amt NUMERIC(20, 8) NOT NULL, -- min_qty에서 컬럼명 변경
    status VARCHAR(20) NOT NULL,
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
    role VARCHAR(20) DEFAULT 'USER', -- 사용자 역할 구분 (USER, SYSTEM)
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100),
    updated_by VARCHAR(100)
);

-- 2. 자산 지갑 테이블 (Wallets)
CREATE TABLE IF NOT EXISTS wallets (
    wallet_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL, -- 물리 FK 제거 (users.user_id 논리 참조)
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
    user_id BIGINT NOT NULL, -- 물리 FK 제거 (users.user_id 논리 참조)
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
    buy_order_id BIGINT NOT NULL, -- 물리 FK 제거 (orders.order_id 논리 참조)
    sell_order_id BIGINT NOT NULL, -- 물리 FK 제거 (orders.order_id 논리 참조)
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
    user_id BIGINT NOT NULL, -- 물리 FK 제거 (users.user_id 논리 참조)
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
    user_id BIGINT NOT NULL, -- 물리 FK 제거 (users.user_id 논리 참조)
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
    user_id BIGINT NOT NULL, -- 물리 FK 제거 (users.user_id 논리 참조)
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
COMMENT ON COLUMN users.role IS '사용자 역할 구분 (USER, SYSTEM)';
COMMENT ON COLUMN users.created_at IS '사용자 가입 및 생성 일시';

COMMENT ON TABLE wallets IS '자산 지갑 테이블';
COMMENT ON COLUMN wallets.wallet_id IS '지갑 고유 일련번호';
COMMENT ON COLUMN wallets.user_id IS '사용자 고유 일련번호 (users.user_id 논리 참조)';
COMMENT ON COLUMN wallets.currency IS '통화 기호 (예: KRW, BTC, USD, ADA)';
COMMENT ON COLUMN wallets.balance IS '사용 가능 잔액';
COMMENT ON COLUMN wallets.locked_balance IS '거래 등으로 잠긴 거래 대기/보류 잔액';
COMMENT ON COLUMN wallets.updated_at IS '지갑 최종 업데이트 일시';

COMMENT ON TABLE orders IS '주문 원장 테이블';
COMMENT ON COLUMN orders.order_id IS '주문 고유 ID';
COMMENT ON COLUMN orders.user_id IS '주문을 접수한 사용자 고유 일련번호 (users.user_id 논리 참조)';
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
COMMENT ON COLUMN trades.buy_order_id IS '매수 주문 ID (orders.order_id 논리 참조)';
COMMENT ON COLUMN trades.sell_order_id IS '매도 주문 ID (orders.order_id 논리 참조)';
COMMENT ON COLUMN trades.price IS '체결 가격';
COMMENT ON COLUMN trades.qty IS '체결 수량';
COMMENT ON COLUMN trades.created_at IS '체결 일시';

COMMENT ON TABLE ledger_journal IS '자산 변경 이력 (원장 분개장)';
COMMENT ON COLUMN ledger_journal.journal_id IS '원장 기록 고유 일련번호';
COMMENT ON COLUMN ledger_journal.user_id IS '사용자 고유 일련번호 (users.user_id 논리 참조)';
COMMENT ON COLUMN ledger_journal.currency IS '원장 변경 대상 통화';
COMMENT ON COLUMN ledger_journal.amount IS '자산 변경 수량 (부호에 따라 입/출금 등 판단)';
COMMENT ON COLUMN ledger_journal.type IS '자산 변경 유형 (DEPOSIT, WITHDRAWAL, ORDER_HOLD, TRADE_SETTLE, CANCEL_RELEASE)';
COMMENT ON COLUMN ledger_journal.reference_id IS '참조 ID (관련 주문 ID 또는 체결 ID 등)';
COMMENT ON COLUMN ledger_journal.created_at IS '원장 기록 생성 일시';

COMMENT ON TABLE markets IS '마켓 메타데이터 테이블';
COMMENT ON COLUMN markets.symbol IS '마켓 거래쌍 심볼';
COMMENT ON COLUMN markets.base_currency IS '기준 통화 (BTC, ADA 등)';
COMMENT ON COLUMN markets.quote_currency IS '결제 통화 (USD, KRW 등)';
COMMENT ON COLUMN markets.fee_rate IS '마켓 수수료율';
COMMENT ON COLUMN markets.price_decimals IS '가격 표시 소수점 자릿수';
COMMENT ON COLUMN markets.min_amt IS '최소 주문 금액';
COMMENT ON COLUMN markets.listing_price IS '상장 기준 가격';
COMMENT ON COLUMN markets.status IS '마켓 활성 상태';

COMMENT ON TABLE market_histories IS '마켓 변경 이력 테이블';
COMMENT ON COLUMN market_histories.history_id IS '이력 고유 일련번호';
COMMENT ON COLUMN market_histories.symbol IS '마켓 심볼 (markets.symbol 논리 참조)';
COMMENT ON COLUMN market_histories.fee_rate IS '변경 시점의 수수료율';
COMMENT ON COLUMN market_histories.price_decimals IS '변경 시점의 소수점 자릿수';
COMMENT ON COLUMN market_histories.min_amt IS '변경 시점의 최소 주문금액';
COMMENT ON COLUMN market_histories.status IS '변경 시점의 마켓 상태';

COMMENT ON TABLE user_crypto_addresses IS '사용자 가상자산 주소 매핑 테이블';
COMMENT ON COLUMN user_crypto_addresses.address_id IS '주소 ID 고유 번호';
COMMENT ON COLUMN user_crypto_addresses.user_id IS '사용자 고유 일련번호 (users.user_id 논리 참조)';
COMMENT ON COLUMN user_crypto_addresses.currency IS '가상자산 통화 기호';
COMMENT ON COLUMN user_crypto_addresses.crypto_address IS '가상자산 지갑 주소';

COMMENT ON TABLE crypto_withdrawals IS '암호화자산 출금 요청 내역 테이블';
COMMENT ON COLUMN crypto_withdrawals.withdrawal_id IS '출금 고유 ID';
COMMENT ON COLUMN crypto_withdrawals.user_id IS '사용자 고유 일련번호 (users.user_id 논리 참조)';
COMMENT ON COLUMN crypto_withdrawals.currency IS '출금 통화 기호';
COMMENT ON COLUMN crypto_withdrawals.amount IS '출금 신청 수량';
COMMENT ON COLUMN crypto_withdrawals.to_address IS '수신 대상 외부 지갑 주소';
COMMENT ON COLUMN crypto_withdrawals.status IS '출금 상태 (PENDING, APPROVED, REJECTED, 등)';
COMMENT ON COLUMN crypto_withdrawals.confirmations IS '블록체인 컨펌 수';
COMMENT ON COLUMN crypto_withdrawals.tx_hash IS '출금 트랜잭션 해시';

COMMENT ON TABLE system_hot_wallets IS '거래소 시스템 핫월렛 관리 테이블';
COMMENT ON COLUMN system_hot_wallets.wallet_id IS '핫월렛 고유 ID';
COMMENT ON COLUMN system_hot_wallets.currency IS '지원 가상자산 통화 기호';
COMMENT ON COLUMN system_hot_wallets.crypto_address IS '핫월렛 지갑 주소';
COMMENT ON COLUMN system_hot_wallets.balance IS '핫월렛 잔액';

-- 5-1. 데이터 조회 성능 최적화를 위한 B-Tree 인덱스 구성 (Paging & Search)
-- 원장 조회 최적화 (유형 및 시간순)
CREATE INDEX IF NOT EXISTS idx_ledger_journal_type_created_at ON ledger_journal(type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_journal_user_type_created_at ON ledger_journal(user_id, type, created_at DESC);
-- 회원별 특정 자산의 원장 변경 히스토리 조회 최적화
CREATE INDEX IF NOT EXISTS idx_ledger_journal_user_currency_created_at ON ledger_journal(user_id, currency, created_at DESC);

-- 체결 내역 조회 최적화 (마켓별 최근 체결 및 차트 데이터 생성용)
CREATE INDEX IF NOT EXISTS idx_trades_symbol_created_at ON trades(symbol, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trades_created_at ON trades(created_at DESC);
-- 논리적 관계 검색 최적화를 위한 인덱스 (기존 외래키 인덱스 유지)
CREATE INDEX IF NOT EXISTS idx_trades_buy_order_id ON trades(buy_order_id);
CREATE INDEX IF NOT EXISTS idx_trades_sell_order_id ON trades(sell_order_id);

-- 사용자 주문 내역 및 정렬 최적화
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_user_symbol_created_at ON orders(user_id, symbol, created_at DESC);
-- 매칭 엔진 호가 스캔 및 주문서(Order Book) 최적화 (활성 주문 전용 부분 인덱스)
CREATE INDEX IF NOT EXISTS idx_orders_active_book 
ON orders (symbol, side, price, created_at) 
WHERE status IN ('NEW', 'PARTIALLY_FILLED');

-- 출금 내역 조회 최적화 (회원별 최근 출금 신청 내역 조회용)
CREATE INDEX IF NOT EXISTS idx_crypto_withdrawals_user_created_at ON crypto_withdrawals(user_id, created_at DESC);

-- 마켓 설정 변경 이력 조회 최적화
CREATE INDEX IF NOT EXISTS idx_market_histories_symbol ON market_histories(symbol);

-- 공통 코드 그룹별 정렬 조회 최적화 (그룹 내 정렬 순서 보장)
CREATE INDEX IF NOT EXISTS idx_common_codes_group_display ON common_codes(group_code, display_order);

