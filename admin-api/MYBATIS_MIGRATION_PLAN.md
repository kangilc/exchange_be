# 🛠️ `admin-api` 복잡한 쿼리 MyBatis 마이그레이션 계획

현재 `admin-api`의 JPA Repository 들에는 통계나 조인(Join)을 필요로 하는 복잡한 쿼리들이 `@Query(nativeQuery = true)` 형태로 하드코딩되어 있습니다. 사용자가 정의한 아키텍처 원칙 **"일반적인 CRUD는 JPA, 복잡한 쿼리는 MyBatis Dao를 사용"**을 준수하기 위해 테스트 구축 전에 MyBatis 마이그레이션을 우선 진행합니다.

## ⚠️ User Review Required

> [!WARNING]
> 본 작업은 기존 JPA 리포지토리의 인터페이스 서명(Signature)과 반환 타입(Projection 등)을 MyBatis 기반 모델로 뜯어고쳐야 하므로, 이를 참조하고 있는 `Service` 계층까지 영향을 미칩니다. 진행하시겠습니까?

---

## 🛠️ Proposed Changes

### 1. MyBatis 의존성 추가
현재 `build.gradle`에 누락된 MyBatis 스타터를 추가합니다.

#### [MODIFY] [build.gradle](file:///d:/exchange_be/admin-api/build.gradle)
- `org.mybatis.spring.boot:mybatis-spring-boot-starter:3.0.3` 추가
- `application.yml`에 mybatis mapper 위치(`classpath:mapper/**/*.xml`) 설정 추가

### 2. 패키지 및 XML Mapper 생성
JPA에 있던 복잡한 쿼리들을 전용 Dao 인터페이스와 XML Mapper로 추출합니다.

#### [NEW] `exchange.admin.dao.StatsDao` 및 `mapper/StatsMapper.xml`
- `UserRepository.getUserStats()` ➔ `StatsDao.getUserStats()`
- `LedgerJournalRepository.getLedgerStats()` ➔ `StatsDao.getLedgerStats()`
- `TradeRepository.getTradeStats()` ➔ `StatsDao.getTradeStats()`
- `TradeRepository.getTotalVolumeUsd()` ➔ `StatsDao.getTotalVolumeUsd()`

#### [NEW] `exchange.admin.dao.TradeDao` 및 `mapper/TradeMapper.xml`
- `TradeRepository.findAllDetailedTrades()` (JOIN, 페이징 쿼리)
- `TradeRepository.findLatestBefore()` 등 복잡한 조건부 조회

#### [NEW] `exchange.admin.dao.LedgerDao` 및 `mapper/LedgerMapper.xml`
- `LedgerJournalRepository.findAllDetailedLedgers()`
- `LedgerJournalRepository.findDetailedLedgersByUserId()`

### 3. JPA Repository 축소 및 Service 리팩토링
MyBatis로 쿼리를 옮긴 후 남은 JPA 인터페이스를 단순화하고, 서비스를 수정합니다.

#### [MODIFY] `LedgerJournalRepository.java`, `TradeRepository.java`, `UserRepository.java`
- `@Query(nativeQuery = true)`와 연관된 `Projection` 인터페이스를 모두 **삭제**하고 순수 엔티티 CRUD 기능만 남깁니다.

#### [MODIFY] `StatsService.java`, `MarketService.java`, `UserService.java`
- 기존 Repository 호출 부분을 새로 생성한 `Dao` 의존성 주입으로 교체합니다.

---

## 🧪 Verification Plan

### Manual Verification
- `admin-api` 서버를 로컬에서 구동하여 스프링 빈(Bean) 등록 에러나 MyBatis 파싱 에러가 발생하지 않는지 확인합니다.
- 기존과 동일하게 빌드 에러 없이 컴파일되는지 점검합니다.
