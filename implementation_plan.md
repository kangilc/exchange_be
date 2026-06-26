# DB VARCHAR 유지 및 애플리케이션 Enum 통합 구현 계획서

데이터베이스의 DDL 유지보수 유연성을 높이기 위해 컬럼은 일반 `VARCHAR` 문자열 방식을 유지하되, 애플리케이션 개발 생산성 및 타입 정합성을 보장받을 수 있도록 백엔드(Java Enum) 및 프론트엔드(TypeScript) 레이어에서만 ENUM 통합 및 OpenAPI 타입 자동 생성 파이프라인을 구축합니다.

## User Review Required

> [!NOTE]
> * **DB 컬럼 스펙 보존**: PostgreSQL의 `VARCHAR` 컬럼 스펙을 그대로 보존하므로, 위험 부담이 큰 DB 레벨의 ENUM DDL 변환 처리를 완전히 배제합니다.
> * **JPA 매핑**: JPA 엔티티 필드를 `String`에서 `Enum` 타입으로 안전하게 교체하고 `@Enumerated(EnumType.STRING)`을 지정하여 DB 저장 시 문자열로 처리하도록 유도합니다.
> * **MyBatis 매핑**: MyBatis 글로벌 설정 파일에 `default-enum-type-handler=org.apache.ibatis.type.EnumTypeHandler`를 등록하여 자바 Enum 객체가 쿼리 결과 문자열과 정상적으로 자동 바인딩되도록 조치합니다.

## Proposed Changes

### 1. Database Schema & Migration (admin-api)

#### [NEW] [V3__add_common_codes.sql](file:///d:/exchange_be/admin-api/src/main/resources/db/migration/V3__add_common_codes.sql)
* 데이터베이스의 기존 테이블 구조(VARCHAR)는 그대로 유지합니다.
* 공통 코드를 동적으로 저장/조회하기 위한 공통 코드 테이블 DDL 및 초기 데이터를 추가합니다.
  ```sql
  CREATE TABLE code_groups (
      group_code VARCHAR(50) PRIMARY KEY,
      group_name VARCHAR(100) NOT NULL
  );

  CREATE TABLE common_codes (
      group_code VARCHAR(50) REFERENCES code_groups(group_code) ON DELETE CASCADE,
      code_value VARCHAR(50) NOT NULL,
      code_name VARCHAR(100) NOT NULL,
      display_order INT DEFAULT 1,
      is_active BOOLEAN DEFAULT TRUE,
      PRIMARY KEY (group_code, code_value)
  );

  -- 기초 코드 데이터 주입 (예: 자산 국문 명칭, 전표 유형 한글 라벨 등)
  INSERT INTO code_groups VALUES ('CURRENCY_DESC', '지원 자산 국문 설명');
  INSERT INTO common_codes VALUES ('CURRENCY_DESC', 'KRW', '원화', 1, true);
  INSERT INTO common_codes VALUES ('CURRENCY_DESC', 'BTC', '비트코인', 2, true);
  ```

### 2. Backend Java Refactoring (admin-api & adapter-kafka)

#### [NEW] [Enums (공통 상수 도메인 정의)](file:///d:/exchange_be/admin-api/src/main/java/exchange/admin/model/constant/)
* `OrderStatus`, `UserRole`, `UserGrade`, `LedgerType`, `WithdrawalStatus`, `MarketStatus` 자바 Enum 클래스를 생성합니다.

#### [MODIFY] [User.java](file:///d:/exchange_be/admin-api/src/main/java/exchange/admin/model/User.java)
* 필드 `role`과 `grade`를 문자열에서 `UserRole`, `UserGrade` Enum 타입으로 각각 수정하고 `@Enumerated(EnumType.STRING)`을 지정합니다.

#### [MODIFY] [CustomUserDetailsService.java](file:///d:/exchange_be/admin-api/src/main/java/exchange/admin/security/CustomUserDetailsService.java)
* 문자열 대신 Enum 상수 비교 방식으로 SYSTEM 계정 외부 로그인 차단 비즈니스 로직을 변경합니다.

#### [MODIFY] [application.properties (또는 application.yml)](file:///d:/exchange_be/admin-api/src/main/resources/application.properties)
* MyBatis 연동 호환을 위한 설정 항목 추가:
  ```properties
  mybatis.configuration.default-enum-type-handler=org.apache.ibatis.type.EnumTypeHandler
  ```

### 3. Frontend Types Auto-Generation (TypeScript)

#### [MODIFY] [package.json (frontend-admin 및 frontend-user)](file:///d:/exchange_be/frontend-admin/package.json)
* OpenAPI 기반 스키마 변환 라이브러리(`openapi-typescript` 등)를 의존성에 추가하고, 백엔드의 OpenAPI JSON 엔드포인트를 호출하여 자동으로 TypeScript 타입 정의 파일을 생성하는 스크립트를 정의합니다.
  ```json
  "scripts": {
    "generate-api": "openapi-typescript http://localhost:8088/v3/api-docs -o src/api/types.ts"
  }
  ```

---

## Verification Plan

### Automated Tests
* `./gradlew.bat :adapter-kafka:test`를 기동하여 변경 후에도 테스트가 모두 차질 없이 작동하는지 최종 테스트를 거칩니다.

### Manual Verification
* `admin-api` 서버 기동 후 `GET http://localhost:8088/v3/api-docs`를 확인하여 API 문서 스펙에 Enum 정보가 문자열 기반 스키마로 명세되어 출력되는지 검사합니다.
* 프론트엔드 모듈 경로에서 `npm run generate-api` 스크립트를 수행하여 `src/api/types.ts` 파일이 정상적으로 동적 생성되는지 검증합니다.
