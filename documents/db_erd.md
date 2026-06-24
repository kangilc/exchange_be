# JavaF 거래소 데이터베이스 ERD (Entity Relationship Diagram)

Flyway 마이그레이션 DDL 스키마(`V1__init_schema.sql`) 기반으로 작성된 거래소 데이터베이스 ERD 및 테이블 상세 명세입니다.

---

## 📊 1. Mermaid ERD 다이어그램

아래 다이어그램은 테이블 간의 관계(1:N, 1:1)와 주요 외래키(FK) 연동을 나타냅니다.

```mermaid
erDiagram
    users_사용자 ||--o{ wallets_지갑 : "has"
    users_사용자 ||--o{ orders_주문 : "places"
    users_사용자 ||--o{ ledger_journal_자산원장분개장 : "logs asset changes"
    users_사용자 ||--o{ user_crypto_addresses_입금주소 : "owns"
    users_사용자 ||--o{ crypto_withdrawals_출금요청 : "requests"
    
    markets_마켓설정 ||--o{ market_histories_마켓변경이력 : "logs history"
    
    orders_주문 ||--o{ trades_체결내역 : "buy_order"
    orders_주문 ||--o{ trades_체결내역 : "sell_order"

    users_사용자 {
        bigint user_id PK "사용자 고유 일련번호 (BIGSERIAL)"
        varchar email UK "이메일 주소 (아이디)"
        varchar password_hash "비밀번호 단방향 암호화 해시"
        varchar status "사용자 계정 상태 (ACTIVE, INACTIVE)"
        varchar grade "사용자 등급 (STANDARD, VIP)"
        varchar refresh_token "JWT Refresh Token (RTR 적용)"
        timestamp created_at "생성 일시"
        timestamp updated_at "수정 일시"
        varchar created_by "최초 등록자"
        varchar updated_by "최종 수정자"
    }

    wallets_지갑 {
        bigint wallet_id PK "지갑 고유 일련번호 (BIGSERIAL)"
        bigint user_id FK "사용자 고유 일련번호 (users.user_id 참조)"
        varchar currency "통화 기호 (KRW, BTC, USD, ADA)"
        numeric balance "사용 가능 잔액"
        numeric locked_balance "주문 대기/보류 잠금 잔액"
        timestamp created_at "생성 일시"
        timestamp updated_at "지갑 최종 업데이트 일시"
        varchar created_by "최초 등록자"
        varchar updated_by "최종 수정자"
    }

    orders_주문 {
        bigint order_id PK "주문 고유 ID (매칭 엔진 생성)"
        bigint user_id FK "주문 접수한 사용자 ID (users.user_id 참조)"
        varchar symbol "거래 대상 심볼 (BTC-USD, ADA-KRW)"
        varchar side "주문 방향 (BUY: 매수, SELL: 매도)"
        bigint price "주문 가격 (소수점 보존 x100 정수형)"
        bigint qty "주문 수량 (정수형)"
        bigint remaining_qty "미체결 남은 수량"
        varchar status "주문 상태 (NEW, PARTIALLY_FILLED, FILLED, CANCELLED)"
        timestamp created_at "주문 생성 일시"
        timestamp updated_at "주문 최종 업데이트 일시"
        varchar created_by "최초 등록자"
        varchar updated_by "최종 수정자"
    }

    trades_체결내역 {
        bigint trade_id PK "체결 고유 ID (매칭 엔진 생성)"
        varchar symbol "거래 대상 심볼 (BTC-USD, ADA-KRW)"
        bigint buy_order_id FK "매수 주문 ID (orders.order_id 참조)"
        bigint sell_order_id FK "매도 주문 ID (orders.order_id 참조)"
        bigint price "체결 가격 (x100 정수형)"
        bigint qty "체결 수량"
        numeric fee_rate "적용 거래 수수료율"
        numeric fee_amount "산정된 수수료 금액"
        timestamp created_at "체결 일시"
        timestamp updated_at "수정 일시"
        varchar created_by "최초 등록자"
        varchar updated_by "최종 수정자"
    }

    ledger_journal_자산원장분개장 {
        bigint journal_id PK "원장 기록 고유 일련번호 (BIGSERIAL)"
        bigint user_id FK "사용자 고유 일련번호 (users.user_id 참조)"
        varchar currency "원장 변경 대상 통화"
        numeric amount "자산 변동 수량 (부호 포함)"
        varchar type "원장 기록 유형 (DEPOSIT, WITHDRAWAL, ORDER_HOLD, TRADE_SETTLE, CANCEL_RELEASE)"
        bigint reference_id "참조 대상 ID (관련 주문 ID/체결 ID 등)"
        timestamp created_at "원장 기록 생성 일시"
        timestamp updated_at "수정 일시"
        varchar created_by "최초 등록자"
        varchar updated_by "최종 수정자"
    }

    user_crypto_addresses_입금주소 {
        bigint address_id PK "주소 고유 일련번호 (BIGSERIAL)"
        bigint user_id FK "사용자 고유 일련번호 (users.user_id 참조)"
        varchar currency "가상자산 통화 기호"
        varchar crypto_address UK "EVM 입금 지갑 주소"
        timestamp created_at "생성 일시"
        timestamp updated_at "수정 일시"
        varchar created_by "최초 등록자"
        varchar updated_by "최종 수정자"
    }

    crypto_withdrawals_출금요청 {
        bigint withdrawal_id PK "출금 고유 일련번호 (BIGSERIAL)"
        bigint user_id FK "사용자 고유 일련번호 (users.user_id 참조)"
        varchar currency "출금 대상 가상자산 통화 기호"
        numeric amount "출금 신청 수량"
        varchar to_address "출금 대상 외부 지갑 주소"
        varchar status "출금 상태 (PENDING, APPROVED, SUCCESS, FAILED 등)"
        int confirmations "블록체인 트랜잭션 컨펌 횟수"
        varchar tx_hash "트랜잭션 해시 값"
        timestamp created_at "출금 신청 일시"
        timestamp updated_at "수정 일시"
        varchar created_by "최초 등록자"
        varchar updated_by "최종 수정자"
    }

    markets_마켓설정 {
        varchar symbol PK "마켓 거래쌍 심볼 (BTC-USD, ADA-KRW)"
        varchar base_currency "기준 통화 (BTC, ADA)"
        varchar quote_currency "결제 통화 (USD, KRW)"
        numeric fee_rate "기본 수수료율"
        int price_decimals "가격 표시 소수점 자릿수 제한"
        numeric min_qty "최소 주문 수량 제한"
        varchar status "마켓 활성 상태 (ACTIVE, INACTIVE)"
        timestamp created_at "상장 및 생성 일시"
        timestamp updated_at "수정 일시"
        varchar created_by "최초 등록자"
        varchar updated_by "최종 수정자"
    }

    market_histories_마켓변경이력 {
        bigint history_id PK "이력 고유 일련번호 (BIGSERIAL)"
        varchar symbol FK "마켓 심볼 (markets.symbol 참조)"
        numeric fee_rate "변경 시점의 수수료율"
        int price_decimals "변경 시점의 소수점 자릿수"
        numeric min_qty "변경 시점의 최소 주문량"
        varchar status "변경 시점의 마켓 상태"
        timestamp created_at "변경 생성 일시"
        timestamp updated_at "수정 일시"
        varchar created_by "최초 등록자"
        varchar updated_by "최종 수정자"
    }

    system_hot_wallets_시스템핫월렛 {
        bigint wallet_id PK "핫월렛 고유 일련번호 (BIGSERIAL)"
        varchar currency UK "통화 기호 (가상자산)"
        varchar crypto_address "시스템 공용 핫월렛 주소"
        numeric balance "핫월렛 잔액"
        timestamp created_at "생성 일시"
        timestamp updated_at "수정 일시"
        varchar created_by "최초 등록자"
        varchar updated_by "최종 수정자"
    }
```

---

## 🗂️ 2. 테이블별 주요 역할 명세

1. **`users` (사용자 테이블)**: 회원 정보를 관리하며 로그인 및 JWT/RTR(Refresh Token Rotation) 인증 세션의 루트가 됩니다.
2. **`wallets` (자산 지갑 테이블)**: 회원의 자산별(KRW, BTC 등) 사용 가능 잔액(`balance`) 및 주문 대기용 잠금 잔액(`locked_balance`) 상태를 저장합니다.
3. **`orders` (주문 원장 테이블)**: 매칭 엔진에서 생성되어 접수된 주문 내역 및 진행 상태를 기록합니다. 가격과 수량은 오차를 없애기 위해 정수 스케일링 상태로 유지됩니다.
4. **`trades` (체결 내역 테이블)**: 매칭 엔진이 실시간으로 체결시킨 매수/매도 주문 쌍의 거래 결과 및 거래 수수료 내역을 기록합니다.
5. **`ledger_journal` (자산 변경 이력 분개장)**: 입출금, 체결 정산, 주문 보류 등 회원의 모든 자산 잔액 변동 내역을 double-entry 원장 기록 형태로 추적하여 신뢰성을 확보합니다.
6. **`user_crypto_addresses` (입금 주소 매핑)**: 입금을 처리하기 위해 회원별, 가상자산별 매핑된 로컬 EVM(Ganache) 생성 지갑 주소를 보관합니다.
7. **`crypto_withdrawals` (출금 요청 내역)**: 회원의 블록체인 자산 출금 요청 상태 및 블록체인 검증 상태(컨펌 횟수, 트랜잭션 해시 등)를 트래킹합니다.
8. **`system_hot_wallets` (시스템 핫월렛)**: 거래소의 블록체인 네트워크 입출금을 중계하고 가스비를 지불하기 위한 공용 핫월렛 상태를 보관합니다.
9. **`markets` / `market_histories` (마켓 정책 및 이력)**: 거래 가능한 마켓 쌍과 기본 수수료율, 소수점 처리 등 제어 속성을 담고 있으며 변경 시 이력이 아카이빙됩니다.
