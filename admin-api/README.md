# JavaF 거래소 관리자 API 서비스 (admin-api)

Spring Boot 3 및 Spring Data JPA 기반의 거래소 통합 관리 및 어드민 비즈니스 로직 제공 REST API 서버. 

---

## 🔍 6. Elasticsearch 기반 고성능 회원 검색 및 자동완성 시스템

회원 이메일 검색 시 DB 부하 및 LIKE 검색 성능 저하를 방지하기 위해 Elasticsearch 8.12.2를 도입하여 역색인 구조의 검색 및 자동완성 기능을 제공한다.

### 🔄 데이터 동기화 아키텍처 및 흐름

#### 1) 초기 벌크 동기화 흐름 (Application Startup)
local 또는 dev 환경에서 애플리케이션 시작 시 DB에 보존된 유저 데이터를 Elasticsearch에 동기화하여 인덱스 공백 상태를 방지한다.

`mermaid
sequenceDiagram
    participant App as Spring Boot Application
    participant Init as ElasticsearchIndexInitializer
    participant DB as PostgreSQL (UserRepository)
    participant ES as Elasticsearch (UserSearchRepository)

    App->>Init: run() 실행 (CommandLineRunner)
    Init->>DB: findAll() 회원 전체 스캔
    DB-->>Init: List<User> 반환
    Init->>Init: UserDocument 리스트로 변환 (데이터 가공)
    Init->>ES: saveAll(docs) 벌크 색인 요청
    ES-->>Init: 색인 완료
    Note over Init: 메서드 종료 시 가공에 쓰인 임시 List 메모리(GC 대상) 해제
`

#### 2) 실시간 변경사항 비동기 반영 흐름 (CUD Event)
회원 데이터 변경(가입 승인, 상태 수정, 삭제 등) 발생 시 데이터 일관성을 맞추기 위해 트랜잭션이 성공적으로 커밋된 시점에 비동기로 ES 인덱스를 동기화한다.

`mermaid
sequenceDiagram
    participant Client as Client/Admin Console
    participant Service as UserService (Transaction)
    participant DB as PostgreSQL
    participant Listener as UserEntityListener (JPA Callback)
    participant Event as Spring eventPublisher
    participant Handler as UserIndexEventListener (@Async)
    participant ES as Elasticsearch

    Client->>Service: 회원 상태 수정 요청 (CUD)
    activate Service
    Service->>DB: JPA Entity 수정 완료
    Service->>DB: Transaction Commit 시도
    activate DB
    DB-->>Service: Commit 완료
    deactivate DB
    
    Note over Listener: JPA 라이프사이클 이벤트 가로챔 (@PostUpdate)
    Listener->>Event: UserIndexedEvent 발행 (Spring Event)
    
    Service-->>Client: API 성공 응답 반환
    deactivate Service

    Note over Handler: 트랜잭션 커밋 완료 후 별도 스레드에서 수신 (@TransactionalEventListener & @Async)
    Handler->>ES: save() or deleteById() 인덱스 갱신 요청
    ES-->>Handler: 반영 완료
`

### 💡 주요 아키텍처 설계 특징
* **비동기 격리 (@Async)**: Elasticsearch 색인 요청 중 네트워크 지연이 발생하더라도, 관리자 API 응답 속도에는 전혀 영향을 미치지 않는다.
* **트랜잭션 일관성 보장 (@TransactionalEventListener)**: DB 트랜잭션이 최종 커밋(AFTER_COMMIT)된 경우에만 ES 색인을 시도한다. DB 트랜잭션 롤백 시 ES 동기화 요청도 함께 취소되어 불일치를 예방한다.
* **에러 전파 차단**: ES 서버 통신 에러가 발생해도 예외를 내부 catch하여 로그를 남기고 종료하므로, 이미 성공적으로 커밋된 DB 트랜잭션과 비즈니스 로직을 보호한다.

* **동작 흐름**:
  1. **초기 동기화**: ElasticsearchIndexInitializer가 애플리케이션 구동 시 DB의 전체 유저 데이터를 읽어 Elasticsearch 인덱스에 벌크 색인한다 (local, dev 프로파일 적용).
  2. **실시간 감지**: JPA 엔티티 이벤트 리스너인 UserEntityListener가 회원 등록, 수정, 삭제 상태를 감지하여 UserIndexedEvent를 발행한다.
  3. **비동기 인덱싱**: UserIndexEventListener가 트랜잭션 커밋 완료(AFTER_COMMIT) 시점에 이벤트를 수신하여 비동기(@Async)로 Elasticsearch 인덱스를 동기화한다.
  4. **검색 및 자동완성 API**:
     - GET /admin/users/search: 이메일 키워드에 해당하는 회원을 검색한다 (edge_ngram 분석기를 사용한 Match Query 적용).
     - GET /admin/users/autocomplete: 입력된 문자열로 시작하는 최대 10개의 이메일 제안 목록을 검색한다.

* **검색 엔티티 추가 가이드**:
  새로운 엔티티 필드를 검색 기능에 포함시키거나 신규 검색 인덱스를 구성하려면 아래 단계를 수행한다.
  1. **도큐먼트 클래스 정의**: exchange.admin.document 패키지에 @Document(indexName = "인덱스명")을 사용한 도큐먼트 클래스를 추가한다. 필요한 경우 형태소 분석 및 자동완성을 위해 @Setting(settingPath = "elasticsearch/settings.json") 및 @Field 어노테이션에 분석기를 매핑한다.
  2. **레포지토리 생성**: exchange.admin.repository.es 패키지에 ElasticsearchRepository를 상속하는 인터페이스를 생성한다.
  3. **엔티티 이벤트 연계**:
     - 대상 JPA 엔티티 클래스에 @EntityListeners를 지정하여 저장/수정/삭제 콜백 메서드에서 이벤트를 발행한다.
     - 트랜잭션 커밋 완료 후 색인 부하를 격리하기 위해 @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)와 @Async를 활용하여 비동기로 Elasticsearch 레포지토리에 데이터를 변경 저장/삭제한다.
  4. **초기 벌크 적재 설정**: ElasticsearchIndexInitializer에 새 도큐먼트에 대한 벌크 저장 로직을 통합하여 로컬/개발 서버 구동 시 전체 DB 데이터가 자동으로 색인 동기화되도록 한다.

\n\n## 🔍 6. Elasticsearch 기반 고성능 회원 검색 및 자동완성 시스템

회원 이메일 검색 시 DB 부하 및 LIKE 검색 성능 저하를 방지하기 위해 Elasticsearch 8.12.2를 도입하여 역색인 구조의 검색 및 자동완성 기능을 제공한다.

### 🔄 데이터 동기화 아키텍처 및 흐름

#### 1) 초기 벌크 동기화 흐름 (Application Startup)
local 또는 dev 환경에서 애플리케이션 시작 시 DB에 보존된 유저 데이터를 Elasticsearch에 동기화하여 인덱스 공백 상태를 방지한다.

`mermaid
sequenceDiagram
    participant App as Spring Boot Application
    participant Init as ElasticsearchIndexInitializer
    participant DB as PostgreSQL (UserRepository)
    participant ES as Elasticsearch (UserSearchRepository)

    App->>Init: run() 실행 (CommandLineRunner)
    Init->>DB: findAll() 회원 전체 스캔
    DB-->>Init: List<User> 반환
    Init->>Init: UserDocument 리스트로 변환 (데이터 가공)
    Init->>ES: saveAll(docs) 벌크 색인 요청
    ES-->>Init: 색인 완료
    Note over Init: 메서드 종료 시 가공에 쓰인 임시 List 메모리(GC 대상) 해제
`

#### 2) 실시간 변경사항 비동기 반영 흐름 (CUD Event)
회원 데이터 변경(가입 승인, 상태 수정, 삭제 등) 발생 시 데이터 일관성을 맞추기 위해 트랜잭션이 성공적으로 커밋된 시점에 비동기로 ES 인덱스를 동기화한다.

`mermaid
sequenceDiagram
    participant Client as Client/Admin Console
    participant Service as UserService (Transaction)
    participant DB as PostgreSQL
    participant Listener as UserEntityListener (JPA Callback)
    participant Event as Spring eventPublisher
    participant Handler as UserIndexEventListener (@Async)
    participant ES as Elasticsearch

    Client->>Service: 회원 상태 수정 요청 (CUD)
    activate Service
    Service->>DB: JPA Entity 수정 완료
    Service->>DB: Transaction Commit 시도
    activate DB
    DB-->>Service: Commit 완료
    deactivate DB
    
    Note over Listener: JPA 라이프사이클 이벤트 가로챔 (@PostUpdate)
    Listener->>Event: UserIndexedEvent 발행 (Spring Event)
    
    Service-->>Client: API 성공 응답 반환
    deactivate Service

    Note over Handler: 트랜잭션 커밋 완료 후 별도 스레드에서 수신 (@TransactionalEventListener & @Async)
    Handler->>ES: save() or deleteById() 인덱스 갱신 요청
    ES-->>Handler: 반영 완료
`

### 💡 주요 아키텍처 설계 특징
* **비동기 격리 (@Async)**: Elasticsearch 색인 요청 중 네트워크 지연이 발생하더라도, 관리자 API 응답 속도에는 전혀 영향을 미치지 않는다.
* **트랜잭션 일관성 보장 (@TransactionalEventListener)**: DB 트랜잭션이 최종 커밋(AFTER_COMMIT)된 경우에만 ES 색인을 시도한다. DB 트랜잭션 롤백 시 ES 동기화 요청도 함께 취소되어 불일치를 예방한다.
* **에러 전파 차단**: ES 서버 통신 에러가 발생해도 예외를 내부 catch하여 로그를 남기고 종료하므로, 이미 성공적으로 커밋된 DB 트랜잭션과 비즈니스 로직을 보호한다.

* **동작 흐름**:
  1. **초기 동기화**: ElasticsearchIndexInitializer가 애플리케이션 구동 시 DB의 전체 유저 데이터를 읽어 Elasticsearch 인덱스에 벌크 색인한다 (local, dev 프로파일 적용).
  2. **실시간 감지**: JPA 엔티티 이벤트 리스너인 UserEntityListener가 회원 등록, 수정, 삭제 상태를 감지하여 UserIndexedEvent를 발행한다.
  3. **비동기 인덱싱**: UserIndexEventListener가 트랜잭션 커밋 완료(AFTER_COMMIT) 시점에 이벤트를 수신하여 비동기(@Async)로 Elasticsearch 인덱스를 동기화한다.
  4. **검색 및 자동완성 API**:
     - GET /admin/users/search: 이메일 키워드에 해당하는 회원을 검색한다 (edge_ngram 분석기를 사용한 Match Query 적용).
     - GET /admin/users/autocomplete: 입력된 문자열로 시작하는 최대 10개의 이메일 제안 목록을 검색한다.

* **검색 엔티티 추가 가이드**:
  새로운 엔티티 필드를 검색 기능에 포함시키거나 신규 검색 인덱스를 구성하려면 아래 단계를 수행한다.
  1. **도큐먼트 클래스 정의**: exchange.admin.document 패키지에 @Document(indexName = "인덱스명")을 사용한 도큐먼트 클래스를 추가한다. 필요한 경우 형태소 분석 및 자동완성을 위해 @Setting(settingPath = "elasticsearch/settings.json") 및 @Field 어노테이션에 분석기를 매핑한다.
  2. **레포지토리 생성**: exchange.admin.repository.es 패키지에 ElasticsearchRepository를 상속하는 인터페이스를 생성한다.
  3. **엔티티 이벤트 연계**:
     - 대상 JPA 엔티티 클래스에 @EntityListeners를 지정하여 저장/수정/삭제 콜백 메서드에서 이벤트를 발행한다.
     - 트랜잭션 커밋 완료 후 색인 부하를 격리하기 위해 @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)와 @Async를 활용하여 비동기로 Elasticsearch 레포지토리에 데이터를 변경 저장/삭제한다.
  4. **초기 벌크 적재 설정**: ElasticsearchIndexInitializer에 새 도큐먼트에 대한 벌크 저장 로직을 통합하여 로컬/개발 서버 구동 시 전체 DB 데이터가 자동으로 색인 동기화되도록 한다.

\n\n## 🛠️ 7. 개발 및 배포 가이드

### 로컬 개발 환경 실행
```bash
# 로컬 빌드 및 의존성 다운로드
./gradlew build -x test

# 로컬 개발 서버 실행 (local 또는 dev 프로파일 활성화)
./gradlew bootRun --args='--spring.profiles.active=dev'
```

### 통합 테스트 실행 및 구조
- 데이터베이스 격리 및 시드 데이터 오염 방지를 위해 DDL 스키마(db/migration)와 시뮬레이션용 시드 데이터(db/seed)의 Flyway 실행 경로를 프로파일별로 분리함.
- 테스트 구동 시 DB(exchange_test)가 비어 있는 상태에서 격리 검증을 수행함.
- 검증 신뢰도와 보고서 가독성을 높이기 위해 도메인별로 8개의 테스트 클래스로 분리하고 총 45개의 세부 테스트 케이스를 구축함.
  1. `UserAccountIntegrationTest`: 회원 등록, 중복 가입 차단, 정보 수정 및 조회 검증 (8개 테스트)
  2. `UserWalletIntegrationTest`: 지갑 생성, 자산 조정, 잔고 부족 차단, 가상자산 소수점 및 대용량 연산 검증 (10개 테스트)
  3. `UserHistoryIntegrationTest`: 감사용 원장 이력 적재 및 MyBatis 연동 상세 조회 페이징 검증 (4개 테스트)
  4. `UserAuthIntegrationTest`: 로그인 자격 증명 처리, 리프레시 토큰 회전(RTR) 및 재사용 공격 차단 검증 (6개 테스트)
  5. `MarketPolicyIntegrationTest`: 수수료 변경 DB 반영, 캐시 동기화 및 마켓 이력 감사 기록 검증 (4개 테스트)
  6. `StatsServiceIntegrationTest`: 요약 지표 집계, 1초 Caffeine 캐싱 및 마이바티스 OHLCV 캔들 집계 검증 (6개 테스트)
  7. `AuthControllerTest`: 회원가입 성공/실패, 입력값 오류 및 이메일 중복 가입 신청 차단 검증 (3개 테스트)
  8. `UserControllerTest`: 어드민 회원 목록 조회 인가(ROLE_ADMIN), 가입 승인에 따른 DB 수정자(updated_by) 추적 및 자산 수동 조정 입력 검사 검증 (5개 테스트)

- **테스트 실행 방법**:
  ```bash
  export JAVA_HOME=/home/administrator/.jdks/temurin-17.0.19
  ./gradlew :admin-api:test --no-daemon
  ```

### 로컬 도커 메모리 최적화 환경
로컬 환경의 자원을 절약하기 위해 Serial GC 사용 및 힙 크기를 엄격하게 제어하여 작동시킵니다.
* **JVM 최적화 옵션**: `JAVA_OPTS=-Xms128m -Xmx256m -XX:+UseSerialGC`
* **도커 메모리 제한**: 최대 `384M`

### 도커 컨테이너 빌드 및 실행
```bash
# 어드민 API 전용 빌드 및 백그라운드 실행
docker compose up -d --build admin-api
```
