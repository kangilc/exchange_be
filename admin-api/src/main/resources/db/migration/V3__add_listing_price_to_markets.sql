ALTER TABLE markets ADD COLUMN listing_price BIGINT DEFAULT 0;
UPDATE markets SET listing_price = 6500000 WHERE symbol = 'BTC-USD';
UPDATE markets SET listing_price = 50000 WHERE symbol = 'ADA-KRW';
