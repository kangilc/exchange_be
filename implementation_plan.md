# 동적 마켓 온보딩 및 메타데이터 기반 아키텍처 구현 계획서 (Dynamic Market Onboarding)

신규 코인 및 거래쌍(마켓) 추가 시, 기존 하드코딩된 정적 구조를 탈피하고 어드민 콘솔에서 무중단으로 상장 및 가동이 가능하도록 하는 **동적 마켓 온보딩 및 메타데이터 기반 아키텍처(Dynamic Market Onboarding)**를 구축하는 계획이다.

---

## Proposed Changes

### 1. Database Schema
* **`markets` 테이블 추가**: 상장된 마켓 메타데이터 정보(심볼, Base/Quote 통화, 소수점 자리수, 활성 상태 등)를 통합 관리한다.
* **지갑 동적 생성 지원**: 지갑이 필요해지는 시점에 지갑 레코드를 자동 생성할 수 있도록 `INSERT ... ON CONFLICT DO NOTHING` 처리를 강화한다.

### 2. User & Admin Frontend (UI)
* **API 기반 동적 렌더링**: 프론트엔드의 하드코딩된 마켓 리스트를 제거하고, 백엔드의 `/api/markets` API 호출 결과를 기반으로 거래 탭, 호가창(Order Book), 주문 콘솔, 차트를 동적으로 렌더링한다.

### 3. Backend (admin-api)
* **마켓 관리 API**: 신규 마켓 추가 및 상장 상태 제어 REST API를 개발한다.
* **Lazy Wallet Initialization**: 입금 요청 및 체결 완료 처리 시 지갑 미존재 시 자동 생성하는 공통 유틸리티를 적용한다.
* **카프카 라우팅 단일화**: 마켓별 토픽 대신 단일 토픽(`order-commands`, `matching-events`)에 `symbol`을 파티션 키로 지정하여 스트리밍하도록 변경한다.

### 4. Matching Engine (engine-core)
* **동적 엔진 풀(MatchingEnginePool) 도입**: 심볼당 1개의 도커 컨테이너를 정적으로 띄우는 배포 구조를 개선한다. 단일 엔진 프로세스 내에서 DB의 활성 마켓 정보를 주기적으로 조회하거나 Redis Pub/Sub 알림을 통해 개별 매칭 엔진 스레드를 실시간으로 추가/종료할 수 있도록 아키텍처를 개편한다.

---

## Verification Plan

### Automated Tests
* DB 신규 마켓 추가 및 상태 변경 API 단위 테스트
* 지갑 동시 자동 생성 로직 동기화 정합성 테스트

### Manual Verification
* 어드민 콘솔에서 신규 마켓 `ETH-USDT` 상장 등록 후 무중단으로 유저 화면 노출 및 체결 정상 동작 여부 최종 검증
