# 동적 마켓 온보딩 및 메타데이터 기반 아키텍처 구현 계획서 (Dynamic Market Onboarding)

신규 코인 및 거래쌍(마켓) 추가 시, 기존 하드코딩된 정적 구조를 탈피하고 어드민 콘솔에서 무중단으로 상장 및 가동이 가능하도록 하는 **동적 마켓 온보딩 및 메타데이터 기반 아키텍처(Dynamic Market Onboarding)**를 구축하는 계획이다.

---

## Proposed Changes

### 1. Database Schema
* **`market_fees` 테이블 폐지 및 `markets` 테이블 통합**:
  기존의 `market_fees` 수수료율 설정 테이블을 없애고, 신규 생성할 `markets` 테이블에 수수료율(`fee_rate`)을 통합하여 함께 관리한다.
  ```sql
  CREATE TABLE IF NOT EXISTS markets (
      symbol VARCHAR(20) PRIMARY KEY,
      base_currency VARCHAR(10) NOT NULL,
      quote_currency VARCHAR(10) NOT NULL,
      fee_rate NUMERIC(10, 6) NOT NULL DEFAULT 0.001000, -- 수수료율 설정 통합
      price_decimals INT DEFAULT 2,
      min_qty NUMERIC(20, 8) DEFAULT 0.0001,
      status VARCHAR(20) DEFAULT 'ACTIVE',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  ```
* [MODIFY] [V1__init_schema.sql](file:///home/administrator/exchange_be/admin-api/src/main/resources/db/migration/V1__init_schema.sql):
  `market_fees` 테이블 생성 구문을 제거하고 `markets` 테이블 생성 구문으로 교체한다.
* **지갑 동적 생성 지원**: 지갑이 필요해지는 시점에 지갑 레코드를 자동 생성할 수 있도록 `INSERT ... ON CONFLICT DO NOTHING` 처리를 강화한다.

### 2. User & Admin Frontend (UI)
* **API 기반 동적 렌더링**: 프론트엔드의 하드코딩된 마켓 리스트를 제거하고, 백엔드의 `/api/markets` API 호출 결과를 기반으로 거래 탭, 호가창(Order Book), 주문 콘솔, 차트를 동적으로 렌더링한다.

### 3. Backend (admin-api)
* [MODIFY] [AdminApiApplication.java](file:///home/administrator/exchange_be/admin-api/src/main/java/exchange/admin/AdminApiApplication.java):
  초기 데이터 검사 쿼리를 `SELECT symbol, fee_rate FROM market_fees`에서 `SELECT symbol, fee_rate FROM markets`로 수정한다.
* [MODIFY] [SettingsController.java](file:///home/administrator/exchange_be/admin-api/src/main/java/exchange/admin/controller/SettingsController.java):
  수수료율 설정 등록/수정 쿼리를 `market_fees` 테이블 대신 `markets` 테이블 대상 쿼리로 수정한다.
* **마켓 및 수수료 관리 API**: 신규 마켓 추가, 상장 상태 제어, 수수료율 수정을 처리하는 REST API를 개발한다.
* **Lazy Wallet Initialization**: 입금 요청 및 체결 완료 처리 시 지갑 미존재 시 자동 생성하는 공통 유틸리티를 적용한다.
* **카프카 라우팅 단일화**: 마켓별 토픽 대신 단일 토픽(`order-commands`, `matching-events`)에 `symbol`을 파티션 키로 지정하여 스트리밍하도록 변경한다.

### 4. Matching Engine (engine-core & db-persister)
* [MODIFY] [DbPersisterRunner.java](file:///home/administrator/exchange_be/adapter-kafka/src/main/java/exchange/kafka/db/DbPersisterRunner.java):
  수수료 캐시 로딩 쿼리를 `SELECT symbol, fee_rate FROM market_fees`에서 `SELECT symbol, fee_rate FROM markets`로 수정한다.
* **동적 엔진 풀(MatchingEnginePool) 도입**: 심볼당 1개의 도커 컨테이너를 정적으로 띄우는 배포 구조를 개선한다. 단일 엔진 프로세스 내에서 DB의 활성 마켓 정보를 주기적으로 조회하거나 Redis Pub/Sub 알림을 통해 개별 매칭 엔진 스레드를 실시간으로 추가/종료할 수 있도록 아키텍처를 개편한다.

---

## Verification Plan

### Automated Tests
* DB 신규 마켓 추가 및 수수료 변경 API 단위 테스트
* 지갑 동시 자동 생성 로직 동기화 정합성 테스트

### Manual Verification
* 어드민 콘솔에서 신규 마켓 `ETH-USDT` 상장 등록 후 무중단으로 유저 화면 노출 및 체결 정상 동작 여부 최종 검증
