# 03. 시스템 설계 (System Design)

본 문서는 고성능 및 고가용성을 목표로 하는 거래소의 기술적 아키텍처를 정의합니다. 상세한 기술 구현은 하위 심층 분석 문서를 참조하십시오.

## 1. 시스템 아키텍처 (Architecture)
*   **이벤트 소싱 모델 (Event Sourcing):** [상세 보기 (06)](./06_Kafka_Event_Sourcing_Deep_Dive.md)
    *   모든 요청을 '이벤트'로 간주하여 Kafka와 같은 메시지 브로커에 순차 저장합니다.
    *   매칭 엔진은 이 이벤트를 순서대로 소비하여 상태를 변경하며, 출력 역시 결정론적(Deterministic)으로 생성합니다.
*   **마이크로서비스 구조:**
    *   **Matching Engine:** 핵심 비즈니스 로직(매칭) 수행. [상세 보기 (05)](./05_Matching_Engine_Deep_Dive.md)
    *   **WebSocket Gateway:** Kafka 이벤트를 바이너리로 변환하여 클라이언트에 푸시. [상세 보기 (09)](./09_WebSocket_WebGL_Tech_Detail.md)
    *   **Infrastructure:** 인프라 전체 구성 및 Docker 설정. [상세 보기 (07)](./07_Infrastructure_Docker_Compose.md)

## 2. 핵심 컴포넌트 설계
*   **매칭 엔진 (Matching Engine):**
    *   **Single-Threaded Loop:** 경합을 피하기 위해 종목별 단일 스레드에서 순차 처리.
    *   **In-Memory Orderbook:** `TreeMap`과 `ArrayDeque`를 사용하여 가격/시간 우선순위 보장.
*   **메시지 브로커 (Kafka):**
    *   **Partitioning Strategy:** `symbol` 기반 파티셔닝으로 종목 내 순서 보장.
    *   **Avro Schema:** 정형화된 데이터 구조와 스키마 진화(Evolution) 지원.

## 3. 통신 프로토콜
*   **Internal:** gRPC 및 Kafka를 통한 고속 비동기 통신.
*   **External (User):** 
    *   REST API: 일반적인 주문 접수 및 계정 관리.
    *   WebSocket (Binary/SBE): 초저지연 호가 및 체결 데이터 푸시.

## 4. 재해 복구 및 정합성
*   **Sequence Number:** 모든 이벤트에 부여된 일련번호를 통해 중복 방지 및 누락 탐지.
*   **Snapshotting:** 주기적으로 매칭 엔진의 메모리 상태를 저장하여 복구 시간(RTO) 단축.
*   **Idempotency:** 동일한 이벤트 재처리가 시스템 상태에 영향을 주지 않도록 설계.
