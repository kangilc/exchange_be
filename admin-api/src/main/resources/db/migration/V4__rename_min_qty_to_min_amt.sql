-- 1. markets 테이블 컬럼명 변경 및 코멘트 수정
ALTER TABLE markets RENAME COLUMN min_qty TO min_amt;
COMMENT ON COLUMN markets.min_amt IS '최소 주문 금액';

-- 2. market_histories 테이블 컬럼명 변경 및 코멘트 수정
ALTER TABLE market_histories RENAME COLUMN min_qty TO min_amt;
COMMENT ON COLUMN market_histories.min_amt IS '변경 시점의 최소 주문금액';
