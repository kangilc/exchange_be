# 07. 인프라 구성 및 Docker Compose (Infrastructure & Setup)

본 문서는 개발, 테스트 및 데모 환경을 신속하게 구축하기 위한 전체 서비스 설정과 인프라 구성 상세를 설명합니다.

## 1. 시스템 컴포넌트 구조
전체 시스템은 다음과 같은 MSA(Microservices Architecture) 구조로 컨테이너화되어 운영됩니다.

*   **Zookeeper & Kafka:** 이벤트 스트리밍 백본.
*   **Schema Registry:** Avro 스키마 관리.
*   **Matching Engine:** 핵심 매칭 로직 처리 서버.
*   **WebSocket Gateway:** 실시간 데이터 푸시 서버 (Netty 기반).
*   **Order Generator:** 테스트 및 데모용 자동 주문 생성기.

## 2. Docker Compose 설정 (`docker-compose.yml`)
아래 설정은 모든 핵심 서비스를 한 번에 기동할 수 있는 완전한 구성을 제공합니다.

```yaml
version: "3.9"

services:
  zookeeper:
    image: confluentinc/cp-zookeeper:7.5.0
    container_name: zookeeper
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181
    ports:
      - "2181:2181"

  kafka:
    image: confluentinc/cp-kafka:7.5.0
    container_name: kafka
    depends_on:
      - zookeeper
    ports:
      - "9092:9092"
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:9092
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: PLAINTEXT:PLAINTEXT
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1

  schema-registry:
    image: confluentinc/cp-schema-registry:7.5.0
    container_name: schema-registry
    depends_on:
      - kafka
    ports:
      - "8081:8081"
    environment:
      SCHEMA_REGISTRY_HOST_NAME: schema-registry
      SCHEMA_REGISTRY_KAFKASTORE_BOOTSTRAP_SERVERS: PLAINTEXT://kafka:9092

  engine:
    build: ./engine-core
    container_name: matching-engine
    depends_on:
      - kafka
    environment:
      SYMBOL: BTC-USD
      KAFKA_BROKER: kafka:9092
      JAVA_OPTS: >
        -XX:+UseZGC
        -XX:+AlwaysPreTouch
        -XX:MaxGCPauseMillis=1
    deploy:
      resources:
        limits:
          cpus: "2"
          memory: 4g

  ws-gateway:
    build: ./adapter-ws
    container_name: ws-gateway
    depends_on:
      - kafka
    ports:
      - "8080:8080"
    environment:
      KAFKA_BROKER: kafka:9092

  order-generator:
    build: ./tools/order-generator
    container_name: order-generator
    depends_on:
      - engine
    environment:
      SYMBOL: BTC-USD
    restart: unless-stopped
```

## 3. 서비스별 역할 상세
| 서비스 | 역할 | 특징 |
| :--- | :--- | :--- |
| **zookeeper** | Kafka 메타데이터 및 클러스터 관리 | 고가용성 구성의 핵심 |
| **kafka** | 이벤트 메시지 브로커 | 초당 수십만 건의 이벤트 스트림 처리 |
| **schema-registry** | Avro/Protobuf 스키마 버전 관리 | 데이터 정합성 및 호환성 보장 |
| **engine** | 단일 스레드 매칭 엔진 | ZGC 및 메모리 최적화 옵션 적용 |
| **ws-gateway** | 바이너리 WebSocket 푸시 | Netty 기반 Non-blocking IO 처리 |
| **order-generator** | 부하 테스트 및 데모 데이터 생성 | 실제 거래소 시뮬레이션 |

## 4. 환경 변수 및 볼륨 관리
*   `.env` 파일을 통해 `SYMBOL`, `KAFKA_BROKER` 등 핵심 설정을 중앙 관리합니다.
*   `audit-volume`을 별도로 구성하여 감사 로그(CSV/PDF) 및 매칭 엔진 스냅샷 데이터를 컨테이너 외부로 영속화합니다.

## 5. 실행 및 검증
```bash
# 전체 서비스 빌드 및 실행
docker compose up --build -d

# 실행 상태 확인
docker compose ps

# Kafka 토픽 생성 확인
docker exec -it kafka kafka-topics --list --bootstrap-server kafka:9092
```

## 6. 개발 ↔ 운영 전환 전략
*   **개발(Dev):** Docker Compose를 활용한 빠른 기동 및 데이터 초기화 허용.
*   **운영(Ops):** Kubernetes(Helm/Argo CD)를 통해 심볼별 엔진 배포, HPA를 통한 WS 게이트웨이 확장, 영속 볼륨(S3/EBS) 기반 데이터 보존.
