# 주문 생성기 (Order Generator)

실시간 가상 거래 매수/매도 주문을 생성하여 매칭 엔진(Matching Engine)에 주입하는 부하 테스트 및 시뮬레이션 데몬.

## 주요 기능

- BTC(소수점 8자리), ADA(소수점 4자리), JAF(KRW: 소수점 4자리, USD: 소수점 8자리) 스케일 자동 변환 지원.
- 현실적인 가격 변동폭(달러/원 단위 정수 틱) 및 소수점 단위 정밀 수량 생성.
- 커넥션 초기 시 호가창 두께 유지를 위한 대규모 시드북(Seed Book) 자동 주입.
- 커맨드라인 아규먼트를 통한 주문 발생 속도(ms) 동적 제어.

## 실행 방법 및 속도 조절

프로그램 실행 시 아규먼트로 최소 대기시간(ms)과 최대 대기시간(ms)을 넘겨서 주문 속도를 조절할 수 있음.

```bash
# 빠른 속도로 주문 생성 (10ms ~ 30ms 간격)
java exchange.generator.OrderGenerator 10 30

# 느린 속도로 주문 생성 (1000ms 간격 고정)
java exchange.generator.OrderGenerator 1000 1000
```

아규먼트를 생략할 경우 상위 디렉토리의 `.env.dev` 파일에 정의된 다음 변수를 기본값으로 사용함.
- `GENERATOR_SLEEP_MIN` (기본값: 50)
- `GENERATOR_SLEEP_MAX` (기본값: 250)

## 환경 변수 설정

상위 폴더의 `.env.dev` 또는 `.env.prod` 파일에서 다음 항목을 설정하여 엔진 포트와 한계치를 제어함.

- `ENGINE_HOST`: BTC 매칭 엔진 호스트 (기본값: localhost)
- `COMMAND_PORT`: BTC 주문 수신 포트 (기본값: 9999)
- `ADA_ENGINE_HOST`: ADA 매칭 엔진 호스트 (기본값: localhost)
- `ADA_COMMAND_PORT`: ADA 주문 수신 포트 (기본값: 9997)
- `JAF_KRW_ENGINE_HOST`: JAF-KRW 매칭 엔진 호스트 (기본값: localhost)
- `JAF_KRW_COMMAND_PORT`: JAF-KRW 주문 수신 포트 (기본값: 9995)
- `JAF_USD_ENGINE_HOST`: JAF-USD 매칭 엔진 호스트 (기본값: localhost)
- `JAF_USD_COMMAND_PORT`: JAF-USD 주문 수신 포트 (기본값: 9994)
- `MAX_ORDERS`: 주입할 최대 누적 주문 수 (기본값: 무제한)
